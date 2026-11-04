/**
 * Auditoria visual do site: captura cada página pública no celular (iPhone 13)
 * e no computador, fatiada em trechos legíveis, mais os estados de interação
 * (menu, calendário, chat, modal da suíte, lightbox, cardápio, rota).
 *
 * Serve para o "antes e depois" do site novo (docs/plano-site-novo.md) e para
 * conferir qualquer página sem abrir o navegador na mão.
 *
 *   BASE_URL=https://www.pousadamarimarilhadomel.com.br SAIDA=auditoria node testes/auditoria-site.mjs
 *   BASE_URL=http://localhost:3000 PREFIXO=/site-novo SAIDA=auditoria-novo node testes/auditoria-site.mjs
 *
 * Playwright não está no package.json; no ambiente em nuvem ele vem instalado
 * globalmente: `ln -sfn "$(npm root -g)/playwright" node_modules/playwright`.
 * A abertura em vídeo toca uma vez por aba: a primeira página espera 7 s e
 * as seguintes reaproveitam a mesma aba. Nunca clica em Reservar nem em
 * WhatsApp.
 */
import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE_URL || "https://www.pousadamarimarilhadomel.com.br").replace(/\/$/, "");
const PREFIXO = (process.env.PREFIXO || "").replace(/\/$/, "");
const SAIDA = process.env.SAIDA || "auditoria";
const PAGINAS = (process.env.PAGINAS || "/,/quartos,/quartos/suite-queen,/reservar?check_in=2026-12-09&check_out=2026-12-12&adultos=2,/galeria,/restaurante,/como-chegar,/a-pousada,/ilha-do-mel,/pacotes,/eventos,/avaliacoes,/faq,/politicas,/contato").split(",");
const TELAS = [
  { nome: "celular", options: { ...devices["iPhone 13"], deviceScaleFactor: 1 }, fatia: 1100 },
  { nome: "desktop", options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, fatia: 1000 },
];

mkdirSync(join(SAIDA, "fatias"), { recursive: true });
const nomeDe = (tela, p) => (tela + "-" + (p === "/" ? "home" : p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, ""))).slice(0, 60);
const url = (p) => BASE + PREFIXO + (p === "/" ? (PREFIXO ? "" : "/") : p);

const nav = await chromium.launch();
const falhas = new Set();
const relatorio = [];
for (const tela of TELAS) {
  const ctx = await nav.newContext({ ...tela.options, locale: "pt-BR" });
  const pag = await ctx.newPage();
  pag.on("requestfailed", (r) => falhas.add(`${tela.nome} ${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
  pag.on("response", (r) => { if (r.status() >= 400) falhas.add(`${tela.nome} HTTP ${r.status()} ${r.url().slice(0, 120)}`); });
  let primeira = true;
  for (const p of PAGINAS) {
    try {
      await pag.goto(url(p), { waitUntil: "load", timeout: 90000 });
      if (primeira) { await pag.waitForTimeout(7000); primeira = false; }
      await pag.waitForFunction(() => { const a = document.querySelector(".abertura"); if (!a) return true; const s = getComputedStyle(a); return s.opacity === "0" || s.visibility === "hidden" || s.display === "none"; }, null, { timeout: 9000 }).catch(() => {});
      await pag.waitForTimeout(1200);
      await pag.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 500)); });
      const medidas = await pag.evaluate(() => ({
        altura: document.documentElement.scrollHeight, largura: document.documentElement.scrollWidth, janela: window.innerWidth,
        h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 80)),
        semAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length, imagens: document.images.length,
        alvosPequenos: [...document.querySelectorAll("a,button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40); }).length,
      }));
      const nome = nomeDe(tela.nome, p);
      await pag.screenshot({ path: join(SAIDA, `${nome}.jpg`), fullPage: true, type: "jpeg", quality: 60 });
      const largura = tela.options.viewport.width;
      let n = 0;
      for (let y = 0; y < medidas.altura && n < 12; y += tela.fatia, n++) {
        await pag.screenshot({ path: join(SAIDA, "fatias", `${nome}-${String(n).padStart(2, "0")}.jpg`), fullPage: true, type: "jpeg", quality: 62, clip: { x: 0, y, width: largura, height: Math.min(tela.fatia, medidas.altura - y) } });
      }
      relatorio.push({ tela: tela.nome, pagina: p, ...medidas, fatias: n, rolagemLateral: medidas.largura > medidas.janela });
      console.log(`${tela.nome} ${p} altura=${medidas.altura} h1=${JSON.stringify(medidas.h1)} alvos<40px=${medidas.alvosPequenos} lateral=${medidas.largura > medidas.janela ? "SIM" : "não"}`);
    } catch (e) { console.log(`${tela.nome} ${p} ERRO ${e.message.slice(0, 120)}`); relatorio.push({ tela: tela.nome, pagina: p, erro: e.message.slice(0, 200) }); }
  }
  const estado = async (rotulo, fn) => { try { await fn(); await pag.waitForTimeout(900); await pag.screenshot({ path: join(SAIDA, "fatias", `${tela.nome}-estado-${rotulo}.jpg`), type: "jpeg", quality: 62 }); console.log(`${tela.nome} estado ${rotulo} ok`); } catch (e) { console.log(`${tela.nome} estado ${rotulo} ERRO ${e.message.slice(0, 100)}`); } };
  await pag.goto(url("/"), { waitUntil: "load", timeout: 90000 }); await pag.waitForTimeout(1500);
  if (tela.nome === "celular") await estado("menu", async () => { await pag.getByRole("button", { name: /menu/i }).first().click(); });
  await pag.keyboard.press("Escape").catch(() => {});
  await estado("calendario", async () => { await pag.getByText(/escolher data|entrada/i).first().click(); });
  await pag.keyboard.press("Escape").catch(() => {});
  await estado("chat", async () => { await pag.getByRole("button", { name: /abrir atendimento|marina|falar/i }).first().click(); });
  await pag.goto(url("/reservar?check_in=2026-12-09&check_out=2026-12-12&adultos=2"), { waitUntil: "load", timeout: 90000 }); await pag.waitForTimeout(1500);
  await estado("modal-suite", async () => { const b = pag.getByRole("button", { name: /detalhes/i }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); });
  await pag.goto(url("/galeria"), { waitUntil: "load", timeout: 90000 }); await pag.waitForTimeout(1500);
  await estado("lightbox", async () => { await pag.locator("main button").filter({ has: pag.locator("img") }).first().click(); });
  await pag.goto(url("/restaurante"), { waitUntil: "load", timeout: 90000 }); await pag.waitForTimeout(1500);
  await estado("cardapio", async () => { await pag.evaluate(() => document.querySelector("#cardapio")?.scrollIntoView()); });
  await pag.goto(url("/como-chegar") + "#rota", { waitUntil: "load", timeout: 90000 }); await pag.waitForTimeout(2500);
  await estado("rota", async () => { await pag.evaluate(() => document.querySelector("#rota")?.scrollIntoView()); });
  await ctx.close();
}
await nav.close();
writeFileSync(join(SAIDA, "relatorio.json"), JSON.stringify({ base: BASE + PREFIXO, relatorio, falhas: [...falhas] }, null, 2));
console.log(`fim: ${relatorio.length} páginas em ${SAIDA}/ (relatorio.json com medidas e falhas de rede)`);
