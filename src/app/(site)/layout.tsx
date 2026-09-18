import Link from "next/link";
import postgres from "postgres";
import { MobileNav } from "@/components/site/MobileNav";
import { COMPLEXO, IDENTIDADE } from "@/lib/conteudo-pousada";

/**
 * Todo o site le conteudo editavel pelo admin, entao nada aqui pode ser
 * congelado em build time.
 *
 * Sem este force-dynamic o Next tentava PRERENDERIZAR as paginas cujo page.tsx
 * tambem nao o declarava (/contato, /faq, /politicas, /a-pousada) e batia no
 * banco durante o `next build`: um Neon lento no momento do deploy derrubava o
 * build inteiro, e quando passava congelava telefone, cores e textos no HTML.
 */
export const dynamic = "force-dynamic";

const NAV: [string, string][] = [
  ["/quartos", "Acomodações"],
  ["/restaurante", "Restaurante"],
  ["/a-pousada", "A Pousada"],
  ["/ilha-do-mel", "Ilha do Mel"],
  ["/como-chegar", "Como Chegar"],
  ["/contato", "Contato"],
];

/** Arquitetura completa — o topo mostra so o essencial, o rodape mostra tudo. */
const RODAPE = {
  Pousada: [
    ["/a-pousada", "A Pousada"],
    ["/quartos", "Acomodações"],
    ["/restaurante", "Restaurante"],
    ["/cafe-da-manha", "Café da Manhã"],
    ["/eventos", "Eventos e Casamentos"],
    ["/galeria", "Galeria"],
  ],
  "Ilha do Mel": [
    ["/ilha-do-mel", "Encantadas e a Ilha"],
    ["/como-chegar", "Como Chegar"],
    ["/ilha-do-mel#travessia", "Travessia e ABALINE"],
    ["/ilha-do-mel#atracoes", "Praias e Trilhas"],
  ],
  Reservas: [
    ["/reservar", "Consultar disponibilidade"],
    ["/pacotes", "Pacotes e Ofertas"],
    ["/politicas", "Políticas"],
    ["/faq", "Perguntas Frequentes"],
    ["/avaliacoes", "Avaliações"],
  ],
} as Record<string, [string, string][]>;

const FALLBACK: Record<string, any> = {
  nome: "Pousada Ilha do Mel Marimar",
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let p: Record<string, any> = FALLBACK;
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    const [row] = await sql`SELECT * FROM pousada LIMIT 1`;
    await sql.end();
    if (row) p = row;
  } catch (e) {
    console.error("[SiteLayout] banco indisponivel, usando fallback:", (e as Error).message);
  }

  const wa = p?.whatsapp?.replace(/\D/g, "") || "";
  const nome = p?.nome || FALLBACK.nome;

  return (
    <div className="min-h-screen flex flex-col bg-fundo">
      {/* Fundo solido de proposito: o briefing pede leitura clara, sem
          transparencia que atrapalhe a visualizacao sobre a foto do hero. */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            {p?.logo_url
              ? <img src={p.logo_url} className="h-9 sm:h-10 w-auto shrink-0" alt={nome} />
              : <span className="text-2xl shrink-0">🏝️</span>}
            <span className="font-titulo text-base sm:text-lg font-bold text-gray-900 leading-tight whitespace-nowrap">
              {IDENTIDADE.nome}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="px-2.5 py-2 text-sm text-gray-600 rounded-lg whitespace-nowrap hover:text-marca hover:bg-marca-sutil transition-marca"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/reservar"
              className="hidden sm:inline-block bg-marca hover:bg-marca-hover text-white px-4 py-2 rounded-marca text-sm font-semibold transition-marca"
            >
              Reservar
            </Link>
            <MobileNav itens={NAV} />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-gray-900 text-gray-300 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          {/* A frase estrutural do complexo, exigida em todas as paginas */}
          <p className="text-sm text-white/90 bg-white/5 border border-white/10 rounded-marca px-5 py-4 mb-10 leading-relaxed">
            {COMPLEXO.fraseRodape}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                {p?.logo_url
                  ? <img src={p.logo_url} className="h-8 w-auto" alt={nome} />
                  : <span className="text-2xl">🏝️</span>}
                <span className="text-white font-titulo font-bold text-lg">{nome}</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-5 max-w-sm">
                {COMPLEXO.fraseLonga}
              </p>
              <div className="space-y-2 text-sm text-gray-400">
                {p?.telefone && (
                  <a href={`tel:${p.telefone.replace(/\D/g, "")}`} className="block hover:text-white transition-marca">
                    📞 {p.telefone}
                  </a>
                )}
                {p?.email && (
                  <a href={`mailto:${p.email}`} className="block hover:text-white transition-marca break-all">✉️ {p.email}</a>
                )}
                <a href={IDENTIDADE.instagram} target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-marca">
                  📷 {IDENTIDADE.instagramUser}
                </a>
              </div>
              {wa && (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-marca text-sm font-medium text-white bg-acento hover:bg-acento-hover transition-marca"
                >
                  💬 Falar no WhatsApp
                </a>
              )}
            </div>

            {Object.entries(RODAPE).map(([titulo, links]) => (
              <div key={titulo}>
                <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-wider">{titulo}</h4>
                {links.map(([href, label]) => (
                  <Link key={href} href={href} className="block text-sm text-gray-400 hover:text-white transition-marca mb-2.5">
                    {label}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} {nome}</p>
            <p>{p?.endereco || "Praia de Encantadas, s/n — Ilha do Mel, Paranaguá/PR"}</p>
          </div>
        </div>
      </footer>

      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar no WhatsApp"
          className="fixed bottom-5 right-5 z-40 text-white p-4 rounded-full shadow-xl hover:scale-110 transition-transform duration-300"
          style={{ backgroundColor: "#25D366" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
        </a>
      )}
    </div>
  );
}
