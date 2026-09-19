"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BannerCamadas } from "./BannerCamadas";
import type { Banner } from "@/lib/banners";

/**
 * Carrossel do topo da home.
 *
 * Regras, e o porquê de cada uma:
 *
 * - **Um banner só não vira carrossel.** Sem bolinhas, sem temporizador.
 *   Controle para navegar entre um item só é ruído.
 * - **Para sozinho** com o mouse em cima, com o foco dentro ou com a aba em
 *   segundo plano. Trocar a imagem por baixo de quem está lendo é a forma
 *   mais rápida de irritar; girar numa aba escondida só gasta bateria.
 * - **Respeita `prefers-reduced-motion`** e o botão de animações do editor:
 *   com eles desligados não gira sozinho — as bolinhas continuam lá.
 * - **Só o primeiro slide tem `priority`**: ele é o LCP da home.
 */
export function CarrosselBanners({
  banners, children,
}: {
  banners: Banner[];
  /** A busca de disponibilidade, que fica por cima de qualquer banner. */
  children?: React.ReactNode;
}) {
  const [atual, setAtual] = useState(0);
  const [parado, setParado] = useState(false);
  const toqueX = useRef<number | null>(null);
  const total = banners.length;

  const ir = useCallback((i: number) => setAtual(((i % total) + total) % total), [total]);

  useEffect(() => {
    if (total < 2 || parado) return;
    const d = getComputedStyle(document.documentElement).getPropertyValue("--duracao");
    if (d && parseFloat(d) < 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t = setInterval(() => setAtual((a) => (a + 1) % total), 7000);
    return () => clearInterval(t);
  }, [total, parado]);

  useEffect(() => {
    const aoTrocarAba = () => setParado(document.hidden);
    document.addEventListener("visibilitychange", aoTrocarAba);
    return () => document.removeEventListener("visibilitychange", aoTrocarAba);
  }, []);

  if (total === 0) return null;

  return (
    <section
      className="relative isolate"
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
      onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toqueX.current === null || total < 2) return;
        const d = e.changedTouches[0].clientX - toqueX.current;
        if (Math.abs(d) > 50) ir(atual + (d < 0 ? 1 : -1));
        toqueX.current = null;
      }}
      aria-roledescription={total > 1 ? "carrossel" : undefined}
    >
      {/* Empilhados no mesmo espaço: o primeiro no fluxo define a altura, os
          outros ficam sobrepostos. Assim a troca não faz a página pular
          quando dois banners têm alturas diferentes. */}
      <div className="grid">
        {banners.map((b, i) => (
          <div
            key={b.id}
            className="col-start-1 row-start-1 transition-opacity duration-700"
            style={{ opacity: i === atual ? 1 : 0, pointerEvents: i === atual ? undefined : "none" }}
            aria-hidden={i !== atual}
          >
            <BannerCamadas b={b} ativo={i === atual} prioridade={i === 0}>
              {i === atual ? children : null}
            </BannerCamadas>
          </div>
        ))}
      </div>

      {total > 1 && (
        <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => ir(i)}
              aria-label={`Ver banner ${i + 1} de ${total}`}
              aria-current={i === atual}
              className="p-2 -m-1 group"
            >
              <span className={`block h-1.5 rounded-full transition-all ${
                i === atual ? "w-7 bg-white" : "w-3 bg-white/50 group-hover:bg-white/80"
              }`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
