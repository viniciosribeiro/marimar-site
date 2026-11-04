/**
 * Fase 6 do site novo: endereço canônico, título da suíte e dados estruturados (JSON-LD).
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhoCanonico, textoDaSuite, urlDoSite, SITE_PADRAO } from "../../src/lib/seo";
import {
  horaIso, jsonLd, noMigalhas, noPerguntas, noPousada, noRestaurante, noSuite, noSite, idPousada,
} from "../../src/lib/site-novo/dados-estruturados";

const SITE = "https://www.pousadamarimarilhadomel.com.br";

test("urlDoSite: variável sem barra no fim; sem variável, o domínio oficial", () => {
  assert.equal(urlDoSite("https://exemplo.com.br/"), "https://exemplo.com.br");
  assert.equal(urlDoSite(""), SITE_PADRAO);
  assert.equal(urlDoSite("  "), SITE_PADRAO);
});

test("caminhoCanonico: sem consulta nem barra no fim; painel e API sem canônico", () => {
  assert.equal(caminhoCanonico("/"), "/");
  assert.equal(caminhoCanonico("/reservar"), "/reservar");
  assert.equal(caminhoCanonico("/reservar?check_in=2026-12-09&check_out=2026-12-12"), "/reservar");
  assert.equal(caminhoCanonico("/quartos/suite-queen/"), "/quartos/suite-queen");
  assert.equal(caminhoCanonico("/quartos/suite-queen#preco"), "/quartos/suite-queen");
  assert.equal(caminhoCanonico("/admin"), null);
  assert.equal(caminhoCanonico("/admin/modelo-site"), null);
  assert.equal(caminhoCanonico("/api/disponibilidade"), null);
  assert.equal(caminhoCanonico("/administracao-da-praia"), "/administracao-da-praia");
  assert.equal(caminhoCanonico(null), "./");
  assert.equal(caminhoCanonico(""), "./");
});

test("textoDaSuite: texto do painel, senão o do motor, senão a frase com a capacidade", () => {
  const painel = textoDaSuite({ nome: "SUITE QUEEN", ocupacao_max: 2, descricao: "Cama queen,  ar-condicionado e frigobar.", descricao_motor: "Texto do motor" });
  assert.equal(painel.titulo, "Suíte Queen — Pousada Marimar, Ilha do Mel");
  assert.equal(painel.descricao, "Cama queen, ar-condicionado e frigobar.");
  const motor = textoDaSuite({ nome: "SUITE QUEEN", ocupacao_max: 2, descricao: "  ", descricao_motor: "Texto do motor" });
  assert.equal(motor.descricao, "Texto do motor");
  const sem = textoDaSuite({ nome: "STANDARD FAMILIA", ocupacao_max: 4, descricao: null, descricao_motor: null });
  assert.match(sem.descricao, /^Standard Família para até 4 pessoas na Pousada Marimar, em Encantadas, Ilha do Mel\./);
  const uma = textoDaSuite({ nome: "SUITE SOLO", ocupacao_max: 1, descricao: null, descricao_motor: null });
  assert.match(uma.descricao, /para até 1 pessoa na/);
  const longo = textoDaSuite({ nome: "SUITE QUEEN", ocupacao_max: 2, descricao: "palavra ".repeat(60), descricao_motor: null });
  assert.ok(longo.descricao.length <= 160, `descrição longa demais: ${longo.descricao.length}`);
});

test("horaIso: horários da política viram HH:MM; o resto, nulo", () => {
  assert.equal(horaIso("14h"), "14:00");
  assert.equal(horaIso("11h"), "11:00");
  assert.equal(horaIso("08h30"), "08:30");
  assert.equal(horaIso("8h"), "08:00");
  assert.equal(horaIso("a partir das 14h"), null);
  assert.equal(horaIso("25h"), null);
  assert.equal(horaIso(null), null);
});

test("noPousada: endereço, mapa, check-in/out e comodidades confirmadas; nunca nota de outra plataforma", () => {
  const n = noPousada(SITE, { telefone: "+55 (41) 99501-2920", email: null, logo: "/logo.png", fotos: ["https://x.blob/a.jpg", null, "https://x.blob/a.jpg", "/__teste/b.jpg"] });
  assert.equal(n["@type"], "Hotel");
  assert.equal(n["@id"], idPousada(SITE));
  assert.equal(n.url, `${SITE}/`);
  assert.equal(n.telephone, "+55 (41) 99501-2920");
  assert.equal("email" in n, false, "sem e-mail, sem campo");
  assert.equal(n.logo, `${SITE}/logo.png`);
  assert.deepEqual(n.image, ["https://x.blob/a.jpg", `${SITE}/__teste/b.jpg`], "sem repetir e só endereços absolutos");
  assert.equal(n.checkinTime, "14:00");
  assert.equal(n.checkoutTime, "11:00");
  assert.equal(n.petsAllowed, false);
  const end = n.address as Record<string, string>;
  assert.equal(end.postalCode, "83251-000");
  assert.equal(end.addressLocality, "Paranaguá");
  assert.equal(end.addressCountry, "BR");
  assert.ok(Array.isArray(n.amenityFeature) && (n.amenityFeature as unknown[]).length > 5);
  const texto = JSON.stringify(n);
  assert.doesNotMatch(texto, /aggregateRating|ratingValue|reviewCount|priceRange|offers/);
});

test("noSuite e noRestaurante: só o que existe; restaurante sem horário nem telefone pendentes", () => {
  const s = noSuite(SITE, { slug: "suite-queen", nome: "Suíte Queen", descricao: "", fotos: [], ocupacaoMax: 2, cama: " ", metragem: "18", comodidades: ["Wi-Fi"] });
  assert.equal(s["@type"], "HotelRoom");
  assert.equal(s.url, `${SITE}/quartos/suite-queen`);
  assert.equal("description" in s, false);
  assert.equal("image" in s, false);
  assert.equal("bed" in s, false);
  assert.deepEqual(s.floorSize, { "@type": "QuantitativeValue", value: 18, unitCode: "MTK" });
  assert.deepEqual((s.containedInPlace as Record<string, unknown>)["@id"], idPousada(SITE));
  const r = noRestaurante(SITE, { fotos: [null, undefined] });
  assert.equal(r["@type"], "Restaurant");
  assert.equal("image" in r, false);
  assert.doesNotMatch(JSON.stringify(r), /openingHours|telephone|servesCuisine/);
});

test("noPerguntas e noMigalhas", () => {
  assert.equal(noPerguntas(SITE, []), null);
  assert.equal(noPerguntas(SITE, [{ p: " ", r: "x" }]), null);
  const f = noPerguntas(SITE, [{ p: "Tem estacionamento?", r: "Não: a ilha não tem carros." }])!;
  assert.equal((f.mainEntity as unknown[]).length, 1);
  const m = noMigalhas(SITE, [["Suítes", "/quartos"], ["Suíte Queen", "/quartos/suite-queen"]]);
  const itens = m.itemListElement as Record<string, unknown>[];
  assert.deepEqual(itens.map((i) => [i.position, i.name, i.item]), [
    [1, "Início", `${SITE}/`], [2, "Suítes", `${SITE}/quartos`], [3, "Suíte Queen", `${SITE}/quartos/suite-queen`],
  ]);
});

test("jsonLd: um grafo só, e texto do painel não fecha a tag <script>", () => {
  assert.equal(jsonLd([null, undefined]), null);
  const t = jsonLd([noSite(SITE), noPerguntas(SITE, [{ p: "Pergunta</script><script>alert(1)</script>", r: "a & b > c" }])])!;
  assert.doesNotMatch(t, /<|>|&/);
  const lido = JSON.parse(t);
  assert.equal(lido["@context"], "https://schema.org");
  assert.equal(lido["@graph"].length, 2);
  assert.equal(lido["@graph"][1].mainEntity[0].name, "Pergunta</script><script>alert(1)</script>");
  assert.equal(lido["@graph"][1].mainEntity[0].acceptedAnswer.text, "a & b > c");
});

test("painel: Fraunces e Albert Sans no seletor de letras (Identidade visual)", async () => {
  const { FONTES_TITULO, FONTES_CORPO, TODAS_AS_FONTES } = await import("../../src/lib/tema");
  assert.ok(FONTES_TITULO.includes("Fraunces"));
  assert.ok(FONTES_CORPO.includes("Albert Sans"));
  assert.ok(TODAS_AS_FONTES.has("Fraunces") && TODAS_AS_FONTES.has("Albert Sans"), "o layout busca as duas no Google Fonts quando escolhidas");
});
