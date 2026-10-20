/**
 * Tela "WhatsApp da Marina": conectar pelo QR e desconectar, de ponta a ponta.
 *
 *   SIM_WHATSAPP_DESCONECTADO=1 node testes/gateway-simulado.mjs   # porta 4010, começa caído
 *   (servidor local com OPENCLAW_GATEWAY_URL=http://localhost:4010)
 *   SENHA=... node testes/e2e-whatsapp.mjs
 *
 * Cobre: o aviso do Hoje leva à tela; a tela mostra o motivo da queda; o QR
 * aparece, troca sozinho e some quando o celular "lê"; o status vira
 * conectado; desconectar exige escrever DESCONECTAR; quem é Edição não vê os
 * botões. Capturas em CAPTURAS (padrão: não salva).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CAPTURAS = process.env.CAPTURAS ?? "";
let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? "✓" : "✗"} ${nome}`); if (!cond) falhas++; };

async function entrar(pag, email, senha) {
  await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(1200);
  await pag.getByLabel("E-mail").fill(email);
  await pag.getByLabel("Senha", { exact: true }).fill(senha);
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/, { timeout: 30000 });
}
const foto = async (pag, nome) => { if (CAPTURAS) await pag.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true }); };

const nav = await chromium.launch();
try {
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await entrar(pag, process.env.EMAIL ?? "admin@teste.local", process.env.SENHA ?? "teste1234567");

  /* Hoje: o aviso no topo leva à tela nova. */
  await pag.goto(`${BASE}/admin`); await pag.waitForTimeout(1500);
  ok(await pag.getByText("A Marina está fora do WhatsApp").first().isVisible(), "hoje: aviso da Marina fora do WhatsApp");
  await pag.getByRole("link", { name: /Religar/ }).first().click();
  await pag.waitForURL(/\/admin\/whatsapp/, { timeout: 15000 }); await pag.waitForTimeout(800);
  ok(true, "hoje: Religar abre /admin/whatsapp");

  ok(await pag.getByText("Fora do WhatsApp").first().isVisible(), "tela: selo Fora do WhatsApp");
  ok(await pag.getByText("O WhatsApp tirou a Marina dos aparelhos conectados").first().isVisible(), "tela: motivo da queda (401)");
  ok(await pag.getByText("API oficial da Meta").first().isVisible(), "tela: a segunda opção (API oficial) aparece");
  await foto(pag, "wa-1-caida");

  /* Conectar: QR 1, depois QR 2 (troca sozinho), depois conectado. */
  await pag.getByRole("button", { name: "Conectar a Marina" }).click();
  const qr = pag.getByRole("img", { name: /QR para conectar/ });
  await qr.waitFor({ timeout: 15000 });
  const primeiro = await qr.getAttribute("src");
  ok(primeiro?.startsWith("data:image/"), "conectar: QR aparece");
  await foto(pag, "wa-2-qr");
  await pag.waitForFunction((src) => document.querySelector('img[alt^="QR para conectar"]')?.getAttribute("src") !== src, primeiro, { timeout: 15000 });
  ok(true, "conectar: QR troca sozinho");
  await pag.getByText("Conectada! A Marina já está atendendo no WhatsApp.").waitFor({ timeout: 20000 });
  ok(true, "conectar: leitura vira Conectada");
  await foto(pag, "wa-3-conectada");

  await pag.reload(); await pag.waitForTimeout(1200);
  ok(await pag.getByText("Conectada e atendendo").first().isVisible(), "status: Conectada e atendendo depois de recarregar");
  ok(!(await pag.getByRole("button", { name: "Conectar a Marina" }).isVisible()), "status: sem botão Conectar com ela no ar");

  /* Desconectar: só com DESCONECTAR escrito. */
  await pag.getByText("Desconectar a Marina do WhatsApp").click();
  const botaoDesligar = pag.getByRole("button", { name: "Desconectar", exact: true });
  ok(await botaoDesligar.isDisabled(), "desconectar: botão travado sem a confirmação");
  await pag.getByLabel("Escreva DESCONECTAR para confirmar").fill("desconectar");
  await botaoDesligar.click();
  await pag.getByText("A Marina foi desconectada do WhatsApp").waitFor({ timeout: 15000 });
  ok(true, "desconectar: confirma e desconecta");
  await pag.waitForTimeout(1500);
  ok(await pag.getByRole("button", { name: "Conectar a Marina" }).isVisible(), "desconectar: volta o botão Conectar");
  await foto(pag, "wa-4-desconectada");

  /* Celular: aviso para abrir no computador. */
  const cel = await (await nav.newContext({ viewport: { width: 390, height: 844 }, storageState: await pag.context().storageState() })).newPage();
  await cel.goto(`${BASE}/admin/whatsapp`); await cel.waitForTimeout(1500);
  ok(await cel.getByText("Abra esta tela no computador").isVisible(), "celular: avisa para abrir no computador");
  await foto(cel, "wa-5-celular");

  /* Edição: vê o status, não os botões. */
  if (process.env.SENHA_EDICAO) {
    const ed = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await entrar(ed, process.env.EMAIL_EDICAO ?? "cecilia@teste.local", process.env.SENHA_EDICAO);
    await ed.goto(`${BASE}/admin/whatsapp`); await ed.waitForTimeout(1200);
    ok(!(await ed.getByRole("button", { name: "Conectar a Marina" }).isVisible()), "edição: sem botão Conectar");
    ok(await ed.getByText("Só quem tem acesso de Administração conecta ou desconecta").isVisible(), "edição: explica quem pode");
  }
} finally {
  await nav.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
