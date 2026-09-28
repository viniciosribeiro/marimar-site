import { NextResponse } from "next/server";

/** Servido em /robots.txt pelo rewrite do next.config.ts. */
export function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.pousadamarimarilhadomel.com.br").replace(/\/+$/, "");
  return new NextResponse(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml`, { headers: { "Content-Type": "text/plain" } });
}
