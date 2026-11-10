import datetime
import json
import sqlite3
from contextlib import closing
from pathlib import Path


class Banco:
    def __init__(self, pasta_dados):
        self.pasta = Path(pasta_dados)
        self.pasta.mkdir(parents=True, exist_ok=True)
        self.arquivo = self.pasta / "compras.sqlite"
        with closing(self.conectar()) as conexao, conexao: conexao.execute("CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, data TEXT NOT NULL)")
        self.backup_diario()

    def conectar(self): 
        return sqlite3.connect(str(self.arquivo), timeout=15)

    def listar(self):
        with closing(self.conectar()) as conexao:
            return [json.loads(linha[0]) for linha in conexao.execute("SELECT data FROM purchases ORDER BY rowid")]

    def salvar(self, compra):
        with closing(self.conectar()) as conexao, conexao:
            conexao.execute("INSERT OR REPLACE INTO purchases (id, data) VALUES (?, ?)",
                            (compra["id"], json.dumps(compra, ensure_ascii=False)))

    def importar(self, compras):
        self.criar_backup("antes-importacao")
        adicionadas = 0
        with closing(self.conectar()) as conexao, conexao:
            for compra in compras:
                cursor = conexao.execute("INSERT OR IGNORE INTO purchases (id, data) VALUES (?, ?)",
                                        (compra["id"], json.dumps(compra, ensure_ascii=False)))
                adicionadas += cursor.rowcount
        return {"added": adicionadas, "skipped": len(compras) - adicionadas}

    def criar_backup(self, motivo):
        pasta = self.pasta / "backups"
        pasta.mkdir(exist_ok=True)
        nome = "compras-{}-{}.sqlite".format(datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f"), motivo)
        destino = pasta / nome
        with closing(self.conectar()) as origem, closing(sqlite3.connect(str(destino))) as copia:
            origem.backup(copia)
        return destino

    def backup_diario(self):
        pasta = self.pasta / "backups"
        hoje = datetime.date.today().strftime("%Y%m%d")
        if not pasta.exists() or not list(pasta.glob("compras-{}-*-diario.sqlite".format(hoje))):
            self.criar_backup("diario")