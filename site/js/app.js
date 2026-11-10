/** Coordena a tela. Cálculos, formulário e API ficam nos módulos próprios. */
import * as api from './api.js';
import {hoje, moeda, dataFormatada, pendentes, parcelasRestantes, proximoVencimento,
    somaPagamentos, situacaoPagamento, situacaoCompra, correspondeSituacao, ordenarCompras} from './compras.js';
import {selecionar, escapar, avisar, atualizarOpcoes} from './tela.js';
import {abrirCadastro} from './formulario.js';

const estado = {compras: [], tela: 'compras', situacao: 'todas', prazo: 7, selecionada: null, baixa: null};
const rotulos = {vencida: 'Vencida', hoje: 'Vence hoje', breve: 'Vence em breve', futura: 'A vencer', paga: 'Quitada'};
const etiqueta = situacao => `<span class="etiqueta ${situacao}">${rotulos[situacao]}</span>`;
const responsavel = compra => compra.responsible?.trim() || 'Não informado';

async function carregar() {
    estado.compras = await api.listarCompras();
    atualizarOpcoes(selecionar('#fornecedor'), estado.compras.map(item => item.supplier), [['', 'Todos']]);
    atualizarOpcoes(selecionar('#responsavel-filtro'), estado.compras.map(item => item.responsible), [['', 'Todos'], ['__sem__', 'Não informado']]);
    for (const [id, atributo] of [['lista-fornecedores', 'supplier'], ['lista-responsaveis', 'responsible']]) {
        selecionar('#' + id).innerHTML = [...new Set(estado.compras.map(item => item[atributo]).filter(Boolean))]
            .map(valor => `<option value="${escapar(valor)}"></option>`).join('');
    }
    renderizar();
}

function filtrarDados() {
    const busca = selecionar('#busca').value.trim().toLocaleLowerCase('pt-BR');
    const fornecedor = selecionar('#fornecedor').value;
    const pessoa = selecionar('#responsavel-filtro').value;
    const inicio = selecionar('#emissao-inicio').value;
    const fim = selecionar('#emissao-fim').value;
    return estado.compras.filter(compra => {
        const texto = [compra.code, compra.supplier, compra.responsible || ''].join(' ').toLocaleLowerCase('pt-BR');
        return texto.includes(busca) && (!fornecedor || compra.supplier === fornecedor)
            && (!pessoa || (pessoa === '__sem__' ? !compra.responsible?.trim() : compra.responsible === pessoa))
            && (!inicio || compra.issued >= inicio) && (!fim || compra.issued <= fim);
    });
}

function renderizarResumo(compras) {
    const pagamentos = compras.flatMap(compra => pendentes(compra));
    const grupos = [
        ['todas', 'Total em aberto', pagamentos],
        ['vencida', 'Vencidas', pagamentos.filter(item => situacaoPagamento(item, estado.prazo) === 'vencida')],
        ['hoje', 'Vence hoje', pagamentos.filter(item => situacaoPagamento(item, estado.prazo) === 'hoje')],
        ['breve', 'Vence em breve', pagamentos.filter(item => situacaoPagamento(item, estado.prazo) === 'breve')]
    ];
    selecionar('#resumo').innerHTML = grupos.map(([chave, titulo, itens]) => `<button class="cartao ${chave}" data-summary="${chave}">
        <span>${titulo}<span aria-hidden="true">↗</span></span><strong>${moeda(itens.reduce((soma, item) => soma + item.amount, 0))}</strong>
        <small>${itens.length} pagamentos ${chave === 'breve' ? 'nos próximos ' + estado.prazo + ' dias' : 'sem baixa'}</small></button>`).join('');
}

function linhaCompra(compra) {
    const proximo = proximoVencimento(compra);
    const restante = parcelasRestantes(compra);
    const entradaPendente = pendentes(compra).some(item => item.kind === 'entry');
    return `<tr><td><button class="abrir-pedido" data-open="${escapar(compra.id)}">#${escapar(compra.code)}</button></td>
        <td>${escapar(compra.supplier)}</td><td>${escapar(responsavel(compra))}</td><td>${dataFormatada(compra.issued)}</td>
        <td class="valor">${moeda(compra.total)}${somaPagamentos(compra) !== compra.total ? '<small class="divergencia">Conferir total</small>' : ''}</td>
        <td>${restante} ${restante === 1 ? 'parcela' : 'parcelas'}${entradaPendente ? '<small>+ entrada pendente</small>' : ''}</td>
        <td>${dataFormatada(proximo)}</td><td>${etiqueta(situacaoCompra(compra, estado.prazo))}</td></tr>`;
}

