/**
 * Aviso no celular ligado pelo painel, sem a Vercel (docs/blindagem-whatsapp.md).
 *
 *   node testes/gateway-simulado.mjs                      # porta 4010
 *   servidor local SEM ALERTA_WHATSAPP_URL, com OPENCLAW_GATEWAY_URL=http://localhost:4010
 *     e ALERTA_NTFY_URL=http://localhost:4010/__ntfy (o "ntfy" do simulador)
 *   DATABASE_URL=<banco LOCAL> AGENT_API_KEY=... SENHA=... node testes/e2e-alerta.mjs
 *
 * Liga pelo painel, manda o teste, confere que o vigia usa o tópico criado
 * e que desligar apaga o endereço.
 */
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:3000";
const GW = process.env.GW ?? "http://localhost:4010";
const CHAVE = process.env.AGENT_API_KEY ?? "";
const URL_BANCO = process.env.DATABASE_URL ?? "";
if (!CHAVE || !/localhost|127\.0\.0\.1/.test(URL_BANCO)) { console.error("Precisa de AGENT_API_KEY e DATABASE_URL de um banco LOCAL."); process.exit(2); }

let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? "✓" : "✗"} ${nome}`); if (!cond) falhas++; };
const estadoSim = (e) => fetch(`${GW}/__estado?e=${e}`).then((r) => r.text());
const alertas = () => fetch(`${GW}/__alertas`).then((r) => r.json());
const cron = () => fetch(`${BASE}/api/cron/chamados`, { headers: { authorization: `Bearer ${CHAVE}` } }).then((r) => r.json());
const foto = async (pag, nome) => { if (process.env.CAPTURAS) await pag.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png`, fullPage: true }); };

const sql = postgres(URL_BANCO, { max: 1 });
const nav = await chromium.launch();
try {
  await sql`INSERT INTO marina_escalonamento_config (id, whatsapp_modo) VALUES (1, 'web') ON CONFLICT (id) DO UPDATE SET whatsapp_modo = 'web'`;
  await sql`DELETE FROM integracoes WHERE chave LIKE 'wa_%' OR chave LIKE 'trava:%' OR chave = 'alerta_whatsapp_url'`;
  await estadoSim("conectado");

  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(1200);
  await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/, { timeout: 30000 });

  /* 1. desligado: um botão só */
  await pag.goto(`${BASE}/admin/whatsapp`); await pag.waitForTimeout(1500);
  ok(await pag.getByText("desligado (ligue no cartão abaixo)").isVisible(), "desligado: Saúde e proteções diz como ligar");
  await pag.getByRole("button", { name: "Ligar o aviso no meu celular" }).click();
  await pag.getByText(/Aviso ligado\. Agora assine o tópico/).waitFor({ timeout: 15000 });
  await pag.waitForTimeout(1500);

  /* 2. o tópico criado aparece, igual ao guardado */
  const [linha] = await sql`SELECT valor FROM integracoes WHERE chave = 'alerta_whatsapp_url'`;
  const topico = linha?.valor?.split("/").pop() ?? "";
  ok(/^marimar-[a-hj-km-np-z2-9]{10}$/.test(topico), `ligar: criou um tópico difícil de adivinhar (${topico})`);
  ok(await pag.locator("code", { hasText: topico }).isVisible(), "ligar: a tela mostra o nome do tópico para digitar no app");
  ok(await pag.getByText("ligado (pelo painel)").isVisible(), "ligar: Saúde e proteções mostra ligado");
  await foto(pag, "al-1-ligado");

  /* 3. alerta de teste chega no tópico */
  const antes = (await alertas()).length;
  await pag.getByRole("button", { name: "Mandar alerta de teste" }).click();
  await pag.getByText(/Alerta de teste enviado/).waitFor({ timeout: 15000 });
  const depois = await alertas();
  ok(depois.length === antes + 1 && depois.at(-1)?.topico === topico && /Teste do painel/.test(depois.at(-1)?.texto ?? ""), "teste: chegou no tópico certo");

  /* 4. o vigia usa o tópico do painel quando a Marina cai, sem a Vercel */
  await cron();
  await estadoSim("caido");
  await cron();
  const caiu = (await alertas()).at(-1);
  ok(caiu?.topico === topico && /401/.test(caiu?.texto ?? ""), "vigia: aparelho removido avisa no tópico do painel");
  await estadoSim("conectado");
  await cron();
  ok(/voltou/.test((await alertas()).at(-1)?.texto ?? ""), "vigia: avisa no tópico quando a Marina volta");

  /* 5. desligar apaga o endereço; o teste então diz que está desligado */
  await pag.reload(); await pag.waitForTimeout(1500);
  await pag.getByRole("button", { name: "Desligar o aviso" }).click();
  await pag.getByRole("button", { name: "Ligar o aviso no meu celular" }).waitFor({ timeout: 15000 });
  ok((await sql`SELECT 1 FROM integracoes WHERE chave = 'alerta_whatsapp_url'`).length === 0, "desligar: apagou o endereço");
  await foto(pag, "al-2-desligado");

  /* 6. celular estreito: o nome do tópico não estoura a tela */
  await pag.getByRole("button", { name: "Ligar o aviso no meu celular" }).click();
  await pag.getByText(/Aviso ligado/).waitFor({ timeout: 15000 });
  await pag.setViewportSize({ width: 375, height: 800 }); await pag.reload(); await pag.waitForTimeout(1500);
  const largura = await pag.evaluate(() => document.documentElement.scrollWidth);
  ok(largura <= 375, `celular: sem rolagem para o lado (${largura}px)`);
  await foto(pag, "al-3-celular");
} finally {
  await sql`DELETE FROM integracoes WHERE chave = 'alerta_whatsapp_url'`.catch(() => {});
  await sql.end();
  await nav.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
