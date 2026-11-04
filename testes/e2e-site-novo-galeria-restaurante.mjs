/**
 * Site novo, fase 4 (04/11/2026): /galeria e /restaurante no Novo.
 *
 * Roda contra o site LOCAL (banco local):
 *   BASE_URL=http://localhost:3000 DATABASE_URL=<LOCAL> AUTH_SECRET=<o do servidor local> \
 *   node testes/e2e-site-novo-galeria-restaurante.mjs
 *
 * Aceite (docs/plano-site-novo.md §7): tela cheia com teclado e deslize; cardápio
 * vazio explicado. Cria fotos e um item de cardápio de teste e apaga no fim.
 */
import { chromium, devices } from "playwright";
import postgres from "postgres";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const { AUTH_SECRET } = process.env;
if (!process.env.DATABASE_URL || /neon|vercel|amazonaws/i.test(process.env.DATABASE_URL)) { console.error("DATABASE_URL precisa ser o Postgres LOCAL."); process.exit(2); }
if (!AUTH_SECRET) { console.error("AUTH_SECRET (o mesmo do servidor local) é obrigatória."); process.exit(2); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
let ok = 0, falhas = 0;
const conferir = (nome, cond, extra = "") => { if (cond) { ok++; console.log(`  ✓ ${nome}`); } else { falhas++; console.log(`  ✗ ${nome} ${extra}`); } };
const assinar = (fim, exp) => { const b = `v1.${fim}.${exp}`; return `${b}.${createHmac("sha256", AUTH_SECRET).update(b).digest("base64url")}`; };
const PREVIA = assinar("previa", Date.now() + 86_400_000);
const COOKIES = [{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }];
const MARCA = "TESTE-E2E-FASE4";
const FOTOS_PRAIA = ["praia.jpg", "aerea2.jpg", "foto7.jpg", "foto8.jpg", "fachada.jpg", "ambiente.jpg", "slide41.jpg"].map((f) => `/__teste/${f}`);

const limpar = async () => {
  await sql`DELETE FROM midias WHERE alt = ${MARCA}`;
  await sql`DELETE FROM cardapio_itens WHERE nome = 'Moqueca de teste'`;
  await sql`DELETE FROM cardapio_categorias WHERE slug = 'teste-e2e'`;
};
await limpar();

const nav = await chromium.launch();
try {
  console.log("1. Visitante comum continua no Clássico");
  for (const c of ["/galeria", "/restaurante"]) {
    const html = await (await fetch(BASE + c)).text();
    conferir(`${c} sem a classe do Novo`, !html.includes('class="sn '));
  }

  console.log("2. Galeria (prévia)");
  /* 7 fotos de praia: o capítulo mostra 5 e oferece "Ver as 7 fotos". */
  for (const [i, url] of FOTOS_PRAIA.entries()) {
    await sql`INSERT INTO midias (url, alt, tipo, secao, ordem) VALUES (${url}, ${MARCA}, 'foto', 'praia', ${100 + i})`;
  }
  const secoesComFoto = (await sql`
    SELECT DISTINCT CASE WHEN m.quarto_id IS NULL THEN m.secao ELSE 'quarto' END AS s
    FROM midias m LEFT JOIN quartos q ON q.id = m.quarto_id
    WHERE m.tipo = 'foto' AND m.secao <> 'orientacao' AND (m.quarto_id IS NULL OR q.ativo = true)`).map((r) => r.s);
  const suitesComFoto = (await sql`
    SELECT count(DISTINCT q.id)::int AS n FROM midias m JOIN quartos q ON q.id = m.quarto_id WHERE m.tipo = 'foto' AND q.ativo = true`)[0].n;
  {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(COOKIES);
    const p = await ctx.newPage();
    const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(`${BASE}/galeria`, { waitUntil: "networkidle" });
    const capitulos = await p.locator('section[id^="capitulo-"]').evaluateAll((els) => els.map((e) => e.id.replace("capitulo-", "")));
    conferir("um capítulo por seção com foto", secoesComFoto.every((s) => capitulos.includes(s)) && capitulos.length === secoesComFoto.length, `${capitulos} × ${secoesComFoto}`);
    const chips = await p.locator('nav[aria-label="Capítulos da galeria"] a').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    conferir("índice leva a cada capítulo", capitulos.every((c) => chips.includes(`#capitulo-${c}`)));
    const praia = p.locator("#capitulo-praia");
    conferir("capítulo com 7 fotos mostra 5", (await praia.locator("ul > li").count()) === 5);
    await praia.getByRole("button", { name: "Ver as 7 fotos" }).click();
    const tela = p.getByRole("dialog", { name: /^Fotos:/ });
    conferir("'Ver as 7 fotos' abre a tela cheia com as 7", (await tela.getByText("1 de 7").count()) === 1);
    await p.keyboard.press("ArrowRight");
    conferir("seta para a direita passa a foto", (await tela.getByText("2 de 7").count()) === 1);
    await p.keyboard.press("Escape");
    conferir("Esc fecha", !(await tela.isVisible().catch(() => false)));
    if (suitesComFoto) {
      const suites = p.locator("#capitulo-quarto ul > li");
      conferir(`as suítes como capas (${suitesComFoto})`, (await suites.count()) === suitesComFoto);
      await suites.first().locator("button").click();
      conferir("a capa abre as fotos daquela suíte", await p.getByRole("dialog", { name: /^Fotos:/ }).isVisible());
      await p.keyboard.press("Escape");
      const links = await p.locator('#capitulo-quarto a[href^="/quartos/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      const status = await Promise.all(links.map(async (u) => (await fetch(BASE + u, { headers: { cookie: `marimar_previa=${PREVIA}; marimar_ver=novo` } })).status));
      conferir("'Ver a suíte' sem 404", status.every((s) => s === 200), JSON.stringify(status));
    }
    conferir("galeria: sem erro de JavaScript", erros.length === 0, erros.join(" | "));
    await ctx.close();
  }
  {
    const ctx = await nav.newContext({ ...devices["iPhone 13"] });
    await ctx.addCookies(COOKIES);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/galeria`, { waitUntil: "networkidle" });
    conferir("galeria no celular sem rolagem lateral", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const altura = await p.evaluate(() => document.documentElement.scrollHeight);
    conferir(`galeria curta no celular (${altura} px)`, altura < 9000);
    await p.locator("#capitulo-praia ul > li").first().locator("button").click();
    const tela = p.getByRole("dialog", { name: /^Fotos:/ });
    const caixa = await tela.boundingBox();
    if (caixa) {
      await p.mouse.move(caixa.x + caixa.width * 0.8, caixa.y + caixa.height / 2);
      await p.touchscreen.tap(caixa.x + 5, caixa.y + 5).catch(() => {});
    }
    conferir("tela cheia no celular", await tela.isVisible());
    await ctx.close();
  }

  console.log("3. Restaurante (prévia)");
  {
    const ctx = await nav.newContext({ ...devices["iPhone 13"] });
    await ctx.addCookies(COOKIES);
    const p = await ctx.newPage();
    const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    const temCardapio = (await sql`SELECT count(*)::int AS n FROM cardapio_itens i JOIN cardapio_categorias c ON c.id = i.categoria_id WHERE i.ativo AND c.ativo`)[0].n > 0;
    await p.goto(`${BASE}/restaurante`, { waitUntil: "networkidle" });
    conferir("título do restaurante", (await p.locator("h1").innerText()).includes("Marimar Café Bistrô Bar"));
    const mesa = await p.getByRole("link", { name: "Reservar mesa" }).first().getAttribute("href");
    conferir("'Reservar mesa' abre o WhatsApp com a mensagem", !!mesa && mesa.startsWith("https://wa.me/") && decodeURIComponent(mesa).includes("reservar uma mesa"));
    conferir("café da manhã com horário", (await p.locator("#cafe-da-manha").innerText()).includes("08h às 10h"));
    if (!temCardapio) conferir("cardápio vazio explicado", (await p.locator("#cardapio").innerText()).includes("ainda está sendo montado"));
    conferir("sem rolagem lateral", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    conferir("restaurante: sem erro de JavaScript", erros.length === 0, erros.join(" | "));

    /* Com um item publicado, a vitrine do cardápio aparece (a mesma do Clássico). */
    const [cat] = await sql`INSERT INTO cardapio_categorias (nome, slug, ordem, ativo) VALUES ('Teste E2E', 'teste-e2e', 999, true) RETURNING id`;
    await sql`INSERT INTO cardapio_itens (categoria_id, nome, descricao, preco, ativo, disponivel) VALUES (${cat.id}, 'Moqueca de teste', 'Prato criado pelo teste', '89.90', true, true)`;
    await p.goto(`${BASE}/restaurante`, { waitUntil: "networkidle" });
    const cardapio = await p.locator("#cardapio").innerText();
    conferir("cardápio publicado aparece com preço", cardapio.includes("Moqueca de teste") && /R\$\s?89,90/.test(cardapio), cardapio.slice(0, 200));
    /* Com um prato só o bloco é curto (a barra sai junto com ele): confere o "grudar" pela regra aplicada. */
    const topo = await p.locator(".sn-cardapio .sticky").first().evaluate((el) => [getComputedStyle(el).position, getComputedStyle(el).top, getComputedStyle(document.querySelector(".sn")).getPropertyValue("--sn-topo").trim()]);
    conferir("barra das categorias gruda abaixo do topo do Novo", topo[0] === "sticky" && topo[1] === topo[2], JSON.stringify(topo));
    await ctx.close();
  }
} finally {
  await nav.close();
  await limpar();
  await sql.end();
}
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
