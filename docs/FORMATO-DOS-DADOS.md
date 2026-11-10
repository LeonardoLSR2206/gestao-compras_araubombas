# Formato do JSON

O envelope exportado contém `exportedAt` (instante UTC) e `purchases` (lista). Exemplo fictício:

```json
{
  "exportedAt": "2026-11-09T12:00:00.000Z",
  "purchases": [
    {
      "id": "compra-exemplo",
      "code": "100",
      "supplier": "Fornecedor fictício",
      "responsible": "Pessoa de exemplo",
      "issued": "2026-11-09",
      "total": 10000,
      "downPayment": 2000,
      "terms": "30/60",
      "notes": "Exemplo sem dados reais",
      "parts": [
        {"id": "entrada", "kind": "entry", "due": "2026-11-09", "amount": 2000, "paid": null},
        {"id": "parcela-1", "kind": "installment", "due": "2026-12-09", "amount": 4000, "paid": null},
        {"id": "parcela-2", "kind": "installment", "due": "2027-01-08", "amount": 4000, "paid": null}
      ]
    }
  ]
}
```

`total`, `downPayment` e `amount` são centavos; 10000 significa R$ 100,00. `paid` é `null` quando pendente, ou uma data `AAAA-MM-DD` quando pago. `kind` diferencia entrada e parcela; registros antigos sem esse campo são tratados como parcelas. `responsible` pode faltar em registros antigos. IDs identificam registros; o número visível do pedido não substitui o ID.

Os vencimentos de `parts` são os efetivos. `terms` registra a condição informada, sem recalcular silenciosamente datas importadas. Campos adicionais desconhecidos são mantidos. Datas e valores são validados; a importação aceita divergência entre a soma dos pagamentos e o total, apresentando um aviso na interface.

## API local

- `GET /api/health`: identificação e pasta da instalação.
- `GET /api/purchases`: lista completa das compras.
- `POST /api/purchases`: recebe `{"purchase": compra}` e cria ou atualiza por ID.
- `POST /api/import`: recebe o envelope de exportação e adiciona somente IDs inexistentes.

POST exige `Content-Type: application/json` e no máximo 10 MB. O servidor verifica Host e Origin para restringir acesso ao endereço local. Os arquivos de dados não são publicados como arquivos estáticos.
