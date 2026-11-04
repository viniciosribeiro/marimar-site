import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoQuartoMotor, selecionarFotosDoMotor } from "../../src/lib/sincronizar-fotos-desbravador";

const foto = "https://reservas.desbravador.com.br/reservas/images/hoteis/marimar/queen-1.jpg";
const foto2 = "https://reservas.desbravador.com.br/reservas/images/hoteis/marimar/queen-2.jpeg";

test("fotos do Desbravador sao deduplicadas e preservam a ordem", () => {
  assert.deepEqual(selecionarFotosDoMotor([foto, foto, foto2]), [foto, foto2]);
});

test("nao aceita hosts arbitrarios, caminho malicioso ou links com query", () => {
  assert.deepEqual(selecionarFotosDoMotor([
    "http://reservas.desbravador.com.br/reservas/images/hoteis/test.jpg",
    "https://example.com/evil.jpg",
    "https://reservas.desbravador.com.br/reservas/images/hoteis/../admin.jpg",
    foto + "?v=1", foto,
  ]), [foto]);
});

test("cadastramento de suite usa codigo do motor, sem tentar adivinhar nome", () => {
  assert.equal(codigoQuartoMotor(" queen "), "QUEEN");
  assert.equal(codigoQuartoMotor("HiDrO"), "HIDRO");
  assert.equal(codigoQuartoMotor(null), "");
});

test("quando nao ha fotos, nao tenta inserir dados", () => {
  assert.deepEqual(selecionarFotosDoMotor(null), []);
  assert.deepEqual(selecionarFotosDoMotor([]), []);
});

/* ── suíte nova vinda do motor (04/11/2026) ─────────────────────────── */
import { slugDe } from "../../src/lib/sincronizar-fotos-desbravador";

test("slug da suite nova: sem acento, sem colidir com os que ja existem", () => {
  const usados = new Set(["suite-king-triplo", "casal-standard"]);
  assert.equal(slugDe("SUÍTE KING TRIPLO", usados), "suite-king-triplo-2");
  assert.equal(slugDe("  Suíte Família & Amigos!! ", usados), "suite-familia-amigos");
  assert.equal(slugDe("", usados), "suite");
  assert.ok(usados.has("suite-familia-amigos"), "o slug novo entra na lista de usados");
});
