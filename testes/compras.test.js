import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {gerarPagamentos, somarDias, situacaoPagamento, correspondeSituacao,
    ordenarCompras, parcelasRestantes, hoje} from '../site/js/compras.js';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

test('30/60 conta a partir da emissão e desconta a entrada', () => {
    const partes = gerarPagamentos('2026-10-30', 55230, 10000, '30/60');
    assert.deepEqual(partes.map(p => [p.kind, p.due, p.amount]), [
        ['entry', '2026-10-30', 10000],
        ['installment', '2026-11-29', 22615],
        ['installment', '2026-12-29', 22615]
    ]);
    assert.ok(partes.every(p => p.paid === null));
});
test('15/30/45, ano bissexto e centavos fecham exatamente', () => {
    const partes = gerarPagamentos('2024-02-14', 10000, 0, '15/30/45');
    assert.deepEqual(partes.map(p => p.due), ['2024-02-29', '2024-03-15', '2024-03-30']);
    assert.deepEqual(partes.map(p => p.amount), [3334, 3333, 3333]);
    assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
    assert.match(hoje(), /^\d{4}-\d{2}-\d{2}$/);
});
test('entrada integral e pagamento à vista', () => {
    assert.equal(gerarPagamentos('2026-01-01', 10000, 10000, '').length, 1);
    assert.equal(gerarPagamentos('2026-01-01', 10000, 0, '0')[0].due, '2026-01-01');
});
test('rejeita condição inválida, data impossível e entrada maior que total', () => {
    for (const condicao of ['30/15', '30/30', '-1', '30/', '', '3651']) {
        assert.throws(() => gerarPagamentos('2026-01-01', 10000, 0, condicao));
    }
    assert.throws(() => gerarPagamentos('2026-02-30', 10000, 0, '30'));
    assert.throws(() => gerarPagamentos('2026-01-01', 10000, 10001, '30'));
    assert.throws(() => gerarPagamentos('2026-01-01', 1, 0, '15/30'));
});
test('limites de vencida, hoje, breve, futura e paga', () => {
    const situacao = (due, paid = null) => situacaoPagamento({due, paid}, 7, '2026-11-09');
    assert.equal(situacao('2026-11-08'), 'vencida');
    assert.equal(situacao('2026-11-09'), 'hoje');
    assert.equal(situacao('2026-11-10'), 'breve');
    assert.equal(situacao('2026-11-16'), 'breve');
    assert.equal(situacao('2026-11-17'), 'futura');
    assert.equal(situacao('2026-11-08', '2026-11-08'), 'paga');
});
test('mesma compra aparece em vencidas e em breve quando possui ambas', () => {
    const compra = {parts: [{due: '2026-11-08'}, {due: '2026-11-12'}]};
    assert.equal(correspondeSituacao(compra, 'vencida', 7, '2026-11-09'), true);
    assert.equal(correspondeSituacao(compra, 'breve', 7, '2026-11-09'), true);
});
test('ordenação bidirecional, quitadas no fim e entrada fora da contagem de parcelas', () => {
    const compras = [
        {code: '1', total: 300, issued: '2026-01-01', parts: [{due: '2026-11-10', paid: '2026-11-01'}]},
        {code: '2', total: 100, issued: '2026-02-01', parts: [{due: '2026-11-11'}]},
        {code: '3', total: 200, issued: '2026-03-01', parts: [{due: '2026-11-12'}, {due: '2026-11-01', kind: 'entry'}]}
    ];
    const codigos = (criterio, ordem) => ordenarCompras(compras, criterio, ordem).map(c => c.code);
    assert.deepEqual(codigos('total', 'asc'), ['2','3','1']);
    assert.deepEqual(codigos('total', 'desc'), ['1','3','2']);
    assert.deepEqual(codigos('due', 'asc'), ['3','2','1']);
    assert.deepEqual(codigos('due', 'desc'), ['2','3','1']);
    assert.deepEqual(codigos('issued', 'desc'), ['3','2','1']);
    assert.equal(parcelasRestantes(compras[2]), 1);
    assert.deepEqual(compras.map(c => c.code), ['1','2','3']);
});