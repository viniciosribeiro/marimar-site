/**
 * Voz da Marina de ponta a ponta: a mesma no site e no WhatsApp
 * (docs/voz-marina.md).
 *
 *   node testes/gateway-simulado.mjs        # porta 4010 (OpenClaw: config.get / config.patch)
 *   node testes/voz-simulada.mjs            # porta 4020 (ElevenLabs, OpenAI, Google)
 *   servidor local com OPENCLAW_GATEWAY_URL=http://localhost:4010, AUTH_SECRET e
 *     VOZ_URL_ELEVENLABS / VOZ_URL_OPENAI / VOZ_URL_GOOGLE = http://localhost:4020,
 *     SEM ELEVENLABS_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY (conecta pelo painel)
 *   DATABASE_URL=<banco LOCAL> SENHA=... node testes/e2e-voz.mjs
 *
 * Reproduz o defeito de 21/10 (WhatsApp com outra voz) e confere que, depois
 * de salvar, o pedido de áudio do site e a config do OpenClaw dizem a mesma
 * voz, nos três provedores.
 */
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:3000";
const GW = process.env.GW ?? "http://localhost:4010";
const VOZ = process.env.VOZ ?? "http://localhost:4020";
const URL_BANCO = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(URL_BANCO)) { console.error("Precisa de DATABASE_URL de um banco LOCAL."); process.exit(2); }

let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? "✓" : "✗"} ${nome}`); if (!cond) falhas++; };
const json = (u) => fetch(u).then((r) => r.json());
const configOC = () => json(`${GW}/__config`);
const pedidos = () => json(`${VOZ}/__pedidos`);
/** Salva e espera o servidor da Marina mudar de verdade (o aviso verde da gravação anterior pode estar na tela). */
async function salvarEsperando(pag, provedor) {
  await pag.getByRole("button", { name: "Salvar nos dois canais" }).click();
  for (let i = 0; i < 60; i++) {
    const c = await configOC();
    if (c.tts?.provider === provedor && !(await pag.getByRole("button", { name: /Salvando e levando/ }).count())) return c;
    await pag.waitForTimeout(500);
  }
  return configOC();
}
const foto = async (pag, nome) => { if (process.env.CAPTURAS) await pag.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png`, fullPage: true }); };

