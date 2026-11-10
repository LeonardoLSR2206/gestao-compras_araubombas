"""Validação dos registros. Todos os valores monetários são centavos inteiros."""
import datetime
import re

def data_valida(valor):
    if not isinstance(valor, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", valor):
        return False
    
    try: return datetime.date.fromisoformat(valor).isoformat() == valor
    except ValueError: return False

def inteiro(valor): return isinstance(valor, int) and not isinstance(valor, bool)

def hoje_brasil(): return (datetime.datetime.utcnow() - datetime.timedelta(hours=3)).date().isoformat()

def validar_compra(compra):
    if not isinstance(compra, dict):
        raise ValueError("Compra inválida.")
    
    for campo, limite in (("id", 100), ("code", 80), ("supplier", 120)):
        valor = compra.get(campo)
        if not isinstance(valor, str) or not valor.strip() or len(valor) > limite:
            raise ValueError("Confira o número do pedido e o fornecedor.")
        
    responsavel = compra.get("responsible", "")

    if not isinstance(responsavel, str) or len(responsavel) > 120:
        raise ValueError("O responsável deve ter até 120 caracteres.")
    
    if not data_valida(compra.get("issued")):
        raise ValueError("Data de emissão inválida.")
    
    total = compra.get("total")

    if not inteiro(total) or not 0 < total <= 100000000000:
        raise ValueError("Valor total inválido.")
    
    if not isinstance(compra.get("notes", ""), str) or len(compra.get("notes", "")) > 2000:
        raise ValueError("As observações devem ter até 2000 caracteres.")
    
    pagamentos = compra.get("parts")

    if not isinstance(pagamentos, list) or not 1 <= len(pagamentos) <= 61:
        raise ValueError("Informe pelo menos um pagamento (máximo de 60 parcelas e entrada).")
    
    identificadores = set()
    entradas = []

    for pagamento in pagamentos:
        if not isinstance(pagamento, dict):
            raise ValueError("Pagamento inválido.")
        
        identificador = pagamento.get("id")
        if not isinstance(identificador, str) or not identificador or identificador in identificadores:
            raise ValueError("Cada pagamento precisa ter uma identificação única.")
        
        identificadores.add(identificador)
        if not inteiro(pagamento.get("amount")) or not 0 < pagamento["amount"] <= 100000000000:
            raise ValueError("O valor de cada pagamento deve ser maior que zero.")
        
        if not data_valida(pagamento.get("due")):
            raise ValueError("Vencimento inválido.")
        
        baixa = pagamento.get("paid")
        if baixa is not None and (not data_valida(baixa) or baixa > hoje_brasil()):
            raise ValueError("A data de pagamento deve ser válida e não pode estar no futuro.")
        
        if pagamento.get("kind") not in (None, "entry", "installment"):
            raise ValueError("Tipo de pagamento inválido.")
        
        if pagamento.get("kind") == "entry":
            entradas.append(pagamento)

    entrada = compra.get("downPayment", 0)
    if (not inteiro(entrada) or not 0 <= entrada <= total or len(entradas) > 1
            or sum(item["amount"] for item in entradas) != entrada):
        raise ValueError("A entrada foi alterada. Gere os pagamentos novamente para aplicá-la.")
    
    prazos = compra.get("terms", "")

    if not isinstance(prazos, str):
        raise ValueError("Condição de pagamento inválida.")
    
    if prazos.strip():
        if not re.fullmatch(r"\d+(\s*/\s*\d+)*", prazos.strip()):
            raise ValueError("Use prazos separados por /, como 30/60.")
        
        dias = [int(valor) for valor in prazos.split("/")]
        if len(dias) > 60 or any(dia > 3650 or (i and dia <= dias[i-1]) for i, dia in enumerate(dias)):
            raise ValueError("Use prazos crescentes, entre 0 e 3650 dias.")
        
    return compra


def validar_backup(conteudo):
    registros = conteudo.get("purchases") if isinstance(conteudo, dict) else None

    if not isinstance(registros, list) or len(registros) > 20000:
        raise ValueError("Arquivo inválido. Selecione um JSON exportado pelo programa.")
    
    ids = set()

    for registro in registros:
        validar_compra(registro)
        if registro["id"] in ids:
            raise ValueError("O arquivo contém compras repetidas.")
        ids.add(registro["id"])
        
    return registros
