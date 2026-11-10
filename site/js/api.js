/** Comunicação com o servidor Python. Os erros são exibidos pela interface. */
async function requisitar(caminho, dados) {
    const opcoes = dados === undefined ? {} : {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados)
    };
    const resposta = await fetch(caminho, opcoes);
    const conteudo = await resposta.json();
    if (!resposta.ok) throw new Error(conteudo.error || 'Não foi possível concluir a operação.');
    return conteudo;
}

export const listarCompras = () => requisitar('/api/purchases');
export const salvarCompra = compra => requisitar('/api/purchases', {purchase: compra});
export const importarCompras = arquivo => requisitar('/api/import', arquivo);