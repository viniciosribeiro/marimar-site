import postgres from "postgres";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { COMPLEXO } from "@/lib/conteudo-pousada";
import { tituloQuarto } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Galeria — Pousada Marimar, Ilha do Mel",
  description: "Fotos das acomodações, do restaurante pé na areia e das áreas comuns da Pousada Marimar em Encantadas.",
};

export default async function GaleriaPage() {
  let midias: any[] = [];
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    midias = await sql`
      SELECT m.url, m.alt, m.quarto_id, q.nome AS quarto_nome, c.nome AS cat_nome
      FROM midias m
      LEFT JOIN quartos q ON m.quarto_id = q.id
      LEFT JOIN categorias c ON q.categoria_id = c.id
      ORDER BY (m.quarto_id IS NULL) DESC, c.nome NULLS FIRST, m.ordem
    `;
    await sql.end();
  } catch (e) {
    console.error("[Galeria] banco indisponivel:", (e as Error).message);
  }

  // Agrupa por origem: fotos da pousada primeiro, depois por acomodacao
  const grupos = new Map<string, any[]>();
  for (const m of midias) {
    const chave = m.quarto_nome ? tituloQuarto(m.quarto_nome) : "A pousada";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(m);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Fotos</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-3">Galeria</h1>
      <p className="text-gray-600 leading-relaxed mb-10 max-w-2xl">{COMPLEXO.fraseLonga}</p>

      {grupos.size === 0 ? (
        <div className="bg-fundo-suave rounded-marca p-10 text-center">
          <p className="text-gray-500 mb-4">Ainda não há fotos cadastradas.</p>
          <Link href="/reservar" className="text-sm text-marca font-medium hover:text-marca-hover transition-marca">
            Consultar disponibilidade →
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {[...grupos.entries()].map(([titulo, fotos]) => (
            <section key={titulo}>
              <h2 className="font-titulo text-xl font-bold text-gray-900 mb-1">{titulo}</h2>
              <p className="text-xs text-gray-400 mb-5">{fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {fotos.map((f: any, i: number) => (
                  <div key={`${f.url}-${i}`} className="relative aspect-[4/3] rounded-marca overflow-hidden bg-marca-suave group">
                    <Image
                      src={f.url}
                      alt={f.alt || titulo}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
