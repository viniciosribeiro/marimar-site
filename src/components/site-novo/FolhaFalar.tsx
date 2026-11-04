"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icone } from "@/components/site/Icone";
import { useSemFlutuante } from "./useSemFlutuante";

/** O chat da Marina (site/ChatMarina, estilo "novo") avisa quando abre ou fecha e quando chegou resposta da equipe. */
export const EVENTO_ESTADO_MARINA = "marimar:marina-estado";
export type EstadoMarina = { aberto: boolean; novidade: boolean };

const MENSAGEM_WHATSAPP = "Olá! Vim pelo site e gostaria de informações sobre a Pousada Marimar.";

/**
 * O botão único do site novo e a folha que ele abre: conversar com a Marina
 * aqui no site, chamar no WhatsApp ou ligar. Com o chat desligado no painel
 * (Integrações), a folha fica só com WhatsApp e telefone.
 *
 * Quando a equipe responde uma pergunta que a Marina encaminhou, o botão
 * vira "A Marina respondeu" e leva direto à conversa.
 */
export function FolhaFalar({ comChat, whatsappDigitos, whatsapp, telefone }: {
  comChat: boolean; whatsappDigitos: string; whatsapp: string; telefone: string | null;
}) {
  const [aberta, setAberta] = useState(false);
  const [chat, setChat] = useState<EstadoMarina>({ aberto: false, novidade: false });
  const esconder = useSemFlutuante();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const folhaRef = useRef<HTMLDivElement>(null);
  const idTitulo = useId();

  /* O chat fechou: o foco volta ao botão (quem navega pelo teclado não se perde). */
  const chatAberto = useRef(false);
  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<EstadoMarina>).detail;
      if (chatAberto.current && !d.aberto) {
        requestAnimationFrame(() => {
          const b = botaoRef.current;
          if (b && b.getAttribute("aria-hidden") !== "true") b.focus({ preventScroll: true });
        });
      }
      chatAberto.current = d.aberto;
      setChat(d);
    };
    window.addEventListener(EVENTO_ESTADO_MARINA, ouvir);
    return () => window.removeEventListener(EVENTO_ESTADO_MARINA, ouvir);
  }, []);

  const fechar = useCallback((devolverFoco = true) => {
    setAberta(false);
    if (devolverFoco) requestAnimationFrame(() => botaoRef.current?.focus());
  }, []);

  /* Aberta: foco na primeira opção, Esc fecha, Tab não sai da folha e, no
     celular, a página não rola por trás. */
  useEffect(() => {
    if (!aberta) return;
    const folha = folhaRef.current;
    folha?.querySelector<HTMLElement>("[data-opcao]")?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); fechar(); return; }
      if (e.key !== "Tab" || !folha) return;
      const itens = [...folha.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (!primeiro || !ultimo) return;
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    if (window.matchMedia("(max-width: 639.98px)").matches) document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", aoTeclar); document.body.style.overflow = anterior; };
  }, [aberta, fechar]);

  const conversar = () => {
    fechar(false);
    window.dispatchEvent(new Event("marimar:abrir-marina"));
  };

  const rotulo = !comChat ? "Falar com a pousada" : chat.novidade ? "A Marina respondeu" : "Falar com a Marina";
  const escondido = esconder || aberta || chat.aberto;
  const telDigitos = telefone?.replace(/\D/g, "") ?? "";

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        data-marina-flutuante=""
        aria-haspopup="dialog"
        aria-expanded={aberta}
        aria-hidden={escondido || undefined}
        tabIndex={escondido ? -1 : undefined}
        /* Resposta da equipe esperando: direto para a conversa. */
        onClick={() => (comChat && chat.novidade ? conversar() : setAberta(true))}
        className={`fixed z-40 flex h-12 items-center gap-2.5 rounded-full bg-sn-mar pl-2 pr-4 text-white shadow-[0_14px_30px_-12px_rgb(0_0_0/0.55)] ring-1 ring-white/15 transition-[opacity,transform,background-color] duration-200 hover:bg-sn-mar-2 motion-reduce:transition-none ${escondido ? "pointer-events-none translate-y-3 opacity-0" : ""}`}
        style={{ right: "max(1rem, env(safe-area-inset-right, 0px))", bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento text-acento-texto" aria-hidden>
          <Icone nome="coracao" tamanho={16} />
        </span>
        <span className="text-[0.95rem] font-semibold">{rotulo}</span>
        {comChat && chat.novidade && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-white" aria-hidden />}
      </button>

      {aberta && (
        <div className="fixed inset-0 z-[65]">
          <div className="sn-folha-fundo absolute inset-0 bg-[rgb(9_24_36/0.45)] sm:bg-transparent" onClick={() => fechar()} aria-hidden />
          <div
            ref={folhaRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            className="sn-folha absolute inset-x-0 bottom-0 rounded-t-[22px] bg-sn-espuma text-sn-texto shadow-[0_-18px_40px_-20px_rgb(0_0_0/0.45)] sm:left-auto sm:right-[max(1rem,env(safe-area-inset-right,0px))] sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))] sm:w-[23rem] sm:rounded-[20px] sm:ring-1 sm:ring-sn-linha sm:shadow-[0_24px_50px_-18px_rgb(0_0_0/0.45)]"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-sn-linha sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-4 pl-5 pr-3 pt-2 sm:pt-4">
              <h2 id={idTitulo} className="sn-h3">Falar com a pousada</h2>
              <button type="button" onClick={() => fechar()} aria-label="Fechar"
                className="flex h-11 w-11 items-center justify-center rounded-full text-sn-texto-2 hover:bg-sn-areia hover:text-sn-texto">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="px-2 pb-1 pt-1">
              {comChat && (
                <li>
                  <button type="button" data-opcao onClick={conversar} className="sn-opcao">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acento text-acento-texto" aria-hidden>
                      <Icone nome="coracao" tamanho={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">Conversar com a Marina</span>
                      <span className="mt-0.5 block text-[0.92rem] leading-snug text-sn-texto-2">Aqui no site, na hora: datas, suítes, restaurante e como chegar</span>
                    </span>
                  </button>
                </li>
              )}
              <li>
                <a href={`https://wa.me/${whatsappDigitos}?text=${encodeURIComponent(MENSAGEM_WHATSAPP)}`} target="_blank" rel="noopener noreferrer"
                  data-opcao onClick={() => fechar(false)} className="sn-opcao">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">WhatsApp</span>
                    <span className="mt-0.5 block text-[0.92rem] leading-snug text-sn-texto-2">{whatsapp}</span>
                  </span>
                </a>
              </li>
              {telDigitos && (
                <li>
                  <a href={`tel:${telDigitos}`} data-opcao className="sn-opcao">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sn-areia text-sn-texto" aria-hidden>
                      <Icone nome="telefone" tamanho={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">Ligar</span>
                      <span className="mt-0.5 block text-[0.92rem] leading-snug text-sn-texto-2">{telefone}</span>
                    </span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
