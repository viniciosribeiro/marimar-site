/**
 * Site novo, fase 2 (04/11/2026): /quartos e /quartos/[slug] no Novo.
 *
 * Roda contra o site LOCAL (banco local + motor simulado na 4011, testes/motor-simulado.mjs):
 *   BASE_URL=http://localhost:3000 DATABASE_URL=<LOCAL> AUTH_SECRET=<o do servidor local> \
 *   node testes/e2e-site-novo-suites.mjs
 *
 * O aceite da fase (docs/plano-site-novo.md §7): o preço da página da suíte é
 * o MESMO do /reservar para as mesmas datas e hóspedes, e "Reservar" leva o
 * roomCode. Mexe na regra de crianças e no modo do motor simulado; volta tudo
 * no fim.
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
const COOKIE = `marimar_previa=${PREVIA}; marimar_ver=novo`;
const visivel = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;| /g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const get = async (caminho, previa = true) => { const r = await fetch(BASE + caminho, { headers: previa ? { cookie: COOKIE } : {} }); return { status: r.status, html: await r.text() }; };
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const reais = (s) => (s ? Number(s.replace(/[^\d,]/g, "").replace(",", ".")) : NaN);

const ativas = await sql`SELECT slug, nome, ocupacao_max, desbravador_room_id FROM quartos WHERE ativo = true ORDER BY ordem, nome`;
const inativa = (await sql`SELECT slug FROM quartos WHERE ativo = false LIMIT 1`)[0]?.slug;
const grande = ativas.find((q) => q.ocupacao_max >= 4 && q.desbravador_room_id);
const pequena = ativas.find((q) => q.ocupacao_max <= 2 && q.desbravador_room_id);
if (!grande || !pequena) { console.error("O banco local precisa de uma suíte ativa para 4+ pessoas e outra para 2, com código do motor."); process.exit(2); }
/* Contadas na hora de cada conferência: uma busca no /reservar pode rodar a sincronização com o motor (simulado) e mudar as fotos. */
const contarFotos = async () => (await sql`SELECT count(*)::int AS n FROM midias m JOIN quartos q ON q.id = m.quarto_id WHERE q.slug = ${grande.slug} AND m.tipo = 'foto'`)[0].n;
let nomeExibido = "";
const regraAntes = (await sql`SELECT * FROM regras_hospedagem WHERE id = 1`)[0] ?? null;
const DATAS = "check_in=2026-12-09&check_out=2026-12-12";

