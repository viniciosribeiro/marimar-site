/**
 * Abertura do site em vídeo (30/10/2026): o pôr do sol com a logo, 5 s.
 *
 *   servidor local (npm run build && npx next start) com DATABASE_URL de um banco LOCAL
 *   DATABASE_URL=<banco LOCAL> SENHA=... [CAPTURAS=pasta] node testes/e2e-abertura.mjs
 *
 * Confere, em computador, monitor ultralargo, tablet e celular (em pé e
 * deitado), que a logo do vídeo nunca sai da tela; que o vídeo toca, some
 * sozinho aos ~5,5 s e não segura o toque (o "Escolher data" do iPhone,
 * 27/10); que não volta nem é baixado na segunda página da visita; que quem
 * pediu menos movimento não vê; e que a escolha "Logo animada" do painel
 * traz a abertura antiga de volta.
 *
 * O Chromium do Playwright não toca H.264: aqui o vídeo sai pelo WebM de
 * reserva — que também prova que a troca automática funciona.
 */
import { chromium, devices } from "playwright";
import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:3000";
const URL_BANCO = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(URL_BANCO)) { console.error("Precisa de DATABASE_URL de um banco LOCAL."); process.exit(2); }

let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? "✓" : "✗"} ${nome}`); if (!cond) falhas++; };
const foto = async (pag, nome) => { if (process.env.CAPTURAS) await pag.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png` }); };

/* Onde fica a logo dentro do vídeo (medido no quadro do meio): 19%–78% da
   largura e 43%–67% da altura. Devolve a caixa dela na tela. */
const caixaDaLogo = (pag) => pag.evaluate(() => {
  const v = document.getElementById("abertura-video");
  const r = v.getBoundingClientRect();
  /* object-fit: cover — o vídeo pode ser maior que a caixa do elemento. */
  const escala = getComputedStyle(v).objectFit === "cover" ? Math.max(r.width / 720, r.height / 544) : r.width / 720;
  const w = 720 * escala, h = 544 * escala;
  const x0 = r.left + (r.width - w) / 2, y0 = r.top + (r.height - h) / 2;
  return { esq: x0 + .19 * w, dir: x0 + .78 * w, topo: y0 + .43 * h, base: y0 + .67 * h, vw: innerWidth, vh: innerHeight };
});
const dentro = (c) => c.esq >= 0 && c.dir <= c.vw && c.topo >= 0 && c.base <= c.vh;

