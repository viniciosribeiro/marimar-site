/**
 * Blindagem do WhatsApp da Marina, de ponta a ponta (docs/blindagem-whatsapp.md).
 *
 *   SIM_WHATSAPP_DESCONECTADO=1 SIM_TRAVA_DEPOIS_DO_QR=1 node testes/gateway-simulado.mjs   # porta 4010
 *   servidor local com OPENCLAW_GATEWAY_URL=http://localhost:4010 e
 *     ALERTA_WHATSAPP_URL=http://localhost:4010/__alerta
 *   DATABASE_URL=<banco LOCAL> AGENT_API_KEY=... SENHA=... node testes/e2e-blindagem.mjs
 *
 * Reproduz os casos reais e confere a reação:
 *   - servidor sem responder: o QR NÃO é gerado (não apaga conexão boa);
 *   - 21/10: o celular lê o QR e a conexão trava → a tela destrava sozinha;
 *   - travado ao abrir a tela → botão Destravar, sem QR;
 *   - travado sem ninguém olhando → o vigia (agendador) destrava;
 *   - 18/10: aparelho removido (401) → alerta no celular, uma vez; ao voltar, outro;
 *   - "Testar envio" repetido no mesmo minuto → o disjuntor segura;
 *   - número da Marina cadastrado na Equipe → recusado;
 *   - painel mostra número, período de adaptação, segurados e histórico.
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
const rpcs = () => fetch(`${GW}/__rpcs`).then((r) => r.json());
const alertas = () => fetch(`${GW}/__alertas`).then((r) => r.json());
const cron = () => fetch(`${BASE}/api/cron/chamados`, { headers: { authorization: `Bearer ${CHAVE}` } }).then((r) => r.json());
const foto = async (pag, nome) => { if (process.env.CAPTURAS) await pag.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png`, fullPage: true }); };

const sql = postgres(URL_BANCO, { max: 1 });
const nav = await chromium.launch();
try {
  await sql`INSERT INTO marina_escalonamento_config (id, whatsapp_modo) VALUES (1, 'web') ON CONFLICT (id) DO UPDATE SET whatsapp_modo = 'web'`;
  await sql`DELETE FROM integracoes WHERE chave LIKE 'wa_%' OR chave LIKE 'trava:%'`;
  await sql`DELETE FROM equipe_contatos WHERE nome LIKE 'Blindagem%'`;
  await estadoSim("caido");

  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(1200);
  await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/, { timeout: 30000 });

  /* 1. servidor sem responder: nada de QR por cima de uma conexão que pode estar boa */
  await pag.goto(`${BASE}/admin/whatsapp`); await pag.waitForTimeout(1200);
  await estadoSim("fora");
  const antesQr = (await rpcs()).filter((m) => m === "web.login.start").length;
  await pag.getByRole("button", { name: "Conectar a Marina" }).click();
  await pag.getByText(/Para não apagar uma conexão que pode estar funcionando/).waitFor({ timeout: 20000 });
  ok((await rpcs()).filter((m) => m === "web.login.start").length === antesQr, "QR: com o servidor sem responder, não gera QR (não apaga conexão boa)");
  await estadoSim("caido");

  /* 2. 21/10: lê o QR, a conexão trava, a tela destrava sozinha */
  await pag.reload(); await pag.waitForTimeout(1200);
  /* Grava cada aviso que passa pela tela: alguns duram menos de 1 s. */
  await pag.evaluate(() => {
    window.__vistos = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[role="status"]')) {
        const t = el.textContent ?? "";
        if (t && !window.__vistos.includes(t)) window.__vistos.push(t);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  const inicio = Date.now();
  await pag.getByRole("button", { name: "Conectar a Marina" }).click();
  await pag.getByRole("img", { name: /QR para conectar/ }).waitFor({ timeout: 15000 });
  await pag.getByText(/Conferindo se a Marina abriu a conexão/).waitFor({ timeout: 20000 });
  ok(true, "QR: depois da leitura, confere a conexão de verdade (não diz Conectada antes)");
  await foto(pag, "bl-1-conferindo");
  await pag.getByText("Conectada! A Marina já está atendendo no WhatsApp.").waitFor({ timeout: 150000 });
  const vistos = await pag.evaluate(() => window.__vistos);
  ok(vistos.some((t) => /travou no servidor .*Destravando sozinha/.test(t)), "QR: a conexão travou e a tela destravou sozinha");
  ok(Date.now() - inicio > 40000, "QR: esperou a conexão abrir antes de mexer");
  ok(await pag.getByText(/Número ligado: \+5541999990000/).isVisible(), "QR: mostra o número ligado");
  const r1 = await rpcs();
  ok(r1.includes("channels.stop") && r1.includes("channels.start"), "QR: destravou com channels.stop + channels.start");
  await foto(pag, "bl-2-conectada");

  /* 3. travado ao abrir a tela: botão Destravar, sem QR */
  await estadoSim("travado");
  await pag.reload(); await pag.waitForTimeout(1500);
  ok(await pag.getByRole("button", { name: "Destravar a conexão" }).isVisible(), "tela: travado mostra Destravar");
  ok(!(await pag.getByRole("button", { name: "Conectar a Marina" }).isVisible()), "tela: travado não oferece QR (apagaria a ligação)");
  await foto(pag, "bl-3-travado");
  await pag.getByRole("button", { name: "Destravar a conexão" }).click();
  await pag.getByText("Conectada! A Marina já está atendendo no WhatsApp.").waitFor({ timeout: 60000 });
  ok(true, "tela: Destravar resolve sem QR");

  /* 4. travado sem ninguém olhando: o vigia destrava pelo agendador */
  await estadoSim("travado");
  const memoria = (await sql`SELECT valor FROM integracoes WHERE chave = 'wa_vigia'`)[0];
  const m = memoria ? JSON.parse(memoria.valor) : {};
  await sql`UPDATE integracoes SET valor = ${JSON.stringify({ ...m, estado: "travado", desde: Date.now() - 10 * 60_000, acoes: [], avisado: null })} WHERE chave = 'wa_vigia'`;
  const c1 = await cron();
  ok(c1.dados?.vigia?.acao === "destravar", "vigia: agendador encontrou travado há 10 min e destravou");
  ok((await estadoSim("")) === "conectado", "vigia: a Marina voltou a ficar conectada");

  /* 5. 18/10: aparelho removido → alerta uma vez; ao voltar, outro */
  await estadoSim("caido");
  const antesRpcs = (await rpcs()).length;
  const antesAlertas = (await alertas()).length;
  await cron();
  const depois1 = await alertas();
  ok(depois1.length === antesAlertas + 1 && /401/.test(depois1.at(-1)?.texto ?? ""), "alerta: aparelho removido avisa no celular (ALERTA_WHATSAPP_URL)");
  await cron();
  ok((await alertas()).length === antesAlertas + 1, "alerta: não repete o mesmo aviso");
  const depoisCaido = (await rpcs()).slice(antesRpcs);
  ok(!depoisCaido.includes("channels.start") && !depoisCaido.includes("channels.stop"), "vigia: 401 não se resolve destravando (não mexe)");
  await estadoSim("conectado");
  await cron();
  ok(/voltou/.test((await alertas()).at(-1)?.texto ?? ""), "alerta: avisa quando a Marina volta");

  /* 6. disjuntor: o mesmo "Testar envio" duas vezes no mesmo minuto */
  await sql`INSERT INTO equipe_contatos (nome, numero, setores, dias, hora_inicio, hora_fim, ordem, ativo)
    VALUES ('Blindagem Teste', '5541977776666', ${sql.json(["geral"])}, ${sql.json([0, 1, 2, 3, 4, 5, 6])}, '00:00', '23:59', 99, true)`;
  await pag.goto(`${BASE}/admin/equipe?aba=equipe`); await pag.waitForTimeout(1500);
  const linha = pag.locator("li").filter({ hasText: "Blindagem Teste" });
  await linha.getByRole("button", { name: /Testar envio/ }).click();
  await pag.getByText(/O WhatsApp confirmou a entrega/).first().waitFor({ timeout: 30000 });
  await linha.getByRole("button", { name: /Testar envio/ }).click();
  await pag.getByText(/Segurado para proteger o número da Marina: a mesma mensagem/).first().waitFor({ timeout: 30000 });
  ok(true, "disjuntor: segunda mensagem igual no mesmo minuto foi segurada");

  /* 7. o número da Marina não entra na Equipe */
  await pag.getByRole("button", { name: /Adicionar pessoa/ }).click();
  await pag.locator('input[name="nome"]').fill("Blindagem Marina");
  await pag.locator('input[name="numero"]').fill("(41) 99999-0000");
  await pag.getByRole("button", { name: "Salvar", exact: true }).click();
  await pag.getByText(/Este é o número que está ligado à Marina/).waitFor({ timeout: 15000 });
  ok(true, "equipe: recusa cadastrar o número da própria Marina");

  /* 8. o painel mostra o que está acontecendo */
  await pag.goto(`${BASE}/admin/whatsapp`); await pag.waitForTimeout(1500);
  ok(await pag.getByText("+5541999990000").first().isVisible(), "painel: número ligado à Marina");
  ok(await pag.getByText("Número novo: período de adaptação").isVisible(), "painel: período de adaptação do número novo");
  ok(await pag.getByText(/[1-9]\d* segurada/).first().isVisible(), "painel: envios segurados nas últimas 24 h");
  ok(await pag.getByText(/Destravamento automático|Destravado pelo painel/).first().isVisible(), "painel: histórico das recuperações");
  await foto(pag, "bl-4-saude");
} finally {
  await sql`DELETE FROM equipe_contatos WHERE nome LIKE 'Blindagem%'`.catch(() => {});
  await sql.end();
  await nav.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
