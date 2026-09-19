import Link from "next/link";
import postgres from "postgres";
import { MenuPrincipal } from "@/components/site/MenuPrincipal";
import { COLUNAS_RODAPE } from "@/lib/navegacao";
import { COMPLEXO, CONTATO, IDENTIDADE } from "@/lib/conteudo-pousada";
import { lerTema } from "@/lib/tema";

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

/**
 * Topo, gaveta do celular e rodape leem a MESMA arvore, em
 * src/lib/navegacao.ts. Antes eram duas listas soltas aqui: seis links no
 * topo e quinze no rodape, que divergiam a cada pagina nova.
 */

const FALLBACK: Record<string, any> = {
  nome: "Pousada Ilha do Mel Marimar",
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let p: Record<string, any> = FALLBACK;
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    const [row] = await sql`SELECT to_jsonb(x) AS dados FROM pousada x LIMIT 1`;
    await sql.end();
    if (row?.dados) p = row.dados as Record<string, any>;
  } catch (e) {
    console.error("[SiteLayout] banco indisponivel, usando fallback:", (e as Error).message);
  }

  const wa = p?.whatsapp?.replace(/\D/g, "") || "";
  const nome = p?.nome || FALLBACK.nome;

  // Faixa de aviso configurada em Admin -> Identidade visual -> Banner.
  // Sem isto o editor salvaria e nada apareceria — que era exatamente o
  // problema do editor antigo.
  const banner = lerTema(p).banner;
  const mostrarBanner = banner.ativo && !!banner.texto;

  return (
    <div className="min-h-screen flex flex-col bg-fundo">
      {mostrarBanner && (
        <div className="bg-acento text-acento-texto text-center text-sm px-4 py-2.5">
          <span className={banner.animado !== false ? "inline-block animate-pulse" : ""}>
            {banner.texto}
          </span>
          {banner.subtexto && <span className="opacity-85"> · {banner.subtexto}</span>}
        </div>
      )}

      <MenuPrincipal
        nome={IDENTIDADE.nome}
        logoUrl={p?.logo_url ?? null}
        whatsappDigitos={wa || CONTATO.whatsappDigitos}
        whatsappExibicao={p?.whatsapp || CONTATO.whatsapp}
        instagram={IDENTIDADE.instagram}
        instagramUser={IDENTIDADE.instagramUser}
      />

      <main className="flex-1">{children}</main>

      <footer className="bg-gray-900 text-gray-300 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          {/* A frase estrutural do complexo, exigida em todas as paginas */}
          <p className="text-sm text-white/90 bg-white/5 border border-white/10 rounded-marca px-5 py-4 mb-10 leading-relaxed">
            {COMPLEXO.fraseRodape}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-10">
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
                  className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-marca text-sm font-medium text-acento-texto bg-acento hover:bg-acento-hover transition-marca"
                >
                  💬 Falar no WhatsApp
                </a>
              )}
            </div>

            {COLUNAS_RODAPE.map((coluna) => (
              <div key={coluna.titulo}>
                <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-wider">{coluna.titulo}</h4>
                {coluna.itens.map((item) => (
                  <Link key={item.href} href={item.href} className="block text-sm text-gray-400 hover:text-white transition-marca mb-2.5">
                    {item.rotulo}
                  </Link>
                ))}
              </div>
            ))}
            <div>
              <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-wider">Reservas</h4>
              {[["/reservar", "Consultar disponibilidade"], ["/contato", "Falar com a pousada"]].map(([href, rotulo]) => (
                <Link key={href} href={href} className="block text-sm text-gray-400 hover:text-white transition-marca mb-2.5">
                  {rotulo}
                </Link>
              ))}
            </div>
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