function renderizarAgenda(compras) {
    const criterio = selecionar('#ordenar').value;
    let linhas = compras.flatMap(compra => compra.parts.map((pagamento, indice) => ({compra, pagamento, indice})));
    linhas = linhas.filter(({pagamento}) => {
        if (estado.situacao === 'paga') return !!pagamento.paid;
        if (pagamento.paid) return false;
        if (['todas', 'conferir'].includes(estado.situacao)) return true;
        if (estado.situacao === 'futura') return pagamento.due > hoje();
        return situacaoPagamento(pagamento, estado.prazo) === estado.situacao;
    });
    // Para a agenda, o vencimento é o da linha, não o primeiro vencimento da compra.
    if (criterio === 'due') linhas.sort((a, b) => a.pagamento.due.localeCompare(b.pagamento.due) * (selecionar('#direcao').value === 'desc' ? -1 : 1));
    selecionar('#colunas').innerHTML = '<tr><th>Pedido</th><th>Fornecedor</th><th>Responsável</th><th>Pagamento</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr>';
    selecionar('#linhas').innerHTML = linhas.map(({compra, pagamento}) => {
        const numero = compra.parts.filter(item => item.kind !== 'entry').findIndex(item => item.id === pagamento.id) + 1;
        return `<tr><td><button class="abrir-pedido" data-open="${escapar(compra.id)}">#${escapar(compra.code)}</button></td>
            <td>${escapar(compra.supplier)}</td><td>${escapar(responsavel(compra))}</td>
            <td>${pagamento.kind === 'entry' ? 'Entrada' : 'Parcela ' + numero}</td><td>${dataFormatada(pagamento.due)}</td>
            <td class="valor">${moeda(pagamento.amount)}</td><td>${etiqueta(situacaoPagamento(pagamento, estado.prazo))}</td></tr>`;
    }).join('');
    return linhas.length;
}

function renderizar() {
    const base = filtrarDados();
    renderizarResumo(base);
    const filtradas = base.filter(compra => correspondeSituacao(compra, estado.situacao, estado.prazo)
        && (estado.tela !== 'quitadas' || !pendentes(compra).length));
    const compras = ordenarCompras(filtradas, selecionar('#ordenar').value, selecionar('#direcao').value);
    let quantidade = compras.length;
    if (estado.tela === 'agenda') quantidade = renderizarAgenda(compras);
    else {
        selecionar('#colunas').innerHTML = '<tr><th>Pedido</th><th>Fornecedor</th><th>Responsável</th><th>Emissão</th><th>Total</th><th>Faltam quitar</th><th>Próximo vencimento</th><th>Situação</th></tr>';
        selecionar('#linhas').innerHTML = compras.map(linhaCompra).join('');
    }
    selecionar('#vazio').hidden = quantidade > 0;
    selecionar('#contagem').textContent = quantidade + (estado.tela === 'agenda' ? ' pagamentos encontrados' : ' compras encontradas');
    selecionar('#exportar').disabled = !estado.compras.length;
    const nomes = {compras: 'Compras da oficina', agenda: 'Agenda de pagamentos', quitadas: 'Compras quitadas'};
    selecionar('#titulo').textContent = nomes[estado.tela];
    selecionar('#localizacao').textContent = nomes[estado.tela];
    selecionar('#titulo-lista').textContent = nomes[estado.tela];
    document.querySelectorAll('[data-status]').forEach(botao => {
        botao.classList.toggle('selecionada', botao.dataset.status === estado.situacao);
        botao.setAttribute('aria-pressed', String(botao.dataset.status === estado.situacao));
    });
    document.querySelectorAll('[data-view]').forEach(botao => botao.classList.toggle('ativo', botao.dataset.view === estado.tela));
}

