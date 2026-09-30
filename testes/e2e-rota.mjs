/**
 * A rota até a pousada, pela tela, com serviços de mapa simulados.
 *
 *   node testes/mapa-simulado.mjs          # porta 4020
 *   (config da rota no banco local apontando para http://localhost:4020 —
 *    ver docs/fluxo-rota.md, "Testar localmente")
 *   SAIDA=capturas node testes/e2e-rota.mjs
 *
 * Cobre: computador (origem digitada → carro + barco + a pé, trocar estilo,
 * 3D, QR para o celular), iPhone simulado com GPS (já na ilha → só a pé,
 * navegação ao vivo, "você chegou"), Android com link compartilhado e o
 * painel Rota e mapa (pinos arrastáveis; não salva).
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SAIDA = process.env.SAIDA ?? "capturas";
mkdirSync(SAIDA, { recursive: true });
const falhas = [];
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) falhas.push(m); };
const TRAPICHE = { latitude: -25.5719, longitude: -48.3157 };
const POUSADA = { latitude: -25.56845, longitude: -48.31519 };

const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  /* ── computador ─────────────────────────────────────────────── */
  const pc = await (await nav.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const erros = [];
  pc.on("pageerror", (e) => erros.push(e.message));
  pc.on("console", (m) => { if (m.type() === "error" && !/CERT|Failed to load resource/.test(m.text())) erros.push(m.text().slice(0, 200)); });
  await pc.goto(`${BASE}/como-chegar`); await pc.waitForTimeout(1500);
  await pc.locator("#rota").scrollIntoViewIfNeeded(); await pc.waitForTimeout(3500);
  ok(await pc.getByRole("button", { name: "Usar minha localização" }).isVisible(), "pc: botão de localização");
  ok(!(await pc.getByText(/Plus Code/i).count()), "pc: nada de “Plus Code” na página");
  await pc.getByPlaceholder(/Ou digite de onde vai sair/).fill("Curitiba"); await pc.waitForTimeout(1200);
  await pc.getByRole("button", { name: /^Curitiba/ }).first().click(); await pc.waitForTimeout(3000);
  ok(await pc.getByText("De carro até Terminal de Pontal do Sul").isVisible(), "pc: trecho de carro até o terminal");
  ok(await pc.getByText(/Barco até Trapiche de Encantadas/).isVisible(), "pc: trecho de barco");
  ok(await pc.getByText("A pé até a pousada").isVisible(), "pc: trecho a pé");
  await pc.getByRole("radio", { name: /De ônibus/ }).click(); await pc.waitForTimeout(1500);
  ok(await pc.getByText(/De ônibus até/).isVisible(), "pc: troca para ônibus");
  await pc.getByRole("radio", { name: /Terminal de Paranaguá/ }).click(); await pc.waitForTimeout(1500);
  ok(await pc.getByText(/até Terminal de Paranaguá/).isVisible(), "pc: troca de terminal");
  await pc.getByRole("button", { name: "Claro", exact: true }).click();
  await pc.getByRole("button", { name: /3D/ }).click(); await pc.waitForTimeout(800);
  await pc.getByRole("button", { name: /Abrir no celular/ }).click(); await pc.waitForTimeout(800);
  ok(await pc.locator("#rota svg path").count() > 0, "pc: QR code para abrir no celular");
  await pc.locator("#rota").screenshot({ path: `${SAIDA}/rota-computador.png` });
  const saved = await pc.evaluate(() => localStorage.getItem("marimar:rota-salva"));
  ok(!!saved && JSON.parse(saved).trechos.length === 3, "pc: rota guardada no aparelho (sinal fraco)");
  ok(erros.length === 0, `pc: sem erros no console${erros.length ? " — " + erros.join(" | ") : ""}`);

  /* ── iPhone com GPS, já na ilha ─────────────────────────────── */
  const ctx = await nav.newContext({ ...devices["iPhone 13"], geolocation: TRAPICHE, permissions: ["geolocation"] });
  const cel = await ctx.newPage();
  await cel.goto(`${BASE}/como-chegar#rota`); await cel.waitForTimeout(4000);
  await cel.getByRole("button", { name: "Usar minha localização" }).click(); await cel.waitForTimeout(3000);
  ok(await cel.getByText("A pé até a pousada").isVisible() && !(await cel.getByText(/De carro até/).count()), "iPhone: já na ilha → só a pé");
  ok(await cel.getByRole("link", { name: "Apple Maps" }).isVisible(), "iPhone: plano B no Apple Maps");
  await cel.screenshot({ path: `${SAIDA}/rota-iphone.png`, fullPage: false });
  await cel.getByRole("button", { name: /Começar a navegação/ }).click(); await cel.waitForTimeout(2500);
  ok(await cel.getByText(/Próximo|Procurando/).first().isVisible(), "iPhone: navegação ao vivo aberta");
  await cel.screenshot({ path: `${SAIDA}/rota-navegando.png` });
  await ctx.setGeolocation(POUSADA); await cel.waitForTimeout(3000);
  ok(await cel.getByRole("dialog", { name: "Você chegou" }).isVisible(), "iPhone: “você chegou” na porta da pousada");

  /* ── Android, link compartilhado ────────────────────────────── */
  const and = await (await nav.newContext({ ...devices["Pixel 7"] })).newPage();
  await and.goto(`${BASE}/como-chegar?de=-25.4284,-49.2733&terminal=pontal&modo=carro#rota`); await and.waitForTimeout(5000);
  ok(await and.getByText("De carro até Terminal de Pontal do Sul").isVisible(), "Android: link compartilhado abre a rota pronta");
  ok(await and.getByRole("link", { name: "Waze" }).isVisible() && !(await and.getByRole("link", { name: "Apple Maps" }).count()), "Android: plano B no Google Maps/Waze");

  /* ── painel: Rota e mapa (só abre e confere; não salva) ─────── */
  const adm = await (await nav.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await adm.goto(`${BASE}/admin/login`);
  await adm.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await adm.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await adm.getByRole("button", { name: "Entrar no painel" }).click();
  await adm.waitForURL(/\/admin(\?|$)/);
  await adm.goto(`${BASE}/admin/rota`);
  await adm.locator(".rota-pino--arrastavel").nth(3).waitFor({ timeout: 20000 }).catch(() => {});
  ok(await adm.locator(".rota-pino--arrastavel").count() >= 4, "painel: pousada, trapiche e terminais arrastáveis no mapa");
  const pino = await adm.locator(".rota-pino:has(.rota-marcador--trapiche)").boundingBox();
  await adm.mouse.move(pino.x + pino.width / 2, pino.y + pino.height / 2); await adm.mouse.down();
  await adm.mouse.move(pino.x + 60, pino.y + 40, { steps: 8 }); await adm.mouse.up();
  ok(await adm.getByText("Há mudanças não salvas.").isVisible(), "painel: arrastar marca mudança para salvar");
  await adm.screenshot({ path: `${SAIDA}/rota-painel.png` });
} catch (e) {
  falhas.push(e.message); console.error("✗", e.message);
} finally {
  await nav.close();
}
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
