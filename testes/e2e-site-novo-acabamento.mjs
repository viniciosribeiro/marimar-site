/**
 * Site novo, fase 6 (acabamento, parte 1 — 04/11/2026): endereço canônico,
 * título e foto de cada suíte e pacote, dados estruturados (JSON-LD) e a
 * página "não encontrada" no desenho novo.
 *
 * Roda contra o site LOCAL (banco local):
 *   BASE_URL=http://localhost:3000 DATABASE_URL=<LOCAL> AUTH_SECRET=<o do servidor local> \
 *   node testes/e2e-site-novo-acabamento.mjs
 *
 * O <head> (canônico, títulos, prévia do link) vale para os dois modelos; os
 * dados estruturados e a página nova de "não encontrada", só para o Novo.
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
const COOKIE = `marimar_previa=${PREVIA}; marimar_ver=novo`;
const WHATSAPP = "WhatsApp/2.23.20.0";

const pagina = async (caminho, { cookie = "", ua } = {}) => {
  const r = await fetch(`${BASE}${caminho}`, { headers: { ...(cookie ? { cookie } : {}), ...(ua ? { "user-agent": ua } : {}) }, redirect: "manual" });
  return { status: r.status, html: await r.text() };
};
const tag = (html, re) => (html.match(re) || [])[1] ?? null;
const canonico = (html) => tag(html, /<link rel="canonical" href="([^"]+)"/);
const titulo = (html) => tag(html, /<title>([^<]*)<\/title>/);
const og = (html, p) => tag(html, new RegExp(`<meta property="og:${p}" content="([^"]*)"`));
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])["@graph"]);
const ehNovo = (html) => html.includes('class="sn ');
const amp = (t) => t?.replace(/&amp;/g, "&");

const [ativa] = await sql`
  SELECT q.slug, q.nome FROM quartos q WHERE q.ativo = true
    AND EXISTS (SELECT 1 FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto') ORDER BY q.ordem LIMIT 1`;
const [desligada] = await sql`SELECT slug FROM quartos WHERE ativo = false ORDER BY ordem LIMIT 1`;
if (!ativa) { console.error("Precisa de uma suíte ativa com foto no banco local."); process.exit(2); }

const nav = await chromium.launch();
try {
  console.log("1. <head> nos dois modelos: canônico sem a consulta, título e prévia de cada página");
  for (const [rotulo, cookie] of [["Clássico", ""], ["Novo", COOKIE]]) {
    const r = await pagina("/reservar?check_in=2026-12-09&check_out=2026-12-12&adultos=2", { cookie });
    conferir(`${rotulo}: /reservar com datas → canônico sem a consulta`, canonico(r.html)?.endsWith("/reservar"), canonico(r.html));
    conferir(`${rotulo}: /reservar com título próprio`, /^Disponibilidade e preços — Pousada Marimar/.test(amp(titulo(r.html)) ?? ""), titulo(r.html));
    const g = await pagina("/galeria", { cookie, ua: WHATSAPP });
    conferir(`${rotulo}: prévia do link com o título da página (/galeria)`, og(g.html, "title") === titulo(g.html) && /^Galeria/.test(og(g.html, "title") ?? ""), og(g.html, "title"));
    conferir(`${rotulo}: og:url = canônico`, og(g.html, "url") === canonico(g.html) && /\/galeria$/.test(og(g.html, "url") ?? ""));
    const s = await pagina(`/quartos/${ativa.slug}`, { cookie, ua: WHATSAPP });
    conferir(`${rotulo}: suíte com título próprio`, new RegExp(`— Pousada Marimar, Ilha do Mel$`).test(amp(titulo(s.html)) ?? "") && !/Reserva Oficial/.test(titulo(s.html) ?? ""), titulo(s.html));
    conferir(`${rotulo}: suíte com a foto na prévia do link`, !!og(s.html, "image"), "sem og:image");
    conferir(`${rotulo}: suíte com descrição própria`, !!tag(s.html, /<meta name="description" content="([^"]*)"/) && !/Consulte disponibilidade e preços no site oficial/.test(tag(s.html, /<meta name="description" content="([^"]*)"/)));
    for (const [c, t] of [["/contato", /^Contato — /], ["/pacotes", /^Pacotes — /]]) {
      const x = await pagina(c, { cookie });
      conferir(`${rotulo}: ${c} com título próprio`, t.test(amp(titulo(x.html)) ?? ""), titulo(x.html));
    }
  }
  const adm = await pagina("/admin/login");
  conferir("painel sem endereço canônico", canonico(adm.html) === null, canonico(adm.html));

  console.log("2. Dados estruturados (JSON-LD): só no Novo, válidos e só com dados confirmados");
  const home = ld((await pagina("/", { cookie: COOKIE })).html);
  const hotel = home.find((n) => n["@type"] === "Hotel");
  conferir("início: a pousada (Hotel) com endereço, mapa e horários", hotel?.address?.postalCode === "83251-000" && hotel?.geo?.latitude && hotel?.checkinTime === "14:00" && hotel?.checkoutTime === "11:00");
  conferir("início: sem nota de outra plataforma nem preço", !/aggregateRating|ratingValue|priceRange|"offers"/.test(JSON.stringify(home)));
  conferir("início: o site (WebSite)", home.some((n) => n["@type"] === "WebSite"));
  const suite = ld((await pagina(`/quartos/${ativa.slug}`, { cookie: COOKIE })).html);
  const quarto = suite.find((n) => n["@type"] === "HotelRoom");
  conferir("suíte: HotelRoom com nome, foto e a pousada", !!quarto?.name && Array.isArray(quarto?.image) && quarto.image.length > 0 && quarto?.containedInPlace?.["@type"] === "Hotel");
  const trilha = suite.find((n) => n["@type"] === "BreadcrumbList")?.itemListElement?.map((i) => i.name);
  conferir("suíte: caminho Início › Suítes › nome", trilha?.length === 3 && trilha[0] === "Início" && trilha[1] === "Suítes" && trilha[2] === quarto?.name, JSON.stringify(trilha));
  const faq = ld((await pagina("/faq", { cookie: COOKIE })).html).find((n) => n["@type"] === "FAQPage");
  conferir("perguntas: FAQPage com as perguntas da página", faq?.mainEntity?.length > 5 && faq.mainEntity.every((q) => q.name && q.acceptedAnswer?.text));
  const rest = ld((await pagina("/restaurante", { cookie: COOKIE })).html).find((n) => n["@type"] === "Restaurant");
  conferir("restaurante: Restaurant sem horário nem telefone pendentes", rest?.name === "Marimar Café Bistrô Bar" && !rest.openingHours && !rest.telephone);
  for (const c of ["/quartos", "/reservar", "/galeria", "/como-chegar", "/ilha-do-mel", "/a-pousada", "/eventos", "/avaliacoes", "/politicas", "/contato", "/pacotes"]) {
    const nos = ld((await pagina(c, { cookie: COOKIE })).html);
    const t = nos.find((n) => n["@type"] === "BreadcrumbList");
    conferir(`${c}: caminho Início › página`, t?.itemListElement?.length === 2 && t.itemListElement[1].item.endsWith(c));
  }
  for (const c of ["/", `/quartos/${ativa.slug}`, "/faq", "/restaurante"]) {
    conferir(`Clássico ${c} sem JSON-LD (o corpo do Clássico não muda)`, ld((await pagina(c)).html).length === 0);
  }

  console.log("3. Página \"não encontrada\"");
  let r = await pagina("/endereco-que-nao-existe", { cookie: COOKIE });
  conferir("Novo: 404 com o desenho novo", r.status === 404 && ehNovo(r.html) && r.html.includes("Não encontramos esta página"));
  conferir("Novo: 404 com os caminhos (suítes, datas, como chegar, perguntas)", ["/quartos", "/reservar", "/como-chegar", "/faq"].every((h) => r.html.includes(`href="${h}"`)));
  conferir("Novo: 404 fora dos buscadores", /<meta name="robots" content="noindex"/.test(r.html));
  r = await pagina("/endereco-que-nao-existe");
  conferir("Clássico: 404 de sempre", r.status === 404 && !ehNovo(r.html) && r.html.includes("Pagina nao encontrada"));
  /* Suíte desligada e pacote inexistente: a página chama notFound() no meio
     do streaming e o Next desenha a "não encontrada" no navegador (o HTML
     cru só traz os dados) — então a conferência é no navegador. */
  const ctxNovo = await nav.newContext();
  await ctxNovo.addCookies([{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }]);
  const p404 = await ctxNovo.newPage();
  for (const [rotulo, caminho] of [...(desligada ? [["suíte desligada", `/quartos/${desligada.slug}`]] : []), ["pacote inexistente", "/pacotes/pacote-que-nao-existe"]]) {
    const resp = await p404.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded" });
    await p404.locator(".sn h1").first().waitFor({ timeout: 10_000 }).catch(() => {});
    const h1 = await p404.locator(".sn h1").first().textContent().catch(() => null);
    conferir(`Novo: ${rotulo} → 404 no desenho novo`, resp?.status() === 404 && h1 === "Não encontramos esta página", `${resp?.status()} ${h1}`);
  }
  await ctxNovo.close();
  r = await pagina("/admin/endereco-que-nao-existe", { cookie: COOKIE });
  conferir("painel: 404 de sempre, mesmo com a prévia", r.status === 404 && !ehNovo(r.html));

  const ctx = await nav.newContext({ ...devices["iPhone 13"] });
  await ctx.addCookies([{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }]);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/endereco-que-nao-existe`, { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(400);
  const medida = await pg.evaluate(() => ({
    h1: document.querySelectorAll("h1").length, larg: document.documentElement.scrollWidth, tela: innerWidth,
    alturas: [...document.querySelectorAll('main a[href="/quartos"], main a[href="/reservar"], main a[href="/como-chegar"], main a[href="/faq"]')].map((a) => a.getBoundingClientRect().height),
  }));
  conferir("celular: um H1 e sem rolagem lateral", medida.h1 === 1 && medida.larg <= medida.tela, JSON.stringify(medida));
  conferir("celular: os quatro caminhos com área de toque ≥ 48 px", medida.alturas.length === 4 && medida.alturas.every((h) => h >= 48), JSON.stringify(medida.alturas));
  await pg.getByRole("link", { name: /Suítes/ }).first().click();
  await pg.waitForURL(/\/quartos$/);
  conferir("celular: o caminho \"Suítes\" leva à lista de suítes", pg.url().endsWith("/quartos"));
  await ctx.close();
} finally {
  await nav.close();
  await sql.end();
}
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
