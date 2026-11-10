"""Servidor local: entrega HTML/CSS/JS e disponibiliza a API de compras.

Execução: python aplicativo/servidor.py
Não depende de Flask, Node.js, npm nem instalação de pacotes.
"""
import json
import logging
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from banco import Banco
from modelos import validar_compra, validar_backup

RAIZ = Path(__file__).resolve().parent.parent
PORTA = 18742
IDENTIFICADOR = "araubombas-local-v3"


def criar_servidor(raiz=RAIZ, porta=PORTA):
    raiz = Path(raiz).resolve()
    banco = Banco(raiz / "dados")
    site = (raiz / "site").resolve()

    class Requisicao(BaseHTTPRequestHandler):
        def log_message(self, formato, *argumentos):
            logging.info(formato, *argumentos)

        def origem_permitida(self):
            endereco = "127.0.0.1:{}".format(self.server.server_port)
            return (self.headers.get("Host") == endereco
                    and self.headers.get("Origin") in (None, "http://" + endereco))

        def responder_json(self, codigo, conteudo):
            self.responder(codigo, json.dumps(conteudo, ensure_ascii=False).encode("utf-8"),
                           "application/json; charset=utf-8")

        def responder(self, codigo, corpo, tipo):
            self.send_response(codigo)
            self.send_header("Content-Type", tipo)
            self.send_header("Content-Length", str(len(corpo)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(corpo)

        def do_GET(self):
            if not self.origem_permitida():
                return self.responder_json(403, {"error": "Acesso permitido apenas neste computador."})
            
            caminho = urlsplit(self.path).path

            if caminho == "/api/health":
                return self.responder_json(200, {"app": IDENTIFICADOR, "installation": str(raiz)})
            
            if caminho == "/api/purchases":
                return self.responder_json(200, banco.listar())
            
            arquivo = (site / ("index.html" if caminho == "/" else unquote(caminho).lstrip("/"))).resolve()

            if site not in arquivo.parents or not arquivo.is_file():
                return self.responder_json(404, {"error": "Arquivo não encontrado."})
            
            tipos = {".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
                     ".html": "text/html; charset=utf-8"}
            
            tipo = tipos.get(arquivo.suffix, mimetypes.guess_type(str(arquivo))[0] or "application/octet-stream")
            return self.responder(200, arquivo.read_bytes(), tipo)

        def do_POST(self):
            if not self.origem_permitida():
                return self.responder_json(403, {"error": "Origem não permitida."})
            
            if not self.headers.get("Content-Type", "").startswith("application/json"):
                return self.responder_json(415, {"error": "Envie JSON."})
            
            try:
                tamanho = int(self.headers.get("Content-Length", "0"))
                if not 0 < tamanho <= 10 * 1024 * 1024:
                    raise ValueError("Arquivo vazio ou maior que 10 MB.")
                
                conteudo = json.loads(self.rfile.read(tamanho).decode("utf-8-sig"))
                caminho = urlsplit(self.path).path
                if caminho == "/api/purchases":
                    compra = validar_compra(conteudo.get("purchase"))
                    banco.backup_diario()
                    banco.salvar(compra)
                    return self.responder_json(200, {"ok": True})
                
                if caminho == "/api/import":
                    compras = validar_backup(conteudo)
                    return self.responder_json(200, banco.importar(compras))
                
                return self.responder_json(404, {"error": "Rota não encontrada."})
            
            except (ValueError, TypeError, AttributeError, KeyError) as erro:
                return self.responder_json(400, {"error": str(erro)})
                
            except Exception:
                logging.exception("Falha ao gravar")
                return self.responder_json(500, {"error": "Não foi possível salvar. Confira o espaço em disco e as permissões da pasta."})

    return ThreadingHTTPServer(("127.0.0.1", porta), Requisicao)


if __name__ == "__main__":
    (RAIZ / "logs").mkdir(exist_ok=True)
    logging.basicConfig(filename=str(RAIZ / "logs/servidor.log"), level=logging.INFO,
                        format="%(asctime)s %(message)s")
    try:
        criar_servidor().serve_forever()
    except Exception:
        logging.exception("Não foi possível iniciar o servidor")
        raise