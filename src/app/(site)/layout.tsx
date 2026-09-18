import Link from "next/link"; import postgres from "postgres";

/**
 * Todo o site le conteudo editavel pelo admin, entao nada aqui pode ser
 * congelado em build time.
 *
 * Sem este force-dynamic o Next tentava PRERENDERIZAR as paginas cujo page.tsx
 * tambem nao o declarava (/contato, /faq, /politicas, /a-pousada) e batia no
 * banco durante o `next build`. Consequencia em producao: se o Neon estivesse
 * fora do ar ou lento na hora do deploy, o build INTEIRO falhava — e, quando
 * passava, gravava telefone, cores e textos de forma estatica, fazendo as
 * edicoes do admin so aparecerem no deploy seguinte.
 */
export const dynamic = "force-dynamic";

// Defaults usados quando o banco nao responde: o site continua no ar com o
// catalogo e o CTA, em vez de devolver 500 em todas as paginas de uma vez.
const FALLBACK = {
  nome: "Pousada Ilha do Mel Marimar",
  cor_primaria: "#0D9488",
  cor_secundaria: "#0EA5E9",
} as Record<string, any>;

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
  const cp = p?.cor_primaria || "#0D9488";
  const cs = p?.cor_secundaria || "#0EA5E9";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {p?.logo_url ? <img src={p.logo_url} className="h-9 sm:h-10 w-auto" alt="Logo" /> : <span className="text-2xl">🏝️</span>}
            <span className="text-base sm:text-lg font-bold text-gray-900 leading-tight" style={{ fontFamily: p?.fonte_titulo || "Inter" }}>
              {p?.nome || "Marimar"}
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {[["/","Home"],["/quartos","Quartos"],["/pacotes","Pacotes"],["/a-pousada","A Pousada"],["/ilha-do-mel","Ilha do Mel"],["/contato","Contato"]].map(([href,label]) => (
              <Link key={href} href={href} className="px-3 py-2 text-sm text-gray-600 hover:text-white rounded-lg transition-colors" style={{ ":hover": { backgroundColor: cp } } as any}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/reservar" className="text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: cp }}>
              Reservar
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                {p?.logo_url ? <img src={p.logo_url} className="h-6" alt="Logo" /> : <span className="text-2xl">🏝️</span>}
                <span className="text-white font-bold text-lg">{p?.nome||"Marimar"}</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{p?.descricao_curta}</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Pousada</h4>
              {["/a-pousada","A Pousada","/quartos","Quartos","/pacotes","Pacotes","/ilha-do-mel","Ilha do Mel"].map((v,i,a)=>{
                if(i%2===0) return <Link key={v} href={v} className="block text-sm text-gray-400 hover:text-white transition-colors mb-2">{a[i+1]}</Link>;
                return null;
              })}
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Ajuda</h4>
              <Link href="/faq" className="block text-sm text-gray-400 hover:text-white mb-2">FAQ</Link>
              <Link href="/politicas" className="block text-sm text-gray-400 hover:text-white mb-2">Políticas</Link>
              <Link href="/contato" className="block text-sm text-gray-400 hover:text-white mb-2">Contato</Link>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contato</h4>
              <div className="space-y-2 text-sm text-gray-400">
                {p?.telefone && <p>📞 {p.telefone}</p>}
                {p?.email && <p>✉️ {p.email}</p>}
                {p?.endereco && <p>📍 {p.endereco}</p>}
              </div>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: cs }}>
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} {p?.nome || "Pousada Ilha do Mel Marimar"}
          </div>
        </div>
      </footer>

      {wa && <a href={`https://wa.me/${wa}`} target="_blank" aria-label="Falar no WhatsApp"
        className="fixed bottom-6 right-6 z-50 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-all duration-300"
        style={{ backgroundColor: "#25D366" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
      </a>}
    </div>
  );
}