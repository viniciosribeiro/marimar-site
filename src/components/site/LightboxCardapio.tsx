"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

/**
 * Visualizador de fotos de um item do cardapio.
 *
 * Responsivo de verdade: no celular fecha com arrastar para baixo e troca
 * de foto com deslize lateral; no computador responde a setas e Esc.
 * Trava o scroll do fundo enquanto aberto — sem isso, o toque para deslizar
 * rolava a pagina atras do visualizador.
 */
export type FotoItem = { url: string; alt: string | null };

export function LightboxCardapio({
  fotos, nome, aberto, indiceInicial, aoFechar,
}: {
  fotos: FotoItem[]; nome: string; aberto: boolean;
  indiceInicial: number; aoFechar: () => void;
}) {
  const [i, setI] = useState(indiceInicial);
  const toqueX = useRef<number | null>(null);
  const toqueY = useRef<number | null>(null);

  useEffect(() => { setI(indiceInicial); }, [indiceInicial, aberto]);

  const proxima = useCallback(() => setI((v) => (v + 1) % fotos.length), [fotos.length]);
  const anterior = useCallback(() => setI((v) => (v - 1 + fotos.length) % fotos.length), [fotos.length]);

  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") proxima();
      if (e.key === "ArrowLeft") anterior();
    };
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto, aoFechar, proxima, anterior]);

  if (!aberto || fotos.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${nome}`}
      className="fixed inset-0 z-[80] bg-black/92 flex flex-col"
      onClick={aoFechar}
      onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; toqueY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => {
        if (toqueX.current === null || toqueY.current === null) return;
        const dx = e.changedTouches[0].clientX - toqueX.current;
        const dy = e.changedTouches[0].clientY - toqueY.current;
        if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) aoFechar();
        else if (Math.abs(dx) > 50) (dx < 0 ? proxima() : anterior());
        toqueX.current = null; toqueY.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <div className="min-w-0">
          <p className="font-semibold truncate">{nome}</p>
          {fotos.length > 1 && (
            <p className="text-xs text-white/60">{i + 1} de {fotos.length}</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); aoFechar(); }}
          aria-label="Fechar"
          className="p-2 -mr-2 text-white/80 hover:text-white text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 relative min-h-0" onClick={(e) => e.stopPropagation()}>
        <Image
          key={fotos[i].url}
          src={fotos[i].url}
          alt={fotos[i].alt || nome}
          fill
          sizes="100vw"
          className="object-contain"
          priority
        />

        {fotos.length > 1 && (
          <>
            <Seta lado="esq" onClick={anterior} />
            <Seta lado="dir" onClick={proxima} />
          </>
        )}
      </div>

      {fotos[i].alt && (
        <p className="text-center text-sm text-white/70 px-6 py-3 shrink-0">{fotos[i].alt}</p>
      )}

      {fotos.length > 1 && (
        <div className="flex gap-2 justify-center px-4 py-4 overflow-x-auto shrink-0" onClick={(e) => e.stopPropagation()}>
          {fotos.map((f, idx) => (
            <button
              key={f.url}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Foto ${idx + 1}`}
              aria-current={idx === i}
              className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 transition-opacity ${
                idx === i ? "ring-2 ring-white" : "opacity-50 hover:opacity-80"
              }`}
            >
              <Image src={f.url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <p className="sm:hidden text-center text-[11px] text-white/40 pb-3 shrink-0">
        deslize para trocar · arraste para baixo para fechar
      </p>
    </div>
  );
}

function Seta({ lado, onClick }: { lado: "esq" | "dir"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "esq" ? "Foto anterior" : "Próxima foto"}
      className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${lado === "esq" ? "left-4" : "right-4"}
        w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl backdrop-blur`}
    >
      {lado === "esq" ? "‹" : "›"}
    </button>
  );
}
