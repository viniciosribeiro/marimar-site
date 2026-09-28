"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lightbox, type FotoLightbox } from "./Lightbox";

export type GrupoGaleria = {
  /** Seção (pousada, quarto, restaurante…) — é o filtro. */
  secao: string;
  titulo: string;
  /** Link "ver a suíte", só nos grupos de suíte. */
  href?: string;
  fotos: FotoLightbox[];
};

/**
 * Galeria pública, separada por onde cada foto pertence.
 *
 * Antes toda foto que não era de suíte caía num grupo único "A pousada" —
 * restaurante, café da manhã e praia misturados. Agora cada seção tem sua
 * aba, e cada suíte o seu bloco: as fotos de uma suíte não aparecem na
 * outra. As abas rolam na horizontal no celular em vez de quebrar em
 * várias linhas.
 */
export function GaleriaSecoes({
  grupos, secoes,
}: {
  grupos: GrupoGaleria[];
  secoes: { chave: string; nome: string }[];
}) {
  const [filtro, setFiltro] = useState<string>("todas");
  const [aberto, setAberto] = useState<{ grupo: number; foto: number } | null>(null);

  const comFoto = secoes.filter((s) => grupos.some((g) => g.secao === s.chave));
  const visiveis = grupos
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => filtro === "todas" || g.secao === filtro);

  return (
    <>
      {comFoto.length > 1 && (
        <nav aria-label="Filtrar fotos" className="sticky top-[var(--altura-topo,4rem)] z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-fundo/90 backdrop-blur-md mb-6">
          <ul className="flex gap-2 overflow-x-auto no-scrollbar">
            {[{ chave: "todas", nome: "Todas" }, ...comFoto].map((s) => {
              const ativo = filtro === s.chave;
              return (
                <li key={s.chave} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setFiltro(s.chave)}
                    aria-pressed={ativo}
                    className={`rounded-full px-4 py-2 text-sm font-medium border transition-marca min-h-10 ${
                      ativo
                        ? "bg-marca text-marca-texto border-marca shadow-marca"
                        : "bg-white text-tinta border-linha hover:border-marca"
                    }`}
                  >
                    {s.nome}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className="space-y-14">
        {visiveis.map(({ g, i }) => (
          <section key={`${g.secao}-${g.titulo}`} aria-labelledby={`grupo-${i}`}>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <h2 id={`grupo-${i}`} className="font-titulo text-xl sm:text-2xl font-bold text-tinta">{g.titulo}</h2>
                <p className="text-xs text-tinta-suave mt-0.5">{g.fotos.length === 1 ? "1 foto" : `${g.fotos.length} fotos`}</p>
              </div>
              {g.href && (
                <Link href={g.href} className="inline-flex items-center py-3 text-sm font-semibold text-marca hover:text-marca-hover shrink-0">
                  Ver a suíte →
                </Link>
              )}
            </div>

            {/* Primeira foto maior: dá ritmo e evita a grade "planilha". */}
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 auto-rows-[9rem] sm:auto-rows-[12rem]">
              {g.fotos.map((f, j) => (
                <li key={`${f.url}-${j}`} className={j === 0 && g.fotos.length > 2 ? "col-span-2 row-span-2" : ""}>
                  <button
                    type="button"
                    onClick={() => setAberto({ grupo: i, foto: j })}
                    className="group relative block w-full h-full rounded-marca overflow-hidden bg-areia focus-visible:ring-4 focus-visible:ring-marca/40"
                    aria-label={`Ampliar: ${f.alt}`}
                  >
                    <Image
                      src={f.url}
                      alt={f.alt}
                      fill
                      sizes={j === 0 ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 1024px) 50vw, 25vw"}
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {aberto && (
        <Lightbox
          fotos={grupos[aberto.grupo].fotos}
          indice={aberto.foto}
          titulo={grupos[aberto.grupo].titulo}
          aoMudar={(foto) => setAberto({ grupo: aberto.grupo, foto })}
          aoFechar={() => setAberto(null)}
        />
      )}
    </>
  );
}
