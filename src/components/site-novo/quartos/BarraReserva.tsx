"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CELULAR_OU_TABLET, EVENTO_BARRA_RESERVA } from "../useSemFlutuante";

export type AcaoBarra = { href: string; rotulo: string; externo?: boolean };

const naoMuda = () => () => {};

/**
 * Barra fixa do celular na página da suíte: o preço e um botão, sempre à
 * mão. Some enquanto o quadro de preço (#preco) está na tela — não repete o
 * que a pessoa já está vendo. Enquanto ela aparece, o botão "Falar com a
 * Marina" sai de cena (evento EVENTO_BARRA_RESERVA; os dois empilhados
 * cobriam o título). Desenhada dentro de `.sn` (portal), para nenhum
 * ancestral com transform prender o `fixed`.
 */
export function BarraReserva({ titulo, detalhe, acao }: { titulo: string; detalhe?: string | null; acao: AcaoBarra }) {
  const noNavegador = useSyncExternalStore(naoMuda, () => true, () => false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const alvo = document.getElementById("preco");
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisivel(!e.isIntersecting), { rootMargin: "0px 0px -12% 0px" });
    io.observe(alvo);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    /* No computador a barra não existe (lg:hidden): o botão da Marina fica. */
    window.dispatchEvent(new CustomEvent(EVENTO_BARRA_RESERVA, { detail: visivel && window.matchMedia(CELULAR_OU_TABLET).matches }));
  }, [visivel]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent(EVENTO_BARRA_RESERVA, { detail: false })); }, []);

  if (!noNavegador) return null;
  const destino = document.querySelector(".sn") ?? document.body;
  return createPortal(
    <div data-visivel={visivel ? "true" : "false"} aria-hidden={!visivel || undefined}
      className={`sn-barra-reserva fixed inset-x-0 bottom-0 z-30 border-t border-sn-linha bg-white/95 backdrop-blur-md lg:hidden ${visivel ? "translate-y-0" : "pointer-events-none translate-y-full"}`}
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}>
      <div className="flex items-center justify-between gap-3 pt-3">
        <div className="min-w-0">
          <p className="truncate font-semibold tabular-nums">{titulo}</p>
          {detalhe && <p className="truncate text-[0.85rem] tabular-nums text-sn-texto-2">{detalhe}</p>}
        </div>
        <a href={acao.href} tabIndex={visivel ? undefined : -1}
          {...(acao.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="sn-botao shrink-0 rounded-xl px-5">
          {acao.rotulo}
        </a>
      </div>
    </div>,
    destino,
  );
}
