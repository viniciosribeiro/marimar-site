/**
 * Calendario de check-in/check-out: regressao mobile e desktop.
 * SITE_URL=http://localhost:3000 node testes/e2e-calendario-abertura.mjs
 * Requer Playwright + Chromium disponiveis no ambiente. Sem reservas reais.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origem = process.env.SITE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
try {
  for (const dispositivo of [
    { nome: "desktop", viewport: { width: 1366, height: 768 }, mobile: false },
    { nome: "celular", viewport: { width: 390, height: 844 }, mobile: true },
  ]) {
    const contexto = await browser.newContext({
      viewport: dispositivo.viewport,
      isMobile: dispositivo.mobile,
      hasTouch: dispositivo.mobile,
    });
    try {
      const pagina = await contexto.newPage();
      for (const rota of ["/", "/reservar"]) {
        await pagina.goto(new URL(rota, origem).toString(), { waitUntil: "domcontentloaded" });
        const formulario = pagina.locator('form:has(input[name="check_in"])').first();
        const campos = formulario.locator('button[aria-haspopup="dialog"]');
        assert.equal(await campos.count(), 2, "check-in e check-out devem existir");
        const calendario = pagina.getByRole("dialog", { name: "Escolher as datas da estadia" });

        await campos.first().click();
        await calendario.waitFor({ state: "visible", timeout: 10000 });

        if (dispositivo.mobile) {
          // A folha cobre os campos da pagina; troca de foco pelo topo da folha.
          await calendario.locator(".cal-topo__campo").nth(1).click();
          assert.equal(await calendario.isVisible(), true, "trocar foco nao fecha a folha");
          await calendario.locator(".cal-topo__campo").first().click();
        } else {
          // Bug anterior: alternar para check-out fechava todo o calendario.
          await campos.nth(1).click();
          assert.equal(await calendario.isVisible(), true, "troca para check-out deve manter aberto");
          await campos.first().click();
          assert.equal(await calendario.isVisible(), true, "troca para check-in deve manter aberto");
          await campos.first().click();
          assert.equal(await calendario.isVisible(), true, "clique repetido deve continuar aberto");
        }
        const dias = calendario.locator('button.cal-dia:not([disabled])');
        await dias.first().click();
        await dias.nth(2).click();

        const entrada = await formulario.locator('input[name="check_in"]').inputValue();
        const saida = await formulario.locator('input[name="check_out"]').inputValue();
        assert.match(entrada, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(saida > entrada, "check-out deve ser posterior a entrada");

        await calendario.locator(".cal-confirmar").click();
        await calendario.waitFor({ state: "hidden" });
        console.log("OK", dispositivo.nome, rota, entrada, saida);
      }
    } finally {
      await contexto.close();
    }
  }
} finally {
  await browser.close();
}
