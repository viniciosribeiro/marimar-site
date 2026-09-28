import postgres from "postgres";
import Link from "next/link";
import type { Metadata } from "next";
import { CartaoSuite } from "@/components/site/CartaoSuite";
import { COMPLEXO, COMODIDADES_CONFIRMADAS } from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acomodações — Pousada Marimar, Ilha do Mel",
  description: "Suítes com banheiro privativo, ar-condicionado e TV em Encantadas. Consulte disponibilidade e tarifas em tempo real.",
};

export default async function QuartosPage() {
  let lista: any[] = [];
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
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
      <span className="inline-flex items-center gap-2 text-marca font-semibold text-[0.72rem] uppercase tracking-[0.24em]">
        <span className="h-px w-6 bg-marca/60" aria-hidden />Acomodações
      </span>
      <h1 className="font-titulo text-[2.2rem] leading-tight lg:text-5xl font-bold text-tinta mt-3 mb-3">Nossas suítes</h1>
      <p className="text-tinta-suave leading-relaxed mb-6 max-w-2xl">{COMPLEXO.fraseLonga}</p>

      <ul className="flex flex-wrap gap-2 mb-10">
        {COMODIDADES_CONFIRMADAS.slice(0, 6).map((c) => (
          <li key={c} className="text-xs bg-areia text-tinta px-3 py-1.5 rounded-full">{c}</li>
        ))}
      </ul>

      {lista.length === 0 ? (
        <div className="bg-fundo-suave rounded-marca p-10 text-center">
          <p className="text-tinta-suave mb-4">Não conseguimos carregar as acomodações agora.</p>
          <Link href="/reservar" className="text-sm text-marca font-semibold hover:text-marca-hover transition-marca">
            Consultar disponibilidade →
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {lista.map((q: any) => (
            <li key={q.id}>
              <CartaoSuite q={q} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
            </li>
          ))}
        </ul>
      )}

      <div className="relative overflow-hidden mt-12 bg-tinta text-white rounded-[calc(var(--raio)*2)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="relative">
          <p className="font-titulo text-xl font-bold text-white mb-1">Tarifas e disponibilidade em tempo real</p>
          <p className="text-sm text-white/75">Informe suas datas para ver quais suítes estão livres e por quanto.</p>
        </div>
        <Link href="/reservar" className="relative inline-flex items-center justify-center h-12 px-6 rounded-full bg-white text-tinta text-sm font-semibold hover:bg-white/90 transition-marca whitespace-nowrap shrink-0">
          Consultar disponibilidade
        </Link>
      </div>
    </div>
  );
}
