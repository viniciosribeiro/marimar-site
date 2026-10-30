/**
 * Abertura do site: vídeo do pôr do sol (30/10/2026) ou logo animada.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerTema } from "../../src/lib/tema";

const comMovimento = (movimento: Record<string, unknown>) => lerTema({ tema: { movimento } });

test("abertura: o padrão é o vídeo do pôr do sol", () => {
  assert.equal(lerTema(null).movimento.aberturaEstilo, "video");
  assert.equal(lerTema(null).movimento.abertura, true);
});

test("abertura: tema gravado antes de 30/10 (sem estilo) passa a mostrar o vídeo, sem perder o resto", () => {
  const m = comMovimento({ abertura: true, aberturaTexto: "Bem-vindo", logo: "brilho" }).movimento;
  assert.equal(m.aberturaEstilo, "video");
  assert.equal(m.aberturaTexto, "Bem-vindo");
  assert.equal(m.logo, "brilho");
});

test("abertura: a escolha da logo animada no painel é respeitada", () => {
  assert.equal(comMovimento({ aberturaEstilo: "logo" }).movimento.aberturaEstilo, "logo");
});

test("abertura: valor estranho volta ao vídeo, e desligada continua desligada", () => {
  assert.equal(comMovimento({ aberturaEstilo: "filme" }).movimento.aberturaEstilo, "video");
  assert.equal(comMovimento({ abertura: false }).movimento.abertura, false);
});
