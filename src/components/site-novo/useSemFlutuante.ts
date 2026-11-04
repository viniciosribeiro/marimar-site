"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Esconde o botão flutuante ("Falar com a Marina") enquanto um formulário
 * marcado com `data-sem-flutuante` está na tela — no Clássico, os botões
 * flutuantes cobriam o campo da busca no celular (análise de 04/11/2026).
 */
export function useSemFlutuante(ativo = true): boolean {
  const pathname = usePathname();
  const [esconder, setEsconder] = useState(false);
  /* Página nova: começa visível até o observador dizer o contrário. */
  const [caminho, setCaminho] = useState(pathname);
  if (caminho !== pathname) { setCaminho(pathname); setEsconder(false); }

  useEffect(() => {
    if (!ativo || typeof IntersectionObserver === "undefined") return;
    const alvos = Array.from(document.querySelectorAll("[data-sem-flutuante]"));
    if (!alvos.length) return;
    const naTela = new Set<Element>();
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) { if (e.isIntersecting) naTela.add(e.target); else naTela.delete(e.target); }
      setEsconder(naTela.size > 0);
    }, { rootMargin: "0px 0px -8% 0px" });
    alvos.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, [ativo, pathname]);

  return ativo && esconder;
}