function abrirDetalhes(id) {
    estado.selecionada = estado.compras.find(compra => compra.id === id);
    if (!estado.selecionada) return;
    const compra = estado.selecionada;
    let numero = 0;
    selecionar('#conteudo-detalhes').innerHTML = `<h2 id="titulo-detalhes">Pedido #${escapar(compra.code)}</h2>
        <p>${escapar(compra.supplier)} · Emitido em ${dataFormatada(compra.issued)}</p>
        <p class="responsavel-detalhes">Responsável: <strong>${escapar(responsavel(compra))}</strong></p>
        <div class="totais-detalhes"><div>Total da compra<strong>${moeda(compra.total)}</strong></div><div>Saldo em aberto<strong>${moeda(pendentes(compra).reduce((soma, item) => soma + item.amount, 0))}</strong></div></div>
        ${somaPagamentos(compra) !== compra.total ? `<p class="alerta-divergencia">Soma dos pagamentos: ${moeda(somaPagamentos(compra))}. Diferença: ${moeda(somaPagamentos(compra) - compra.total)}. Confira com a nota.</p>` : ''}
        <div class="observacoes"><b>Condição: ${escapar(compra.terms || 'Vencimentos informados manualmente')}</b><p>Entrada: ${moeda(compra.downPayment || 0)}. As datas abaixo são os vencimentos efetivos.</p></div>
        <h3>Entrada e parcelas</h3><div class="lista-pagamentos">${compra.parts.map((pagamento, indice) => `<div class="pagamento-detalhe"><div><b>${pagamento.kind === 'entry' ? 'Entrada' : 'Parcela ' + (++numero)} · ${moeda(pagamento.amount)}</b><small>Vencimento: ${dataFormatada(pagamento.due)}</small><small>${pagamento.paid ? 'Pago em ' + dataFormatada(pagamento.paid) : rotulos[situacaoPagamento(pagamento, estado.prazo)]}</small></div><button data-payment="${indice}" class="${pagamento.paid ? 'texto-botao' : 'secundario'}">${pagamento.paid ? 'Desfazer baixa' : 'Confirmar pagamento'}</button></div>`).join('')}</div>
        ${compra.notes ? `<div class="observacoes"><b>Observações</b><p class="preservar-linhas">${escapar(compra.notes)}</p></div>` : ''}`;
    const dialogo = selecionar('#detalhes');
    if (!dialogo.open) dialogo.showModal();
}

async function persistir(compra) {
    await api.salvarCompra(compra);
    // Atualiza primeiro em memória: uma falha posterior de rede não perde a confirmação.
    const indice = estado.compras.findIndex(item => item.id === compra.id);
    if (indice < 0) estado.compras.push(compra); else estado.compras[indice] = compra;
    renderizar();
    try { await carregar(); } catch (_) { avisar('Compra salva. Reabra a página para atualizar a consulta.'); }
}

selecionar('#nova-compra').addEventListener('click', () => abrirCadastro(null, async compra => {
    await persistir(compra); avisar('Compra cadastrada.');
}));
selecionar('#editar-compra').addEventListener('click', () => {
    selecionar('#detalhes').close();
    abrirCadastro(estado.selecionada, async compra => { await persistir(compra); avisar('Compra atualizada.'); });
});

selecionar('#conteudo-detalhes').addEventListener('click', async evento => {
    const botao = evento.target.closest('[data-payment]');
    if (!botao || botao.disabled) return;
    const indice = Number(botao.dataset.payment);
    const compra = JSON.parse(JSON.stringify(estado.selecionada));
    if (compra.parts[indice].paid) {
        if (!confirm('Desfazer a confirmação deste pagamento?')) return;
        botao.disabled = true;
        try { compra.parts[indice].paid = null; await persistir(compra); abrirDetalhes(compra.id); avisar('Baixa desfeita.'); }
        catch (erro) { alert(erro.message); } finally { botao.disabled = false; }
    } else {
        estado.baixa = {compra, indice};
        selecionar('#descricao-baixa').textContent = 'Pedido #' + compra.code + ' · ' + moeda(compra.parts[indice].amount);
        selecionar('#data-baixa').value = hoje(); selecionar('#data-baixa').max = hoje();
        selecionar('#erro-baixa').textContent = '';
        selecionar('#baixa').showModal();
    }
});

