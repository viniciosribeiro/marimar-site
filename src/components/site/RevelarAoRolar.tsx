"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Seções aparecem suavemente ao rolar (Identidade visual → Movimento →
 * "Revelar ao rolar").
 *
 * Só marca o que está ABAIXO da tela no momento em que a página abre — o
 * que a pessoa já está vendo nunca some e volta (sem piscar). Sem
 * JavaScript, ou com "reduzir movimento", nada é escondido: o CSS só
 * esconde `.revelar-pendente` dentro do `@media (prefers-reduced-motion:
 * no-preference)` e com `html[data-mov-revelar="on"]`.
 */
const ALVOS = "main section, main [data-revelar]";

export function RevelarAoRolar() {
  const caminho = usePathname();
  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.movRevelar !== "on" || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const alvos = [...document.querySelectorAll<HTMLElement>(ALVOS)].filter((el) => !el.parentElement?.closest(ALVOS));
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.remove("revelar-pendente");
        e.target.classList.add("revelar-visto");
        obs.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    for (const el of alvos) {
      if (el.getBoundingClientRect().top < innerHeight * 0.92) continue;
      el.classList.add("revelar-pendente");
      obs.observe(el);
    }
    return () => {
      obs.disconnect();
      for (const el of alvos) el.classList.remove("revelar-pendente");
    };
  }, [caminho]);
  return null;
}
