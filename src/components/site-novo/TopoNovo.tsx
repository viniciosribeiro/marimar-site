"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACAO, grupoAtivo } from "@/lib/navegacao";

/**
 * O topo do site novo.
 *
 * Sobre a foto da página inicial ele é transparente, com a logo em branco;
 * depois do primeiro rolar (ou em página sem foto no topo) fica sólido, na
 * cor da espuma. A árvore de links é a mesma do Clássico (src/lib/navegacao.ts),
 * então menu, gaveta e rodapé nunca divergem.
 *
 * Altura fixa (--sn-topo, em novo.css): a foto da home sobe exatamente essa
 * medida para ficar por baixo, sem medir nada no navegador.
 */
export function TopoNovo({ nome, logoUrl, whatsappDigitos, telefone }: {
  nome: string; logoUrl: string | null; whatsappDigitos: string; telefone: string | null;
}) {
  const pathname = usePathname();
  const [imersivo, setImersivo] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [painel, setPainel] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState(false);
  const [sanfona, setSanfona] = useState<string | null>(null);
  const barraRef = useRef<HTMLDivElement | null>(null);
  const botaoMenuRef = useRef<HTMLButtonElement | null>(null);
  const gavetaRef = useRef<HTMLDivElement | null>(null);

  /* Ao trocar de página fecha tudo (ajuste de estado durante a renderização,
     o jeito que o React recomenda para "quando a prop muda")… */
  const [caminhoVisto, setCaminhoVisto] = useState(pathname);
  if (caminhoVisto !== pathname) {
    setCaminhoVisto(pathname);
    setPainel(null); setGaveta(false); setSanfona(null);
  }
  /* …e confere se a página nova começa com uma foto (topo transparente). */
  useEffect(() => {
    const id = requestAnimationFrame(() => setImersivo(!!document.querySelector("[data-topo-imersivo]")));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  /* Gaveta aberta: trava o fundo, foca o primeiro link e devolve o foco ao fechar. */
  useEffect(() => {
    if (!gaveta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const botao = botaoMenuRef.current;
    gavetaRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => { document.body.style.overflow = anterior; botao?.focus(); };
  }, [gaveta]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (gaveta) setGaveta(false); else setPainel(null);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [gaveta]);

  useEffect(() => {
    if (!painel) return;
    const fora = (e: MouseEvent) => { if (barraRef.current && !barraRef.current.contains(e.target as Node)) setPainel(null); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [painel]);

  const alternar = useCallback((rotulo: string) => setPainel((p) => (p === rotulo ? null : rotulo)), []);
  const solido = !imersivo || rolou || gaveta;

  return (
    <>
      <header data-solido={solido ? "true" : "false"}
        className="sn-topo sticky z-50 w-full"
        style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div ref={barraRef} className="mx-auto flex h-full max-w-[1240px] items-center gap-4 px-4 sm:px-6 lg:px-10"
          style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}>
          <Link href="/" aria-label={`${nome}, página inicial`} className="sn-topo-texto flex shrink-0 items-center">
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt={nome} width={160} height={44} className="sn-logo-img h-10 w-auto lg:h-11" />
              : <span className="font-titulo text-[1.6rem] italic">Marimar</span>}
          </Link>

          <nav aria-label="Principal" className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAVEGACAO.map((g) => {
                const ativo = grupoAtivo(pathname, g);
                if (!g.itens?.length) {
                  return (
                    <li key={g.rotulo}>
                      <Link href={g.href} aria-current={ativo ? "page" : undefined}
                        className={`sn-topo-texto inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.95rem] font-medium hover:underline hover:underline-offset-[6px] ${ativo ? "underline underline-offset-[6px]" : ""}`}>
                        {g.rotulo}
                      </Link>
                    </li>
                  );
                }
                const aberto = painel === g.rotulo;
                return (
                  <li key={g.rotulo} className="relative">
                    <button type="button" aria-expanded={aberto} aria-controls={`painel-${g.href.slice(1)}`}
                      onClick={() => alternar(g.rotulo)}
                      className={`sn-topo-texto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[0.95rem] font-medium hover:underline hover:underline-offset-[6px] ${ativo ? "underline underline-offset-[6px]" : ""}`}>
                      {g.rotulo}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden
                        className={`transition-transform ${aberto ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {aberto && (
                      <div id={`painel-${g.href.slice(1)}`}
                        className="absolute left-1/2 top-full mt-2 w-[22rem] -translate-x-1/2 rounded-2xl bg-white p-2 text-sn-texto shadow-[0_24px_50px_-20px_rgb(14_42_62/.45)] ring-1 ring-sn-linha">
                        <ul>
                          {g.itens.map((i) => (
                            <li key={i.href}>
                              <Link href={i.href} onClick={() => setPainel(null)}
                                className="block rounded-xl px-3.5 py-3 hover:bg-sn-espuma">
                                <span className="block font-medium">{i.rotulo}</span>
                                {i.descricao && <span className="mt-0.5 block text-[0.88rem] leading-snug text-sn-texto-2">{i.descricao}</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link href="/reservar"
            className={`ml-auto hidden min-h-11 items-center rounded-full px-5 text-[0.95rem] font-semibold sm:inline-flex lg:ml-2 ${solido ? "sn-botao" : "bg-white/15 text-white ring-1 ring-white/70 backdrop-blur-sm hover:bg-white/25"}`}>
            Ver datas e preços
          </Link>

          <button ref={botaoMenuRef} type="button" onClick={() => setGaveta(true)} aria-expanded={gaveta} aria-controls="sn-gaveta"
            className="sn-topo-texto ml-auto inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[0.95rem] font-medium sm:ml-2 lg:hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
            </svg>
            Menu
          </button>
        </div>
      </header>

      {gaveta && (
        <div id="sn-gaveta" ref={gavetaRef} role="dialog" aria-modal="true" aria-label="Menu"
          className="fixed inset-0 z-[80] flex flex-col overflow-y-auto overscroll-contain bg-sn-espuma text-sn-texto"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="flex h-16 shrink-0 items-center justify-between px-4"
            style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}>
            <span className="font-titulo text-[1.35rem]">{nome}</span>
            <button type="button" onClick={() => setGaveta(false)} aria-label="Fechar o menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-sn-linha">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <nav aria-label="Menu" className="flex-1 px-4" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}>
            <ul className="divide-y divide-sn-linha border-y border-sn-linha">
              {NAVEGACAO.map((g) => (
                <li key={g.rotulo}>
                  {g.itens?.length ? (
                    <>
                      <button type="button" aria-expanded={sanfona === g.rotulo} onClick={() => setSanfona((s) => (s === g.rotulo ? null : g.rotulo))}
                        className="flex w-full items-center justify-between py-4 text-left font-titulo text-[1.55rem]">
                        {g.rotulo}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden
                          className={`transition-transform ${sanfona === g.rotulo ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      {sanfona === g.rotulo && (
                        <ul className="pb-3">
                          {g.itens.map((i) => (
                            <li key={i.href}>
                              <Link href={i.href} onClick={() => setGaveta(false)} className="block rounded-xl px-1 py-2.5">
                                <span className="block font-medium">{i.rotulo}</span>
                                {i.descricao && <span className="block text-[0.9rem] leading-snug text-sn-texto-2">{i.descricao}</span>}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link href={g.href} onClick={() => setGaveta(false)} className="block py-4 font-titulo text-[1.55rem]">{g.rotulo}</Link>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2 text-[0.98rem]">
              {whatsappDigitos && (
                <a href={`https://wa.me/${whatsappDigitos}`} target="_blank" rel="noopener noreferrer" className="sn-link block py-1.5">Chamar no WhatsApp</a>
              )}
              {telefone && <a href={`tel:${telefone.replace(/\D/g, "")}`} className="sn-link block py-1.5">Ligar: {telefone}</a>}
            </div>
          </nav>
          <div className="sticky bottom-0 bg-sn-espuma px-4 py-4" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}>
            <Link href="/reservar" onClick={() => setGaveta(false)} className="sn-botao w-full">Ver datas e preços</Link>
          </div>
        </div>
      )}
    </>
  );
}
