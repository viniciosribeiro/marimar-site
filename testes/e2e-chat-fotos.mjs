/**
 * Chat do site: a foto aparece e o endereço é o oficial, mesmo quando a
 * Marina responde fora do combinado (caso visto em produção em 25/11/2026:
 * "não consigo exibir as fotos aqui" + link de marimar-site.vercel.app).
 *
 * Precisa do site local com banco de teste (ao menos uma suíte ativa com 3
 * fotos visíveis para a Marina) e do `testes/gateway-simulado.mjs`, que no
 * pedido "[teste-fotos]" responde como uma Marina descuidada: marcador de
 * lista, legenda na mesma linha, endereço solto e o endereço técnico da Vercel.
 *
 *   SITE_URL=http://localhost:3000 node testes/e2e-chat-fotos.mjs
 *
 * As fotos são servidas pelo domínio oficial; aqui o navegador recebe uma
 * imagem local no lugar (o teste não depende de rede).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const origem = process.env.SITE_URL ?? "http://localhost:3000";
const OFICIAL = "https://www.pousadamarimarilhadomel.com.br";
const imagemLocal = readFileSync(new URL("../public/abertura/por-do-sol.jpg", import.meta.url));
const telas = [
  { nome: "celular", options: devices["iPhone 13"] },
  { nome: "computador", options: { viewport: { width: 1366, height: 800 } } },
];
let ok = 0;
const confere = (cond, msg) => { assert.ok(cond, msg); ok++; console.log("  ✓", msg); };

const browser = await chromium.launch({ headless: true });
try {
  for (const tela of telas) {
    console.log(`\n${tela.nome}`);
    const ctx = await browser.newContext(tela.options);
    const page = await ctx.newPage();
    const pedidas = [];
    await page.route(`${OFICIAL}/api/midia-**`, (rota) => {
      pedidas.push(rota.request().url());
      return rota.fulfill({ status: 200, contentType: "image/jpeg", body: imagemLocal });
    });
    await page.addInitScript(() => { try { sessionStorage.setItem("marimar_abertura", "1"); } catch {} });
    await page.goto(origem + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6500);   // a abertura do site sai da frente
    const abrir = page.getByRole("button", { name: /Abrir atendimento/ });
    if (await abrir.count()) await abrir.first().click();
    else await page.evaluate(() => window.dispatchEvent(new Event("marimar:abrir-marina")));
    const campo = page.getByPlaceholder("Escreva sua pergunta…");
    await campo.waitFor({ timeout: 15000 });
    await campo.fill("[teste-fotos] quero ver fotos da suíte");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    const janela = page.locator('[aria-label^="Atendimento"]');
    await janela.locator("img").nth(2).waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);

    const visto = await janela.evaluate((el) => ({
      imgs: [...el.querySelectorAll("img")].map((i) => ({ src: i.src, carregou: i.complete && i.naturalWidth > 0, largura: Math.round(i.getBoundingClientRect().width) })),
      links: [...el.querySelectorAll("a")].map((a) => a.href),
      negrito: [...el.querySelectorAll("strong")].map((s) => s.textContent),
      texto: el.innerText,
    }));

    confere(visto.imgs.length === 3, "as 3 fotos aparecem como imagem (lista, legenda na mesma linha e endereço solto)");
    confere(visto.imgs.every((i) => i.src.startsWith(`${OFICIAL}/api/midia-quarto/`)), "toda foto vem do endereço oficial");
    confere(visto.imgs.every((i) => i.carregou && i.largura > 100), "as fotos carregam e têm tamanho de foto");
    confere(!/vercel\.app/.test(visto.texto) && !visto.links.some((l) => /vercel\.app/.test(l)), "nenhum endereço da Vercel na tela nem nos links");
    confere(!visto.texto.includes("![") && !visto.texto.includes("]("), "nenhum resto de markdown aparece para o hóspede");
    const pagina = visto.links.find((l) => l.includes("/quartos/"));
    confere(pagina && pagina.startsWith(`${OFICIAL}/quartos/`) && !pagina.endsWith("."), `o link da página é o oficial e sem o ponto final (${pagina})`);
    confere(visto.negrito.includes("Por dentro"), "a legenda em negrito continua legenda");
    confere(pedidas.length >= 3 && pedidas.every((u) => u.startsWith(OFICIAL)), "o navegador só pediu fotos ao endereço oficial");
    if (process.env.SAIDA) await page.screenshot({ path: `${process.env.SAIDA}/chat-fotos-${tela.nome}.png` });
    await ctx.close();
  }
  console.log(`\n${ok} verificações certas.`);
} finally {
  await browser.close();
}
