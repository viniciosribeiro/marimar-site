import { NextResponse } from "next/server";
import { comSql } from "@/lib/db-conexao";

export const dynamic = "force-dynamic";

/** Servido em /sitemap.xml pelo rewrite do next.config.ts. */
export async function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.pousadamarimarilhadomel.com.br").replace(/\/+$/, "");

  // Banco fora do ar nao derruba o sitemap: as paginas fixas continuam.
  let quartos: { slug: string }[] = [];
  let pacotes: { slug: string }[] = [];
  try {
    ({ quartos, pacotes } = await comSql(async (sql) => ({
      quartos: await sql<{ slug: string }[]>`SELECT slug FROM quartos WHERE ativo = true`,
      pacotes: await sql<{ slug: string }[]>`SELECT slug FROM pacotes WHERE ativo = true`,
    })));
  } catch (e) {
    console.error("[sitemap] banco indisponivel:", (e as Error).message);
  }

  const urls = [
    { loc: site, priority: "1.0", freq: "daily" },
    { loc: `${site}/quartos`, priority: "0.9", freq: "daily" },
    { loc: `${site}/reservar`, priority: "0.8", freq: "daily" },
    { loc: `${site}/restaurante`, priority: "0.7", freq: "weekly" },
    { loc: `${site}/pacotes`, priority: "0.7", freq: "weekly" },
    { loc: `${site}/como-chegar`, priority: "0.7", freq: "monthly" },
    { loc: `${site}/a-pousada`, priority: "0.6", freq: "monthly" },
    { loc: `${site}/ilha-do-mel`, priority: "0.6", freq: "monthly" },
    { loc: `${site}/galeria`, priority: "0.5", freq: "monthly" },
    { loc: `${site}/avaliacoes`, priority: "0.5", freq: "monthly" },
    { loc: `${site}/eventos`, priority: "0.5", freq: "monthly" },
    { loc: `${site}/faq`, priority: "0.5", freq: "weekly" },
    { loc: `${site}/contato`, priority: "0.5", freq: "monthly" },
    { loc: `${site}/politicas`, priority: "0.4", freq: "monthly" },
    ...quartos.map((q) => ({ loc: `${site}/quartos/${encodeURIComponent(q.slug)}`, priority: "0.8", freq: "weekly" })),
    ...pacotes.map((p) => ({ loc: `${site}/pacotes/${encodeURIComponent(p.slug)}`, priority: "0.7", freq: "weekly" })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
}
