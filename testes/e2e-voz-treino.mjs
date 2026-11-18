/**
 * Teste ponta a ponta do MODO VOZ do treinamento (painel).
 *
 * Roda contra um site local (npm start / npm run dev) com banco local, o
 * gateway simulado (testes/gateway-simulado.mjs, porta 4010) e os provedores
 * de voz simulados (testes/voz-simulada.mjs, porta 4020). NUNCA aponte para
 * produção.
 *
 *   BASE=http://localhost:3000 EMAIL=... SENHA=... DATABASE_URL=... \
 *     node testes/e2e-voz-treino.mjs
 *
 * Variáveis que o SERVIDOR precisa ter ao subir (recipe no HANDOFF):
 *   OPENCLAW_GATEWAY_URL=http://localhost:4010 OPENCLAW_GATEWAY_TOKEN=token-teste
 *   VOZ_URL_ELEVENLABS=http://localhost:4020 (TTS e STT simulados)
 *   ELEVENLABS_API_KEY=sk_teste-123  ELEVENLABS_VOICE_ID=RachelPadrao0002
 *
 * O que ele prova:
 *   1. /estado: a Marina está ligada e a voz configurada.
 *   2. /conversar: "anota que ..." faz a Marina PROPOR a ação ensinar, e a
 *      ação volta validada e descrita para o cartão de confirmação.
 *   3. /falar: o texto da Marina vira áudio (voz simulada).
 *   4. /ouvir: um áudio vira texto (Scribe simulado).
 *   5. A sessão (conversa falada) é gravada em marina_voz_sessao — prova que
 *      a tabela é criada pelo próprio site (garantirEsquemaVoz).
 */
import { chromium } from "playwright";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3000";
const falhas = [];
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) falhas.push(msg); };

const sessao = randomUUID();
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
pag.setDefaultTimeout(30000);

