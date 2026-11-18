/**
 * Modo voz — as ações no painel, EXECUTADAS num banco local, e o desfazer.
 *   DATABASE_URL=postgres://postgres@localhost:5433/marimar npm test
 *
 * Sem DATABASE_URL local o teste é pulado (o `npm test` normal não tem
 * banco). Cada caso cria o que precisa com nomes "Teste Voz …" e apaga no
 * fim; o conteúdo editável e a linha da pousada são guardados e devolvidos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { ACOES, acaoExiste, catalogoParaPrompt } from "../../src/lib/marina-voz-acoes";
import { mapaDoPainel, retratoDoPainel, AREAS } from "../../src/lib/marina-voz-painel";
import { novoContexto, registrarFeita, desfazerOuRefazer, estadoPilha } from "../../src/lib/marina-voz-desfazer";
import { garantirEsquemaVoz } from "../../src/lib/esquema-voz-treino";

const url = process.env.DATABASE_URL ?? "";
const local = /localhost|127\.0\.0\.1/.test(url);
const pular = { skip: !local && "sem DATABASE_URL local" };
const AUTOR = `Teste Voz ${Date.now()}`;
/* forma solta do jsonb do conteúdo, só para ler nos testes */
type Conteudo = { TRAVESSIA: { precos?: { ida?: number }; duracao?: string; site?: string }; CHEGADA_ETAPAS: { titulo: string }[]; SOBRE_A_ILHA: { bagagem?: string }; ATRACOES: { nome: string }[] };

async function rodar(sql: postgres.Sql, nome: string, dados: Record<string, unknown>) {
  const a = ACOES[nome];
  const v = a.validar(dados);
  if (!v.ok) throw new Error(`validar(${nome}): ${v.erro}`);
  const descricao = await a.descrever(sql as never, v.dados);
  const ctx = novoContexto(sql as never);
  const r = await a.executar(sql as never, v.dados, AUTOR, ctx);
  if (r.ok) await registrarFeita(sql as never, AUTOR, null, nome, r.resumo, await ctx.mudancas());
  return { descricao, r };
}

test("catálogo e mapa cobrem o painel inteiro", () => {
  for (const n of ["criar", "alterar", "politicas", "faq", "cardapio_item", "pacote", "atracao", "travessia", "eventos", "depoimento", "aparencia", "ilha", "ensinar", "dados_pousada"]) {
    assert.ok(acaoExiste(n, false), n);
    assert.ok(catalogoParaPrompt(false).includes(`- ${n}:`), `catálogo sem ${n}`);
  }
  assert.equal(acaoExiste("modelo_site", false), false, "trocar o site dos visitantes é só da Administração");
  assert.equal(acaoExiste("modelo_site", true), true);
  for (const velha of ["faq_editar", "banner", "cardapio_disponivel"]) assert.equal(acaoExiste(velha, true), false, `${velha} virou alterar`);
  const mapa = mapaDoPainel();
  for (const a of AREAS) assert.ok(mapa.includes(`- ${a.id} — `), `mapa sem ${a.id}`);
  assert.match(mapa, /Usuários e senhas/);
});

test("validar recusa o que não dá para gravar (sem tocar no banco)", () => {
  assert.equal(ACOES.politicas.validar({ check_in: "meio da tarde" }).ok, false);
  assert.equal(ACOES.cardapio_item.validar({ nome: "Suco" }).ok, false, "criar sem seção");
  assert.equal(ACOES.travessia.validar({ ida: "cinquenta" }).ok, false);
  assert.equal(ACOES.alterar.validar({ area: "equipe", alvo: "x", campos: { senha: "1" } }).ok, false, "coluna fora do mapa");
  assert.equal(ACOES.alterar.validar({ area: "usuarios", alvo: "x", campos: { ativo: false } }).ok, false, "área fora do mapa");
  assert.equal(ACOES.alterar.validar({ area: "pacotes", alvo: "x", campos: {} }).ok, false, "pacote muda pela ação pacote");
  assert.equal(ACOES.criar.validar({ area: "banners", campos: { titulo: "x" } }).ok, false, "banner novo só pela tela");
  assert.equal(ACOES.criar.validar({ area: "equipe", campos: { nome: "Ana" } }).ok, false, "equipe sem número");
  const dias = ACOES.alterar.validar({ area: "equipe", alvo: "Ana", campos: { dias: "segunda a sexta", setores: ["Restaurante", "reservas"], hora_inicio: "9h" } });
  assert.ok(dias.ok);
  if (dias.ok) assert.deepEqual(dias.dados.campos, { dias: [1, 2, 3, 4, 5], setores: ["restaurante", "reservas"], hora_inicio: "09:00" });
});

