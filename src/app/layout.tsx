import type { Metadata } from "next"; import { Geist, Geist_Mono } from "next/font/google"; import "./globals.css"; import postgres from "postgres";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    const [p] = await sql`SELECT seo_title, seo_description, og_image_url, favicon_url FROM pousada LIMIT 1`;
    await sql.end();
    return {
      title: p?.seo_title || "Pousada Ilha do Mel Marimar — Reserva Oficial",
      description: p?.seo_description || "Pousada na Ilha do Mel (Encantadas, PR). Consulte disponibilidade e reserve diretamente no site oficial.",
      icons: p?.favicon_url ? { icon: p.favicon_url } : undefined,
    };
  } catch {
    return { title: "Pousada Ilha do Mel Marimar", description: "Reserva oficial da pousada na Ilha do Mel." };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let theme = { cor_primaria: "#0D9488", cor_secundaria: "#0EA5E9", fonte_titulo: "Inter", fonte_corpo: "Inter" };
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 3 });
    const [p] = await sql`SELECT cor_primaria, cor_secundaria, fonte_titulo, fonte_corpo FROM pousada LIMIT 1`;
    await sql.end();
    if (p) theme = p as any;
  } catch {}

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <style>{`
          :root {
            --color-primary: ${theme.cor_primaria};
            --color-secondary: ${theme.cor_secundaria};
            --font-title: ${theme.fonte_titulo};
            --font-body: ${theme.fonte_corpo};
          }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}