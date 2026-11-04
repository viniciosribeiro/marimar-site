"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Lightbox } from "@/components/site/Lightbox";

type Foto = { url: string; alt: string };

/**
 * Fotos da suíte no site novo. Uma lista só, que muda de forma:
 *  - celular: as fotos de ponta a ponta, deslizando de lado, com "2 de 7";
 *  - computador: mosaico (uma grande e até quatro menores) e "Ver as 7 fotos".
 * Tocar numa foto abre a tela cheia de sempre (Lightbox: deslizar, setas, Esc).
 * Uma estrutura só para o navegador não baixar as fotos duas vezes.
 */
export function GaleriaSuite({ fotos, nome }: { fotos: Foto[]; nome: string }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [atual, setAtual] = useState(0);
  const trilho = useRef<HTMLUListElement>(null);
  const total = fotos.length;

  if (!total) {
    return (
      <div className="sn-margem mx-auto max-w-[1240px]">
        <div className="flex aspect-[16/9] items-center justify-center rounded-[16px] bg-sn-areia px-6 text-center text-sn-texto-2 lg:aspect-[21/8]">
          As fotos desta suíte chegam em breve.
        </div>
      </div>
    );
  }

  const grade = total === 1 ? "lg:grid-cols-1" : total === 2 ? "lg:grid-cols-2" : "lg:grid-cols-4 lg:grid-rows-2";
  const celula = (i: number) => {
    if (total <= 2) return "";
    if (i === 0) return "lg:col-span-2 lg:row-span-2";
    if (total === 3) return "lg:col-span-2";
    if (total === 4 && i === 1) return "lg:col-span-2";
    return i >= 5 ? "lg:hidden" : "";
  };
  const tamanhos = (i: number) => (total <= 2 || i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 100vw");

  return (
    <div className="relative mx-auto max-w-[1240px] lg:px-10">
      <ul ref={trilho} aria-label={`Fotos da ${nome}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth) setAtual(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
        }}
        className={`sn-trilho flex snap-x snap-mandatory overflow-x-auto lg:grid lg:h-[min(34rem,62vh)] lg:snap-none lg:gap-2 lg:overflow-hidden lg:rounded-[18px] ${grade}`}>
        {fotos.map((f, i) => (
          <li key={`${f.url}-${i}`} className={`relative aspect-[4/3] w-full shrink-0 snap-center lg:aspect-auto lg:w-auto ${celula(i)}`}>
            <button type="button" onClick={() => setAberta(i)} className="absolute inset-0 block h-full w-full cursor-zoom-in bg-sn-areia"
              aria-label={`Ampliar a foto ${i + 1} de ${total}`}>
              <Image src={f.url} alt={f.alt || nome} fill sizes={tamanhos(i)} className="object-cover"
                {...(i === 0 ? { loading: "eager" as const, fetchPriority: "high" as const } : {})} />
            </button>
          </li>
        ))}
      </ul>
      {total > 1 && (
        <>
          <span aria-hidden className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.82rem] tabular-nums text-white lg:hidden"
            style={{ right: "max(0.75rem, env(safe-area-inset-right, 0px))" }}>
            {atual + 1} de {total}
          </span>
          <button type="button" onClick={() => setAberta(0)}
            className="absolute bottom-4 right-14 hidden h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-[0.95rem] font-semibold text-sn-texto shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)] ring-1 ring-black/5 hover:bg-white lg:inline-flex">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            Ver as {total} fotos
          </button>
        </>
      )}
      {aberta !== null && (
        <Lightbox fotos={fotos} indice={aberta} aoMudar={setAberta} aoFechar={() => setAberta(null)} titulo={nome} />
      )}
    </div>
  );
}
