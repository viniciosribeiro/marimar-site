"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Evento da barra "Reservar" do celular (quartos/BarraReserva): `detail` = está na tela. */
export const EVENTO_BARRA_RESERVA = "sn:barra-reserva";

/** Larguras em que a barra "Reservar" existe (abaixo do `lg` do Tailwind). */
export const CELULAR_OU_TABLET = "(max-width: 1023.98px)";

/**
 * Esconde o botão flutuante ("Falar com a Marina") enquanto um formulário
 * marcado com `data-sem-flutuante` está na tela — no Clássico, os botões
 * flutuantes cobriam o campo da busca no celular (análise de 04/11/2026) — e
 * enquanto a barra "Reservar" da página da suíte está à mostra (os dois
 * empilhados cobriam o título no celular). `data-sem-flutuante="celular"`
 * só vale abaixo do `lg` (no computador o quadro de preço fica fixo ao lado).
 */
export function useSemFlutuante(ativo = true): boolean {
  const pathname = usePathname();
  const [esconder, setEsconder] = useState(false);
  const [barra, setBarra] = useState(false);
  /* Página nova: começa visível até o observador dizer o contrário. */
  const [caminho, setCaminho] = useState(pathname);
  if (caminho !== pathname) { setCaminho(pathname); setEsconder(false); setBarra(false); }

  useEffect(() => {
    if (!ativo) return;
    const ouvir = (e: Event) => setBarra(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(EVENTO_BARRA_RESERVA, ouvir);
    return () => window.removeEventListener(EVENTO_BARRA_RESERVA, ouvir);
  }, [ativo]);

  useEffect(() => {
    if (!ativo || typeof IntersectionObserver === "undefined") return;
    const alvos = Array.from(document.querySelectorAll("[data-sem-flutuante]"));
    if (!alvos.length) return;
    const naTela = new Set<Element>();
    const celular = window.matchMedia(CELULAR_OU_TABLET);
    const conta = (el: Element) => el.getAttribute("data-sem-flutuante") !== "celular" || celular.matches;
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) { if (e.isIntersecting) naTela.add(e.target); else naTela.delete(e.target); }
      setEsconder([...naTela].some(conta));
    }, { rootMargin: "0px 0px -8% 0px" });
    alvos.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, [ativo, pathname]);

  return ativo && (esconder || barra);
}
