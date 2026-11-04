/**
 * Site novo, fase 3 (04/11/2026): /reservar no Novo.
 *
 * Roda contra o site LOCAL (banco local + motor simulado na 4011, testes/motor-simulado.mjs):
 *   BASE_URL=http://localhost:3000 DATABASE_URL=<LOCAL> AUTH_SECRET=<o do servidor local> \
 *   node testes/e2e-site-novo-reservar.mjs
 *
 * Aceite (docs/plano-site-novo.md §7): para 3 períodos, as mesmas suítes, os
 * mesmos preços, os mesmos totais e os mesmos links de reserva do /reservar
 * do Clássico; "Buscando suas suítes" e a rolagem até os resultados mantidas;
 * nenhum link para página que dê 404; nunca "R$ 0".
 * Segura a sincronização de fotos de carona durante o teste e devolve tudo no fim.
 */
import { chromium, devices } from "playwright";
import postgres from "postgres";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const MOTOR = process.env.MOTOR_URL || "http://localhost:4011";
const { AUTH_SECRET } = process.env;
if (!process.env.DATABASE_URL || /neon|vercel|amazonaws/i.test(process.env.DATABASE_URL)) { console.error("DATABASE_URL precisa ser o Postgres LOCAL."); process.exit(2); }
if (!AUTH_SECRET) { console.error("AUTH_SECRET (o mesmo do servidor local) é obrigatória."); process.exit(2); }
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
let ok = 0, falhas = 0;
const conferir = (nome, cond, extra = "") => { if (cond) { ok++; console.log(`  ✓ ${nome}`); } else { falhas++; console.log(`  ✗ ${nome} ${extra}`); } };
const assinar = (fim, exp) => { const b = `v1.${fim}.${exp}`; return `${b}.${createHmac("sha256", AUTH_SECRET).update(b).digest("base64url")}`; };
const PREVIA = assinar("previa", Date.now() + 86_400_000);
const COOKIES = [{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }];
const reais = (s) => (s ? Number(s.replace(/[^\d,]/g, "").replace(",", ".")) : NaN);

/* Segura a sincronização de carona (1×/hora pela hora gravada): ela poderia mudar suítes e fotos no meio do teste. */
const syncAntes = (await sql`SELECT valor, atualizado_em FROM integracoes WHERE chave = 'fotos_sync'`)[0] ?? null;
if (syncAntes) await sql`UPDATE integracoes SET atualizado_em = now() WHERE chave = 'fotos_sync'`;
else await sql`INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('fotos_sync', '{}', now())`;

const periodos = [
  { rotulo: "10–12/11, 2 adultos", q: "check_in=2026-11-10&check_out=2026-11-12&adultos=2&criancas=0" },
  { rotulo: "09–12/12, 4 adultos", q: "check_in=2026-12-09&check_out=2026-12-12&adultos=4&criancas=0" },
  { rotulo: "10–13/01/2027, 2 adultos e 1 criança", q: "check_in=2027-01-10&check_out=2027-01-13&adultos=2&criancas=1" },
];

const lerClassico = (p) => p.evaluate(() => [...document.querySelectorAll("article")].map((a) => {
  const t = a.innerText;
  return {
    nome: a.querySelector("h3")?.innerText.trim(),
    disponivel: !a.classList.contains("opacity-75"),
    diaria: (t.match(/Diária\s*(R\$\s?[\d.,]+)/) ?? [])[1] ?? null,
    total: (t.match(/Total \d+ noites?\s*(R\$\s?[\d.,]+)/) ?? [])[1] ?? null,
    link: a.querySelector('a[aria-label^="Reservar"]')?.getAttribute("href") ?? null,
  };
}));
const lerNovo = (p) => p.evaluate(() => {
  const sec = document.querySelector('section[aria-labelledby="sn-resultados"]');
  if (!sec) return null;
  const livres = [...sec.querySelectorAll("ul.grid article")].map((a) => {
    const t = a.innerText;
    return {
      nome: a.querySelector("h3")?.innerText.trim(), disponivel: true,
      diaria: (t.match(/(R\$\s?[\d.,]+)\s*por noite/) ?? [])[1] ?? null,
      total: (t.match(/Total de \d+ noites?:\s*(R\$\s?[\d.,]+)/) ?? [])[1] ?? null,
      link: a.querySelector('a[aria-label^="Reservar"]')?.getAttribute("href") ?? null,
      paginas: [...a.querySelectorAll('a[href^="/quartos/"]')].map((l) => l.getAttribute("href")),
    };
  });
  const semVaga = [...sec.querySelectorAll("ul.divide-y li")].map((li) => ({
    nome: li.querySelector(".font-medium")?.innerText.trim(), disponivel: false,
    paginas: [...li.querySelectorAll('a[href^="/quartos/"]')].map((l) => l.getAttribute("href")),
    texto: li.innerText,
  }));
  return { livres, semVaga, texto: sec.innerText };
});

