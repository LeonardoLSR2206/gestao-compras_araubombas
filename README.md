# Araubombas — controle de compras

Aplicação local para registrar compras de peças e acompanhar entrada, parcelas e pagamentos. Interface em português, com Python, SQLite, HTML, CSS e JavaScript nativo. Não usa React, Vite, Node.js ou npm para funcionar. Não precisa de VS Code.

## Executar a partir do código-fonte

Com Python 3.8 ou posterior instalado, abra um terminal nesta pasta:

```sh
python aplicativo/servidor.py
```

Abra **http://127.0.0.1:18742** no navegador. No Linux, o comando pode ser `python3`. O terminal precisa ficar aberto. Alternativamente, `python aplicativo/iniciar.py --open` inicia o servidor em segundo plano e abre o navegador.

O banco é criado automaticamente em `dados/compras.sqlite`. Nenhuma instalação de pacotes é necessária. O `package.json` só configura os testes opcionais de JavaScript; não é necessário executar `npm install` ou `npm run dev`.

Para Windows 7, use o pacote separado pronto para uso, que inclui o mesmo código e Python 3.8.10 de 32 bits. Ele reaproveita o ambiente que já funcionou nesse sistema. Use o navegador que já executava a versão anterior (Chrome 109 ou Firefox com suporte a módulos JavaScript e `dialog`); Internet Explorer não é compatível. O código-fonte também pode ser executado com Python atual em um sistema atual.

## O que o programa oferece

- Cadastro e edição de número do pedido, fornecedor, responsável, emissão, total, entrada, condição de pagamento e observações.
- Geração de parcelas por dias corridos contados da emissão: `30/60` ou `15/30/45`. `0` significa vencimento na emissão.
- Entrada separada, descontada antes de dividir o restante. A entrada vence na emissão; é possível ajustar sua data. Entrada não é marcada como paga automaticamente.
- Ajuste manual de valores e vencimentos conforme os boletos. Eventuais diferenças entre o total e a soma dos pagamentos ficam sinalizadas para conferência.
- Confirmação de pagamento com data real e opção de desfazer uma baixa.
- Busca por pedido, fornecedor ou responsável; filtros por fornecedor, responsável e intervalo de emissão (datas incluídas).
- Todas, Vencidas, Vence hoje, Vence em breve, A vencer, Quitadas e Conferir valores.
- Ordenação crescente/decrescente por total da compra, próximo vencimento, emissão, parcelas restantes, fornecedor ou responsável.
- Agenda com uma linha por pagamento. Na agenda, ordenar por vencimento usa a data de cada pagamento; ordenar por valor usa o total da compra.
- Exportação JSON completa e importação compatível com o formato anterior.

### Regras dos indicadores

“Vence em breve” inclui **amanhã até o último dia do prazo**, com 7 dias como padrão e opções de 3, 7, 15 ou 30. Hoje e vencidas ficam em categorias próprias. “A vencer” inclui todos os pagamentos futuros, inclusive os que vencem em breve.

Uma compra pode aparecer em mais de um filtro se tiver parcelas em situações diferentes. Sua etiqueta mostra a situação mais urgente. “Quitadas” exige que todos os pagamentos, inclusive a entrada, tenham baixa. Na agenda, essa aba mostra os pagamentos das compras inteiramente quitadas.

O próximo vencimento é o mais antigo entre os pagamentos pendentes, incluindo vencidos e entrada. Compras quitadas ficam no fim nas duas direções dessa ordenação. “Parcelas restantes” exclui a entrada, apresentada separadamente quando pendente.

Os quatro indicadores somam pagamentos pendentes e respeitam busca, fornecedor, responsável e emissão. Não se restringem à aba de situação escolhida. Nenhum pagamento é considerado realizado só porque sua data passou.

## Onde alterar o código

| Arquivo | Responsabilidade |
| --- | --- |
| `aplicativo/servidor.py` | Servidor HTTP e rotas da API |
| `aplicativo/banco.py` | SQLite e backups |
| `aplicativo/modelos.py` | Validação dos registros recebidos |
| `aplicativo/iniciar.py` | Inicialização e abertura do navegador |
| `site/index.html` | Estrutura da tela e formulários |
| `site/css/estilos.css` | Cores, disposição e adaptação à largura |
| `site/js/compras.js` | Cálculos, vencimentos e ordenação |
| `site/js/formulario.js` | Cadastro e edição |
| `site/js/api.js` | Comunicação com o servidor |
| `site/js/tela.js` | Utilidades de apresentação |
| `site/js/app.js` | Filtros, consulta e coordenação da interface |
| `testes/` | Casos automatizados com dados fictícios |

Os nomes dos campos persistidos continuam em inglês para manter compatibilidade com os arquivos antigos. As funções e explicações estão em português. Não há etapa de compilação, arquivos minificados ou dependências de rede: os arquivos em `site/` são os que o navegador executa.

## Dados e backups

Todos os valores são centavos inteiros. A divisão distribui centavos restantes entre as primeiras parcelas, de modo que a soma feche exatamente. As datas são `AAAA-MM-DD`; os indicadores usam o dia de Brasília, e os prazos contam dias corridos, sem ajuste automático por feriados ou fins de semana.

O SQLite guarda uma linha por compra com seu JSON completo. Campos desconhecidos são preservados na importação. Responsáveis ausentes em dados antigos aparecem como “Não informado”; novas compras exigem o nome. Ao editar uma compra antiga, informe o responsável.

A importação **adiciona IDs novos e ignora IDs já existentes**, evitando substituir edições ou baixas. Ela valida o arquivo inteiro antes de gravar. Não serve para restaurar uma versão mais recente de compras que já estão no banco: para migração completa, siga `docs/INSTALACAO-WINDOWS7.md`.

Há cópia automática em `dados/backups/` no primeiro início ou gravação de cada dia e antes de cada importação. Essas cópias ficam no mesmo computador e não substituem uma cópia externa. Use “Exportar dados” e guarde o JSON também em outro local. A exportação inclui todas as compras, independentemente dos filtros.

## GitHub

Esta pasta foi preparada sem compras reais, banco ou runtime. Publique **somente seu conteúdo**. O `.gitignore` exclui dados, logs e runtime. Não coloque exports financeiros em outros diretórios do repositório: o Git não adivinha quais arquivos são privados.

Escolha a licença que deseja aplicar antes de abrir o repositório para contribuições. O runtime Python do pacote Windows tem licença própria incluída; ele não precisa ser enviado ao GitHub.

## Testes

Python, sem dependências adicionais:

```sh
python -m unittest discover -s testes -v
```

JavaScript, opcional, com Node.js 18 ou posterior em um computador de desenvolvimento:

```sh
node --test testes/compras.test.js
```

Os testes usam diretórios temporários e registros fictícios. Cobrem entrada, prazos, arredondamento, vencimentos, ordenação, persistência, validação, importação sem sobrescrita e bloqueio de acesso aos arquivos privados pelo servidor.

## Limites de uso

O servidor escuta apenas em `127.0.0.1`. É para uso local, em uma conta de Windows, e não tem login nem sincronização entre computadores. Responsável identifica quem fez a compra; não é uma conta de acesso. Compartilhar a pasta em rede ou alterar o endereço de escuta não transforma o programa em um serviço multiusuário. Duas abas editando a mesma compra simultaneamente podem sobrescrever alterações; use uma tela de edição por vez.
