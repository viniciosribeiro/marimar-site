/**
 * O motor volta atrás nas fotos (04/11/2026): a lista que vale é a mais
 * recente que ele já mostrou, não a que veio por último.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assinaturaFotos, decidirLista, MAX_VISTAS, type HistoricoSuite } from "../../src/lib/fotos-motor-historico";

const u = (n: string) => `https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_FAM_${n}.jpeg`;
const ANTIGA = [u("538409")];
const NOVAS = [u("681038"), u("220134"), u("557259"), u("638853")];
const T0 = "2026-11-04T15:31:00.000Z", T1 = "2026-11-04T16:33:00.000Z", T2 = "2026-11-04T17:35:00.000Z", T3 = "2026-11-04T22:30:00.000Z";

test("assinatura: não depende da ordem nem de repetidas", () => {
  assert.equal(assinaturaFotos([u("1"), u("2")]), assinaturaFotos([u("2"), u("1"), u("2")]));
  assert.notEqual(assinaturaFotos([u("1")]), assinaturaFotos([u("1"), u("2")]));
});

test("o caso da STANDARD FAMILIA: a lista nova entra e a volta atrás do motor é ignorada", () => {
  /* 15:31 — sem histórico ainda: o site tem a antiga, o motor devolve a antiga. */
  const r0 = decidirLista(undefined, ANTIGA, T0, { noSite: ANTIGA });
  assert.equal(r0.acao, "igual");
  assert.deepEqual(r0.historico.aplicada?.fotos, ANTIGA);
  /* 16:33 — 4 fotos nunca vistas: a pousada subiu fotos. */
  const r1 = decidirLista(r0.historico, NOVAS, T1);
  assert.equal(r1.acao, "aplicar");
  assert.match(r1.motivo, /4 foto\(s\) nova\(s\)/);
  assert.deepEqual(r1.historico.aplicada?.fotos, NOVAS);
  assert.equal(r1.historico.aplicada?.desde, T1);
  /* 17:35 — o motor volta a devolver só a antiga: lista vista ANTES da em vigor. */
  const r2 = decidirLista(r1.historico, ANTIGA, T2);
  assert.equal(r2.acao, "ignorar");
  if (r2.acao === "ignorar") {
    assert.deepEqual(r2.vigente, NOVAS, "o site mantém as novas");
    assert.match(r2.motivo, /lista antiga/);
  }
  assert.deepEqual(r2.historico.aplicada?.fotos, NOVAS, "a volta atrás não muda a lista em vigor");
  /* 22:30 — continua devolvendo a antiga: continua ignorada. */
  const r3 = decidirLista(r2.historico, ANTIGA, T3);
  assert.equal(r3.acao, "ignorar");
  /* Quando o motor voltar a devolver as novas: nada a fazer. */
  const r4 = decidirLista(r3.historico, [...NOVAS].reverse(), T3);
  assert.equal(r4.acao, "igual");
});

test("foto retirada no motor (lista nova só com fotos conhecidas) entra; a volta ao conjunto completo é ignorada", () => {
  const h = decidirLista(undefined, NOVAS, T1, { noSite: NOVAS }).historico;
  const menos = NOVAS.slice(0, 3);
  const r1 = decidirLista(h, menos, T2);
  assert.equal(r1.acao, "aplicar");
  assert.match(r1.motivo, /retirada/);
  const r2 = decidirLista(r1.historico, NOVAS, T3);
  assert.equal(r2.acao, "ignorar", "o conjunto completo já tinha sido visto antes da lista em vigor");
});

test("forçar (botão do painel): a lista atual do motor vale, a memória fica, e a lista mais recente volta sozinha", () => {
  /* O caso real: a antiga era a do site (vista no início), a nova entrou, o
     motor voltou atrás e o proprietário apertou o botão num momento ruim. */
  const h0 = decidirLista(undefined, ANTIGA, T0, { noSite: ANTIGA }).historico;
  const h1 = decidirLista(h0, NOVAS, T1).historico;
  const f = decidirLista(h1, ANTIGA, T2, { forcar: true });
  assert.equal(f.acao, "aplicar");
  assert.match(f.motivo, /forçada/);
  assert.deepEqual(f.historico.aplicada?.fotos, ANTIGA);
  assert.deepEqual(Object.keys(f.historico.vistas).sort(), [assinaturaFotos(ANTIGA), assinaturaFotos(NOVAS)].sort(), "a forçada não apaga a memória");
  /* O motor volta a mostrar as novas (vistas DEPOIS da antiga): entram de novo sozinhas. */
  const r = decidirLista(f.historico, NOVAS, T3);
  assert.equal(r.acao, "aplicar");
  /* E a antiga, de novo: continua sendo a antiga. */
  assert.equal(decidirLista(r.historico, ANTIGA, T3).acao, "ignorar");
  /* Forçada para a lista NOVA quando o motor está bom: a antiga que voltar fica ignorada. */
  const g = decidirLista(h1, NOVAS, T2, { forcar: true });
  assert.equal(g.acao, "aplicar");
  assert.equal(decidirLista(g.historico, ANTIGA, T3).acao, "ignorar");
});

test("lista vazia do motor nunca apaga sozinha; sem nada nos dois lados, nada a fazer", () => {
  const h = decidirLista(undefined, NOVAS, T1, { noSite: NOVAS }).historico;
  const r = decidirLista(h, [], T2);
  assert.equal(r.acao, "ignorar");
  if (r.acao === "ignorar") assert.deepEqual(r.vigente, NOVAS);
  assert.equal(decidirLista(undefined, [], T2, { noSite: [] }).acao, "igual");
  /* Forçada, a lista vazia vale (a pousada tirou tudo e confirmou no painel). */
  assert.equal(decidirLista(h, [], T2, { forcar: true }).acao, "aplicar");
});

test("primeira rodada sem nada no site: a lista do motor entra", () => {
  const r = decidirLista(undefined, ANTIGA, T0, { noSite: [] });
  assert.equal(r.acao, "aplicar");
  assert.deepEqual(r.historico.aplicada?.fotos, ANTIGA);
});

test("histórico corrompido é tratado como vazio; a poda mantém a lista em vigor", () => {
  const r = decidirLista("lixo" as unknown as HistoricoSuite, NOVAS, T1, { noSite: NOVAS });
  assert.equal(r.acao, "igual");
  let h = r.historico;
  for (let i = 0; i < MAX_VISTAS + 10; i++) h = decidirLista(h, [u(`n${i}`)], `2026-11-05T00:${String(i).padStart(2, "0")}:00.000Z`).historico;
  assert.ok(Object.keys(h.vistas).length <= MAX_VISTAS);
  assert.ok(h.aplicada && h.vistas[h.aplicada.assinatura], "a lista em vigor nunca sai das vistas");
});
