import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { lerPousada } from "@/lib/pousada";
import { textoIdeal } from "@/lib/contraste";
import { versaoIcone } from "@/lib/icone";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

import {
  lerTema, temaParaCss, temaParaAtributos, pilhaFonte, pilhaManuscrita, TODAS_AS_FONTES,
} from "@/lib/tema";

// Uma consulta por requisicao, compartilhada com o layout do site (lib/pousada.ts).

export async function generateMetadata(): Promise<Metadata> {
  const p = await lerPousada();
  return {
    title: p?.seo_title || "Pousada Ilha do Mel Marimar — Reserva Oficial",
    description: p?.seo_description || "Pousada na Ilha do Mel (Encantadas, PR). Consulte disponibilidade e reserve diretamente no site oficial.",
    /* Ícones gerados da logo (src/app/marca/icone): antes, sem favicon
       próprio, valia o triângulo padrão da Vercel. */
    icons: {
      icon: [
        ...(p?.favicon_url ? [{ url: p.favicon_url }] : [{ url: `/marca/icone/32?v=${versaoIcone(p)}`, sizes: "32x32", type: "image/png" }]),
        { url: `/marca/icone/192?v=${versaoIcone(p)}`, sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: `/marca/icone/180?v=${versaoIcone(p)}`, sizes: "180x180", type: "image/png" }],
    },
    manifest: "/manifest.webmanifest",
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
    <html lang="pt-BR" suppressHydrationWarning {...temaParaAtributos(tema)} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
