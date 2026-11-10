"""Abre o programa e inicia o servidor se necessário, sem console no Windows.

--start inicia somente o servidor; --open também abre o navegador.
O pacote pronto inclui Python. No código-fonte, usa o Python que executou este arquivo.
"""
import ctypes
import json
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENDERECO = "http://127.0.0.1:18742"


def servidor_disponivel():
    try:
        with urllib.request.urlopen(ENDERECO + "/api/health", timeout=1) as resposta:
            dados = json.load(resposta)
    except (OSError, ValueError):
        return False
    mesma_pasta = os.path.normcase(dados.get("installation", "")) == os.path.normcase(str(RAIZ))
    if dados.get("app") != "araubombas-local-v3" or not mesma_pasta:
        raise RuntimeError("A porta 18742 está ocupada por outra instalação. Reinicie o Windows e abra o atalho configurado na pasta desejada.")
    return True


def iniciar():
    if not servidor_disponivel():
        (RAIZ / "logs").mkdir(exist_ok=True)
        python_embutido = RAIZ / "runtime" / "pythonw.exe"
        executavel = str(python_embutido) if python_embutido.exists() else sys.executable
        opcoes = {"creationflags": 0x08000000} if os.name == "nt" else {}
        with open(str(RAIZ / "logs" / "inicializacao.log"), "ab") as registro:
            subprocess.Popen([executavel, str(RAIZ / "aplicativo" / "servidor.py")],
                             cwd=str(RAIZ), stdout=registro, stderr=registro, **opcoes)
        for tentativa in range(60):
            if servidor_disponivel():
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("O servidor não iniciou. Consulte logs/inicializacao.log e logs/servidor.log. Verifique se a pasta permite gravação.")
    if "--open" in sys.argv:
        webbrowser.open(ENDERECO)


if __name__ == "__main__":
    try:
        iniciar()
    except Exception as erro:
        if os.name == "nt":
            ctypes.windll.user32.MessageBoxW(0, str(erro), "Araubombas - falha ao abrir", 16)
        else:
            raise