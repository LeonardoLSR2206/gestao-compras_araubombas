/** Cadastro e edição. Recebe uma cópia para não alterar a compra antes de salvar. */
import {gerarPagamentos, hoje, moeda, somaPagamentos} from './compras.js';
import {selecionar, escapar} from './tela.js';

let compraEmEdicao = null;
let aoSalvar;
const formulario = selecionar('#formulario-compra');
const campo = nome => formulario.elements.namedItem(nome);
const centavos = nome => Math.round(Number(campo(nome).value) * 100);

export function abrirCadastro(compra, salvar) {
    aoSalvar = salvar;
    compraEmEdicao = compra ? JSON.parse(JSON.stringify(compra)) : {
        id: crypto.randomUUID(), code: '', supplier: '', responsible: '', issued: hoje(),
        total: 0, downPayment: 0, terms: '30/60', notes: '', parts: []
    };
    selecionar('#titulo-cadastro').textContent = compra ? 'Editar compra' : 'Nova compra';
    for (const nome of ['code', 'supplier', 'responsible', 'issued', 'terms', 'notes']) {
        campo(nome).value = compraEmEdicao[nome] || '';
    }
    campo('total').value = compraEmEdicao.total ? (compraEmEdicao.total / 100).toFixed(2) : '';
    campo('downPayment').value = ((compraEmEdicao.downPayment || 0) / 100).toFixed(2);
    selecionar('#erro-cadastro').textContent = '';
    renderizarPagamentos();
    selecionar('#cadastro').showModal();
}

function atualizarTotais() {
    const soma = somaPagamentos(compraEmEdicao);
    const diferenca = soma - centavos('total');
    selecionar('#saldo-parcelar').textContent = 'Saldo a parcelar: ' + moeda(centavos('total') - centavos('downPayment'));
    selecionar('#soma-parcelas').textContent = 'Soma dos pagamentos: ' + moeda(soma)
        + (diferenca ? ' · Diferença: ' + moeda(diferenca) : ' · Total conferido');
    selecionar('#soma-parcelas').classList.toggle('divergencia', diferenca !== 0);
}

function renderizarPagamentos() {
    let numero = 0;
    selecionar('#pagamentos-formulario').innerHTML = compraEmEdicao.parts.map((pagamento, indice) => {
        const entrada = pagamento.kind === 'entry';
        const titulo = entrada ? 'Entrada' : 'Parcela ' + (++numero);
        return `<div class="pagamento-editavel" data-index="${indice}">
            <strong>${titulo}${pagamento.paid ? '<small>Pagamento confirmado</small>' : ''}</strong>
            <label>Vencimento<input data-field="due" type="date" required value="${escapar(pagamento.due)}"></label>
            <label>Valor (R$)<input data-field="amount" type="number" min="0.01" step="0.01" required value="${(pagamento.amount / 100).toFixed(2)}" ${entrada ? 'readonly' : ''}></label>
            <button type="button" class="remover" data-remove="${indice}" aria-label="Remover ${titulo}" ${pagamento.paid || entrada ? 'disabled' : ''}>×</button>
        </div>`;
    }).join('');
    atualizarTotais();
}

selecionar('#pagamentos-formulario').addEventListener('input', evento => {
    const atributo = evento.target.dataset.field;
    if (!atributo) return;
    const indice = Number(evento.target.closest('[data-index]').dataset.index);
    compraEmEdicao.parts[indice][atributo] = atributo === 'amount'
        ? Math.round(Number(evento.target.value) * 100) : evento.target.value;
    atualizarTotais();
});

selecionar('#pagamentos-formulario').addEventListener('click', evento => {
    const botao = evento.target.closest('[data-remove]');
    if (!botao || botao.disabled) return;
    compraEmEdicao.parts.splice(Number(botao.dataset.remove), 1);
    renderizarPagamentos();
});

for (const nome of ['total', 'downPayment']) campo(nome).addEventListener('input', atualizarTotais);

selecionar('#gerar-pagamentos').addEventListener('click', () => {
    try {
        if (compraEmEdicao.parts.some(item => item.paid)) throw new Error('Há pagamentos confirmados. Edite individualmente ou desfaça as baixas antes de gerar novamente.');
        // Valide antes de pedir para substituir a lista existente.
        const pagamentos = gerarPagamentos(campo('issued').value, centavos('total'), centavos('downPayment'), campo('terms').value);
        if (compraEmEdicao.parts.length && !confirm('Substituir a lista de pagamentos pela condição informada?')) return;
        compraEmEdicao.parts = pagamentos;
        selecionar('#erro-cadastro').textContent = '';
        renderizarPagamentos();
    } catch (erro) {
        selecionar('#erro-cadastro').textContent = erro.message;
    }
});

selecionar('#adicionar-parcela').addEventListener('click', () => {
    if (compraEmEdicao.parts.filter(item => item.kind !== 'entry').length >= 60) return;
    compraEmEdicao.parts.push({id: crypto.randomUUID(), kind: 'installment', amount: 0, due: hoje(), paid: null});
    renderizarPagamentos();
});

formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const botao = formulario.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
        const compra = {...compraEmEdicao};
        for (const nome of ['code', 'supplier', 'responsible', 'issued', 'terms', 'notes']) compra[nome] = campo(nome).value.trim();
        compra.total = centavos('total');
        compra.downPayment = centavos('downPayment');
        if (!compra.responsible) throw new Error('Informe quem é o responsável pela compra.');
        if (!compra.parts.length) throw new Error('Gere os pagamentos ou adicione uma parcela.');
        if (somaPagamentos(compra) !== compra.total && !confirm('A soma dos pagamentos é diferente do total. Salvar com alerta para conferência?')) return;
        await aoSalvar(compra);
        selecionar('#cadastro').close();
    } catch (erro) {
        selecionar('#erro-cadastro').textContent = erro.message;
    } finally {
        botao.disabled = false;
    }
});