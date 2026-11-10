"""Testes com banco temporário, nunca com dados reais da oficina."""
import copy
import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'aplicativo'))
from banco import Banco
from modelos import validar_compra, validar_backup
from servidor import criar_servidor


def exemplo():
    return {'id': 'teste-1', 'code': '100', 'supplier': 'Fornecedor fictício',
            'responsible': 'Pessoa de teste', 'issued': '2020-01-01', 'total': 10000,
            'downPayment': 2000, 'terms': '30/60', 'notes': '', 'parts': [
                {'id': 'entrada', 'kind': 'entry', 'due': '2020-01-01', 'amount': 2000, 'paid': '2020-01-01'},
                {'id': 'p1', 'kind': 'installment', 'due': '2020-01-31', 'amount': 4000, 'paid': None},
                {'id': 'p2', 'kind': 'installment', 'due': '2020-03-01', 'amount': 4000, 'paid': None}]}


class TestesRegras(unittest.TestCase):
    def test_preserva_registro_antigo_e_campos_desconhecidos(self):
        compra = exemplo()
        del compra['responsible']
        compra['campo-legado'] = 'preservar'
        compra['total'] += 1  # discrepância deve ser sinalizada, não apagada
        self.assertEqual(validar_compra(copy.deepcopy(compra)), compra)

    def test_rejeita_entrada_inconsistente_e_data_futura(self):
        compra = exemplo()
        compra['downPayment'] = 5000
        with self.assertRaises(ValueError): validar_compra(compra)
        compra = exemplo()
        compra['parts'][0]['paid'] = '9999-01-01'
        with self.assertRaises(ValueError): validar_compra(compra)

    def test_backup_rejeita_ids_repetidos(self):
        with self.assertRaises(ValueError): validar_backup({'purchases': [exemplo(), exemplo()]})


class TestesAPI(unittest.TestCase):
    def setUp(self):
        self.temporaria = tempfile.TemporaryDirectory()
        self.raiz = Path(self.temporaria.name)
        (self.raiz / 'site').mkdir()
        (self.raiz / 'site/index.html').write_text('<h1>Teste</h1>')
        self.servidor = criar_servidor(self.raiz, 0)
        self.url = 'http://127.0.0.1:{}'.format(self.servidor.server_port)
        self.thread = threading.Thread(target=self.servidor.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.servidor.shutdown()
        self.servidor.server_close()
        self.thread.join()
        self.temporaria.cleanup()

    def requisicao(self, caminho, dados=None, origem=None):
        headers = {'Content-Type': 'application/json'}
        if origem: headers['Origin'] = origem
        requisicao = urllib.request.Request(self.url + caminho,
            data=json.dumps(dados).encode() if dados is not None else None, headers=headers)
        try:
            with urllib.request.urlopen(requisicao) as resposta:
                return resposta.status, json.load(resposta)
        except urllib.error.HTTPError as erro:
            return erro.code, json.load(erro)

    def test_salva_reabre_e_atualiza_baixa(self):
        compra = exemplo()
        self.assertEqual(self.requisicao('/api/purchases', {'purchase': compra})[0], 200)
        self.assertEqual(Banco(self.raiz / 'dados').listar(), [compra])
        compra['parts'][1]['paid'] = '2020-01-31'
        self.requisicao('/api/purchases', {'purchase': compra})
        self.assertEqual(self.requisicao('/api/purchases')[1], [compra])

    def test_importacao_preserva_ids_existentes(self):
        self.requisicao('/api/purchases', {'purchase': exemplo()})
        alterada = exemplo()
        alterada['responsible'] = 'Não substituir'
        nova = exemplo()
        nova['id'] = 'teste-2'
        status, resultado = self.requisicao('/api/import', {'purchases': [alterada, nova]})
        self.assertEqual(status, 200)
        self.assertEqual(resultado, {'added': 1, 'skipped': 1})
        self.assertEqual(self.requisicao('/api/purchases')[1], [exemplo(), nova])
        self.assertTrue(list((self.raiz / 'dados/backups').glob('*antes-importacao.sqlite')))

    def test_importacao_invalida_nao_grava_nenhum_registro(self):
        invalida = exemplo()
        invalida['id'] = 'invalida'
        invalida['parts'][0]['due'] = '2020-02-30'
        self.assertEqual(self.requisicao('/api/import', {'purchases': [exemplo(), invalida]})[0], 400)
        self.assertEqual(self.requisicao('/api/purchases')[1], [])

    def test_dados_privados_e_origem_externa_bloqueados(self):
        self.assertEqual(self.requisicao('/dados/compras.sqlite')[0], 404)
        self.assertEqual(self.requisicao('/%2e%2e/dados/compras.sqlite')[0], 404)
        self.assertEqual(self.requisicao('/api/purchases', {'purchase': exemplo()}, 'https://example.org')[0], 403)
        self.assertEqual(self.requisicao('/api/purchases')[1], [])


if __name__ == '__main__':
    unittest.main()