/**
 * Modo voz — as ações no resto do painel, EXECUTADAS num banco local.
 *   DATABASE_URL=postgres://postgres@localhost:5433/marimar npm test
 *
 * Sem DATABASE_URL local o teste é pulado (o `npm test` normal não tem
 * banco). Cada caso cria o que precisa com nomes "Teste Voz …" e apaga no
 * fim; o conteúdo editável (travessia, atrações, eventos) é guardado antes
 * e devolvido depois.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { ACOES, acaoExiste, catalogoParaPrompt } from "../../src/lib/marina-voz-acoes";

const url = process.env.DATABASE_URL ?? "";
const local = /localhost|127\.0\.0\.1/.test(url);
const pular = { skip: !local && "sem DATABASE_URL local" };

async function rodar(sql: postgres.Sql, nome: string, dados: Record<string, unknown>) {
  const a = ACOES[nome];
  const v = a.validar(dados);
  if (!v.ok) throw new Error(`validar(${nome}): ${v.erro}`);
  const descricao = await a.descrever(sql as never, v.dados);
  const r = await a.executar(sql as never, v.dados, "Teste Voz");
  return { descricao, r };
}

test("catálogo tem as ações do painel inteiro e nenhuma técnica escondida por engano", () => {
  for (const n of ["politicas", "faq", "faq_editar", "cardapio_item", "cardapio_disponivel", "pacote", "banner", "atracao", "travessia", "eventos", "depoimento", "ensinar", "dados_pousada"]) {
    assert.ok(acaoExiste(n, false), n);
    assert.ok(catalogoParaPrompt(false).includes(`- ${n}:`), `catálogo sem ${n}`);
  }
  assert.equal(acaoExiste("apagar_tudo", true), false);
});

test("validar recusa o que não dá para gravar (sem tocar no banco)", () => {
  assert.equal(ACOES.politicas.validar({ check_in: "meio da tarde" }).ok, false);
  assert.equal(ACOES.politicas.validar({}).ok, false);
  assert.deepEqual(ACOES.politicas.validar({ check_in: "14h", check_out: "12" }), { ok: true, dados: { check_in: "14:00", check_out: "12:00" } });
  assert.equal(ACOES.cardapio_item.validar({ nome: "Suco" }).ok, false, "criar sem seção");
  assert.equal(ACOES.pacote.validar({ nome: "X", vigencia_inicio: "20/12/2026", vigencia_fim: "10/12/2026" }).ok, false);
  assert.equal(ACOES.depoimento.validar({ autor: "Ana", texto: "Ótimo", nota: 9 }).ok, false);
  assert.equal(ACOES.travessia.validar({ ida: "cinquenta" }).ok, false);
});

test("políticas: muda horários, pets e pagamento", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    const [antes] = await sql`SELECT * FROM politicas LIMIT 1`;
    const { r } = await rodar(sql, "politicas", { check_out: "12h", pet: true, formas_pagamento: ["Pix", "Cartão"] });
    assert.equal(r.ok, true);
    const [d] = await sql`SELECT check_out, pet, formas_pagamento FROM politicas LIMIT 1`;
    assert.equal(d.check_out, "12:00");
    assert.equal(d.pet, true);
    assert.deepEqual(d.formas_pagamento, ["Pix", "Cartão"]);
    if (antes) await sql`UPDATE politicas SET check_out = ${antes.check_out}, pet = ${antes.pet}, formas_pagamento = ${sql.json(antes.formas_pagamento ?? [])} WHERE id = ${antes.id}`;
    else await sql`DELETE FROM politicas`;
  } finally { await sql.end(); }
});

test("FAQ: cria, acha pelo pedaço da pergunta e tira do site (reversível)", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    const c = await rodar(sql, "faq", { pergunta: "Teste Voz: tem estacionamento?", resposta: "Sim, em Pontal." });
    assert.equal(c.r.ok, true);
    const e = await rodar(sql, "faq_editar", { alvo: "Teste Voz: tem estac", ativo: false });
    assert.equal(e.r.ok, true);
    assert.match(e.descricao, /tirar do site/);
    const [f] = await sql`SELECT ativo FROM faq WHERE pergunta = 'Teste Voz: tem estacionamento?'`;
    assert.equal(f.ativo, false);
    /* ambíguo: pede o nome exato em vez de mexer no errado */
    await sql`INSERT INTO faq (pergunta, resposta) VALUES ('Teste Voz: tem estacionamento coberto?', 'Não.')`;
    const amb = ACOES.faq_editar;
    const r = await amb.executar(sql as never, { alvo: "Teste Voz: tem estac", ativo: true }, "Teste Voz");
    assert.equal(r.ok, false);
  } finally {
    await sql`DELETE FROM faq WHERE pergunta LIKE 'Teste Voz:%'`;
    await sql.end();
  }
});