const sql = postgres(URL_BANCO, { max: 1 });
const nav = await chromium.launch();
try {
  /* estado de 21/10: o site com uma voz, o servidor com outra (e uma camada do canal por cima) */
  await sql`DELETE FROM integracoes WHERE chave LIKE 'chave_voz:%' OR chave = 'voz_marina'`;
  const [cfg] = await sql`SELECT id FROM marina_config LIMIT 1`;
  if (cfg) await sql`UPDATE marina_config SET voz_id = 'MarinaClonada01', voz_modelo = 'eleven_multilingual_v2' WHERE id = ${cfg.id}`;
  else await sql`INSERT INTO marina_config (voz_id) VALUES ('MarinaClonada01')`;
  await sql`UPDATE pousada SET chat_ativo = true`;
  await sql`DELETE FROM chat_mensagens WHERE sessao = 'e2e-voz'`;
  await sql`DELETE FROM chat_voz WHERE sessao = 'e2e-voz'`;
  await sql`INSERT INTO chat_mensagens (sessao, papel, conteudo) VALUES ('e2e-voz', 'marina', 'Oi! O café é das 8 às 10.')`;
  await fetch(`${GW}/__config?reset=1`);
  await fetch(`${GW}/__estado?e=conectado`);
  const vozAntes = (await configOC()).tts.providers.elevenlabs.voiceId;

  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const pag = await ctx.newPage();
  await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(1200);
  await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/, { timeout: 30000 });

  /* 1. o defeito aparece: o WhatsApp está com outra voz */
  await pag.goto(`${BASE}/admin/marina?aba=voz`);
  await pag.getByText("Voz diferente").waitFor({ timeout: 20000 });
  ok(await pag.getByText(/VozDoCanal/).first().isVisible(), "conferência: mostra a voz que o WhatsApp usa de fato (camada do canal)");
  ok(await pag.getByText(/ainda pode trocar a voz/).isVisible(), "conferência: avisa que o modelo pode trocar a voz");
  await foto(pag, "voz-1-diferente");

  /* 2. conectar a ElevenLabs pelo painel: chave errada recusada, certa aceita */
  await pag.getByLabel("Chave da ElevenLabs").fill("sk_errada_0000000000000000");
  await pag.getByRole("button", { name: "Testar e conectar" }).click();
  await pag.getByText(/A chave da ElevenLabs foi recusada/).first().waitFor({ timeout: 15000 });
  ok(true, "conectar: chave recusada pela ElevenLabs não é guardada");
  await pag.getByLabel("Chave da ElevenLabs").fill("sk_teste_eleven_00000000abcd");
  await pag.getByRole("button", { name: "Testar e conectar" }).click();
  await pag.getByText(/ElevenLabs conectada \(chave …abcd\)/).first().waitFor({ timeout: 20000 });
  await pag.getByText("Mesma voz do site").waitFor({ timeout: 20000 });
  ok(true, "conectar: a conta da voz em uso já leva a voz ao WhatsApp, e o cartão do topo mostra");
  const [guardada] = await sql`SELECT valor FROM integracoes WHERE chave = 'chave_voz:elevenlabs'`;
  ok(guardada && guardada.valor.startsWith("v1:") && !guardada.valor.includes("sk_teste"), "conectar: chave guardada cifrada no banco");

  /* 3. as vozes da conta, com a clonada primeiro; escolher e ouvir */
  await pag.getByText("Marina (clonada)").waitFor({ timeout: 15000 });
  ok(await pag.getByText("da sua conta").first().isVisible(), "vozes: lista as vozes da conta (clonada marcada)");
  await pag.getByRole("button", { name: "Ouvir a Marina" }).click();
  await pag.getByRole("button", { name: "Parar" }).waitFor({ timeout: 15000 });
  ok(true, "ouvir: a prova toca no navegador");
  await foto(pag, "voz-2-eleven");

  /* 4. salvar: site e WhatsApp com a mesma voz, conferido no servidor
     (conectar a conta do provedor em uso já levou a voz; salvar confirma) */
  await salvarEsperando(pag, "elevenlabs");
  await pag.getByText("Mesma voz do site").waitFor({ timeout: 30000 });
  let oc = await configOC();
  ok(vozAntes === "VozAntigaDoServidor" && oc.tts.providers.elevenlabs.voiceId === "MarinaClonada01", "salvar: voiceId certo no OpenClaw (campo que ele lê)");
  ok(oc.channels.whatsapp.tts.providers.elevenlabs.voiceId === "MarinaClonada01", "salvar: a camada do canal WhatsApp também recebeu a voz");
  ok(oc.tts.providers.elevenlabs.apiKey === "sk_teste_eleven_00000000abcd", "salvar: o WhatsApp usa a mesma conta (chave) do site");
  ok(oc.tts.modelOverrides?.allowVoice === false && oc.tts.modelOverrides?.allowProvider === false, "salvar: o modelo não troca mais a voz");
  ok(oc.channels.whatsapp.dmPolicy === "open", "salvar: o resto da config do servidor ficou intacto");

  /* 5. o chat do site fala com exatamente os ajustes do WhatsApp */
  const r5 = await fetch(`${BASE}/api/chat/voz`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao: "e2e-voz", texto: "Oi! O café é das 8 às 10." }) });
  const p5 = (await pedidos()).at(-1);
  const vs = oc.tts.providers.elevenlabs.voiceSettings;
  ok(r5.status === 200 && p5.voz === oc.tts.providers.elevenlabs.voiceId && p5.modelo === oc.tts.providers.elevenlabs.modelId
    && p5.ajustes.stability === vs.stability && p5.ajustes.similarity_boost === vs.similarityBoost && p5.ajustes.speed === vs.speed
    && p5.ajustes.style === vs.style && p5.ajustes.use_speaker_boost === vs.useSpeakerBoost && p5.idioma === oc.tts.providers.elevenlabs.languageCode,
  "site = WhatsApp (ElevenLabs): mesma voz, modelo e ajustes");

  /* 6. OpenAI: conectar, ouvir uma voz da lista, jeito de falar, salvar */
  await pag.getByRole("radio", { name: /OpenAI/ }).click();
  await pag.getByLabel("Chave da OpenAI").fill("sk-teste-openai-000000000wxyz");
  await pag.getByRole("button", { name: "Testar e conectar" }).click();
  await pag.getByText(/OpenAI conectada/).first().waitFor({ timeout: 20000 });
  await pag.getByRole("radio", { name: /OpenAI/ }).click();
  await pag.getByRole("button", { name: "Ouvir Coral" }).click();
  let pediuCoral = false;
  for (let i = 0; i < 30 && !pediuCoral; i++) { await pag.waitForTimeout(300); pediuCoral = (await pedidos()).at(-1)?.voz === "coral"; }
  ok(pediuCoral, "openai: ▶ da lista toca a voz certa");
  await pag.locator("li").filter({ hasText: "Coral" }).getByRole("button", { name: "Usar" }).click();
  await pag.getByRole("textbox", { name: /Como ela fala/ }).fill("Fale em português do Brasil, sorrindo, devagar.");
  oc = await salvarEsperando(pag, "openai");
  const ao = oc.tts.providers.openai;
  ok(oc.tts.provider === "openai" && ao.voice === "coral" && ao.model === "gpt-4o-mini-tts" && ao.instructions === "Fale em português do Brasil, sorrindo, devagar." && !("speed" in ao),
    "openai: provedor, voz, modelo e jeito de falar no OpenClaw (sem velocidade, que esse modelo recusa)");
  ok(oc.channels.whatsapp.tts.provider === "openai", "openai: a camada do canal também trocou de provedor");
  await fetch(`${BASE}/api/chat/voz`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao: "e2e-voz", texto: "Oi! O café é das 8 às 10." }) });
  const p6 = (await pedidos()).at(-1);
  ok(p6.provedor === "openai" && p6.voz === ao.voice && p6.modelo === ao.model && p6.instrucoes === ao.instructions, "site = WhatsApp (OpenAI)");

  /* 7. Google: conectar, escolher, salvar; o site toca WAV */
  await pag.getByRole("radio", { name: /Google/ }).click();
  await pag.getByLabel("Chave do Google").fill("AIza-teste-google-0000000qrst");
  await pag.getByRole("button", { name: "Testar e conectar" }).click();
  await pag.getByText(/Google conectado/).first().waitFor({ timeout: 20000 });
  await pag.getByRole("radio", { name: /Google/ }).click();
  await pag.locator("li").filter({ hasText: "Sulafat" }).getByRole("button", { name: "Usar" }).click();
  await pag.getByRole("button", { name: "Ouvir a Marina" }).click();
  await pag.getByRole("button", { name: "Parar" }).waitFor({ timeout: 15000 });
  oc = await salvarEsperando(pag, "google");
  ok(oc.tts.provider === "google" && oc.tts.providers.google.voiceName === "Sulafat" && oc.tts.providers.google.apiKey.endsWith("qrst"), "google: voz e chave no OpenClaw");
  const r7 = await fetch(`${BASE}/api/chat/voz`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao: "e2e-voz", texto: "Oi! O café é das 8 às 10." }) });
  const p7 = (await pedidos()).at(-1);
  ok(r7.headers.get("content-type") === "audio/wav" && p7.voz === "Sulafat" && p7.texto.startsWith(oc.tts.providers.google.audioProfile), "site = WhatsApp (Google): mesma voz e o jeito de falar antes da fala");
  await foto(pag, "voz-3-google");

  /* 8. não desconecta a conta em uso */
  await pag.getByRole("button", { name: "Desconectar" }).click();
  await pag.getByText(/Escolha e salve outra voz antes de desconectar/).first().waitFor({ timeout: 15000 });
  ok(true, "desconectar: recusa a conta que a Marina está usando");

  /* 9. alguém mexeu na config do servidor no meio: lê de novo e grava */
  await fetch(`${GW}/__config?conflito=1`);
  await pag.getByRole("radio", { name: /ElevenLabs/ }).click();
  ok((await salvarEsperando(pag, "elevenlabs")).tts.provider === "elevenlabs", "conflito de versão: tenta de novo com o hash novo e grava");
  await pag.getByText("Mesma voz do site").waitFor({ timeout: 20000 });

  /* 10. servidor fora: diz que não deu para conferir (não finge) */
  await fetch(`${GW}/__estado?e=fora`);
  await pag.getByRole("button", { name: "Conferir de novo" }).click();
  await pag.getByText("Não deu para conferir").waitFor({ timeout: 20000 });
  ok(true, "servidor fora: a tela diz que não conferiu");
  await fetch(`${GW}/__estado?e=conectado`);

  /* 11. celular */
  await pag.setViewportSize({ width: 375, height: 800 });
  await pag.reload(); await pag.getByText("Mesma voz do site").waitFor({ timeout: 20000 });
  const largura = await pag.evaluate(() => document.documentElement.scrollWidth);
  ok(largura <= 375, `celular: sem rolagem para o lado (${largura}px)`);
  const vazando = await pag.evaluate(() => [...document.querySelectorAll("ul > li")].filter((li) => {
    const pai = li.parentElement.getBoundingClientRect(), r = li.getBoundingClientRect();
    return li.scrollWidth > li.clientWidth + 1 || r.right > pai.right + 1;
  }).length);
  ok(vazando === 0, `celular: nada sai pela borda dos cartões de voz (${vazando})`);
  await foto(pag, "voz-4-celular");
} finally {
  await sql.end();
  await nav.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
