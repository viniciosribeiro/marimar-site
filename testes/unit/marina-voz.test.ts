/**
 * Modo voz do treinamento — peças puras.
 *   npm test
 *
 * O leitor do bloco de ação (o que a Marina propõe) e a conta de custo da
 * voz. Nada de servidor nem de banco.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extrairAcao, estimarCentavos, estadoGasto, normalizarPrecos, emReais, PRECOS_VOZ_PADRAO,
} from "../../src/lib/marina-voz-base";

/* ── extrairAcao ─────────────────────────────────────────────────── */

test("extrairAcao: texto sem ação fica como está", () => {
  const r = extrairAcao("Claro! O café é das 8 às 10.");
  assert.equal(r.acao, null);
  assert.equal(r.texto, "Claro! O café é das 8 às 10.");
});

test("extrairAcao: bloco com marcadores vira ação, e só a fala é dita", () => {
  const bruto = 'Deixa comigo. [[acao]]{"nome":"ensinar","dados":{"tipo":"fato","titulo":"Check-in","conteudo":"14h"},"fala":"Vou guardar que o check-in é às 14 horas, confirma?"}[[/acao]]';
  const r = extrairAcao(bruto);
  assert.ok(r.acao);
  assert.equal(r.acao!.nome, "ensinar");
  assert.equal(r.acao!.dados.titulo, "Check-in");
  assert.equal(r.texto, "Vou guardar que o check-in é às 14 horas, confirma?");
  assert.ok(!r.texto.includes("acao"));
});

test("extrairAcao: sem campo fala, usa o que sobra do texto", () => {
  const bruto = 'Perfeito, confirma? [[acao]]{"nome":"ensinar","dados":{"titulo":"X","conteudo":"Y"}}[[/acao]]';
  const r = extrairAcao(bruto);
  assert.ok(r.acao);
  assert.equal(r.texto, "Perfeito, confirma?");
});

test("extrairAcao: bloco quebrado não vaza JSON para a fala", () => {
  const bruto = 'Tudo bem. [[acao]]{isto não é json}[[/acao]]';
  const r = extrairAcao(bruto);
  assert.equal(r.acao, null);
  assert.equal(r.texto, "Tudo bem.");
  assert.ok(!r.texto.includes("{"));
});

test("extrairAcao: objeto JSON solto (sem marcadores) ainda é lido", () => {
  const bruto = 'ok {"nome":"dados_pousada","dados":{"whatsapp":"5541999990000"},"fala":"Mudo o WhatsApp, confirma?"}';
  const r = extrairAcao(bruto);
  assert.ok(r.acao);
  assert.equal(r.acao!.nome, "dados_pousada");
  assert.equal(r.texto, "Mudo o WhatsApp, confirma?");
});

test("extrairAcao: objeto sem nome não é ação", () => {
  const r = extrairAcao('texto {"dados":{"x":1}} fim');
  assert.equal(r.acao, null);
});

/* ── custo (estimativa) ──────────────────────────────────────────── */

test("estimarCentavos: soma TTS por caractere e STT por minuto", () => {
  const p = { ttsCentavos1k: 100, sttCentavosMin: 60, limiteCentavos: 0, avisarPct: 80 };
  // 2000 car * (100/1000) = 200; 120 s = 2 min * 60 = 120; total 320
  assert.equal(estimarCentavos(2000, 120, p), 320);
  assert.equal(estimarCentavos(0, 0, p), 0);
});

test("estadoGasto: ok, aviso e estourou", () => {
  const p = { ...PRECOS_VOZ_PADRAO, limiteCentavos: 1000, avisarPct: 80 };
  assert.equal(estadoGasto(100, p).nivel, "ok");
  assert.equal(estadoGasto(850, p).nivel, "aviso");
  assert.equal(estadoGasto(1000, p).nivel, "estourou");
  assert.equal(estadoGasto(1200, p).nivel, "estourou");
});

test("estadoGasto: sem teto nunca estoura", () => {
  const p = { ...PRECOS_VOZ_PADRAO, limiteCentavos: 0 };
  assert.equal(estadoGasto(999999, p).nivel, "ok");
});

test("normalizarPrecos: valores inválidos voltam ao padrão", () => {
  const p = normalizarPrecos({ ttsCentavos1k: "abc", limiteCentavos: -5 });
  assert.equal(p.ttsCentavos1k, PRECOS_VOZ_PADRAO.ttsCentavos1k);
  assert.equal(p.limiteCentavos, 0); // -5 fica no mínimo (0)
  assert.equal(p.avisarPct, PRECOS_VOZ_PADRAO.avisarPct);
});

test("emReais: centavos viram R$ com dois dígitos", () => {
  assert.equal(emReais(1234), "R$ 12,34");
  assert.equal(emReais(0), "R$ 0,00");
});
