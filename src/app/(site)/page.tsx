import postgres from "postgres";
import Link from "next/link";
import Image from "next/image";
import { tituloQuarto, resumir, brl } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [p] = await sql`SELECT * FROM pousada LIMIT 1`;
  const quartosList = await sql`
    SELECT q.*, c.nome as cat_nome,
      (SELECT url FROM midias WHERE quarto_id = q.id AND destaque = true ORDER BY ordem LIMIT 1) as foto
    FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id
    WHERE q.ativo = true ORDER BY q.ordem LIMIT 6
  `;
  const deps = await sql`SELECT * FROM depoimentos WHERE ativo = true ORDER BY ordem LIMIT 4`;
  const faqs = await sql`SELECT * FROM faq WHERE ativo = true ORDER BY ordem LIMIT 5`;
  const passeios = await sql`SELECT * FROM passeios WHERE ativo = true ORDER BY ordem LIMIT 3`;
  // Foto do hero: prefere uma midia em destaque que NAO seja de quarto (foto da
  // pousada/praia); cai para og_image_url e, por fim, para o gradiente.
  const [heroMidia] = await sql`
    SELECT url, alt FROM midias WHERE destaque = true
    ORDER BY (quarto_id IS NULL) DESC, ordem LIMIT 1
  `;
  await sql.end();

  const heroUrl: string | null = heroMidia?.url || p?.og_image_url || null;

  const wa = p?.whatsapp?.replace(/\D/g, "") || "";

  return (
    <div>
      {/* ─── HERO ─── */}
      <section className="relative bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 text-white py-28 lg:py-36 overflow-hidden">
        {heroUrl ? (
          <>
            <Image
              src={heroUrl}
              alt={heroMidia?.alt || p?.nome || "Pousada Ilha do Mel Marimar"}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            {/* Escurece a foto para o texto continuar legivel sobre qualquer imagem */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        )}
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <span className="inline-block text-teal-200 text-sm font-medium bg-white/10 px-4 py-1.5 rounded-full mb-6 backdrop-blur">
            🌊 Ilha do Mel • Encantadas • Paraná
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            {p?.nome || "Pousada Ilha do Mel Marimar"}
          </h1>
          <p className="text-lg lg:text-xl text-teal-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            {p?.descricao_curta || "Seu refúgio pé na areia. Conforto, natureza e a autêntica hospitalidade paranaense."}
          </p>
          <form action="/reservar" className="bg-white rounded-2xl shadow-2xl p-3 max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
            <input type="date" name="check_in" required className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" placeholder="Check-in" />
            <input type="date" name="check_out" required className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" placeholder="Check-out" />
            <select name="adultos" defaultValue="2" className="px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-teal-500 outline-none">
              <option>1</option><option>2</option><option>3</option><option>4</option>
            </select>
            <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-sm whitespace-nowrap">
              Ver disponibilidade
            </button>
          </form>
        </div>
      </section>

      {/* ─── QUARTOS ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <span className="text-teal-600 font-medium text-sm">Acomodações</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2">Nossos Quartos</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">Do econômico Standard à luxuosa Suíte com Hidromassagem — encontre o quarto perfeito para sua estadia.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quartosList.map((q: any) => (
            <Link key={q.id} href={`/quartos/${q.slug}`} className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
              <div className="relative h-52 overflow-hidden">
                {q.foto ? (
                  <Image src={q.foto} alt={q.nome} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-teal-100 to-emerald-200 flex items-center justify-center">
                    <span className="text-5xl opacity-40">🏨</span>
                  </div>
                )}
                {q.cat_nome && (
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur text-xs font-medium text-teal-700 px-3 py-1 rounded-full">
                    {q.cat_nome}
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-lg text-gray-900 group-hover:text-teal-600 transition-colors">{tituloQuarto(q.nome)}</h3>
                <p className="text-sm text-gray-500 mt-1">{resumir(q.descricao || q.descricao_motor, 110)}</p>
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                  {q.cama && <span className="flex items-center gap-1">🛏 {q.cama}</span>}
                  <span className="flex items-center gap-1">👥 Até {q.ocupacao_max}</span>
                  {q.metragem && <span>{q.metragem}m²</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/quartos" className="inline-flex items-center gap-2 text-teal-600 font-medium hover:text-teal-700 transition-colors">
            Ver todos os quartos <span className="text-lg">→</span>
          </Link>
        </div>
      </section>

      {/* ─── DEPOIMENTOS ─── */}
      {deps.length > 0 && (
        <section className="bg-gradient-to-b from-gray-50 to-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-amber-500 font-medium text-sm">Depoimentos</span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2">O que dizem nossos hóspedes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {deps.map((d: any) => (
                <div key={d.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < d.nota ? "text-amber-400" : "text-gray-200"}>★</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{resumir(d.texto, 150)}</p>
                  <div className="mt-4 pt-3 border-t border-gray-50">
                    <p className="text-sm font-semibold text-gray-800">{d.autor}</p>
                    <p className="text-xs text-gray-400">{d.origem}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── PASSEIOS ─── */}
      {passeios.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-teal-600 font-medium text-sm">Experiências</span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-2">Explore a Ilha do Mel</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {passeios.map((p: any) => (
                <div key={p.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 text-xl mb-4">
                    {p.ordem === 1 ? "🥾" : p.ordem === 2 ? "🚤" : p.ordem === 3 ? "🌅" : "🌟"}
                  </div>
                  <h3 className="font-semibold text-gray-900">{p.nome}</h3>
                  <p className="text-sm text-gray-500 mt-2">{resumir(p.descricao, 120)}</p>
                  <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                    <span>⏱ {p.duracao}</span>
                    {p.preco_referencia && <span className="font-medium text-teal-600">a partir de {brl(p.preco_referencia)}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href="/ilha-do-mel" className="inline-flex items-center gap-2 text-teal-600 font-medium hover:text-teal-700">
                Ver todos os passeios <span className="text-lg">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── CTA ─── */}
      <section className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white py-20 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Pronto para sua estadia na Ilha do Mel?</h2>
          <p className="text-teal-100 text-lg mb-8">Consulte a disponibilidade e garanta sua vaga no paraíso.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/reservar" className="bg-white text-teal-700 px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors text-lg">
              Consultar disponibilidade
            </Link>
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" className="border-2 border-white/50 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors text-lg">
                💬 Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      {faqs.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Perguntas Frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f: any) => (
              <details key={f.id} className="group bg-white rounded-2xl shadow-sm border border-gray-100">
                <summary className="px-6 py-4 font-medium text-gray-800 cursor-pointer hover:text-teal-600 transition-colors list-none flex items-center justify-between">
                  {f.pergunta}
                  <span className="text-gray-300 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{f.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}