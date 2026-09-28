"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";

export type FotoLightbox = { url: string; alt: string };

/**
 * Foto em tela cheia — usado pela galeria e pelas páginas das suítes.
 *
 * O que ele precisa fazer bem, porque a maior parte das visitas é no
 * celular: deslizar para os lados troca a foto, deslizar para baixo fecha,
 * as setas do teclado e o Esc funcionam no computador, e a página por trás
 * não rola enquanto ele está aberto (no iPhone, rolar o fundo com o dedo
 * sobre a foto era o que fazia a galeria "pular").
 */
export function Lightbox({
  fotos, indice, aoMudar, aoFechar, titulo,
}: {
  fotos: FotoLightbox[];
  indice: number;
  aoMudar: (i: number) => void;
  aoFechar: () => void;
  /** Nome do grupo (a suíte, "Restaurante"…), acima do contador. */
  titulo?: string;
}) {
  const toque = useRef<{ x: number; y: number } | null>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const total = fotos.length;

  const ir = useCallback((i: number) => aoMudar((i + total) % total), [aoMudar, total]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") ir(indice + 1);
      if (e.key === "ArrowLeft") ir(indice - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [indice, ir, aoFechar]);

  const foto = fotos[indice];
  if (!foto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo ? `Fotos: ${titulo}` : "Foto ampliada"}
      className="fixed inset-0 z-[90] bg-black/95 flex flex-col select-none"
      onTouchStart={(e) => { toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        if (!toque.current) return;
        const dx = e.changedTouches[0].clientX - toque.current.x;
        const dy = e.changedTouches[0].clientY - toque.current.y;
        toque.current = null;
        if (dy > 90 && Math.abs(dy) > Math.abs(dx)) aoFechar();
        else if (Math.abs(dx) > 45 && total > 1) ir(indice + (dx < 0 ? 1 : -1));
      }}
    >
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white shrink-0">
        <div className="min-w-0">
          {titulo && <p className="font-titulo text-base sm:text-lg font-semibold truncate">{titulo}</p>}
          {total > 1 && <p className="text-xs text-white/60 tabular-nums">{indice + 1} de {total}</p>}
        </div>
        <button
          ref={fecharRef}
          onClick={aoFechar}
          aria-label="Fechar"
          className="shrink-0 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-2xl leading-none"
        >
          ×
        </button>
      </header>

      <div className="relative flex-1 min-h-0" onClick={aoFechar}>
        <Image
          key={foto.url}
          src={foto.url}
          alt={foto.alt}
          fill
          sizes="100vw"
          className="object-contain animate-[aparecer_.25s_ease-out]"
          onClick={(e) => e.stopPropagation()}
          priority
        />

        {total > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); ir(indice - 1); }}
              aria-label="Foto anterior"
              className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white items-center justify-center text-2xl"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); ir(indice + 1); }}
              aria-label="Próxima foto"
              className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white items-center justify-center text-2xl"
            >
              ›
            </button>
          </>
        )}
      </div>

      <footer className="px-4 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
        {foto.alt && <p className="text-center text-sm text-white/80 max-w-2xl mx-auto">{foto.alt}</p>}
        {total > 1 && (
          <p className="sm:hidden text-center text-[11px] text-white/40 mt-2">Deslize para os lados · para baixo fecha</p>
        )}
      </footer>
    </div>
  );
}
