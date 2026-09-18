import postgres from "postgres";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { tituloQuarto, resumir } from "@/lib/format";
import { COMPLEXO, COMODIDADES_CONFIRMADAS } from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acomodações — Pousada Marimar, Ilha do Mel",
  description: "Suítes com banheiro privativo, ar-condicionado e TV em Encantadas. Consulte disponibilidade e tarifas em tempo real.",
};

export default async function QuartosPage() {
  let lista: any[] = [];
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    // A foto de capa NAO estava sendo consultada: a pagina tinha um emoji fixo
    // no lugar da imagem. Agora pega a midia em destaque do quarto e, se nao
    // houver, a primeira por ordem.
    lista = await sql`
      SELECT q.*, c.nome AS cat_nome,
        COALESCE(
          (SELECT m.url FROM midias m WHERE m.quarto_id = q.id AND m.destaque = true ORDER BY m.ordem LIMIT 1),
          (SELECT m.url FROM midias m WHERE m.quarto_id = q.id ORDER BY m.ordem LIMIT 1)
        ) AS foto,
        COALESCE(
          (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id AND m.destaque = true ORDER BY m.ordem LIMIT 1),
          (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id ORDER BY m.ordem LIMIT 1)
        ) AS foto_alt,
        (SELECT count(*)::int FROM midias m WHERE m.quarto_id = q.id) AS total_fotos
      FROM quartos q
      LEFT JOIN categorias c ON q.categoria_id = c.id
      WHERE q.ativo = true
      ORDER BY q.ordem
    `;
    await sql.end();
  } catch (e) {
    console.error("[Quartos] banco indisponivel:", (e as Error).message);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Acomodações</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-3">Nossas suítes</h1>
      <p className="text-gray-600 leading-relaxed mb-6 max-w-2xl">{COMPLEXO.fraseLonga}</p>

      <div className="flex flex-wrap gap-2 mb-10">
        {COMODIDADES_CONFIRMADAS.slice(0, 6).map((c) => (
          <span key={c} className="text-xs bg-marca-sutil text-marca-ativa px-3 py-1.5 rounded-full">{c}</span>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="bg-fundo-suave rounded-marca p-10 text-center">
          <p className="text-gray-500 mb-4">Não conseguimos carregar as acomodações agora.</p>
          <Link href="/reservar" className="text-sm text-marca font-medium hover:text-marca-hover transition-marca">
            Consultar disponibilidade →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {lista.map((q: any) => (
            <Link
              key={q.id}
              href={`/quartos/${q.slug}`}
              className="group bg-white rounded-marca shadow-marca hover:shadow-marca-forte transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col"
            >
              <div className="relative h-52 overflow-hidden bg-marca-suave">
                {q.foto ? (
                  <Image
                    src={q.foto}
                    alt={q.foto_alt || tituloQuarto(q.nome)}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl opacity-40">🏨</span>
                  </div>
                )}
                {q.cat_nome && (
                  <span className="absolute top-3 left-3 bg-white/95 text-xs font-medium text-marca-ativa px-3 py-1 rounded-full shadow-sm">
                    {tituloQuarto(q.cat_nome)}
                  </span>
                )}
                {q.total_fotos > 1 && (
                  <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full">
                    📷 {q.total_fotos}
                  </span>
                )}
              </div>

              <div className="p-5 flex flex-col flex-1">
                <h2 className="font-semibold text-lg text-gray-900 group-hover:text-marca transition-marca">
                  {tituloQuarto(q.nome)}
                </h2>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed flex-1">
                  {resumir(q.descricao || q.descricao_motor, 110)}
                </p>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  {q.cama && <span>🛏 {q.cama}</span>}
                  <span>👥 Até {q.ocupacao_max}</span>
                  {q.metragem && <span>{q.metragem}m²</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12 bg-marca-sutil border border-marca-borda rounded-marca p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900 mb-1">Tarifas e disponibilidade em tempo real</p>
          <p className="text-sm text-gray-600">Informe suas datas para ver quais suítes estão livres e por quanto.</p>
        </div>
        <Link href="/reservar" className="bg-marca hover:bg-marca-hover text-marca-texto px-5 py-3 rounded-marca text-sm font-semibold transition-marca whitespace-nowrap shrink-0">
          Consultar disponibilidade
        </Link>
      </div>
    </div>
  );
}