test("equipe pela voz: cadastra, muda os dias, desfaz e refaz", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await garantirEsquemaVoz(sql as never);
    const c = await rodar(sql, "criar", { area: "equipe", campos: { nome: "Teste Voz Cecília", numero: "(41) 98888-7777", setores: ["recepcao"] } });
    assert.equal(c.r.ok, true);
    const [criada] = await sql`SELECT numero, setores, dias, ativo FROM equipe_contatos WHERE nome = 'Teste Voz Cecília'`;
    assert.equal(criada.numero, "5541988887777");
    assert.deepEqual(criada.setores, ["recepcao"]);
    assert.deepEqual(criada.dias, [0, 1, 2, 3, 4, 5, 6]);

    const dup = await ACOES.criar.executar(sql as never, { area: "equipe", campos: { nome: "Teste Voz Outra", numero: "5541988887777" } }, AUTOR, novoContexto(sql as never));
    assert.equal(dup.ok, false, "número repetido é recusado");

    const m = await rodar(sql, "alterar", { area: "equipe", alvo: "Teste Voz Cecília", campos: { dias: "segunda a sexta" } });
    assert.equal(m.r.ok, true);
    assert.match(m.descricao, /segunda a sexta/);
    const ler = async () => (await sql`SELECT dias FROM equipe_contatos WHERE nome = 'Teste Voz Cecília'`)[0]?.dias;
    assert.deepEqual(await ler(), [1, 2, 3, 4, 5]);

    assert.equal((await estadoPilha(sql as never, AUTOR)).desfazer !== null, true);
    const d1 = await desfazerOuRefazer(sql as never, AUTOR, "desfazer");
    assert.equal(d1.ok, true, d1.mensagem);
    assert.deepEqual(await ler(), [0, 1, 2, 3, 4, 5, 6], "voltou aos 7 dias");
    const r1 = await desfazerOuRefazer(sql as never, AUTOR, "refazer");
    assert.equal(r1.ok, true, r1.mensagem);
    assert.deepEqual(await ler(), [1, 2, 3, 4, 5], "refez");

    /* mudou por fora (pela tela): o desfazer recusa em vez de atropelar */
    await sql`UPDATE equipe_contatos SET hora_fim = '18:00' WHERE nome = 'Teste Voz Cecília'`;
    const d2 = await desfazerOuRefazer(sql as never, AUTOR, "desfazer");
    assert.equal(d2.ok, false);
    assert.match(d2.mensagem, /mudado depois/);
  } finally {
    await sql`DELETE FROM equipe_contatos WHERE nome LIKE 'Teste Voz%'`;
    await sql`DELETE FROM marina_voz_desfazer WHERE autor = ${AUTOR}`.catch(() => {});
    await sql.end();
  }
});

test("desfazer um cadastro tira o registro; desfazer um ensino manda para a lixeira", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await garantirEsquemaVoz(sql as never);
    await rodar(sql, "faq", { pergunta: "Teste Voz: tem estacionamento?", resposta: "Sim, em Pontal." });
    assert.equal((await desfazerOuRefazer(sql as never, AUTOR, "desfazer")).ok, true);
    assert.equal((await sql`SELECT count(*)::int AS n FROM faq WHERE pergunta LIKE 'Teste Voz:%'`)[0].n, 0);
    assert.equal((await desfazerOuRefazer(sql as never, AUTOR, "refazer")).ok, true);
    assert.equal((await sql`SELECT count(*)::int AS n FROM faq WHERE pergunta LIKE 'Teste Voz:%'`)[0].n, 1);

    await rodar(sql, "ensinar", { tipo: "fato", titulo: "Teste Voz trabalho", conteudo: "Teste Voz: falar com a Cecília." });
    assert.equal((await desfazerOuRefazer(sql as never, AUTOR, "desfazer")).ok, true);
    const [k] = await sql`SELECT excluido_em FROM marina_conhecimento WHERE titulo = 'Teste Voz trabalho'`;
    assert.ok(k.excluido_em, "foi para a lixeira (o histórico continua)");
  } finally {
    await sql`DELETE FROM faq WHERE pergunta LIKE 'Teste Voz:%'`;
    await sql`DELETE FROM marina_historico WHERE conhecimento_id IN (SELECT id FROM marina_conhecimento WHERE titulo LIKE 'Teste Voz%')`;
    await sql`DELETE FROM marina_conhecimento WHERE titulo LIKE 'Teste Voz%'`;
    await sql`DELETE FROM marina_voz_desfazer WHERE autor = ${AUTOR}`.catch(() => {});
    await sql.end();
  }
});

