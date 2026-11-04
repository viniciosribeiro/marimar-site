/**
 * Site novo, fase 5 (04/11/2026): Como chegar, Ilha do Mel, A pousada,
 * Eventos, Avaliações, Perguntas, Políticas, Contato e Pacotes no Novo.
 *
 * Roda contra o site LOCAL (banco local):
 *   BASE_URL=http://localhost:3000 DATABASE_URL=<LOCAL> AUTH_SECRET=<o do servidor local> \
 *   node testes/e2e-site-novo-conteudo.mjs
 *
 * Aceite (docs/plano-site-novo.md §7): mapa e rota no lugar (o mapa em si
 * precisa de internet: conferir num celular com 4G), formulário de contato
 * enviando. Cria um contato e um pacote de teste e apaga no fim.
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
const COOKIES = [{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }];
const NOME_TESTE = "Teste E2E Fase 5";
const SLUG_TESTE = "teste-e2e-fase5";

const PAGINAS = [
  ["/como-chegar", "Como chegar"], ["/ilha-do-mel", "Ilha do Mel e Encantadas"], ["/a-pousada", "A Pousada Marimar"],
  ["/eventos", "Eventos e casamentos"], ["/avaliacoes", "Avaliações"], ["/faq", "Perguntas frequentes"],
  ["/politicas", "Políticas"], ["/contato", "Contato"], ["/pacotes", "Pacotes"],
];
const limpar = async () => {
  await sql`DELETE FROM leads WHERE nome = ${NOME_TESTE}`;
  await sql`DELETE FROM pacotes WHERE slug = ${SLUG_TESTE}`;
};
await limpar();

const nav = await chromium.launch();
try {
  console.log("1. Visitante comum continua no Clássico");
  for (const [c] of PAGINAS) {
    const html = await (await fetch(BASE + c)).text();
    conferir(`${c} no Clássico`, !html.includes('class="sn '));
  }

  console.log("2. As 9 páginas no Novo (celular e computador)");
  for (const [rotulo, opcoes] of [["celular", devices["iPhone 13"]], ["computador", { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await nav.newContext(opcoes);
    await ctx.addCookies(COOKIES);
    const p = await ctx.newPage();
    const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    const ruins = [];
    for (const [c, titulo] of PAGINAS) {
      const r = await p.goto(BASE + c, { waitUntil: "load" });
      const h1 = await p.locator("h1").allInnerTexts();
      const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      const novo = await p.locator(".sn").count();
      if (r.status() !== 200 || h1.length !== 1 || h1[0].trim() !== titulo || !largura || !novo) ruins.push(`${c} ${r.status()} ${JSON.stringify(h1)} largura=${largura} novo=${novo}`);
    }
    conferir(`${rotulo}: 200, um H1 certo e sem rolagem lateral nas 9`, ruins.length === 0, ruins.join(" | "));
    conferir(`${rotulo}: sem erro de JavaScript`, erros.length === 0, erros.join(" | "));
    await ctx.close();
  }

  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(COOKIES);
  const p = await ctx.newPage();

  console.log("3. Como chegar");
  {
    const rotaAtiva = (await sql`SELECT dados FROM conteudo_editavel WHERE chave = 'ROTA'`.catch(() => []))[0];
    await p.goto(`${BASE}/como-chegar`, { waitUntil: "load" });
    const etapas = await p.locator(".sn-parada").count();
    conferir(`linha da travessia com as etapas da chegada (${etapas})`, etapas >= 2);
    const medida = await p.evaluate(() => {
      const linha = [...document.querySelectorAll("svg.sn-linha")].find((s) => getComputedStyle(s).display !== "none" && s.getBoundingClientRect().width > 100);
      const centros = [...document.querySelectorAll(".sn-parada")].map((e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; });
      if (!linha || centros.length < 2) return null;
      const r = linha.getBoundingClientRect();
      return { inicio: Math.round(r.left - centros[0]), fim: Math.round(r.right - centros[centros.length - 1]) };
    });
    conferir("linha de ponta a ponta com 3 paradas", !!medida && Math.abs(medida.inicio) <= 3 && Math.abs(medida.fim) <= 3, JSON.stringify(medida));
    conferir("âncora #rota da página inicial existe (o planejador de rota)", (await p.locator("#rota").count()) === 1 || rotaAtiva === undefined);
    conferir("valores da travessia", /Ida e volta/.test(await p.locator("#travessia").innerText()));
  }

  console.log("4. Ilha do Mel: as mesmas âncoras das atrações do Clássico");
  {
    const classico = await (await fetch(`${BASE}/ilha-do-mel`)).text();
    const idsC = [...classico.matchAll(/<article[^>]* id="([^"]+)"/g)].map((m) => m[1]).sort();
    await p.goto(`${BASE}/ilha-do-mel`, { waitUntil: "load" });
    const idsN = (await p.locator("#atracoes li[id]").evaluateAll((els) => els.map((e) => e.id))).sort();
    conferir(`${idsN.length} atrações com âncora`, idsN.length > 0 && JSON.stringify(idsC) === JSON.stringify(idsN), `${idsC} × ${idsN}`);
  }

  console.log("5. A pousada, Eventos, Avaliações");
  {
    await p.goto(`${BASE}/a-pousada`, { waitUntil: "load" });
    const texto = await p.locator("main").innerText();
    conferir("sem recado do painel para o visitante", !texto.includes("pode ser editado no painel"));
    await p.goto(`${BASE}/eventos`, { waitUntil: "load" });
    const wa = await p.getByRole("link", { name: "Falar sobre meu evento" }).getAttribute("href").catch(() => null);
    conferir("eventos: WhatsApp com a mensagem", !!wa && decodeURIComponent(wa).includes("eventos na Pousada Marimar"));
    await p.goto(`${BASE}/avaliacoes`, { waitUntil: "load" });
    conferir("avaliações: 5 plataformas e #criterios", (await p.locator('section[aria-label="Notas por plataforma"] li').count()) === 5 && (await p.locator("#criterios").count()) === 1);
  }

  console.log("6. Perguntas: as mesmas do Clássico, com busca");
  {
    const classico = await (await fetch(`${BASE}/faq`)).text();
    const qtdC = (classico.match(/<details/g) ?? []).length;
    await p.goto(`${BASE}/faq`, { waitUntil: "load" });
    const qtdN = await p.locator("details").count();
    conferir(`mesmo número de perguntas (${qtdN})`, qtdN === qtdC && qtdN > 0, `Clássico ${qtdC}`);
    await p.getByLabel("Procurar uma dúvida").fill("check-in");
    const filtradas = await p.locator("details").count();
    conferir("a busca filtra", filtradas > 0 && filtradas < qtdN, `${filtradas}`);
    await p.getByLabel("Procurar uma dúvida").fill("xyzxyz");
    conferir("busca sem resultado explica e oferece o WhatsApp", (await p.getByText("Nenhuma pergunta fala de").count()) === 1);
  }

  console.log("7. Políticas: índice e a regra de crianças do Clássico");
  {
    await p.goto(`${BASE}/politicas`, { waitUntil: "load" });
    const alvos = await p.locator('nav[aria-label="Nesta página"] a').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    const existem = await Promise.all(alvos.map((h) => p.locator(h).count()));
    conferir(`índice com ${alvos.length} seções e todas existem`, alvos.length === 5 && existem.every((n) => n === 1));
    const classico = (await (await fetch(`${BASE}/politicas`)).text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const criancas = (await p.locator("#criancas p").first().innerText()).trim();
    conferir("regra de crianças igual à do Clássico", classico.includes(criancas), criancas);
  }

  console.log("8. Contato: o formulário envia");
  {
    const m = await nav.newContext({ ...devices["iPhone 13"] });
    await m.addCookies(COOKIES);
    const c = await m.newPage();
    await c.goto(`${BASE}/contato`, { waitUntil: "load" });
    await c.getByLabel("Nome", { exact: true }).fill(NOME_TESTE);
    await c.getByLabel("Telefone ou WhatsApp").fill("41999990000");
    await c.getByLabel("Mensagem", { exact: true }).fill("Mensagem de teste automático. Pode apagar.");
    await Promise.all([c.waitForURL(/\/contato\?ok=/, { timeout: 20000 }), c.getByRole("button", { name: "Enviar mensagem" }).click()]);
    conferir("volta com 'Mensagem enviada!'", (await c.getByRole("status").filter({ hasText: "Mensagem enviada" }).count()) === 1);
    conferir("contato gravado (leads)", (await sql`SELECT count(*)::int AS n FROM leads WHERE nome = ${NOME_TESTE}`)[0].n === 1);
    await c.goto(`${BASE}/contato?erro=Informe+seu+nome.`, { waitUntil: "load" });
    conferir("erro aparece", (await c.getByRole("alert").filter({ hasText: "Informe seu nome." }).count()) === 1);
    await m.close();
  }

  console.log("9. Pacotes");
  {
    const ativos = (await sql`SELECT count(*)::int AS n FROM pacotes WHERE ativo = true`)[0].n;
    if (ativos === 0) {
      await p.goto(`${BASE}/pacotes`, { waitUntil: "load" });
      conferir("sem pacote: explica e oferece o caminho", (await p.getByText("No momento não há pacotes publicados.").count()) === 1);
    }
    await sql`INSERT INTO pacotes (nome, slug, descricao, inclusos, diaria_minima, ativo, ordem)
              VALUES ('Pacote de teste', ${SLUG_TESTE}, 'Criado pelo teste automático.', ${sql.json(["Café da manhã", "Passeio de barco"])}, 2, true, 999)`;
    await p.goto(`${BASE}/pacotes`, { waitUntil: "load" });
    conferir("pacote ativo aparece na lista", (await p.locator(`a[href="/pacotes/${SLUG_TESTE}"]`).count()) === 1);
    const r = await p.goto(`${BASE}/pacotes/${SLUG_TESTE}`, { waitUntil: "load" });
    const texto = await p.locator("main").innerText();
    conferir("página do pacote com o que está incluso", r.status() === 200 && texto.includes("Passeio de barco") && texto.includes("2 noites"));
    await sql`UPDATE pacotes SET ativo = false WHERE slug = ${SLUG_TESTE}`;
    const r2 = await fetch(`${BASE}/pacotes/${SLUG_TESTE}`, { headers: { cookie: COOKIE } });
    conferir("pacote desligado: 404", r2.status === 404);
  }
  await ctx.close();
} finally {
  await nav.close();
  await limpar();
  await sql.end();
}
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
