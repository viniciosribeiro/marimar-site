/**
 * API oficial do WhatsApp (Meta) e a troca entre as duas formas, de ponta a ponta.
 *
 *   node testes/gateway-simulado.mjs     # porta 4010 (OpenClaw)
 *   node testes/meta-simulada.mjs        # porta 4030 (Graph API)
 *   servidor local com OPENCLAW_GATEWAY_URL=http://localhost:4010,
 *     WHATSAPP_META_GRAPH_URL=http://localhost:4030 e as quatro WHATSAPP_META_*
 *   DATABASE_URL=<banco LOCAL> SENHA=... node testes/e2e-whatsapp-oficial.mjs
 *
 * SÓ roda contra banco local: apaga as conversas "wa:" e volta a forma
 * para o WhatsApp Web no fim.
 */
import { chromium } from "playwright";
import postgres from "postgres";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE ?? "http://localhost:3000";
const META = process.env.META ?? "http://localhost:4030";
const GW = process.env.GW ?? "http://localhost:4010";
const SEGREDO = process.env.WHATSAPP_META_APP_SECRET ?? "segredo-meta-teste";
const VERIFICA = process.env.WHATSAPP_META_VERIFY_TOKEN ?? "palavra-meta-teste";
const PHONE = process.env.WHATSAPP_META_PHONE_ID ?? "PHONE1";
const CLIENTE = "5541988887777";
const URL_BANCO = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(URL_BANCO)) { console.error("Precisa de DATABASE_URL apontando para um banco LOCAL."); process.exit(2); }