const sql = postgres(URL_BANCO, { max: 1 });
const nav = await chromium.launch();
try {
  await sql`UPDATE pousada SET tema = COALESCE(tema, '{}'::jsonb) - 'movimento'`;

  /* 1. computador: cobre a tela, toca, não segura clique, some sozinha */
  {
    const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/`);
    ok(await pag.locator(".abertura--video").isVisible(), "computador: abertura em vídeo aparece ao abrir o site");
    await pag.waitForTimeout(1500);
    const v = await pag.evaluate(() => { const e = document.getElementById("abertura-video"); return { src: e.currentSrc, t: e.currentTime, mudo: e.muted }; });
    ok(/\/abertura\/por-do-sol\.(mp4|webm)$/.test(v.src) && v.t > 0.3 && v.mudo, `computador: o vídeo toca, sem som (${v.src.split("/").pop()}, ${v.t.toFixed(1)} s)`);
    const c = await caixaDaLogo(pag);
    ok(dentro(c), "computador: a logo do vídeo inteira na tela");
    const embaixo = await pag.evaluate(() => !document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".abertura"));
    ok(embaixo, "computador: a abertura não pega clique (vai para o site embaixo)");
    await foto(pag, "abertura-computador");
    await pag.waitForTimeout(4600);
    const sumiu = await pag.evaluate(() => { const s = getComputedStyle(document.querySelector(".abertura")); return s.visibility === "hidden" || Number(s.opacity) < 0.05; });
    ok(sumiu, "computador: some sozinha depois do vídeo (~5,5 s)");

    /* 2. segunda página na mesma aba: nem aparece, nem baixa o vídeo */
    await pag.goto(`${BASE}/quartos`);
    const segunda = await pag.evaluate(() => {
      const a = document.querySelector(".abertura"), v = document.getElementById("abertura-video");
      return { visivel: a ? getComputedStyle(a).display !== "none" : false, src: v?.getAttribute("src") ?? null };
    });
    ok(!segunda.visivel && !segunda.src, "visita: na segunda página não aparece e o vídeo nem é baixado");
    await ctx.close();
  }

  /* 3. outras telas: a logo nunca sai */
  const telas = [
    ["monitor ultralargo 21:9", { viewport: { width: 2560, height: 1080 } }],
    ["tablet em pé", { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true }],
    ["celular em pé", { ...devices["iPhone 13"], defaultBrowserType: undefined }],
    ["celular pequeno", { ...devices["iPhone SE"], defaultBrowserType: undefined }],
    ["celular deitado", { ...devices["iPhone 13 landscape"], defaultBrowserType: undefined }],
  ];
  for (const [nome, opcoes] of telas) {
    const ctx = await nav.newContext(opcoes);
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/`);
    await pag.waitForTimeout(2200);
    const c = await caixaDaLogo(pag);
    const largura = await pag.evaluate(() => document.documentElement.scrollWidth);
    ok(dentro(c) && largura <= c.vw, `${nome}: a logo inteira na tela e sem rolagem para o lado (${c.vw}×${c.vh})`);
    await foto(pag, `abertura-${nome.replace(/\W+/g, "-")}`);

    await ctx.close();

    /* o problema do iPhone de 27/10: com a abertura na frente (aba nova =
       primeira visita), o toque em "Escolher data" precisa abrir o calendário */
    if (nome === "celular em pé") {
      const ctx2 = await nav.newContext(opcoes);
      const pag2 = await ctx2.newPage();
      await pag2.goto(`${BASE}/`);
      await pag2.waitForTimeout(800);
      const naFrente = await pag2.locator(".abertura--video").isVisible();
      await pag2.getByText("Escolher data").first().tap({ timeout: 5000 });
      await pag2.waitForTimeout(500);
      const abriu = await pag2.getByRole("dialog", { name: "Escolher as datas da estadia" }).isVisible();
      ok(naFrente && abriu, "celular: com a abertura na tela, tocar em \"Escolher data\" abre o calendário");
      await ctx2.close();
    }
  }

  /* 4. quem pediu menos movimento no aparelho */
  {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/`);
    const r = await pag.evaluate(() => {
      const a = document.querySelector(".abertura"), v = document.getElementById("abertura-video");
      return { visivel: a ? getComputedStyle(a).display !== "none" : false, src: v?.getAttribute("src") ?? null };
    });
    ok(!r.visivel && !r.src, "menos movimento: não vê a abertura e não baixa o vídeo");
    await ctx.close();
  }

  /* 5. painel: "Logo animada" traz a abertura antiga */
  await sql`UPDATE pousada SET tema = jsonb_set(COALESCE(tema, '{}'::jsonb), '{movimento}', '{"abertura": true, "aberturaEstilo": "logo", "aberturaTexto": "Pousada"}'::jsonb)`;
  {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/`);
    const antiga = await pag.evaluate(() => ({
      video: Boolean(document.getElementById("abertura-video")),
      texto: document.querySelector(".abertura__texto")?.textContent ?? "",
    }));
    ok(!antiga.video && antiga.texto === "Pousada", "painel → Logo animada: volta a abertura antiga, com \"Pousada\" e sem vídeo");
    await ctx.close();
  }

  /* 6. a escolha aparece em Identidade visual → Forma */
  {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(1000);
    await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
    await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
    await pag.getByRole("button", { name: "Entrar no painel" }).click();
    await pag.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 });
    await pag.goto(`${BASE}/admin/identidade-visual`);
    await pag.getByRole("button", { name: "Forma", exact: true }).click();
    const escolha = pag.getByLabel("Estilo da abertura");
    await escolha.waitFor({ timeout: 10000 });
    ok((await escolha.inputValue()) === "logo", "painel: mostra a escolha gravada (Logo animada)");
    ok(await pag.getByText("Texto abaixo da logo na abertura").isVisible(), "painel: na logo animada, o campo do texto aparece");
    await escolha.selectOption("video");
    ok(!(await pag.getByText("Texto abaixo da logo na abertura").isVisible()), "painel: no vídeo, o campo do texto some (o vídeo já tem a marca)");
    await foto(pag, "abertura-painel");
    await ctx.close();
  }
} finally {
  await sql`UPDATE pousada SET tema = COALESCE(tema, '{}'::jsonb) - 'movimento'`.catch(() => {});
  await sql.end();
  await nav.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