test("cardápio: cria prato na seção, muda o preço e marca como esgotado", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`INSERT INTO cardapio_categorias (nome, slug) VALUES ('Teste Voz Bebidas', 'teste-voz-bebidas')`;
    const semSecao = await ACOES.cardapio_item.executar(sql as never, { nome: "Teste Voz Suco", secao: "Seção Que Não Existe" }, "Teste Voz");
    assert.equal(semSecao.ok, false);
    const c = await rodar(sql, "cardapio_item", { nome: "Teste Voz Suco de caju", secao: "Teste Voz Bebidas", preco: "12,50" });
    assert.equal(c.r.ok, true);
    const p = await rodar(sql, "cardapio_item", { alvo: "Teste Voz Suco", preco: 14 });
    assert.equal(p.r.ok, true);
    const e = await rodar(sql, "cardapio_disponivel", { alvo: "Teste Voz Suco", disponivel: false });
    assert.equal(e.r.ok, true);
    const [i] = await sql`SELECT preco, disponivel, ativo FROM cardapio_itens WHERE nome = 'Teste Voz Suco de caju'`;
    assert.equal(Number(i.preco), 14);
    assert.equal(i.disponivel, false);
    assert.equal(i.ativo, true);
  } finally {
    await sql`DELETE FROM cardapio_categorias WHERE slug = 'teste-voz-bebidas'`; // leva os itens junto (cascade)
    await sql.end();
  }
});

test("pacote: cria com slug próprio e desliga", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    const c = await rodar(sql, "pacote", { nome: "Teste Voz Réveillon", inclusos: ["Ceia", "Queima de fogos"], vigencia_inicio: "29/12/2026", vigencia_fim: "02/01/2027" });
    assert.equal(c.r.ok, true);
    const d = await rodar(sql, "pacote", { alvo: "Teste Voz Réveillon", ativo: false });
    assert.equal(d.descricao, 'desligar o pacote "Teste Voz Réveillon"');
    const [p] = await sql`SELECT slug, ativo, inclusos FROM pacotes WHERE nome = 'Teste Voz Réveillon'`;
    assert.equal(p.slug, "teste-voz-reveillon");
    assert.equal(p.ativo, false);
    assert.deepEqual(p.inclusos, ["Ceia", "Queima de fogos"]);
  } finally {
    await sql`DELETE FROM pacotes WHERE nome LIKE 'Teste Voz%'`;
    await sql.end();
  }
});

test("banner: desliga e troca o título (a imagem fica)", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`INSERT INTO banners (titulo, imagem_url, ativo) VALUES ('Teste Voz Verão', 'https://exemplo.invalid/b.jpg', true)`;
    const r = await rodar(sql, "banner", { alvo: "Teste Voz Verão", ativo: false, titulo: "Teste Voz Verão 2027" });
    assert.equal(r.r.ok, true);
    const [b] = await sql`SELECT titulo, ativo, imagem_url FROM banners WHERE titulo LIKE 'Teste Voz%'`;
    assert.equal(b.ativo, false);
    assert.equal(b.titulo, "Teste Voz Verão 2027");
    assert.equal(b.imagem_url, "https://exemplo.invalid/b.jpg");
  } finally {
    await sql`DELETE FROM banners WHERE titulo LIKE 'Teste Voz%'`;
    await sql.end();
  }
});