try {
  await pag.goto(`${BASE}/admin/login`);
  await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/);
  ok(true, "login no painel");

  // 1. estado
  const est = await (await pag.request.get(`${BASE}/api/admin/marina/voz/estado`)).json();
  ok(est.ok && est.gateway, "estado: a Marina está ligada (gateway)");
  ok(est.voz === true, "estado: a voz está configurada");

  // 2. conversar → ação proposta
  const conv = await (await pag.request.post(`${BASE}/api/admin/marina/voz/conversar`, {
    data: { sessao, mensagem: "anota que o check-in é às 14 horas", historico: [] },
  })).json();
  ok(conv.ok, "conversar: respondeu");
  ok(conv.acao && conv.acao.valido === true, "conversar: a Marina PROPÔS uma ação válida");
  ok(conv.acao?.nome === "ensinar", "conversar: a ação proposta é 'ensinar'");
  ok(typeof conv.acao?.descricao === "string" && conv.acao.descricao.length > 0, "conversar: a ação vem com descrição para confirmar");
  ok(/confirma/i.test(conv.resposta), "conversar: a fala pede confirmação");

  // 3. falar (TTS)
  const fala = await pag.request.post(`${BASE}/api/admin/marina/voz/falar`, {
    data: { sessao, texto: "Oi, aqui é a Marina. Posso ajudar?" },
  });
  ok(fala.ok(), "falar: devolveu áudio (200)");
  ok((fala.headers()["content-type"] ?? "").startsWith("audio/"), "falar: o tipo é áudio");

  // 4. ouvir (STT)
  const ouvir = await (await pag.request.post(`${BASE}/api/admin/marina/voz/ouvir`, {
    multipart: {
      audio: { name: "fala.webm", mimeType: "audio/webm", buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]) },
      sessao, segundos: "3",
    },
  })).json();
  ok(typeof ouvir.texto === "string" && ouvir.texto.length > 0, "ouvir: o áudio virou texto");

  // 5. a sessão foi gravada (tabela criada pelo site)
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
    try {
      const [linha] = await sql`SELECT transcricao, stt_segundos, tts_caracteres FROM marina_voz_sessao WHERE id = ${sessao}`;
      ok(Boolean(linha), "sessão gravada em marina_voz_sessao (tabela criada pelo site)");
      ok(Array.isArray(linha?.transcricao) && linha.transcricao.length >= 2, "a conversa falada foi guardada na transcrição");
      ok((linha?.stt_segundos ?? 0) > 0 || (linha?.tts_caracteres ?? 0) > 0, "o custo da voz foi contabilizado na sessão");
    } finally { await sql.end(); }
  } else {
    console.log("· (sem DATABASE_URL: pulei a conferência da tabela)");
  }

  // 6. confirmar é uma ROTA leve (não Server Action): grava e responde na hora
  {
    const t0 = Date.now();
    const r = await (await pag.request.post(`${BASE}/api/admin/marina/voz/acao`, {
      data: { sessao, nome: conv.acao.nome, dados: conv.acao.dados, fala: "sim" },
    })).json();
    const ms = Date.now() - t0;
    ok(r.ok === true, "acao: a rota gravou o que foi confirmado");
    ok(ms < 5000, `acao: respondeu rápido (${ms} ms), sem esperar a página do painel`);
  }

  // 7. fim do loop: com a ação pendente no contexto, "isso, pode guardar…" faz a
  //    Marina mandar a MESMA ação (o painel trata como sim, sem novo "confirma?")
  {
    const r = await (await pag.request.post(`${BASE}/api/admin/marina/voz/conversar`, {
      data: {
        sessao, mensagem: "isso, pode guardar", historico: [],
        pendente: { nome: conv.acao.nome, dados: conv.acao.dados, descricao: conv.acao.descricao }, situacao: "outra",
      },
    })).json();
    ok(r.acao?.nome === conv.acao.nome && JSON.stringify(r.acao?.dados) === JSON.stringify(conv.acao.dados),
      "conversar: com a ação pendente no contexto, a Marina repropõe a MESMA (vira sim no painel)");
  }

  // 8–10. pela TELA: abrir o painel de voz, ensinar por texto e responder
  const sqlUi = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1, prepare: false }) : null;
  const marcas = [];
  try {
    await pag.goto(`${BASE}/admin`);
    await pag.getByRole("button", { name: "Treinar a Marina por voz" }).click();
    const dialogo = pag.getByRole("dialog", { name: "Treinar a Marina por voz" });
    await dialogo.waitFor();
    const campo = dialogo.getByPlaceholder("…ou escreva aqui");
    await pag.waitForFunction(() => !document.querySelector('[role=dialog] input')?.disabled);
    const chave = dialogo.getByRole("switch");
    if ((await chave.count()) && (await chave.getAttribute("aria-checked")) === "true") await chave.click(); // só texto: o teste não depende de tocar áudio

    const ensinar = async (marca) => {
      marcas.push(marca);
      await campo.fill(`anota que ${marca}`);
      await campo.press("Enter");
      await dialogo.getByRole("button", { name: "Confirmar" }).waitFor({ timeout: 20000 });
    };
    const pronta = () => dialogo.getByText("Pronta quando você quiser").waitFor({ timeout: 10000 });
    const noBanco = async (marca) => sqlUi ? Number((await sqlUi`SELECT count(*)::int AS n FROM marina_conhecimento WHERE conteudo = ${marca} AND excluido_em IS NULL`)[0].n) : -1;

    // 8. botão Confirmar: grava e a tela VOLTA (o travamento relatado)
    const m1 = `e2e voz botao ${Date.now()}`;
    await ensinar(m1);
    ok(true, "UI: a Marina propôs e o cartão Confirmar apareceu");
    await dialogo.getByRole("button", { name: "Confirmar" }).click();
    await pronta();
    ok(true, "UI: depois de Confirmar a tela volta a 'Pronta' (não fica em Pensando/Salvando)");
    ok(await dialogo.getByText("Feito nesta conversa").isVisible(), "UI: aparece em 'Feito nesta conversa'");
    if (sqlUi) ok((await noBanco(m1)) === 1, "UI: Confirmar gravou no banco");

    // 9. responder "sim" escrito: confirma SEM outra ida à Marina
    const m2 = `e2e voz sim ${Date.now()}`;
    await ensinar(m2);
    await campo.fill("Sim, pode salvar para mim.");
    await campo.press("Enter");
    await pronta();
    const ultima = await (await fetch("http://localhost:4010/__ultima")).json().catch(() => null);
    const ultimaFala = JSON.stringify(ultima ?? {});
    ok(!ultimaFala.includes("pode salvar para mim"), "UI: o 'sim' foi resolvido no painel (a Marina não foi chamada de novo)");
    if (sqlUi) ok((await noBanco(m2)) === 1, "UI: o 'sim, pode salvar PARA mim' gravou (o 'para' não cancelou)");

    // 10. responder "não": cancela, nada muda
    const m3 = `e2e voz nao ${Date.now()}`;
    await ensinar(m3);
    await campo.fill("Não, obrigado.");
    await campo.press("Enter");
    await dialogo.getByText("Tudo bem, não vou mexer nisso.").last().waitFor({ timeout: 10000 });
    await pronta();
    ok(true, "UI: o 'não' cancelou e a tela voltou");
    if (sqlUi) ok((await noBanco(m3)) === 0, "UI: depois do 'não' nada foi gravado");
  } finally {
    if (sqlUi) {
      marcas.push(String(conv.acao?.dados?.conteudo ?? "")); // o item que o passo 6 gravou pela rota
      for (const m of marcas.filter(Boolean)) {
        await sqlUi`DELETE FROM marina_historico WHERE conhecimento_id IN (SELECT id FROM marina_conhecimento WHERE conteudo = ${m})`.catch(() => {});
        await sqlUi`DELETE FROM marina_conhecimento WHERE conteudo = ${m}`.catch(() => {});
      }
      await sqlUi.end();
    }
  }
} catch (e) {
  ok(false, "erro inesperado: " + e.message);
} finally {
  await nav.close();
}

console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo no modo voz.");
process.exit(falhas.length ? 1 : 0);
