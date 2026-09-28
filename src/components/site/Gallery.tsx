"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Lightbox } from "./Lightbox";

/**
 * Galeria da página de uma suíte.
 *
 * Deslizar troca a foto, tocar abre em tela cheia. As bolinhas antigas
 * tinham 10px — pequenas demais para o dedo — e a grade de miniaturas em
 * cinco colunas virava selos no celular; agora elas rolam na horizontal.
 */
export function Gallery({ images, titulo }: { images: { url: string; alt: string }[]; titulo?: string }) {
  const [selected, setSelected] = useState(0);
  const [ampliada, setAmpliada] = useState(false);
  const toqueX = useRef<number | null>(null);

  const fotos = images.filter((i) => i.url);
  if (fotos.length === 0) {
    return (
      <div className="aspect-[16/10] rounded-marca bg-areia flex items-center justify-center text-tinta-suave text-sm">
        Fotos desta suíte em breve
      </div>
    );
  }

  const ir = (i: number) => setSelected((i + fotos.length) % fotos.length);
  const atual = fotos[selected];

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-[16/10] rounded-marca overflow-hidden bg-areia group"
        onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (toqueX.current === null) return;
          const dx = e.changedTouches[0].clientX - toqueX.current;
          toqueX.current = null;
          if (Math.abs(dx) > 40 && fotos.length > 1) ir(selected + (dx < 0 ? 1 : -1));
        }}
      >
        <button type="button" onClick={() => setAmpliada(true)} className="absolute inset-0 cursor-zoom-in" aria-label={`Ampliar: ${atual.alt}`}>
          <Image
            key={atual.url}
            src={atual.url}
            alt={atual.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover animate-[aparecer_.3s_ease-out]"
          />
        </button>

        {fotos.length > 1 && (
          <>
            <button type="button" onClick={() => ir(selected - 1)} aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 text-tinta shadow-marca flex items-center justify-center text-xl sm:opacity-0 group-hover:opacity-100 transition-opacity">
              ‹
            </button>
            <button type="button" onClick={() => ir(selected + 1)} aria-label="Próxima foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 text-tinta shadow-marca flex items-center justify-center text-xl sm:opacity-0 group-hover:opacity-100 transition-opacity">
              ›
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/55 text-white text-xs px-2.5 py-1 tabular-nums pointer-events-none">
              {selected + 1} / {fotos.length}
            </span>
          </>
        )}
      </div>

      {fotos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {fotos.map((img, i) => (
            <li key={`${img.url}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === selected}
                className={`relative block w-24 sm:w-28 aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                  i === selected ? "border-marca" : "border-transparent opacity-65 hover:opacity-100"
                }`}
              >
                <Image src={img.url} alt="" fill sizes="112px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ampliada && (
        <Lightbox fotos={fotos} indice={selected} titulo={titulo} aoMudar={setSelected} aoFechar={() => setAmpliada(false)} />
      )}
    </div>
  );
}
