/**
 * Captura telas do painel em três larguras (celular, tablet, desktop),
 * para revisar visual e responsividade sem abrir o navegador na mão.
 *
 *   BASE=http://localhost:3000 SAIDA=./capturas node testes/capturas.mjs /admin /admin/marina?aba=conhecimento
 *
 * Sem rotas na linha de comando, captura todas as telas do painel.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SAIDA = process.env.SAIDA ?? "capturas";
const LARGURAS = (process.env.LARGURAS ?? "375,768,1440").split(",").map(Number);
const ROTAS = process.argv.slice(2).length ? process.argv.slice(2) : [
  "/admin/login", "/admin", "/admin/marina?aba=visao", "/admin/marina?aba=conhecimento", "/admin/marina?aba=testar",
  "/admin/marina?aba=sem-resposta", "/admin/marina?aba=conversas", "/admin/marina?aba=documentos",
  "/admin/marina?aba=personalidade", "/admin/marina?aba=voz", "/admin/marina?aba=historico",
  "/admin/pousada", "/admin/quartos", "/admin/categorias", "/admin/comodidades", "/admin/midias", "/admin/cardapio",
  "/admin/banners", "/admin/blocos-home", "/admin/cartoes", "/admin/pacotes", "/admin/passeios", "/admin/depoimentos",
  "/admin/faq", "/admin/politicas", "/admin/conteudo", "/admin/atracoes", "/admin/identidade-visual", "/admin/leads",
  "/admin/integracoes", "/admin/diagnostico", "/admin/usuarios", "/admin/trocar-senha",
];

mkdirSync(SAIDA, { recursive: true });
const nav = await chromium.launch();
const ctx = await nav.newContext();
const pag = await ctx.newPage();
await pag.goto(`${BASE}/admin/login`);
await pag.waitForTimeout(1500);
await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
await pag.getByRole("button", { name: "Entrar no painel" }).click();
await pag.waitForURL(/\/admin(\?|$)/, { timeout: 30000 });

const problemas = [];
for (const rota of ROTAS) {
  for (const w of LARGURAS) {
    const p = rota === "/admin/login" ? await (await nav.newContext()).newPage() : pag;
    await p.setViewportSize({ width: w, height: w < 500 ? 812 : w < 1000 ? 1024 : 900 });
    const resp = await p.goto(BASE + rota, { waitUntil: "networkidle" }).catch((e) => ({ status: () => e.message }));
    await p.waitForTimeout(400);
    /* Rolagem horizontal no celular é o defeito mais comum de layout. */
    const vazou = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (vazou > 1) problemas.push(`${rota} @${w}px: ${vazou}px de rolagem horizontal`);
    if (resp.status && resp.status() !== 200) problemas.push(`${rota} @${w}px: status ${resp.status()}`);
    const nome = rota.replace(/^\/admin\/?/, "").replace(/[?=&/]+/g, "-") || "painel";
    await p.screenshot({ path: `${SAIDA}/${nome}@${w}.png`, fullPage: true });
    if (p !== pag) await p.context().close();
  }
}
await nav.close();
console.log(problemas.length ? problemas.join("\n") : "Sem rolagem horizontal nem erro de status.");
