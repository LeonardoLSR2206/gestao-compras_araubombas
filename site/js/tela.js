/** Utilidades pequenas para a interface. Dados do usuário nunca viram HTML livre. */
export const selecionar = seletor => document.querySelector(seletor);

export function escapar(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caractere]));
}

export function avisar(mensagem, erro = false) {
    const elemento = selecionar('#aviso');
    elemento.textContent = mensagem;
    elemento.classList.toggle('erro', erro);
    elemento.hidden = !mensagem;
}

export function atualizarOpcoes(elemento, valores, opcoesIniciais) {
    const escolhido = elemento.value;
    elemento.replaceChildren();
    for (const [valor, texto] of opcoesIniciais) elemento.add(new Option(texto, valor));
    for (const valor of [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
        elemento.add(new Option(valor, valor));
    }
    elemento.value = escolhido;
    if (elemento.selectedIndex === -1) elemento.selectedIndex = 0;
}