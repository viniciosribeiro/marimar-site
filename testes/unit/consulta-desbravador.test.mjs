import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const executar = promisify(execFile);
const script = resolve('agente/skills/consulta-desbravador/scripts/consultar-api.mjs');
const args = ['2026-11-10', '2026-11-12', '2', '1', '1'];

async function testarComServidor(responder, parametros = args, chave = 'chave-de-teste-nao-secreta') {
  const server = createServer(responder);
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  try {
    const { stdout } = await executar(process.execPath, [script, ...parametros], {
      timeout: 8000,
      env: { ...process.env, MARIMAR_SITE_URL: `http://127.0.0.1:${server.address().port}`, MARIMAR_API_KEY: chave },
    });
    return JSON.parse(stdout.trim());
  } finally {
    await new Promise((ok) => server.close(ok));
  }
}

test('precos e disponibilidade usam apenas a API autenticada do site, com ocupacao ajustada', async () => {
  let consultou = false;
  const d = await testarComServidor((req, res) => {
    consultou = true;
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.pathname, '/api/agent/disponibilidade');
    assert.equal(url.searchParams.get('bebes'), '1');
    assert.equal(url.searchParams.get('criancas'), '1');
    assert.equal(req.headers.authorization, 'Bearer chave-de-teste-nao-secreta');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true, fonte: 'worker', consultado_em: '2026-10-26T10:00:00Z',
      ocupacao: { regraAplicada: true, adultosMotor: 3, criancasMotor: 0, explicacao: 'Crianca paga como adulto.', valorBebes: 40 },
      dados: [
        { id: 'KING', nome: 'Suite King', disponivel: true, total: 1300, diaria: 630, ocupacao_max: 3, deep_link: 'https://reservas.desbravador.com.br/reservar-x' },
        { id: 'FAM', nome: 'Familia', disponivel: false, total: 500, diaria: 250 },
      ],
    }));
  });
  assert.equal(consultou, true);
  assert.equal(d.ok, true);
  assert.equal(d.quartos.length, 1);
  assert.equal(d.quartos[0].total, 1300);
  assert.equal(d.quartos[0].ultima_unidade, null);
  assert.equal(d.quartos[0].unidades, null);
  assert.equal(d.quartos[0].diaria_media, 630);
  assert.equal(d.regra_criancas, 'Crianca paga como adulto.');
  assert.equal(d.valor_bebes, 40);
  assert.equal(d.esgotados.length, 1);
  const link = new URL(d.link_reserva);
  assert.equal(link.origin + link.pathname, 'https://reservas.desbravador.com.br/reservar-x');
  assert.equal(link.searchParams.get('roomCode'), 'KING');
  assert.equal(link.searchParams.get('rateCode'), '');
  assert.equal(d.quartos[0].link_reserva, d.link_reserva);
});

test('401 nao e confundido com falta de quartos', async () => {
  const d = await testarComServidor((_req, res) => { res.statusCode = 401; res.end('nao autorizado'); });
  assert.equal(d.ok, false);
  assert.match(d.erro, /MARIMAR_API_KEY/);
});

test('502 nao e convertido em preco ou disponibilidade falsa', async () => {
  const d = await testarComServidor((_req, res) => { res.statusCode = 502; res.end('upstream offline'); });
  assert.equal(d.ok, false);
  assert.match(d.erro, /HTTP 502/);
});

test('sem chave falha fechado sem consultar o motor', async () => {
  let acionado = false;
  const d = await testarComServidor((_req, res) => { acionado = true; res.end('{}'); }, args, '');
  assert.equal(acionado, false);
  assert.equal(d.ok, false);
  assert.match(d.erro, /MARIMAR_API_KEY ausente/);
});

test('periodo impossivel nao dispara consulta', async () => {
  let acionado = false;
  const d = await testarComServidor((_req, res) => { acionado = true; res.end('{}'); }, ['2026-02-30', '2026-03-02', '2']);
  assert.equal(acionado, false);
  assert.equal(d.ok, false);
});

test('varias suítes recebem links próprios, com link geral sem roomCode', async () => {
  const d = await testarComServidor((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true, ocupacao: { adultosMotor: 2, criancasMotor: 0 },
      dados: [
        { id: 'QUEEN', nome: 'Suite Queen', disponivel: true, total: 900, diaria: 450, ocupacao_max: 2 },
        { id: 'HIDRO', nome: 'Suite Lua de Mel', disponivel: true, total: 1400, diaria: 700, ocupacao_max: 2 },
      ],
    }));
  }, ['2026-11-10', '2026-11-12', '2', '0', '0']);
  assert.equal(d.ok, true);
  assert.equal(d.quartos.length, 2);
  assert.equal(new URL(d.link_reserva).searchParams.has('roomCode'), false);
  for (const q of d.quartos) {
    const u = new URL(q.link_reserva);
    assert.equal(u.searchParams.get('roomCode'), q.codigo);
    assert.equal(u.searchParams.get('rateCode'), '');
    assert.equal(u.searchParams.get('checkin'), '2026-11-10');
    assert.equal(u.searchParams.get('checkout'), '2026-11-12');
    assert.equal(u.searchParams.get('adults'), '2');
  }
});