let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? "✓" : "✗"} ${nome}`); if (!cond) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const enviadas = async () => (await fetch(`${META}/__enviadas`)).json();
async function aguardar(cond, ms = 25000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await cond()) return true; await esperar(500); }
  return false;
}

function mandar(id, texto, { assinar = true } = {}) {
  const corpo = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "5541995012920", phone_number_id: PHONE },
      contacts: [{ wa_id: CLIENTE, profile: { name: "Ana Teste" } }],
      messages: [{ from: CLIENTE, id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: texto } }],
    } }] }],
  });
  const assinatura = "sha256=" + createHmac("sha256", SEGREDO).update(corpo).digest("hex");
  return fetch(`${BASE}/api/whatsapp/meta`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(assinar ? { "x-hub-signature-256": assinatura } : {}) },
    body: corpo,
  });
}

const sql = postgres(URL_BANCO, { max: 1 });
const nav = await chromium.launch();
try {
  await sql`INSERT INTO marina_escalonamento_config (id, whatsapp_modo) VALUES (1, 'web') ON CONFLICT (id) DO UPDATE SET whatsapp_modo = 'web'`;
  await sql`DELETE FROM chat_mensagens WHERE sessao LIKE 'wa:%'`;
  await sql`DELETE FROM integracoes WHERE chave LIKE 'wa_%'`;
  await fetch(`${META}/__enviadas`, { method: "DELETE" });

  /* 1. a porta do webhook */
  const v = await fetch(`${BASE}/api/whatsapp/meta?hub.mode=subscribe&hub.verify_token=${VERIFICA}&hub.challenge=4242`);
  ok(v.status === 200 && (await v.text()) === "4242", "webhook: a Meta valida o endereço com a palavra certa");
  ok((await fetch(`${BASE}/api/whatsapp/meta?hub.mode=subscribe&hub.verify_token=errada&hub.challenge=1`)).status === 403, "webhook: palavra errada é recusada");
  ok((await mandar("wamid.SEM", "oi", { assinar: false })).status === 401, "webhook: sem assinatura é recusado");

  /* 2. com o WhatsApp Web em uso, a API oficial não responde */
  ok((await mandar("wamid.T0", "Oi, tudo bem?")).status === 200, "modo QR: a Meta recebe 200");
  await esperar(3000);
  ok((await enviadas()).length === 0, "modo QR: nada sai pela API oficial");

  /* 3. painel: trocar para a API oficial */
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(1200);
  await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/, { timeout: 30000 });
  await pag.goto(`${BASE}/admin/whatsapp`); await pag.waitForTimeout(1200);
  ok(await pag.getByText("Pronta, não está em uso").isVisible(), "painel: API oficial pronta, não em uso");
  if (process.env.CAPTURAS) await pag.screenshot({ path: `${process.env.CAPTURAS}/of-1-web.png`, fullPage: true });
  pag.once("dialog", (d) => d.accept());
  await pag.getByRole("button", { name: "Usar a API oficial" }).click();
  await pag.getByText("Pronto: a Marina agora atende pela API oficial da Meta.").waitFor({ timeout: 20000 });
  ok(true, "painel: troca para a API oficial");
  ok((await (await fetch(`${GW}/__rpcs`)).json()).includes("channels.stop"), "painel: pausou o WhatsApp Web no OpenClaw (channels.stop)");
  await pag.waitForTimeout(1500);
  ok(await pag.getByText("Pausado: a Marina está usando a API oficial").isVisible(), "painel: cartão do QR mostra Pausado");
  await pag.getByRole("button", { name: "Testar a ligação com a Meta" }).click();
  await pag.getByText(/A Meta respondeu: número \+55 41 99501-2920, nome “Pousada Marimar”/).waitFor({ timeout: 15000 });
  ok(true, "painel: teste da ligação com a Meta");
  if (process.env.CAPTURAS) await pag.screenshot({ path: `${process.env.CAPTURAS}/of-2-oficial.png`, fullPage: true });

  /* 4. cliente escreve → a Marina responde pela Meta */
  ok((await mandar("wamid.T1", "Tem café da manhã incluso?")).status === 200, "oficial: a Meta recebe 200 na hora");
  const respondeu = await aguardar(async () => (await enviadas()).some((e) => e.tipo === "text" && e.para === CLIENTE));
  ok(respondeu, "oficial: a resposta da Marina saiu pela Meta para o cliente");
  const todas = await enviadas();
  ok(todas.some((e) => e.tipo === "lida" && e.id === "wamid.T1"), "oficial: mensagem marcada como lida");
  const conversa = await sql`SELECT papel FROM chat_mensagens WHERE sessao = ${"wa:" + CLIENTE} ORDER BY criado_em`;
  ok(conversa.map((c) => c.papel).join(",") === "visitante,marina", "oficial: conversa gravada (cliente e Marina)");
  const ultimaAoGateway = await (await fetch(`${GW}/__ultima`)).json();
  ok(ultimaAoGateway?.user === `wa:${CLIENTE}` && /WHATSAPP OFICIAL/.test(ultimaAoGateway?.messages?.[0]?.content ?? ""), "oficial: a Marina sabe que está no WhatsApp oficial");

  /* 5. o mesmo aviso de novo não gera outra resposta */
  const antes = (await enviadas()).length;
  await mandar("wamid.T1", "Tem café da manhã incluso?");
  await esperar(3000);
  ok((await enviadas()).length === antes, "oficial: aviso repetido da Meta não responde duas vezes");

  /* 6. painel: a conversa aparece; Hoje mostra a API oficial */
  await pag.goto(`${BASE}/admin/marina?aba=conversas`); await pag.waitForTimeout(1500);
  ok(await pag.getByText(/WhatsApp · final 7777/).first().isVisible(), "painel: conversa do WhatsApp oficial em Conversas");
  await pag.goto(`${BASE}/admin`); await pag.waitForTimeout(1500);
  ok(await pag.getByText("API oficial da Meta").first().isVisible(), "hoje: semáforo mostra a API oficial");
  ok(!(await pag.getByText("A Marina está fora do WhatsApp").first().isVisible().catch(() => false)), "hoje: sem alarme falso com o QR pausado");

  /* 7. voltar para o WhatsApp Web */
  await pag.goto(`${BASE}/admin/whatsapp`); await pag.waitForTimeout(1200);
  pag.once("dialog", (d) => d.accept());
  await pag.getByRole("button", { name: "Usar o WhatsApp Web" }).click();
  await pag.getByText("Pronto: a Marina voltou para o WhatsApp Web (QR).").waitFor({ timeout: 20000 });
  ok((await (await fetch(`${GW}/__rpcs`)).json()).includes("channels.start"), "painel: religou o WhatsApp Web (channels.start)");
  const antes2 = (await enviadas()).length;
  await mandar("wamid.T2", "Ainda está aí?");
  await esperar(3000);
  ok((await enviadas()).length === antes2, "de volta ao QR: a API oficial para de responder");
} finally {
  await sql`UPDATE marina_escalonamento_config SET whatsapp_modo = 'web' WHERE id = 1`.catch(() => {});
  await sql.end();
  await nav.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
