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
} catch (e) {
  ok(false, "erro inesperado: " + e.message);
} finally {
  await nav.close();
}

console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo no modo voz.");
process.exit(falhas.length ? 1 : 0);
