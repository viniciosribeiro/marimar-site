"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lightbox, type FotoLightbox } from "@/components/site/Lightbox";

export type GrupoFotos = { titulo: string; href?: string; fotos: FotoLightbox[] };
export type Capitulo =
  | { tipo: "secao"; chave: string; nome: string; grupo: GrupoFotos }
  | { tipo: "suites"; chave: string; nome: string; suites: GrupoFotos[] };

/** Quantas fotos o mosaico mostra: uma grande e quatro pequenas fecham duas linhas no celular e no computador. */
export const NO_MOSAICO = 5;

/**
 * Galeria do site novo em capítulos curtos (a do Clássico era uma parede de
 * 92 fotos, 12.777 px no celular — análise de 04/11/2026): cada capítulo
 * mostra até 5 fotos e "Ver as N fotos" abre todas em tela cheia; as suítes
 * aparecem como capas, cada uma abrindo as suas fotos.
 */
export function CapitulosGaleria({ capitulos }: { capitulos: Capitulo[] }) {
  const [aberto, setAberto] = useState<{ grupo: GrupoFotos; foto: number } | null>(null);
  const abrir = (grupo: GrupoFotos, foto = 0) => setAberto({ grupo, foto });

  return (
    <>
      <div className="space-y-20 lg:space-y-28">
        {capitulos.map((c) => (
          <section key={c.chave} id={`capitulo-${c.chave}`} aria-labelledby={`titulo-${c.chave}`}
            className="sn-margem mx-auto max-w-[1240px] scroll-mt-[calc(var(--sn-topo)+1rem)]">
            {c.tipo === "secao" ? (
              <>
                <Cabecalho id={`titulo-${c.chave}`} nome={c.nome} total={c.grupo.fotos.length}
                  acao={c.grupo.fotos.length > NO_MOSAICO ? <button type="button" onClick={() => abrir(c.grupo)} className="sn-link min-h-11">Ver as {c.grupo.fotos.length} fotos</button> : null} />
                <Mosaico grupo={c.grupo} abrir={abrir} />
              </>
            ) : (
              <>
                <Cabecalho id={`titulo-${c.chave}`} nome={c.nome} total={c.suites.length} unidade="suíte" />
                <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {c.suites.map((s) => (
                    <li key={s.titulo} className="min-w-0">
                      <button type="button" onClick={() => abrir(s)} aria-label={`Ver as fotos da ${s.titulo}`}
                        className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[14px] bg-sn-areia">
                        <Image src={s.fotos[0].url} alt={s.fotos[0].alt} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                      </button>
                      <div className="mt-3 flex items-baseline justify-between gap-4">
                        <h3 className="sn-h3">{s.titulo}</h3>
                        <span className="shrink-0 text-[0.92rem] text-sn-texto-2">{s.fotos.length === 1 ? "1 foto" : `${s.fotos.length} fotos`}</span>
                      </div>
                      {s.href && <Link href={s.href} className="sn-link mt-1 inline-flex min-h-11 items-center text-[0.95rem]">Ver a suíte</Link>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ))}
      </div>
      {aberto && (
        <Lightbox fotos={aberto.grupo.fotos} indice={aberto.foto} titulo={aberto.grupo.titulo}
          aoMudar={(foto) => setAberto({ grupo: aberto.grupo, foto })} aoFechar={() => setAberto(null)} />
      )}
    </>
  );
}

function Cabecalho({ id, nome, total, unidade = "foto", acao }: { id: string; nome: string; total: number; unidade?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        <h2 id={id} className="sn-h2">{nome}</h2>
        <p className="mt-1 text-[0.95rem] text-sn-texto-2">{total === 1 ? `1 ${unidade}` : `${total} ${unidade}s`}</p>
      </div>
      {acao}
    </div>
  );
}

/** Classes de cada célula: uma grande à esquerda e as pequenas fechando o bloco, sem buraco. */
function celula(i: number, n: number): string {
  const pequenas = n - 1;
  if (i === 0) return n === 1 ? "col-span-2 row-span-2 lg:col-span-4" : "col-span-2 row-span-2";
  const ultimaSozinha = pequenas % 2 === 1 && i === n - 1 ? "max-lg:col-span-2" : "";
  const noComputador =
    pequenas === 1 ? "lg:col-span-2 lg:row-span-2"
    : pequenas === 2 ? "lg:col-span-2"
    : pequenas === 3 && i === 1 ? "lg:col-span-2"
    : "";
  return `${ultimaSozinha} ${noComputador}`;
}

function Mosaico({ grupo, abrir }: { grupo: GrupoFotos; abrir: (g: GrupoFotos, i?: number) => void }) {
  const mostradas = grupo.fotos.slice(0, NO_MOSAICO);
  const n = mostradas.length;
  return (
    <ul className="mt-6 grid grid-cols-2 gap-2 auto-rows-[9.5rem] sm:auto-rows-[12rem] lg:grid-cols-4 lg:auto-rows-[13.5rem]">
      {mostradas.map((f, i) => (
        <li key={`${f.url}-${i}`} className={`min-w-0 ${celula(i, n)}`}>
          <button type="button" onClick={() => abrir(grupo, i)} aria-label={`Ampliar: ${f.alt}`}
            className="relative block h-full w-full cursor-zoom-in overflow-hidden rounded-[12px] bg-sn-areia">
            <Image src={f.url} alt={f.alt} fill className="object-cover"
              sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} />
          </button>
        </li>
      ))}
    </ul>
  );
}
