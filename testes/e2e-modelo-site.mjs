/**
 * Site → Modelo do site (04/11/2026): a chave Clássico/Novo, a prévia e a
 * página inicial nova.
 *
 * Roda contra o site LOCAL (banco local, motor simulado na 4011):
 *   BASE_URL=http://localhost:3000 DATABASE_URL=<LOCAL> AUTH_SECRET=<o do servidor local> \
 *   EMAIL=admin@teste.local SENHA=<senha local> node testes/e2e-modelo-site.mjs
 *
 * Mexe em pousada.modelo_site e volta ao estado de antes no fim.
 */
import { chromium, devices } from "playwright";
import postgres from "postgres";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const { AUTH_SECRET, EMAIL, SENHA } = process.env;
if (!process.env.DATABASE_URL || /neon|vercel|amazonaws/i.test(process.env.DATABASE_URL)) { console.error("DATABASE_URL precisa ser o Postgres LOCAL."); process.exit(2); }
if (!AUTH_SECRET) { console.error("AUTH_SECRET (o mesmo do servidor local) é obrigatória."); process.exit(2); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
let ok = 0, falhas = 0;
const conferir = (nome, cond, extra = "") => { if (cond) { ok++; console.log(`  ✓ ${nome}`); } else { falhas++; console.log(`  ✗ ${nome} ${extra}`); } };
const assinar = (fim, exp) => { const base = `v1.${fim}.${exp}`; return `${base}.${createHmac("sha256", AUTH_SECRET).update(base).digest("base64url")}`; };
const ehNovo = (html) => html.includes('id="sn-titulo"');
const pagina = async (caminho, cookie = "") => (await fetch(BASE + caminho, { headers: cookie ? { cookie } : {}, redirect: "manual" })).text();
const cookiesDe = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const temColuna = (await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'pousada' AND column_name = 'modelo_site'`).length > 0;
const antes = temColuna ? (await sql`SELECT modelo_site FROM pousada LIMIT 1`)[0]?.modelo_site ?? null : null;

try {
  console.log("1. Visitante comum");
  conferir("vê o Clássico", !ehNovo(await pagina("/")));

  console.log("2. Link de prévia");
  let r = await fetch(`${BASE}/api/modelo-site/previa?t=lixo`, { redirect: "manual" });
  conferir("link adulterado: 403 com explicação", r.status === 403 && (await r.text()).includes("venceu"));
  r = await fetch(`${BASE}/api/modelo-site/previa?t=${encodeURIComponent(assinar("entrar", Date.now() - 1000))}`, { redirect: "manual" });
  conferir("link vencido: 403", r.status === 403);
  r = await fetch(`${BASE}/api/modelo-site/previa?t=${encodeURIComponent(assinar("previa", Date.now() + 60_000))}`, { redirect: "manual" });
  conferir("cookie usado como link: 403", r.status === 403);
  r = await fetch(`${BASE}/api/modelo-site/previa?t=${encodeURIComponent(assinar("entrar", Date.now() + 600_000))}`, { redirect: "manual" });
  const sc = r.headers.getSetCookie().join(" | ");
  conferir("link válido: 303 para a página inicial", r.status === 303 && new URL(r.headers.get("location")).pathname === "/");
  conferir("cookie de prévia HttpOnly", /marimar_previa=v1\.previa\./.test(sc) && /HttpOnly/i.test(sc));
  let jar = cookiesDe(r);

  console.log("3. Com a prévia");
  let html = await pagina("/", jar);
  conferir("vê o Novo", ehNovo(html));
  conferir("barra 'Prévia do site novo'", html.includes("Prévia do site novo"));
  conferir("sem letras do Google (Novo usa as do site)", !html.includes("fonts.googleapis.com/css2"));
  conferir("visitante ao mesmo tempo continua no Clássico", !ehNovo(await pagina("/")));
  const ver = async (valor, voltar = "/") => {
    const res = await fetch(`${BASE}/api/modelo-site/ver`, { method: "POST", headers: { cookie: jar, "content-type": "application/x-www-form-urlencoded" }, body: `ver=${valor}&voltar=${encodeURIComponent(voltar)}`, redirect: "manual" });
    const novos = cookiesDe(res);
    for (const par of novos.split("; ").filter(Boolean)) { const [k] = par.split("="); jar = jar.split("; ").filter((c) => !c.startsWith(k + "=")).concat(par.endsWith("=") ? [] : [par]).join("; "); }
    return res;
  };
  r = await ver("classico", "/quartos");
  conferir("'Ver o Clássico' volta para a mesma página", r.status === 303 && new URL(r.headers.get("location")).pathname === "/quartos");
  html = await pagina("/", jar);
  conferir("com 'Ver o Clássico': Clássico + barra", !ehNovo(html) && html.includes("Você está vendo o site clássico"));
  await ver("novo");
  conferir("'Ver o Novo' de volta", ehNovo(await pagina("/", jar)));
  r = await ver("x", "https://outro-site.example/");
  conferir("voltar para outro site é ignorado", new URL(r.headers.get("location")).host === new URL(BASE).host);
  await ver("sair");
  html = await pagina("/", jar);
  conferir("'Sair da prévia': Clássico sem barra", !ehNovo(html) && !html.includes("Prévia do site novo") && !html.includes("Você está vendo o site clássico"));
  conferir("cookie forjado não vale", !ehNovo(await pagina("/", "marimar_previa=v1.previa.9999999999999.forjado")));

  /* Com página em construção, "novo" no banco não vale (teste unitário de lerConfigModelo);
     com as 15 prontas (04/11/2026, fase 5), vale para todos. */
  console.log("4. Banco dizendo 'novo' com as 15 páginas prontas");
  await sql.unsafe(`ALTER TABLE "pousada" ADD COLUMN IF NOT EXISTS "modelo_site" jsonb`);
  await sql`UPDATE pousada SET modelo_site = ${sql.json({ modelo: "novo" })}`;
  conferir("visitante vê o Novo", ehNovo(await pagina("/")));
  await sql`UPDATE pousada SET modelo_site = ${sql.json({ modelo: "classico" })}`;
  conferir("'classico' no banco: visitante volta ao Clássico", !ehNovo(await pagina("/")));
  await sql`UPDATE pousada SET modelo_site = ${antes ? sql.json(antes) : null}`;

  console.log("5. Painel");
  const semLogin = await fetch(`${BASE}/admin/modelo-site`, { redirect: "manual" });
  const corpoSemLogin = await semLogin.text();
  /* As telas do painel redirecionam pela própria página (Next manda 200 + NEXT_REDIRECT). */
  conferir("sem login vai para o login", ([302, 303, 307, 308].includes(semLogin.status) && (semLogin.headers.get("location") || "").includes("/admin/login"))
    || corpoSemLogin.includes("NEXT_REDIRECT;replace;/admin/login"));
  conferir("sem login não aparece link de prévia", !corpoSemLogin.includes("modelo-site/previa"));
  const nav = await chromium.launch();
  try {
    if (EMAIL && SENHA) {
      const ctx = await nav.newContext({ ...devices["iPhone 13"] });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/admin/login`);
      await p.getByLabel("E-mail").fill(EMAIL);
      await p.getByLabel("Senha", { exact: true }).fill(SENHA);
      await p.getByRole("button", { name: "Entrar no painel" }).click();
      await p.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 });
      await p.goto(`${BASE}/admin/modelo-site`);
      const corpo = await p.locator("main").innerText();
      conferir("mostra o progresso das páginas (15 de 15)", /15 de 15 páginas prontas/.test(corpo));
      conferir("QR da prévia na tela", (await p.locator('[aria-label="Código QR com o link da prévia"] svg').count()) === 1);
      const sem = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      conferir("sem rolagem lateral no celular", sem);
      await p.getByRole("button", { name: /^(Desligar|Ligar)$/ }).click();
      await p.waitForURL(/ok=/, { timeout: 15000 });
      const [linha] = await sql`SELECT modelo_site FROM pousada LIMIT 1`;
      conferir("o céu foi gravado (coluna criada pelo próprio site)", linha?.modelo_site && typeof linha.modelo_site.ceu_por_hora === "boolean" && !!linha.modelo_site.alterado_por);
      await p.getByRole("button", { name: /^(Desligar|Ligar)$/ }).click();
      await p.waitForURL(/ok=/, { timeout: 15000 });
      /* A troca de verdade, como o proprietário fará (perfil Administração = papel master). */
      const papel = (await sql`SELECT papel FROM usuarios WHERE email = ${EMAIL}`)[0]?.papel;
      if (papel === "master") {
        await p.getByRole("button", { name: "Ligar o Novo para todos" }).click();
        await p.getByRole("button", { name: "Ligar o Novo para todos" }).last().click();
        await p.waitForURL(/ok=/, { timeout: 15000 });
        conferir("'Ligar o Novo para todos': os visitantes veem o Novo", ehNovo(await pagina("/")) && ehNovo(await pagina("/", "")));
        await p.getByRole("button", { name: "Voltar para o Clássico" }).click();
        await p.getByRole("button", { name: "Voltar para o Clássico" }).last().click();
        await p.waitForURL(/ok=/, { timeout: 15000 });
        conferir("'Voltar para o Clássico': os visitantes voltam na hora", !ehNovo(await pagina("/")));
      } else conferir("perfil sem Administração não vê o botão", !/Ligar o Novo para todos/.test(corpo));
      const link = await p.getByRole("link", { name: "Ver o site novo neste aparelho" }).getAttribute("href");
      await p.goto(link);
      conferir("o link do painel abre o Novo neste aparelho", await p.locator("#sn-titulo").count() === 1);
      await ctx.close();
    } else console.log("  (EMAIL/SENHA ausentes: telas do painel não testadas)");

    console.log("6. Página inicial nova");
    for (const [nome, opts] of [["celular", devices["iPhone 13"]], ["computador", { viewport: { width: 1440, height: 900 } }], ["computador 1024", { viewport: { width: 1024, height: 768 } }]]) {
      const ctx = await nav.newContext(opts);
      await ctx.addCookies([{ name: "marimar_previa", value: assinar("previa", Date.now() + 86_400_000), url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }]);
      const p = await ctx.newPage();
      const erros = []; p.on("pageerror", (e) => erros.push(e.message));
      await p.goto(BASE + "/", { waitUntil: "load" });
      await p.waitForTimeout(6500);
      conferir(`${nome}: um H1`, (await p.locator("h1").count()) === 1);
      conferir(`${nome}: sem rolagem lateral`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await p.waitForFunction(() => /por noite|Preço para as suas datas/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
      conferir(`${nome}: preço de referência das suítes chegou`, /R\$\s?[\d.,]+\s*por noite/.test(await p.locator("main").innerText()));
      if (nome.startsWith("computador")) {
        /* A linha da travessia começa na primeira parada e termina na última, em qualquer largura. */
        const medida = await p.evaluate(() => {
          const linha = [...document.querySelectorAll("svg.sn-linha")].find((s) => getComputedStyle(s).display !== "none" && s.getBoundingClientRect().width > 100);
          const centros = [...document.querySelectorAll(".sn-parada")].map((e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; });
          if (!linha || centros.length < 2) return null;
          const r = linha.getBoundingClientRect();
          return { inicio: Math.round(r.left - centros[0]), fim: Math.round(r.right - centros[centros.length - 1]) };
        });
        conferir(`${nome}: linha da travessia vai da primeira à última parada`, !!medida && Math.abs(medida.inicio) <= 3 && Math.abs(medida.fim) <= 3, JSON.stringify(medida));
      }
      if (nome === "celular") {
        /* Escondido, o botão sai também da árvore de acessibilidade (aria-hidden): localizar por CSS. */
        const botao = p.locator("button[data-marina-flutuante]");
        const escondido = await botao.evaluate((b) => getComputedStyle(b).opacity === "0").catch(() => null);
        conferir("celular: botão da Marina sai da frente da busca", escondido === true);
        await p.evaluate(() => window.scrollTo(0, 1600)); await p.waitForTimeout(500);
        conferir("celular: e volta ao rolar", await botao.evaluate((b) => getComputedStyle(b).opacity === "1").catch(() => false));
        await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
      }
      const form = p.locator('form:has(input[name="check_in"])').first();
      await form.locator('button[aria-haspopup="dialog"]').first().click();
      const cal = p.getByRole("dialog", { name: "Escolher as datas da estadia" });
      await cal.waitFor({ timeout: 5000 });
      const dias = cal.locator("button.cal-dia:not([disabled])");
      await dias.nth(3).click(); await dias.nth(6).click();
      await cal.locator(".cal-confirmar").click();
      await form.getByRole("button", { name: /Hóspedes/ }).click();
      await form.getByRole("button", { name: "Mais: Adultos" }).click();
      await Promise.all([p.waitForURL(/\/reservar\?/, { timeout: 30000 }), form.getByRole("button", { name: "Ver suítes e preços" }).click()]);
      const u = new URL(p.url());
      conferir(`${nome}: busca leva datas e hóspedes para /reservar`, !!u.searchParams.get("check_in") && !!u.searchParams.get("check_out") && u.searchParams.get("adultos") === "3" && u.searchParams.get("ver_resultados") === "1", u.search);
      conferir(`${nome}: sem erro de JavaScript`, erros.length === 0, erros.join(" | "));
      await ctx.close();
    }

    console.log("7. A foto do topo do Novo é a mesma do Clássico (pedido do proprietário, 04/11)");
    const COOKIE = `marimar_previa=${assinar("previa", Date.now() + 86_400_000)}; marimar_ver=novo`;
    /* A primeira imagem do topo (seção `data-topo-imersivo`), decodificada de /_next/image?url=… */
    const fotoDoTopo = (html) => {
      const i = html.indexOf("data-topo-imersivo");
      const trecho = i >= 0 ? html.slice(i, i + 6000) : "";
      const m = trecho.match(/<img[^>]*?\s(?:src|srcSet)="([^"\s]+)/);
      if (!m) return null;
      const u = m[1].replace(/&amp;/g, "&");
      const q = u.match(/[?&]url=([^&]+)/);
      return q ? decodeURIComponent(q[1]) : u;
    };
    const altDoTopo = (html) => { const i = html.indexOf("data-topo-imersivo"); const m = html.slice(i, i + 6000).match(/<img[^>]*?\salt="([^"]*)"/); return m ? m[1] : null; };
    const htmlClassico = await pagina("/");
    const htmlNovo = await pagina("/", COOKIE);
    const topoClassico = fotoDoTopo(htmlClassico), topoNovo = fotoDoTopo(htmlNovo);
    conferir("sem banner: o topo do Novo usa a mesma foto que o Clássico (foto em destaque)", !!topoNovo && topoNovo === topoClassico, `${topoClassico} × ${topoNovo}`);
    const [banner] = await sql`
      INSERT INTO banners (titulo, imagem_url, alt, ordem, ativo, foco_x, foco_y)
      VALUES ('Banner de teste E2E', '/__teste/praia.jpg', 'Banner de teste E2E', -100, true, 30, 70) RETURNING id`;
    try {
      const comBannerClassico = fotoDoTopo(await pagina("/"));
      const novoComBanner = await pagina("/", COOKIE);
      const comBannerNovo = fotoDoTopo(novoComBanner);
      conferir("com banner ativo no painel: o Clássico mostra o banner no topo", comBannerClassico === "/__teste/praia.jpg", String(comBannerClassico));
      conferir("e o Novo mostra o MESMO banner", comBannerNovo === "/__teste/praia.jpg" && altDoTopo(novoComBanner) === "Banner de teste E2E", `${comBannerNovo} alt=${altDoTopo(novoComBanner)}`);
      conferir("com o enquadramento do banner (ponto focal)", /object-position:\s*30% 70%/.test(novoComBanner));
    } finally {
      await sql`DELETE FROM banners WHERE id = ${banner.id}`;
    }
  } finally { await nav.close(); }
} finally {
  await sql`UPDATE pousada SET modelo_site = ${antes ? sql.json(antes) : null}`.catch(() => {});
  await sql.end();
}
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
