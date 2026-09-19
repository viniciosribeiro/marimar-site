import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import postgres from "postgres";
import { textoIdeal } from "@/lib/contraste";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

import {
  lerTema, temaParaCss, pilhaFonte, pilhaManuscrita, TODAS_AS_FONTES,
} from "@/lib/tema";

async function lerPousada(): Promise<Record<string, any> | null> {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 3, prepare: false });
    // to_jsonb evita nomear colunas: funciona antes e depois de qualquer
    // migration que acrescente campo na tabela.
    const [row] = await sql`SELECT to_jsonb(p) AS dados FROM pousada p LIMIT 1`;
    await sql.end();
    return (row?.dados as Record<string, any>) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const p = await lerPousada();
  return {
    title: p?.seo_title || "Pousada Ilha do Mel Marimar — Reserva Oficial",
    description: p?.seo_description || "Pousada na Ilha do Mel (Encantadas, PR). Consulte disponibilidade e reserve diretamente no site oficial.",
    icons: p?.favicon_url ? { icon: p.favicon_url } : undefined,
    openGraph: {
      title: p?.seo_title || "Pousada Ilha do Mel Marimar",
      description: p?.seo_description || undefined,
      images: p?.og_image_url ? [p.og_image_url] : undefined,
      type: "website",
      locale: "pt_BR",
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const p = await lerPousada();
  const tema = lerTema(p);

  // So busca no Google Fonts o que o admin realmente escolheu
  const googleFonts = [tema.fonteTitulo, tema.fonteCorpo, tema.fonteManuscrita]
    .filter((f) => TODAS_AS_FONTES.has(f))
    .filter((f, i, a) => a.indexOf(f) === i);

  const googleHref = googleFonts.length
    ? `https://fonts.googleapis.com/css2?${googleFonts
        .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
        .join("&")}&display=swap`
    : null;

  const css = temaParaCss(tema, {
    titulo: pilhaFonte(tema.fonteTitulo),
    corpo: pilhaFonte(tema.fonteCorpo),
    manuscrita: pilhaManuscrita(tema.fonteManuscrita),
  });

  // Cor de texto legivel sobre cada cor de marca, pela formula da WCAG
  const extras = `--marca-texto:${textoIdeal(tema.marca)};--acento-texto:${textoIdeal(tema.acento)};`;

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {googleHref && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={googleHref} />
          </>
        )}
        {/* Valores crus dos tokens. O globals.css deriva a escala de cor com
            color-mix e os tamanhos de texto com calc — ver aquele arquivo. */}
        <style>{`:root{${css}${extras}}`}</style>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