test("ação geral alterar: FAQ, cardápio (esgotou) e banner", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await garantirEsquemaVoz(sql as never);
    await rodar(sql, "faq", { pergunta: "Teste Voz: aceita cartão?", resposta: "Sim." });
    const e = await rodar(sql, "alterar", { area: "faq", alvo: "Teste Voz: aceita", campos: { ativo: false } });
    assert.equal(e.r.ok, true);
    assert.match(e.descricao, /^desligar/);
    assert.equal((await sql`SELECT ativo FROM faq WHERE pergunta = 'Teste Voz: aceita cartão?'`)[0].ativo, false);

    await sql`INSERT INTO cardapio_categorias (nome, slug) VALUES ('Teste Voz Bebidas', 'teste-voz-bebidas')`;
    const c = await rodar(sql, "cardapio_item", { nome: "Teste Voz Suco de caju", secao: "Teste Voz Bebidas", preco: "12,50" });
    assert.equal(c.r.ok, true);
    const esg = await rodar(sql, "alterar", { area: "cardapio", alvo: "Teste Voz Suco", campos: { disponivel: false, preco: 14 } });
    assert.equal(esg.r.ok, true);
    const [i] = await sql`SELECT preco, disponivel FROM cardapio_itens WHERE nome = 'Teste Voz Suco de caju'`;
    assert.equal(Number(i.preco), 14);
    assert.equal(i.disponivel, false);

    await sql`INSERT INTO banners (titulo, imagem_url, ativo) VALUES ('Teste Voz Verão', 'https://exemplo.invalid/b.jpg', true)`;
    const b = await rodar(sql, "alterar", { area: "banners", alvo: "Teste Voz Verão", campos: { ativo: false, titulo: "Teste Voz Verão 2027", termina_em: "10/03/2027" } });
    assert.equal(b.r.ok, true);
    const [bb] = await sql`SELECT titulo, ativo, imagem_url, termina_em FROM banners WHERE titulo LIKE 'Teste Voz%'`;
    assert.equal(bb.ativo, false);
    assert.equal(bb.titulo, "Teste Voz Verão 2027");
    assert.equal(bb.imagem_url, "https://exemplo.invalid/b.jpg");
    assert.equal(new Date(bb.termina_em).getMonth(), 2);
  } finally {
    await sql`DELETE FROM faq WHERE pergunta LIKE 'Teste Voz:%'`;
    await sql`DELETE FROM cardapio_categorias WHERE slug = 'teste-voz-bebidas'`;
    await sql`DELETE FROM banners WHERE titulo LIKE 'Teste Voz%'`;
    await sql`DELETE FROM marina_voz_desfazer WHERE autor = ${AUTOR}`.catch(() => {});
    await sql.end();
  }
});