selecionar('#formulario-baixa').addEventListener('submit', async evento => {
    evento.preventDefault();
    const botao = evento.target.querySelector('[type="submit"]'); botao.disabled = true;
    try {
        const {compra, indice} = estado.baixa;
        compra.parts[indice].paid = selecionar('#data-baixa').value;
        await persistir(compra); selecionar('#baixa').close(); abrirDetalhes(compra.id); avisar('Pagamento confirmado.');
    } catch (erro) { selecionar('#erro-baixa').textContent = erro.message; }
    finally { botao.disabled = false; }
});

// Eventos delegados mantêm os botões funcionais depois de atualizar as tabelas.
document.addEventListener('click', evento => {
    const botao = evento.target.closest('button'); if (!botao) return;
    if (botao.dataset.close) selecionar('#' + botao.dataset.close).close();
    if (botao.dataset.open) abrirDetalhes(botao.dataset.open);
    if (botao.dataset.status) { if (estado.tela === 'quitadas') estado.tela = 'compras'; estado.situacao = botao.dataset.status; renderizar(); }
    if (botao.dataset.summary) { estado.tela = 'compras'; estado.situacao = botao.dataset.summary; renderizar(); }
    if (botao.dataset.view) { estado.tela = botao.dataset.view; estado.situacao = estado.tela === 'quitadas' ? 'paga' : 'todas'; renderizar(); }
});
for (const id of ['busca', 'fornecedor', 'responsavel-filtro', 'emissao-inicio', 'emissao-fim', 'ordenar', 'direcao']) {
    selecionar('#' + id).addEventListener('input', renderizar);
}
selecionar('#limpar-filtros').addEventListener('click', () => {
    for (const id of ['busca', 'fornecedor', 'responsavel-filtro', 'emissao-inicio', 'emissao-fim']) selecionar('#' + id).value = '';
    estado.situacao = estado.tela === 'quitadas' ? 'paga' : 'todas';
    selecionar('#ordenar').value = 'due'; selecionar('#direcao').value = 'asc'; renderizar();
});
selecionar('#prazo-breve').addEventListener('change', evento => {
    estado.prazo = Number(evento.target.value);
    try { localStorage.setItem('araubombas-prazo-breve', String(estado.prazo)); } catch (_) { /* preferência opcional */ }
    renderizar();
});

selecionar('#exportar').addEventListener('click', () => {
    const conteudo = JSON.stringify({exportedAt: new Date().toISOString(), purchases: estado.compras}, null, 2);
    const endereco = URL.createObjectURL(new Blob([conteudo], {type: 'application/json'}));
    const link = document.createElement('a'); link.href = endereco; link.download = 'araubombas-' + hoje() + '.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(endereco), 1000);
});
selecionar('#importar').addEventListener('click', () => selecionar('#arquivo-json').click());
selecionar('#arquivo-json').addEventListener('change', async evento => {
    const arquivo = evento.target.files[0]; if (!arquivo) return;
    const botao = selecionar('#importar'); botao.disabled = true;
    try {
        if (arquivo.size > 10 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 10 MB.');
        const dados = JSON.parse((await arquivo.text()).replace(/^\uFEFF/, ''));
        if (!Array.isArray(dados.purchases)) throw new Error('Selecione um JSON exportado pelo programa.');
        if (!confirm('Adicionar compras deste arquivo? IDs já existentes serão ignorados para preservar as alterações atuais.')) return;
        const resultado = await api.importarCompras(dados); await carregar();
        avisar(resultado.added + ' compras importadas; ' + resultado.skipped + ' já existentes foram preservadas.');
    } catch (erro) { avisar(erro.message, true); }
    finally { botao.disabled = false; evento.target.value = ''; }
});

try {
    const salvo = Number(localStorage.getItem('araubombas-prazo-breve'));
    if ([3, 7, 15, 30].includes(salvo)) estado.prazo = salvo;
} catch (_) { /* funciona mesmo sem armazenamento de preferências */ }
selecionar('#prazo-breve').value = String(estado.prazo);
carregar().catch(erro => avisar('Não foi possível carregar: ' + erro.message, true));

// Atualiza prazos se a página ficar aberta durante a virada do dia.
setInterval(renderizar, 60000);