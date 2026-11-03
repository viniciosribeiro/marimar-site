/**
 * Teste E2E somente leitura dos cards de reservas, incluindo suites cujo
 * cadastro individual nao esta ativo. Nunca clica em Reservar ou WhatsApp.
 * SITE_URL=https://<preview-com-banco> node testes/e2e-cards-reserva.mjs
 * Requer Playwright; falha se a preview nao tem conexao com o banco.
 */
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";

const origem = process.env.SITE_URL;
assert.ok(origem, "SITE_URL e obrigatoria: use uma preview com banco de teste");
const periodos = [
  ["2026-11-10", "2026-11-12"],
  ["2026-12-09", "2026-12-12"],
];
const telas = [
  { nome: "desktop", options: { viewport: { width: 1366, height: 768 } } },
  { nome: "celular", options: devices["Pixel 7"] },
];
const browser = await chromium.launch({ headless: true });
try {
  for (const tela of telas) {
    const context = await browser.newContext(tela.options);
    try {
      for (const [ci, co] of periodos) {
        const pagina = await context.newPage();
        const erros = [];
        pagina.on("pageerror", e => erros.push(e.message));
        try {
          const url = new URL("/reservar", origem);
          url.searchParams.set("check_in", ci);
          url.searchParams.set("check_out", co);
          url.searchParams.set("adultos", "2");
          await pagina.goto(url.toString(), { waitUntil: "domcontentloaded" });
          const imagem = pagina.getByRole("button", { name: /Ver fotos e detalhes de/ });
          await imagem.first().waitFor({ state: "visible", timeout: 60000 });
          assert.ok(await imagem.count() > 0, "a consulta deve devolver suites");

          // Testa a imagem, o nome e Detalhes sem acessar /quartos/[slug].
          const seletores = [
            () => pagina.getByRole("button", { name: /Ver fotos e detalhes de/ }).first(),
            () => pagina.locator("article h3 button").first(),
            () => pagina.getByRole("button", { name: /Ver detalhes do quarto/ }).first(),
          ];
          for (const seletor of seletores) {
            const botao = seletor();
            await botao.click();
            const modal = pagina.getByRole("dialog", { name: /Fotos e detalhes de/ });
            await modal.waitFor({ state: "visible", timeout: 5000 });
            assert.equal(new URL(pagina.url()).pathname, "/reservar", "clique nao navega para 404");
            const linkModal = modal.getByRole("link", { name: "Reservar", exact: true });
            if (await linkModal.count()) {
              const destino = await linkModal.first().getAttribute("href");
              assert.ok(destino?.startsWith("https://reservas.desbravador.com.br/"));
              assert.equal(new URL(destino).searchParams.get("checkin"), ci);
              assert.equal(new URL(destino).searchParams.get("checkout"), co);
              assert.ok(new URL(destino).searchParams.get("roomCode"));
            }
            await modal.getByRole("button", { name: "Fechar detalhes da suíte" }).click();
            await modal.waitFor({ state: "hidden", timeout: 3000 });
          }
          assert.deepEqual(erros, [], `${tela.nome}: erros de script inesperados`);
          console.log("OK", tela.nome, ci, co);
        } finally {
          await pagina.close();
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
