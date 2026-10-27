/**
 * Regressao de "Escolher data" mudo apos abrir/fechar/recarregar no iPhone.
 * Nao consulta disponibilidade nem envia reservas.
 * Executar: SITE_URL=https://www.pousadamarimarilhadomel.com.br node testes/e2e-calendario-ios.mjs
 * Requer npm install e browsers Playwright (npx playwright install webkit chromium).
 * WebKit do Playwright e aproximacao, NAO substitui testar em iPhone real.
 */
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const origem = process.env.SITE_URL || "http://localhost:3000";
const navegadores = [
  { nome: "WebKit iPhone simulado", motor: webkit, largura: 390, altura: 844 },
  { nome: "Chromium Android simulado", motor: chromium, largura: 390, altura: 844 },
  { nome: "Chromium desktop", motor: chromium, largura: 1366, altura: 768 },
];

for (const { nome, motor, largura, altura } of navegadores) {
  const browser = await motor.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: largura, height: altura },
    isMobile: largura < 640,
    hasTouch: largura < 640,
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const rota of ["/", "/reservar"]) {
      for (let tentativa = 1; tentativa <= 4; tentativa++) {
        await page.goto(new URL(rota, origem).toString(), { waitUntil: "networkidle" });
        const botoes = page.locator('form button[aria-haspopup="dialog"]');
        await botoes.first().waitFor({ state: "visible", timeout: 15000 });
        assert.equal(await botoes.count(), 2, `${nome} ${rota}: dois campos`);
        await botoes.first().click({ timeout: 10000 });
        const janela = page.getByRole("dialog", { name: "Escolher as datas da estadia" });
        await janela.waitFor({ state: "visible", timeout: 3000 });
        await janela.locator(".cal-topo__campo").nth(1).click();
        assert.equal(await janela.isVisible(), true, "trocar foco nao pode fechar calendario");
        if (largura < 640) await page.locator(".cal-veu").click({ position: { x: 10, y: 10 } });
        else await page.keyboard.press("Escape");
        await janela.waitFor({ state: "hidden", timeout: 3000 });
        console.log("OK", nome, rota, "carregamento", tentativa);
      }
    }
    assert.equal(errors.length, 0, `${nome}: erros de JavaScript: ${errors.join(" | ")}`);
  } finally {
    await context.close();
    await browser.close();
  }
}