try {
  console.log("1. Visitante comum continua no Clássico");
  let r = await get("/quartos", false);
  conferir("/quartos sem a classe do Novo", !r.html.includes('class="sn ') && visivel(r.html).includes("Nossas suítes"));
  r = await get(`/quartos/${grande.slug}`, false);
  conferir("página da suíte no Clássico", !r.html.includes("sn-titulo-pagina"));

  console.log("2. Lista das suítes (prévia)");
  r = await get("/quartos");
  let t = visivel(r.html);
  conferir("título As suítes", /<h1[^>]*>As suítes<\/h1>/.test(r.html));
  conferir("todas as suítes ativas listadas", ativas.every((q) => r.html.includes(`href="/quartos/${q.slug}"`)), ativas.map((q) => q.slug).join(","));
  conferir("referência dita com todas as letras", t.includes("Preço por noite para 2 adultos") && /R\$\s?[\d.]+ por noite/.test(t));
  r = await get("/quartos?pessoas=4");
  t = visivel(r.html);
  conferir("filtro 4 pessoas: só as que acomodam 4", ativas.every((q) => r.html.includes(`href="/quartos/${q.slug}?adultos=4"`) === (q.ocupacao_max >= 4)));
  conferir("filtro 4 pessoas: referência para 4 adultos", t.includes("Preço por noite para 4 adultos"));
  r = await get("/quartos?pessoas=abc");
  conferir("filtro inválido vira Todas", ativas.every((q) => r.html.includes(`href="/quartos/${q.slug}"`)));

  console.log("3. Página da suíte sem datas");
  r = await get(`/quartos/${grande.slug}`);
  t = visivel(r.html);
  const h1 = (r.html.match(/<h1 class="sn-titulo-pagina">([^<]*)<\/h1>/) ?? [])[1] ?? "";
  conferir("H1 com o nome da suíte", semAcento(h1) === semAcento(grande.nome), h1);
  nomeExibido = h1;
  conferir("preço de referência dito como referência", t.includes("A partir de") && t.includes("Para 2 adultos, consultado agora"));
  conferir("formulário de datas", t.includes("Quando você vem?") && t.includes("Ver o preço destas datas"));
  if (inativa) conferir("suíte desligada: 404", (await get(`/quartos/${inativa}`)).status === 404);
  r = await get(`/quartos/${grande.slug}?check_in=2026-12-12&check_out=2026-12-09`);
  conferir("datas trocadas: explica", visivel(r.html).includes("A data de saída precisa ser depois da data de entrada."));

  console.log("4. Não acomoda o grupo");
  r = await get(`/quartos/${pequena.slug}?${DATAS}&adultos=4&criancas=0`);
  t = visivel(r.html);
  conferir("diz a capacidade", t.includes(`Esta suíte é para até ${pequena.ocupacao_max} pessoas`), t.slice(t.indexOf("noites"), t.indexOf("noites") + 160));
  conferir("leva às suítes livres com as mesmas datas", r.html.includes(`/reservar?${DATAS.replace("&", "&amp;")}&amp;adultos=4&amp;criancas=0&amp;ver_resultados=1`));

  console.log("5. Sem tarifa publicada (motor simulado)");
  await fetch(`${MOTOR}/__modo?sem_tarifa=1`);
  r = await get(`/quartos/${grande.slug}?${DATAS}&adultos=2&criancas=0`);
  t = visivel(r.html);
  conferir("explica que não há tarifa", t.includes("não publicou tarifa"));
  conferir("nunca R$ 0", !/R\$\s?0(?![\d.,])/.test(t));
  await fetch(`${MOTOR}/__modo?sem_tarifa=0`);

  const nav = await chromium.launch();
  try {
    console.log("6. Mesmo preço e mesmo link do /reservar");
    const comparar = async (rotulo, query) => {
      const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/reservar?${query}&ver_resultados=1`);
      const card = p.locator("article").filter({ has: p.locator("h3", { hasText: nomeExibido }) }).first();
      await card.waitFor({ timeout: 60000 }).catch(() => {});
      const txtC = await card.innerText().catch(() => "");
      const diariaC = reais((txtC.match(/Diária\s*(R\$\s?[\d.,]+)/) ?? [])[1]);
      const totalC = reais((txtC.match(/Total \d+ noites?\s*(R\$\s?[\d.,]+)/) ?? [])[1]);
      const linkC = await card.locator('a[aria-label^="Reservar"]').first().getAttribute("href").catch(() => null);
      await ctx.addCookies([{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }]);
      await p.goto(`${BASE}/quartos/${grande.slug}?${query}`);
      const painel = p.locator("#preco");
      await painel.getByText("Reservar estas datas").waitFor({ timeout: 60000 }).catch(() => {});
      const txtN = await painel.innerText();
      const diariaN = reais((txtN.match(/(R\$\s?[\d.,]+)\s*por noite/) ?? [])[1]);
      const totalN = reais((txtN.match(/Total de \d+ noites?:\s*(R\$\s?[\d.,]+)/) ?? [])[1]);
      const linkN = await painel.locator("a", { hasText: "Reservar estas datas" }).getAttribute("href").catch(() => null);
      conferir(`${rotulo}: diária igual (${diariaN})`, diariaN > 0 && diariaN === diariaC, `Clássico ${diariaC}`);
      conferir(`${rotulo}: total igual (${totalN})`, totalN > 0 && totalN === totalC, `Clássico ${totalC}`);
      conferir(`${rotulo}: mesmo link de reserva`, !!linkN && linkN === linkC, `\n    Novo ${linkN}\n    Clássico ${linkC}`);
      conferir(`${rotulo}: link com roomCode da suíte`, !!linkN && new URL(linkN).searchParams.get("roomCode") === grande.desbravador_room_id);
      await ctx.close();
    };
    await comparar("2 adultos", `${DATAS}&adultos=2&criancas=0`);
    /* Regra da pousada: criança paga como adulto; bebê de colo R$ 40 por noite, à parte. */
    await sql`INSERT INTO regras_hospedagem (id, idade_colo_max, crianca_paga_como_adulto, bebe_cobranca, bebe_valor, observacao)
              VALUES (1, 1, true, 'por_noite', 40, null)
              ON CONFLICT (id) DO UPDATE SET idade_colo_max = 1, crianca_paga_como_adulto = true, bebe_cobranca = 'por_noite', bebe_valor = 40, observacao = null`;
    await comparar("2 adultos, 1 criança e 1 bebê (com a regra)", `${DATAS}&adultos=2&criancas=1&bebes=1`);
    if (regraAntes) {
      const a = regraAntes;
      await sql`UPDATE regras_hospedagem SET idade_colo_max = ${a.idade_colo_max}, crianca_paga_como_adulto = ${a.crianca_paga_como_adulto}, bebe_cobranca = ${a.bebe_cobranca}, bebe_valor = ${a.bebe_valor}, observacao = ${a.observacao} WHERE id = 1`;
    } else await sql`DELETE FROM regras_hospedagem WHERE id = 1`;

    console.log("7. Celular");
    const ctx = await nav.newContext({ ...devices["iPhone 13"] });
    await ctx.addCookies([{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }]);
    await ctx.addInitScript(() => { try { sessionStorage.setItem("marimar:abertura", "1"); } catch { /* sem armazenamento */ } });
    const p = await ctx.newPage();
    const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(`${BASE}/quartos`, { waitUntil: "networkidle" });
    conferir("lista sem rolagem lateral", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await p.goto(`${BASE}/quartos/${grande.slug}`, { waitUntil: "networkidle" });
    conferir("suíte sem rolagem lateral", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const fotosCel = await contarFotos();
    if (fotosCel > 1) conferir(`galeria: 1 de ${fotosCel}`, (await p.getByText(`1 de ${fotosCel}`).count()) === 1);
    await p.locator('button[aria-label^="Ampliar a foto 1"]').click();
    const tela = p.getByRole("dialog", { name: /^Fotos:/ });
    conferir("foto abre em tela cheia", await tela.isVisible());
    await p.keyboard.press("Escape");
    conferir("Esc fecha", !(await tela.isVisible().catch(() => false)));
    const barra = p.locator(".sn-barra-reserva");
    const marina = p.locator("button[data-marina-flutuante]");
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(600);
    conferir("barra Reservar aparece longe do quadro de preço", (await barra.getAttribute("data-visivel")) === "true");
    conferir("e o botão da Marina sai da frente", await marina.evaluate((b) => getComputedStyle(b).opacity === "0").catch(() => false));
    await p.locator("#preco").scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    conferir("barra some com o quadro de preço na tela", (await barra.getAttribute("data-visivel")) === "false");
    const outras = p.locator("#sn-outras ~ ul li").first();
    if (await outras.count()) {
      await outras.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
      const x = await outras.evaluate((el) => el.getBoundingClientRect().left);
      conferir("outras suítes: o primeiro cartão respeita a margem", x >= 15, `x=${x}`);
    }
    const chat = p.getByRole("button", { name: "Tirar dúvidas com a Marina" });
    if (await chat.count()) {
      await chat.click();
      conferir("'Tirar dúvidas com a Marina' abre o chat", await p.getByRole("dialog", { name: /^Atendimento/ }).isVisible());
      await p.reload({ waitUntil: "networkidle" });
    }
    /* Escolher as datas na própria página. */
    await p.locator("#datas").scrollIntoViewIfNeeded();
    await p.locator('#datas button[aria-haspopup="dialog"]').first().click();
    const cal = p.getByRole("dialog", { name: "Escolher as datas da estadia" });
    await cal.waitFor({ timeout: 5000 });
    const dias = cal.locator("button.cal-dia:not([disabled])");
    await dias.nth(10).click(); await dias.nth(13).click();
    await cal.locator(".cal-confirmar").click();
    await Promise.all([p.waitForURL(/check_in=.*#preco$/, { timeout: 60000 }), p.getByRole("button", { name: "Ver o preço destas datas" }).click()]);
    await p.locator("#preco").getByText("Reservar estas datas").waitFor({ timeout: 60000 });
    conferir("datas escolhidas na página: preço e Reservar", /R\$\s?[\d.]+\s*por noite/.test(await p.locator("#preco").innerText()));
    conferir("celular: sem erro de JavaScript", erros.length === 0, erros.join(" | "));
    await ctx.close();

    console.log("8. Computador");
    const ctx2 = await nav.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx2.addCookies([{ name: "marimar_previa", value: PREVIA, url: BASE }, { name: "marimar_ver", value: "novo", url: BASE }]);
    await ctx2.addInitScript(() => { try { sessionStorage.setItem("marimar:abertura", "1"); } catch { /* sem armazenamento */ } });
    const pc = await ctx2.newPage();
    const erros2 = []; pc.on("pageerror", (e) => erros2.push(e.message));
    await pc.goto(`${BASE}/quartos/${grande.slug}?${DATAS}&adultos=2&criancas=0`, { waitUntil: "networkidle" });
    conferir("sem rolagem lateral", await pc.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const fotosPc = await contarFotos();
    if (fotosPc > 1) conferir(`"Ver as ${fotosPc} fotos"`, await pc.getByRole("button", { name: `Ver as ${fotosPc} fotos` }).isVisible());
    await pc.evaluate(() => window.scrollTo(0, 700)); await pc.waitForTimeout(400);
    const topo = await pc.locator("#preco").evaluate((el) => el.getBoundingClientRect().top);
    conferir("quadro de preço fica ao lado ao rolar", topo > 60 && topo < 140, `top=${topo}`);
    conferir("botão da Marina continua no computador", await pc.locator("button[data-marina-flutuante]").evaluate((b) => getComputedStyle(b).opacity === "1").catch(() => false));
    conferir("computador: sem erro de JavaScript", erros2.length === 0, erros2.join(" | "));
    await ctx2.close();
  } finally { await nav.close(); }
} finally {
  await fetch(`${MOTOR}/__modo?sem_tarifa=0`).catch(() => {});
  const agora = (await sql`SELECT * FROM regras_hospedagem WHERE id = 1`)[0] ?? null;
  if (JSON.stringify(agora) !== JSON.stringify(regraAntes)) {
    if (regraAntes) {
      const a = regraAntes;
      await sql`UPDATE regras_hospedagem SET idade_colo_max = ${a.idade_colo_max}, crianca_paga_como_adulto = ${a.crianca_paga_como_adulto}, bebe_cobranca = ${a.bebe_cobranca}, bebe_valor = ${a.bebe_valor}, observacao = ${a.observacao} WHERE id = 1`;
    } else await sql`DELETE FROM regras_hospedagem WHERE id = 1`;
  }
  await sql.end();
}
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
