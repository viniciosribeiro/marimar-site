import Link from "next/link";
import Image from "next/image";
import { tituloQuarto, resumir, pluralizar } from "@/lib/format";
import { FolhaPalmeira } from "./Tropical";

export type SuiteCartao = {
  id: string; slug: string; nome: string;
  cat_nome?: string | null; descricao?: string | null; descricao_motor?: string | null;
  foto?: string | null; foto_alt?: string | null; total_fotos?: number | null;
  ocupacao_max: number; cama?: string | null; metragem?: number | null;
};

/**
 * Cartão de uma suíte: a foto inteira, com nome e capacidade por cima.
 *
 * Um só componente para a home e para /quartos — antes cada página tinha o
 * seu, e a lista de acomodações ficou com o cartão branco antigo e um
 * emoji de hotel no lugar da foto. Sem foto cadastrada, entra o degradê
 * do tema com folhagem: nunca um desenho genérico.
 */
export function CartaoSuite({ q, sizes }: { q: SuiteCartao; sizes: string }) {
  const nome = tituloQuarto(q.nome);
  return (
    <Link
      href={`/quartos/${q.slug}`}
      className="group relative isolate flex flex-col justify-end aspect-[4/5] overflow-hidden rounded-[calc(var(--raio)*2)] bg-areia shadow-[0_24px_50px_-28px_rgb(18_50_79/0.6)]"
    >
      {q.foto ? (
        <Image src={q.foto} alt={q.foto_alt || nome} fill sizes={sizes}
          className="object-cover -z-10 transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-marca via-marca-hover to-marca-escura">
          <FolhaPalmeira className="absolute -right-10 -top-6 w-64 text-white/15 rotate-[25deg]" />
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute top-4 inset-x-4 flex items-start justify-between gap-2">
        {q.cat_nome ? (
          <span className="rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[0.72rem] font-semibold text-tinta">
            {tituloQuarto(q.cat_nome)}
          </span>
        ) : <span />}
        {!!q.total_fotos && q.total_fotos > 1 && (
          <span className="rounded-full bg-black/50 backdrop-blur px-2.5 py-1 text-[0.72rem] text-white">
            {pluralizar(q.total_fotos, "foto")}
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6 text-white">
        <h3 className="font-titulo text-2xl font-bold text-white">{nome}</h3>
        <p className="text-sm text-white/80 mt-1.5 line-clamp-2">{resumir(q.descricao || q.descricao_motor, 90)}</p>
        <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/20">
          <span className="text-xs text-white/85 flex flex-wrap gap-x-3 gap-y-1">
            <span>Até {pluralizar(q.ocupacao_max, "pessoa")}</span>
            {q.cama && <span>{q.cama}</span>}
            {q.metragem && <span>{q.metragem} m²</span>}
          </span>
          <span className="shrink-0 w-10 h-10 rounded-full bg-white text-tinta flex items-center justify-center transition-transform group-hover:translate-x-1" aria-hidden>→</span>
        </div>
      </div>
    </Link>
  );
}