test("travessia, atração e eventos: gravam sem apagar o resto do conteúdo", pular, async () => {
  const sql = postgres(url, { max: 1 });
  const guardado = await sql<{ chave: string; dados: unknown }[]>`SELECT chave, dados FROM conteudo_editavel`;
  try {
    /* algo que a ação NÃO mexe precisa continuar lá */
    await sql`INSERT INTO conteudo_editavel (chave, dados) VALUES ('chegar', ${sql.json({ CHEGADA_ETAPAS: [{ n: 1, titulo: "Teste Voz etapa", texto: "x" }], TRAVESSIA: { site: "https://exemplo.invalid" } } as never)})
      ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados`;
    const t = await rodar(sql, "travessia", { ida: "50", duracao: "30 minutos" });
    assert.equal(t.r.ok, true);
    const [c] = await sql<{ dados: Record<string, any> }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'chegar'`;
    assert.equal(c.dados.TRAVESSIA.precos.ida, 50);
    assert.equal(c.dados.TRAVESSIA.duracao, "30 minutos");
    assert.equal(c.dados.TRAVESSIA.site, "https://exemplo.invalid");
    assert.equal(c.dados.CHEGADA_ETAPAS[0].titulo, "Teste Voz etapa");
    assert.match(c.dados.TRAVESSIA.precos.consultadoEm, /^\d{2}\/\d{2}\/\d{4}$/);

    const a = await rodar(sql, "atracao", { nome: "Teste Voz Gruta", texto: "Uma gruta. Muito bonita." });
    assert.equal(a.r.ok, true);
    const a2 = await rodar(sql, "atracao", { alvo: "Teste Voz Gruta", distancia: "20 min a pé" });
    assert.equal(a2.r.ok, true);
    const [ilha] = await sql<{ dados: Record<string, any> }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'ilha'`;
    const gruta = ilha.dados.ATRACOES.find((x: { nome: string }) => x.nome === "Teste Voz Gruta");
    assert.equal(gruta.slug, "teste-voz-gruta");
    assert.equal(gruta.resumo, "Uma gruta.");
    assert.equal(gruta.distanciaTexto, "20 min a pé");

    const e = await rodar(sql, "eventos", { tipos: "Casamento; Aniversário", capacidade: "até 80 pessoas" });
    assert.equal(e.r.ok, true);
    const [ev] = await sql<{ dados: Record<string, any> }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'eventos'`;
    assert.deepEqual(ev.dados.EVENTOS.tipos, ["Casamento", "Aniversário"]);
    assert.equal(ev.dados.EVENTOS.capacidade, "até 80 pessoas");
  } finally {
    await sql`DELETE FROM conteudo_editavel`;
    for (const l of guardado) await sql`INSERT INTO conteudo_editavel (chave, dados) VALUES (${l.chave}, ${sql.json(l.dados as never)})`;
    await sql.end();
  }
});

test("depoimento: entra com nota e origem", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    const r = await rodar(sql, "depoimento", { autor: "Teste Voz Ana", texto: "Lugar lindo.", origem: "Google", nota: 5 });
    assert.equal(r.r.ok, true);
    const [d] = await sql`SELECT nota, origem, ativo FROM depoimentos WHERE autor = 'Teste Voz Ana'`;
    assert.equal(d.nota, 5);
    assert.equal(d.origem, "Google");
    assert.equal(d.ativo, true);
  } finally {
    await sql`DELETE FROM depoimentos WHERE autor LIKE 'Teste Voz%'`;
    await sql.end();
  }
});
