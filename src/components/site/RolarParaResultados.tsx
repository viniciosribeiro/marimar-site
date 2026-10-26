"use client";

import { useEffect } from "react";

/** Quando o servidor termina a busca e entrega os cards, traz os resultados
 * para a area visivel, respeitando preferencias de acessibilidade. */
export function RolarParaResultados({ ativo }: { ativo: boolean }) {
  useEffect(() => {
    if (!ativo) return;
    let quadro2 = 0;
    const quadro1 = requestAnimationFrame(() => {
      quadro2 = requestAnimationFrame(() => {
        const secao = document.getElementById("resultados-disponibilidade");
        if (!secao) return;
        const semAnimacao =
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          document.documentElement.dataset.mov === "off";
        secao.scrollIntoView({ behavior: semAnimacao ? "instant" : "smooth", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(quadro1);
      cancelAnimationFrame(quadro2);
    };
  }, [ativo]);
  return null;
}
