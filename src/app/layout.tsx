import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import postgres from "postgres";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Fontes que o editor visual oferece. Geist ja vem no bundle; as outras
 *  sao buscadas no Google Fonts so quando o admin realmente escolhe uma. */
const FONTES_GOOGLE = new Set([
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat",
  "Playfair Display", "Merriweather", "Poppins", "Nunito", "Raleway",
]);

type Tema = {
  raio?: string;
  sombra?: "none" | "sm" | "md" | "lg";
  animacoes?: boolean;
};

const SOMBRAS: Record<string, string> = {
  none: "none",
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
};

async function lerPousada(): Promise<Record<string, any> | null> {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 3 });
    // to_jsonb evita nomear colunas: funciona antes e depois da migration
    // que adiciona `tema`, sem quebrar o site no meio do caminho.
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

  const marca = p?.cor_primaria || "#0D9488";
  const acento = p?.cor_secundaria || "#0EA5E9";
  const fonteTitulo = p?.fonte_titulo || "";
  const fonteCorpo = p?.fonte_corpo || "";
  const tema: Tema = (p?.tema as Tema) || {};

  // So busca no Google Fonts o que o admin escolheu de fato
  const googleFonts = [fonteTitulo, fonteCorpo]
    .filter((f) => FONTES_GOOGLE.has(f))
    .filter((f, i, a) => a.indexOf(f) === i);
  const googleHref = googleFonts.length
    ? `https://fonts.googleapis.com/css2?${googleFonts
        .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
        .join("&")}&display=swap`
    : null;

  const pilha = (nome: string) =>
    nome && nome !== "Geist"
      ? `"${nome}", var(--font-geist-sans), system-ui, sans-serif`
      : `var(--font-geist-sans), system-ui, sans-serif`;

  const raio = tema.raio ? `${tema.raio}px` : "0.75rem";
  const sombra = SOMBRAS[tema.sombra ?? "sm"] ?? SOMBRAS.sm;
  const duracao = tema.animacoes === false ? "0.01ms" : "200ms";

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
        {/* Valores crus dos tokens. O globals.css deriva a escala a partir
            daqui com color-mix — ver o cabecalho daquele arquivo. */}
        <style>{`:root{
          --marca:${marca};
          --acento:${acento};
          --fonte-titulo:${pilha(fonteTitulo)};
          --fonte-corpo:${pilha(fonteCorpo)};
          --raio:${raio};
          --sombra:${sombra};
          --duracao:${duracao};
        }`}</style>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
