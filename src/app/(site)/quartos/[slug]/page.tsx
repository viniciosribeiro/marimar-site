import { brl, datasExemplo } from "@/lib/format";
import postgres from "postgres"; import { notFound } from "next/navigation"; import Link from "next/link"; import { fetchTarifas } from "@/lib/worker"; import { buildDeepLink } from "@/lib/deeplink"; import { Gallery } from "@/components/site/Gallery"; import { lerPousada, digitosWhatsApp } from "@/lib/pousada";

export const dynamic = "force-dynamic";

export default async function QuartoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const [q] = await sql`SELECT q.*, c.nome as cat_nome FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id WHERE q.slug = ${slug} AND q.ativo = true`;
  if (!q) { await sql.end(); notFound(); }

  // Preço ao vivo. A consulta ao motor (a parte lenta, ~1s) começa já e
  // corre em paralelo com o resto do banco, em vez de esperar por ele.
  const exemplo = datasExemplo();
  const tarifas = q.desbravador_room_id
    ? fetchTarifas(exemplo.checkIn, exemplo.checkOut, 2).catch(() => null)
    : Promise.resolve(null);

  const p = await lerPousada();
  const comods = await sql`SELECT cm.* FROM comodidades cm JOIN quarto_comodidades qc ON qc.comodidade_id = cm.id WHERE qc.quarto_id = ${q.id}`;
  /* Fotos para a galeria; vídeos à parte (migration 0018). O filtro por
     tipo é o que impede um vídeo de virar uma "foto" quebrada na galeria. */
  const fotos = await sql`SELECT * FROM midias WHERE quarto_id = ${q.id} AND tipo = 'foto' ORDER BY destaque DESC, ordem, criado_em`;
  const videos = await sql<{ id: string; url: string; titulo: string | null; descricao: string | null; thumb_url: string | null; alt: string }[]>`
    SELECT id, url, titulo, descricao, thumb_url, alt FROM midias
    WHERE quarto_id = ${q.id} AND tipo = 'video' ORDER BY ordem, criado_em`.catch(() => []);
  await sql.end();

  let preco: any = null;
  const data = await tarifas;
  if (data) {
    const found = [...data.quartos, ...data.indisponiveis].find((r: any) => r.id === q.desbravador_room_id);
    if (found) preco = found;
  }

  const galleryImages = fotos.length > 0
    ? fotos.map((f: any) => ({ url: f.url, alt: f.alt }))
    : [{ url: "", alt: q.nome }];

  const wa = digitosWhatsApp(p?.whatsapp);
  const waMsg = `Olá! Tenho interesse no quarto *${q.nome}* da Pousada Marimar.`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="inline-block py-2.5 hover:text-marca">Home</Link>
        <span>/</span>
        <Link href="/quartos" className="inline-block py-2.5 hover:text-marca">Quartos</Link>
        <span>/</span>
        <span className="text-gray-600">{q.nome}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
        {/* Galeria - ocupa 3 colunas */}
        <div className="lg:col-span-3">
          <Gallery images={galleryImages} titulo={q.nome} />
          {videos.length > 0 && (
            <section className="mt-8" aria-label="Vídeos da suíte">
              <h2 className="font-titulo text-xl font-bold text-tinta mb-3">Vídeos da suíte</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {videos.map((v) => (
                  <figure key={v.id} className="overflow-hidden rounded-marca border border-linha/60 bg-white">
                    {/* preload="none": vídeo só baixa quando a pessoa aperta play. */}
                    <video src={v.url} poster={v.thumb_url ?? undefined} controls playsInline preload="none"
                      className="aspect-video w-full bg-tinta object-cover" aria-label={v.titulo ?? v.alt} />
                    {(v.titulo || v.descricao) && (
                      <figcaption className="p-3">
                        {v.titulo && <p className="text-sm font-semibold text-tinta">{v.titulo}</p>}
                        {v.descricao && <p className="text-xs text-tinta-suave mt-0.5 leading-relaxed">{v.descricao}</p>}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Info - ocupa 2 colunas */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-6">
            <div>
              {q.cat_nome && (
                              <span className="text-sm text-marca font-medium mb-2 block">{q.cat_nome}</span>
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
            <div className="bg-gradient-to-br from-marca-sutil to-marca-suave/50 rounded-marca p-6 border border-marca-borda">
              {preco ? (
                <>
                  <p className="text-sm text-gray-500 mb-1">A partir de</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-marca-ativa">{brl(preco.diaria)}</span>
                    <span className="text-sm text-gray-500">/noite</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Total para 2 noites: <span className="font-semibold text-gray-700">{brl(preco.total)}</span>
                  </p>
                  {preco.pacote && (
                    <p className="text-xs text-marca mt-2 flex items-center gap-1">
                      <span>🎁</span> {preco.pacote}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 mt-4">
                    <a
                      href={buildDeepLink({ checkIn: exemplo.checkIn, checkOut: exemplo.checkOut, adultos: 2 })}
                      target="_blank"
                      className="block text-center bg-marca text-marca-texto py-3 rounded-marca font-medium hover:bg-marca-hover transition-colors"
                    >
                      Reservar no site oficial
                    </a>
                    <a
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(waMsg)}`}
                      target="_blank"
                      className="block text-center border-2 border-green-500 text-green-600 py-3 rounded-marca font-medium hover:bg-green-50 transition-colors"
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
                    className="block text-center bg-marca text-marca-texto py-3 rounded-marca font-medium hover:bg-marca-hover transition-colors"
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
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-marca">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-700">{value}</p>
      </div>
    </div>
  );
}