const nav = await chromium.launch();
try {
  console.log("1. Visitante comum continua no Clássico");
  {
    const r = await fetch(`${BASE}/reservar?${periodos[0].q}`);
    const html = await r.text();
    conferir("/reservar sem a classe do Novo", !html.includes('class="sn ') && html.includes("Disponibilidade"));
  }

  console.log("2. Mesmas suítes, preços, totais e links do Clássico (3 períodos)");
  const paginasVistas = new Set();
  for (const per of periodos) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/reservar?${per.q}`, { waitUntil: "load" });
    const classico = (await lerClassico(p)).filter((c) => c.nome);
    await ctx.addCookies(COOKIES);
    await p.goto(`${BASE}/reservar?${per.q}`, { waitUntil: "load" });
    const novo = await lerNovo(p);
    await ctx.close();
    if (!novo) { conferir(`${per.rotulo}: resultados no Novo`, false); continue; }
    const livresC = classico.filter((c) => c.disponivel).map((c) => c.nome).sort();
    const livresN = novo.livres.map((c) => c.nome).sort();
    conferir(`${per.rotulo}: mesmas suítes livres (${livresN.length})`, JSON.stringify(livresC) === JSON.stringify(livresN), `\n    Clássico ${livresC}\n    Novo ${livresN}`);
    const semC = classico.filter((c) => !c.disponivel).map((c) => c.nome).sort();
    const semN = novo.semVaga.map((c) => c.nome).sort();
    conferir(`${per.rotulo}: mesmas sem vaga (${semN.length})`, JSON.stringify(semC) === JSON.stringify(semN), `\n    Clássico ${semC}\n    Novo ${semN}`);
    const diferentes = novo.livres.filter((n) => {
      const c = classico.find((x) => x.nome === n.nome);
      return !c || reais(c.diaria) !== reais(n.diaria) || reais(c.total) !== reais(n.total) || c.link !== n.link;
    });
    conferir(`${per.rotulo}: diária, total e link iguais suíte por suíte`, diferentes.length === 0, JSON.stringify(diferentes).slice(0, 400));
    conferir(`${per.rotulo}: nunca R$ 0`, !/R\$\s?0(?![\d.,])/.test(novo.texto));
    [...novo.livres, ...novo.semVaga].forEach((x) => x.paginas.forEach((u) => paginasVistas.add(u)));
  }

  console.log("3. Nenhum link para página que dê 404");
  const status = await Promise.all([...paginasVistas].map(async (u) => [u, (await fetch(BASE + u, { headers: { cookie: `marimar_previa=${PREVIA}; marimar_ver=novo` } })).status]));
  conferir(`${status.length} links "Ver a suíte" respondem 200`, status.length > 0 && status.every(([, s]) => s === 200), JSON.stringify(status.filter(([, s]) => s !== 200)));
  conferir("links da suíte levam as mesmas datas", [...paginasVistas].every((u) => u.includes("check_in=") && u.includes("check_out=")));

  console.log("4. Ordem por menor preço");
  {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(COOKIES);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/reservar?${periodos[0].q}&ordem=preco`, { waitUntil: "load" });
    const n = await lerNovo(p);
    const valores = n.livres.map((x) => reais(x.diaria));
    conferir("diárias em ordem crescente", valores.every((v, i) => i === 0 || v >= valores[i - 1]), valores.join(","));
    conferir("'Menor preço' marcado", (await p.locator('nav[aria-label="Ordem das suítes"] a[aria-current="true"]').innerText()).includes("Menor preço"));
    await ctx.close();
  }

  console.log("5. Sem tarifa publicada (motor simulado)");
  {
    await fetch(`${MOTOR}/__modo?sem_tarifa=1`);
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(COOKIES);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/reservar?${periodos[0].q}`, { waitUntil: "load" });
    const n = await lerNovo(p);
    conferir("nenhuma livre e nenhum R$ 0", n && n.livres.length === 0 && !/R\$\s?0(?![\d.,])/.test(n.texto));
    conferir("as sem vaga dizem 'Sem tarifa publicada'", n && n.semVaga.length > 0 && n.semVaga.every((x) => x.texto.includes("Sem tarifa publicada")));
    await ctx.close();
    await fetch(`${MOTOR}/__modo?sem_tarifa=0`);
  }

  console.log("6. Suíte sem página no site: a janela de detalhes (nunca 404)");
  {
    const [alvo] = await sql`SELECT id, nome, desbravador_room_id FROM quartos WHERE ativo = true AND desbravador_room_id IS NOT NULL ORDER BY ordem LIMIT 1`;
    await sql`UPDATE quartos SET desbravador_room_id = ${alvo.desbravador_room_id + "_TESTE"} WHERE id = ${alvo.id}`;
    try {
      const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addCookies(COOKIES);
      const p = await ctx.newPage();
      await p.goto(`${BASE}/reservar?${periodos[0].q}`, { waitUntil: "load" });
      const cartao = p.locator('section[aria-labelledby="sn-resultados"] ul.grid article').filter({ has: p.getByRole("button", { name: "Ver detalhes" }) }).first();
      conferir("cartão com 'Ver detalhes' (sem link para /quartos)", (await cartao.count()) === 1 && (await cartao.locator('a[href^="/quartos/"]').count()) === 0);
      await cartao.getByRole("button", { name: "Ver detalhes" }).click();
      conferir("abre a janela de detalhes", await p.getByRole("dialog", { name: /^Fotos e detalhes de/ }).isVisible());
      await ctx.close();
    } finally {
      await sql`UPDATE quartos SET desbravador_room_id = ${alvo.desbravador_room_id} WHERE id = ${alvo.id}`;
    }
  }

  console.log("7. Celular: buscar, 'Buscando suas suítes' e rolagem até os resultados");
  {
    const ctx = await nav.newContext({ ...devices["iPhone 13"] });
    await ctx.addCookies(COOKIES);
    await ctx.addInitScript(() => { try { sessionStorage.setItem("marimar:abertura", "1"); } catch { /* sem armazenamento */ } });
    const p = await ctx.newPage();
    const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(`${BASE}/reservar`, { waitUntil: "networkidle" });
    conferir("sem rolagem lateral", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    conferir("sem busca: nenhuma rolagem automática", (await p.evaluate(() => window.scrollY)) === 0);
    const form = p.locator('form:has(input[name="check_in"])').first();
    await form.locator('button[aria-haspopup="dialog"]').first().click();
    const cal = p.getByRole("dialog", { name: "Escolher as datas da estadia" });
    await cal.waitFor({ timeout: 5000 });
    const dias = cal.locator("button.cal-dia:not([disabled])");
    await dias.nth(8).click(); await dias.nth(10).click();
    await cal.locator(".cal-confirmar").click();
    /* A espera aparece antes da navegação e some com a página nova: um observador anota na sessão
       (que sobrevive à troca de página na mesma aba) quando ela aparece. */
    await p.evaluate(() => {
      sessionStorage.removeItem("viu-espera");
      new MutationObserver(() => {
        const s = document.querySelector('[role="status"][aria-label="Consultando disponibilidade de quartos"]');
        if (s && s.textContent.includes("Buscando suas suítes")) sessionStorage.setItem("viu-espera", "1");
      }).observe(document.body, { childList: true, subtree: true });
    });
    await form.getByRole("button", { name: "Ver suítes e preços" }).click();
    await p.waitForURL(/ver_resultados=1/, { timeout: 60000 });
    conferir("'Buscando suas suítes' apareceu durante a busca", (await p.evaluate(() => sessionStorage.getItem("viu-espera"))) === "1");
    await p.locator('section[aria-labelledby="sn-resultados"]').waitFor({ timeout: 60000 });
    await p.waitForTimeout(1500);
    const topo = await p.locator("#resultados-disponibilidade").evaluate((el) => el.getBoundingClientRect().top);
    conferir("rolou até os resultados", (await p.evaluate(() => window.scrollY)) > 100 && topo < 140, `top=${topo}`);
    conferir("resultados sem rolagem lateral", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await p.goto(`${BASE}/reservar?check_in=2026-12-12&check_out=2026-12-09`, { waitUntil: "load" });
    conferir("datas trocadas: explica", (await p.getByRole("alert").filter({ hasText: "data de saída" }).count()) === 1);
    conferir("sem erro de JavaScript", erros.length === 0, erros.join(" | "));
    await ctx.close();
  }
} finally {
  await nav.close();
  await fetch(`${MOTOR}/__modo?sem_tarifa=0`).catch(() => {});
  if (syncAntes) await sql`UPDATE integracoes SET atualizado_em = ${syncAntes.atualizado_em} WHERE chave = 'fotos_sync'`;
  else await sql`DELETE FROM integracoes WHERE chave = 'fotos_sync'`;
  await sql.end();
}
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
