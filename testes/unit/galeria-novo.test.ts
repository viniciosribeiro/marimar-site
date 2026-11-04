/**
 * Site novo, /galeria: capítulos na ordem das seções, cada suíte com as suas
 * fotos e a mesma foto uma vez só por grupo (as regras do Clássico).
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarCapitulos } from "../../src/components/site-novo/galeria/GaleriaNovo";

const f = (url: string, secao: string, quarto?: { id: string; nome: string; slug: string }) => ({
  url, alt: "", secao, quarto_id: quarto?.id ?? null, quarto_nome: quarto?.nome ?? null, quarto_slug: quarto?.slug ?? null,
});

test("capítulos: ordem das seções, suítes separadas, sem repetição", () => {
  const queen = { id: "q1", nome: "SUITE QUEEN", slug: "suite-queen" };
  const king = { id: "q2", nome: "SUITE KING", slug: "suite-king" };
  const caps = montarCapitulos([
    f("/r1.jpg", "restaurante"),
    f("/p1.jpg", "pousada"), f("/p1.jpg", "pousada"), f("/p2.jpg", "pousada"),
    f("/q1.jpg", "pousada", queen), f("/q2.jpg", "pousada", queen), f("/k1.jpg", "pousada", king),
  ]);
  assert.deepEqual(caps.map((c) => c.chave), ["pousada", "quarto", "restaurante"]);
  const pousada = caps[0];
  assert.ok(pousada.tipo === "secao" && pousada.grupo.fotos.length === 2, "a mesma foto duas vezes aparece uma vez");
  assert.equal(pousada.tipo === "secao" && pousada.grupo.fotos[0].alt, "A pousada", "sem texto alternativo: o nome da seção");
  const suites = caps[1];
  assert.ok(suites.tipo === "suites");
  if (suites.tipo !== "suites") return;
  assert.deepEqual(suites.suites.map((s) => [s.titulo, s.href, s.fotos.length]), [["Suíte Queen", "/quartos/suite-queen", 2], ["Suíte King", "/quartos/suite-king", 1]]);
});

test("capítulos: sem fotos, nenhum capítulo", () => {
  assert.deepEqual(montarCapitulos([]), []);
});
