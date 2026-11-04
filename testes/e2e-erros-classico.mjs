/**
 * Os 4 erros visíveis do site Clássico, corrigidos em 04/11/2026:
 *   1. /a-pousada imprimia o nome do ícone ("talheres", "caminhar"…) no lugar do desenho;
 *   2. regras de crianças com bebê de colo até 0 anos: "a partir de 1 anos", "até 0 anos";
 *   3. "R$ 0" quando o motor devolve a suíte sem tarifa (cards, janela de detalhes, página da suíte);
 *   4. /pacotes vazio sem nenhuma explicação.
 *
 * Roda contra o site local com o motor simulado (testes/motor-simulado.mjs na
 * 4011) e o Postgres LOCAL: grava uma regra de criança com bebê até 0 anos e
 * a apaga no fim. Nunca rode com DATABASE_URL de produção.
 *
 *   BASE_URL=http://localhost:3000 MOTOR_URL=http://localhost:4011 DATABASE_URL=<LOCAL> node testes/e2e-erros-classico.mjs
 */
import { chromium, devices } from "playwright";
import postgres from "postgres";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const MOTOR = process.env.MOTOR_URL || "http://localhost:4011";
if (!process.env.DATABASE_URL || /neon|vercel|amazonaws/i.test(process.env.DATABASE_URL)) {
  console.error("DATABASE_URL precisa ser o Postgres LOCAL de teste."); process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
let ok = 0, falhas = 0;
const conferir = (nome, cond, extra = "") => { if (cond) { ok++; console.log(`  ✓ ${nome}`); } else { falhas++; console.log(`  ✗ ${nome} ${extra}`); } };
const texto = async (caminho) => { const r = await fetch(BASE + caminho, { headers: { "cache-control": "no-store" } }); return { status: r.status, html: await r.text() }; };
const visivel = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

const regraAntes = await sql`SELECT * FROM regras_hospedagem WHERE id = 1`;
try {
  await sql`INSERT INTO regras_hospedagem (id, idade_colo_max, crianca_paga_como_adulto, bebe_cobranca, bebe_valor, observacao)
            VALUES (1, 0, true, 'gratis', null, null)
            ON CONFLICT (id) DO UPDATE SET idade_colo_max = 0, crianca_paga_como_adulto = true, bebe_cobranca = 'gratis', bebe_valor = null, observacao = null`;

  console.log("1. A Pousada: ícones desenhados, não escritos");
  {
    const { status, html } = await texto("/a-pousada");
    const t = visivel(html);
    conferir("página 200", status === 200);
    for (const palavra of ["talheres", "caminhar", "familia", "folha", "wifi"]) conferir(`sem a palavra solta "${palavra}"`, !new RegExp(`(^|\\s)${palavra}(\\s|$)`).test(t));
    conferir("grade com 8 ícones SVG", (html.match(/<svg[^>]*viewBox="0 0 24 24"/g) || []).length >= 8);
  }

  console.log("2. Idades das crianças (bebê de colo até 0 anos)");
  {
    const pol = visivel((await texto("/politicas")).html);
    conferir("políticas: 'a partir de 1 ano pagam'", /a partir de 1 ano pagam/.test(pol), pol.match(/Crianças a partir[^.]*\./)?.[0]);
    conferir("políticas: 'menores de 1 ano'", /menores de 1 ano/.test(pol));
    conferir("políticas: sem '1 anos' e sem 'até 0'", !/\b1 anos\b/.test(pol) && !/até 0 anos/.test(pol));
    const res = visivel((await texto("/reservar")).html);
    conferir("busca: 'Crianças (1 ano ou mais)'", res.includes("Crianças (1 ano ou mais)"));
    conferir("busca: 'Bebês (menos de 1 ano)'", res.includes("Bebês (menos de 1 ano)"));
    const home = visivel((await texto("/")).html);
    conferir("home: sem 'Bebês (até 0)'", !home.includes("Bebês (até 0)"));
  }

  console.log("3. Motor sem tarifa: nunca 'R$ 0'");
  await fetch(`${MOTOR}/__modo?sem_tarifa=1`);
  const nav = await chromium.launch();
  try {
    const ctx = await nav.newContext({ ...devices["iPhone 13"] });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/reservar?check_in=2026-12-09&check_out=2026-12-12&adultos=2`, { waitUntil: "load" });
    const corpo = await p.locator("main").innerText();
    conferir("cards sem 'R$ 0'", !/R\$\s?0(,00)?\b/.test(corpo), corpo.match(/R\$\s?0\S*/)?.[0]);
    conferir("cards dizem 'Sem tarifa publicada'", corpo.includes("Sem tarifa publicada para estas datas."));
    const det = p.getByRole("button", { name: /Ver detalhes do quarto|Ver fotos e detalhes/ }).first();
    await det.click();
    const dialogo = p.getByRole("dialog").first();
    await dialogo.waitFor({ timeout: 5000 });
    const dtxt = await dialogo.innerText();
    conferir("janela de detalhes sem 'R$ 0'", !/R\$\s?0(,00)?\b/.test(dtxt));
    await ctx.close();
    const suite = visivel((await texto("/quartos/casal-standard")).html);
    conferir("página da suíte sem 'R$ 0'", !/R\$\s?0(,00)?\b/.test(suite));
    conferir("página da suíte oferece 'Consultar disponibilidade'", suite.includes("Consultar disponibilidade"));
  } finally {
    await fetch(`${MOTOR}/__modo?sem_tarifa=0`);
    await nav.close();
  }
  {
    const comTarifa = visivel((await texto("/reservar?check_in=2026-12-09&check_out=2026-12-12&adultos=2")).html);
    conferir("com tarifa, o preço volta a aparecer (R$ 550)", /R\$\s?550/.test(comTarifa));
  }

  console.log("4. Pacotes vazio explica e aponta o caminho");
  {
    const ativos = await sql`SELECT count(*)::int AS n FROM pacotes WHERE ativo = true`;
    if (ativos[0].n === 0) {
      const t = visivel((await texto("/pacotes")).html);
      conferir("mensagem de que não há pacotes", t.includes("No momento não há pacotes publicados"));
      conferir("link para consultar disponibilidade", (await texto("/pacotes")).html.includes('href="/reservar"'));
    } else console.log("  (há pacotes ativos no banco local: caso vazio não testado)");
  }
} finally {
  if (regraAntes.length) {
    const r = regraAntes[0];
    await sql`UPDATE regras_hospedagem SET idade_colo_max = ${r.idade_colo_max}, crianca_paga_como_adulto = ${r.crianca_paga_como_adulto}, bebe_cobranca = ${r.bebe_cobranca}, bebe_valor = ${r.bebe_valor}, observacao = ${r.observacao} WHERE id = 1`;
  } else await sql`DELETE FROM regras_hospedagem WHERE id = 1`;
  await sql.end();
}
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
