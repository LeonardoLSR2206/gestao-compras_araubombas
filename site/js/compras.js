/** Regras de consulta e cálculo. Sem acesso à tela ou ao servidor. */
export function hoje() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const valor = tipo => partes.find(parte => parte.type === tipo).value;
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function somarDias(data, quantidade) {
    const resultado = new Date(data + 'T00:00:00Z');
    resultado.setUTCDate(resultado.getUTCDate() + quantidade);
    return resultado.toISOString().slice(0, 10);
}

export function moeda(centavos) {
    return (centavos / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

export function dataFormatada(data) {
    return data ? data.split('-').reverse().join('/') : '—';
}

export function pendentes(compra) {
    return compra.parts.filter(pagamento => !pagamento.paid);
}

export function parcelasRestantes(compra) {
    return pendentes(compra).filter(pagamento => pagamento.kind !== 'entry').length;
}

export function proximoVencimento(compra) {
    return pendentes(compra).map(pagamento => pagamento.due).sort()[0] || null;
}

export function somaPagamentos(compra) {
    return compra.parts.reduce((total, pagamento) => total + pagamento.amount, 0);
}

export function situacaoPagamento(pagamento, prazo = 7, referencia = hoje()) {
    if (pagamento.paid) return 'paga';
    if (pagamento.due < referencia) return 'vencida';
    if (pagamento.due === referencia) return 'hoje';
    if (pagamento.due <= somarDias(referencia, prazo)) return 'breve';
    return 'futura';
}

export function situacaoCompra(compra, prazo = 7, referencia = hoje()) {
    const abertos = pendentes(compra);
    if (!abertos.length) return 'paga';
    // Na etiqueta da compra, a situação mais urgente tem prioridade.
    for (const situacao of ['vencida', 'hoje', 'breve', 'futura']) {
        if (abertos.some(item => situacaoPagamento(item, prazo, referencia) === situacao)) return situacao;
    }
}

export function correspondeSituacao(compra, filtro, prazo = 7, referencia = hoje()) {
    if (filtro === 'todas') return true;
    if (filtro === 'paga') return pendentes(compra).length === 0;
    if (filtro === 'conferir') return somaPagamentos(compra) !== compra.total;
    // Uma compra pode ter parcela vencida e outra vencendo em breve.
    return pendentes(compra).some(item => {
        if (filtro === 'futura') return item.due > referencia;
        return situacaoPagamento(item, prazo, referencia) === filtro;
    });
}

export function ordenarCompras(compras, criterio, direcao = 'asc') {
    const valor = {
        total: compra => compra.total,
        issued: compra => compra.issued,
        due: proximoVencimento,
        remaining: parcelasRestantes,
        supplier: compra => compra.supplier.toLocaleLowerCase('pt-BR'),
        responsible: compra => (compra.responsible || '').toLocaleLowerCase('pt-BR')
    }[criterio] || proximoVencimento;
    const sentido = direcao === 'desc' ? -1 : 1;
    return [...compras].sort((a, b) => {
        const primeiro = valor(a), segundo = valor(b);
        // Quitadas não possuem vencimento: ficam por último nos dois sentidos.
        if (primeiro === null) return segundo === null ? a.code.localeCompare(b.code) : 1;
        if (segundo === null) return -1;
        const comparacao = typeof primeiro === 'number'
            ? primeiro - segundo : primeiro.localeCompare(segundo, 'pt-BR');
        return comparacao * sentido || a.code.localeCompare(b.code, 'pt-BR', {numeric: true});
    });
}

export function gerarPagamentos(emissao, total, entrada, condicao) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(emissao) || isNaN(Date.parse(emissao + 'T00:00:00Z'))
        || new Date(emissao + 'T00:00:00Z').toISOString().slice(0, 10) !== emissao) {
        throw new Error('Informe uma data de emissão válida.');
    }
    if (!Number.isSafeInteger(total) || total <= 0) throw new Error('Informe o valor total.');
    if (!Number.isSafeInteger(entrada) || entrada < 0 || entrada > total) {
        throw new Error('A entrada deve estar entre zero e o total.');
    }
    const pagamentos = [];
    if (entrada > 0) pagamentos.push({id: crypto.randomUUID(), kind: 'entry', due: emissao, amount: entrada, paid: null});
    const saldo = total - entrada;
    if (!saldo) return pagamentos;
    if (!/^\d+(\s*\/\s*\d+)*$/.test(condicao.trim())) throw new Error('Use prazos como 30/60 ou 15/30/45.');
    const prazos = condicao.split('/').map(Number);
    if (prazos.length > 60 || saldo < prazos.length || prazos.some((dias, i) => dias > 3650 || (i > 0 && dias <= prazos[i - 1]))) {
        throw new Error('Use até 60 prazos crescentes entre 0 e 3650 dias. Cada parcela deve ter pelo menos R$ 0,01.');
    }
    prazos.forEach((dias, indice) => {
        pagamentos.push({
            id: crypto.randomUUID(), kind: 'installment', due: somarDias(emissao, dias),
            amount: Math.floor(saldo / prazos.length) + (indice < saldo % prazos.length ? 1 : 0), paid: null
        });
    });
    return pagamentos;
}