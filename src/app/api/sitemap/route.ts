import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pousadamarimarilhadomel.com.br";
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const quartos = await sql`SELECT slug FROM quartos WHERE ativo = true`;
  const pacotes = await sql`SELECT slug FROM pacotes WHERE ativo = true`;
  await sql.end();

  const urls = [
    { loc: site, priority: "1.0", freq: "daily" },
    { loc: `${site}/quartos`, priority: "0.9", freq: "daily" },
    { loc: `${site}/reservar`, priority: "0.8", freq: "daily" },
    { loc: `${site}/pacotes`, priority: "0.7", freq: "weekly" },
    { loc: `${site}/a-pousada`, priority: "0.6", freq: "monthly" },
    { loc: `${site}/ilha-do-mel`, priority: "0.6", freq: "monthly" },
    { loc: `${site}/politicas`, priority: "0.4", freq: "monthly" },
    { loc: `${site}/faq`, priority: "0.5", freq: "weekly" },
    { loc: `${site}/contato`, priority: "0.5", freq: "monthly" },
    ...quartos.map((q: any) => ({ loc: `${site}/quartos/${q.slug}`, priority: "0.8", freq: "weekly" })),
    ...pacotes.map((p: any) => ({ loc: `${site}/pacotes/${p.slug}`, priority: "0.7", freq: "weekly" })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
}