import { brl, tituloQuarto } from "@/lib/format";
import postgres from "postgres"; import { notFound } from "next/navigation"; import Link from "next/link"; import { fetchTarifas } from "@/lib/worker"; import { buildDeepLink } from "@/lib/deeplink"; import { Gallery } from "@/components/site/Gallery";

export const dynamic = "force-dynamic";

export default async function QuartoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [q] = await sql`SELECT q.*, c.nome as cat_nome FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id WHERE q.slug = ${slug} AND q.ativo = true`;
  if (!q) { await sql.end(); notFound(); }
  const [p] = await sql`SELECT * FROM pousada LIMIT 1`;
  const comods = await sql`SELECT cm.* FROM comodidades cm JOIN quarto_comodidades qc ON qc.comodidade_id = cm.id WHERE qc.quarto_id = ${q.id}`;
  const fotos = await sql`SELECT * FROM midias WHERE quarto_id = ${q.id} ORDER BY ordem`;
  await sql.end();

  // Preço ao vivo
  let preco: any = null;
  try {
    if (q.desbravador_room_id) {
      const data = await fetchTarifas("2026-10-15", "2026-10-17", 2);
      const found = [...data.quartos, ...data.indisponiveis].find((r: any) => r.id === q.desbravador_room_id);
      if (found) preco = found;
    }
  } catch {}

  const galleryImages = fotos.length > 0
    ? fotos.map((f: any) => ({ url: f.url, alt: f.alt }))
    : [{ url: "", alt: q.nome }];

  const wa = p?.whatsapp?.replace(/\D/g, "") || "";
  const waMsg = `Olá! Tenho interesse no quarto *${q.nome}* da Pousada Marimar.`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-teal-600">Home</Link>
        <span>/</span>
        <Link href="/quartos" className="hover:text-teal-600">Quartos</Link>
        <span>/</span>
        <span className="text-gray-600">{q.nome}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
        {/* Galeria - ocupa 3 colunas */}
        <div className="lg:col-span-3">
          <Gallery images={galleryImages} />
        </div>

        {/* Info - ocupa 2 colunas */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-6">
            <div>
              {q.cat_nome && (
                              <span className="text-sm text-teal-600 font-medium mb-2 block">{q.cat_nome}</span>
                            )}
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{q.nome}</h1>
              {q.descricao_motor && (
                <p className="mt-2 text-gray-500 text-sm leading-relaxed line-clamp-3">{q.descricao_motor}</p>
              )}
              {q.descricao && (
                <p className="mt-2 text-gray-600 text-sm">{q.descricao}</p>
              )}
            </div>

            {/* Especificações */}
            <div className="grid grid-cols-2 gap-3">
              {q.cama && <Spec label="Cama" value={q.cama} icon="🛏" />}
              {q.metragem && <Spec label="Tamanho" value={`${q.metragem}m²`} icon="📐" />}
              <Spec label="Ocupação" value={`Até ${q.ocupacao_max} pessoas`} icon="👥" />
              {q.vista && <Spec label="Vista" value={q.vista} icon="🌅" />}
            </div>

            {/* Comodidades */}
            {comods.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-gray-700 mb-3">Comodidades</h3>
                <div className="grid grid-cols-2 gap-2">
                  {comods.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                      {c.nome}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preço */}
            <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-2xl p-6 border border-teal-100">
              {preco ? (
                <>
                  <p className="text-sm text-gray-500 mb-1">A partir de</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-teal-700">{brl(preco.diaria)}</span>
                    <span className="text-sm text-gray-500">/noite</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Total para 2 noites: <span className="font-semibold text-gray-700">{brl(preco.total)}</span>
                  </p>
                  {preco.pacote && (
                    <p className="text-xs text-teal-600 mt-2 flex items-center gap-1">
                      <span>🎁</span> {preco.pacote}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 mt-4">
                    <a
                      href={buildDeepLink({ checkIn: "2026-10-15", checkOut: "2026-10-17", adultos: 2 })}
                      target="_blank"
                      className="block text-center bg-teal-600 text-white py-3 rounded-xl font-medium hover:bg-teal-700 transition-colors"
                    >
                      Reservar no site oficial
                    </a>
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(waMsg)}`}
                      target="_blank"
                      className="block text-center border-2 border-green-500 text-green-600 py-3 rounded-xl font-medium hover:bg-green-50 transition-colors"
                    >
                      💬 Falar no WhatsApp
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-sm mb-4">Consulte a disponibilidade para ver os preços em tempo real.</p>
                  <Link
                    href="/reservar"
                    className="block text-center bg-teal-600 text-white py-3 rounded-xl font-medium hover:bg-teal-700 transition-colors"
                  >
                    Consultar disponibilidade
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-700">{value}</p>
      </div>
    </div>
  );
}