test("políticas, pacote, conteúdo, aparência: gravam, desfazem e não apagam o resto", pular, async () => {
  const sql = postgres(url, { max: 1 });
  const conteudo = await sql<{ chave: string; dados: unknown }[]>`SELECT chave, dados FROM conteudo_editavel`;
  const [pousada] = await sql`SELECT id, tema, modelo_site, chat_ativo FROM pousada LIMIT 1`;
  const [pol] = await sql`SELECT * FROM politicas LIMIT 1`;
  try {
    await garantirEsquemaVoz(sql as never);
    const p = await rodar(sql, "politicas", { check_out: "12h", pet: true });
    assert.equal(p.r.ok, true);
    assert.equal((await sql`SELECT check_out FROM politicas LIMIT 1`)[0].check_out, "12:00");

    const pk = await rodar(sql, "pacote", { nome: "Teste Voz Réveillon", inclusos: ["Ceia"] });
    assert.equal(pk.r.ok, true);
    assert.equal((await rodar(sql, "pacote", { alvo: "Teste Voz Réveillon", ativo: false })).r.ok, true);

    await sql`INSERT INTO conteudo_editavel (chave, dados) VALUES ('chegar', ${sql.json({ CHEGADA_ETAPAS: [{ n: 1, titulo: "Teste Voz etapa", texto: "x" }], TRAVESSIA: { site: "https://exemplo.invalid" } } as never)})
      ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados`;
    const t = await rodar(sql, "travessia", { ida: "50" });
    assert.equal(t.r.ok, true);
    const [c] = await sql<{ dados: Conteudo }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'chegar'`;
    assert.equal(c.dados.TRAVESSIA.precos?.ida, 50);
    assert.equal(c.dados.CHEGADA_ETAPAS[0].titulo, "Teste Voz etapa");
    assert.equal((await desfazerOuRefazer(sql as never, AUTOR, "desfazer")).ok, true);
    const [c2] = await sql<{ dados: Conteudo }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'chegar'`;
    assert.equal(c2.dados.TRAVESSIA.precos, undefined, "desfazer voltou à linha de antes");

    assert.equal((await rodar(sql, "ilha", { bagagem: "Teste Voz: carrinhos no trapiche." })).r.ok, true);
    assert.equal((await rodar(sql, "atracao", { nome: "Teste Voz Gruta", texto: "Uma gruta. Bonita." })).r.ok, true);
    const [ilha] = await sql<{ dados: Conteudo }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'ilha'`;
    assert.equal(ilha.dados.SOBRE_A_ILHA.bagagem, "Teste Voz: carrinhos no trapiche.");
    assert.ok(ilha.dados.ATRACOES.some((a: { nome: string }) => a.nome === "Teste Voz Gruta"));

    if (pousada) {
      const ap = await rodar(sql, "aparencia", { abertura: false, ceu_por_hora: false });
      assert.equal(ap.r.ok, true);
      const [pp] = await sql`SELECT tema, modelo_site FROM pousada WHERE id = ${pousada.id}`;
      assert.equal(pp.tema.movimento.abertura, false);
      assert.equal(pp.modelo_site.ceu_por_hora, false);
      assert.equal((await desfazerOuRefazer(sql as never, AUTOR, "desfazer")).ok, true);
      const [pv] = await sql`SELECT tema FROM pousada WHERE id = ${pousada.id}`;
      assert.deepEqual(pv.tema, pousada.tema, "aparência voltou");
    }
  } finally {
    await sql`DELETE FROM pacotes WHERE nome LIKE 'Teste Voz%'`;
    await sql`DELETE FROM conteudo_editavel`;
    for (const l of conteudo) await sql`INSERT INTO conteudo_editavel (chave, dados) VALUES (${l.chave}, ${sql.json(l.dados as never)})`;
    if (pousada) await sql`UPDATE pousada SET tema = ${sql.json(pousada.tema ?? {})}, modelo_site = ${pousada.modelo_site ? sql.json(pousada.modelo_site) : null}, chat_ativo = ${pousada.chat_ativo} WHERE id = ${pousada.id}`;
    if (pol) await sql`UPDATE politicas SET check_out = ${pol.check_out}, pet = ${pol.pet} WHERE id = ${pol.id}`;
    else await sql`DELETE FROM politicas`;
    await sql`DELETE FROM marina_voz_desfazer WHERE autor = ${AUTOR}`.catch(() => {});
    await sql.end();
  }
});

test("retrato do painel: mostra a equipe e o resto, sem dado de hóspede", pular, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`INSERT INTO equipe_contatos (nome, numero, setores) VALUES ('Teste Voz Cecília', '5541977776666', ${sql.json(["recepcao"])})`;
    await sql`INSERT INTO leads (nome, telefone, mensagem) VALUES ('Hóspede Secreto Teste', '41900000000', 'oi')`;
    const r = await retratoDoPainel(sql as never);
    assert.match(r, /Equipe \(\d+\): .*Teste Voz Cecília — WhatsApp: 5541977776666; assuntos: Recepção/);
    assert.match(r, /Contatos recebidos não lidos: \d+/);
    assert.ok(!r.includes("Hóspede Secreto Teste"), "nome de hóspede não aparece");
    assert.ok(!r.includes("41900000000"), "telefone de hóspede não aparece");
  } finally {
    await sql`DELETE FROM equipe_contatos WHERE nome LIKE 'Teste Voz%'`;
    await sql`DELETE FROM leads WHERE nome = 'Hóspede Secreto Teste'`;
    await sql.end();
  }
});
