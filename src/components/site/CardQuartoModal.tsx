"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Gallery } from "./Gallery";
import { brl, pluralizar } from "@/lib/format";

export type DadosDetalhesSuite = {
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  descricaoMotor?: string | null;
  fotos: { url: string; alt: string }[];
  comodidades: string[];
  cama?: string | null;
  metragem?: number | null;
  vista?: string | null;
  ocupacao: number;
  disponivel: boolean;
  diaria: number;
  total: number;
  noites: number;
  reservaUrl: string;
  whatsappUrl?: string | null;
  avisoEstadia?: number | null;
  motivoIndisponivel?: string | null;
};

/**
 * O cartao continua renderizado no servidor e o fluxo de reservar/WhatsApp
 * permanece intocado. Somente cliques de exploracao abrem a janela.
 * Os links de /quartos continuam como fallback se JavaScript nao carregar.
 */
export function CardQuartoModal({ dados, children }: { dados: DadosDetalhesSuite; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fecharRef.current?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      // Quando a galeria estiver ampliada, o Escape pertence ao Lightbox.
      if (document.querySelector('[role="dialog"][data-lightbox="true"]')) return;
      if (e.key === "Escape") setAberto(false);
      if (e.key !== "Tab") return;
      const elementos = painelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'
      );
      if (!elementos?.length) return;
      const primeiro = elementos[0], ultimo = elementos[elementos.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primeiro.focus();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      anterior?.focus?.();
    };
  }, [aberto]);

  function aoClicarCartao(e: MouseEvent<HTMLDivElement>) {
    const alvo = e.target;
    const link = alvo instanceof Element ? alvo.closest("a") : null;
    if (link) {
      // O botao Reservar e o WhatsApp abrem os mesmos destinos de antes.
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/quartos/")) return;
      e.preventDefault();
    }
    setAberto(true);
  }

  return (
    <>
      <div onClick={aoClicarCartao} className="[&_article]:cursor-pointer">{children}</div>
      {aberto && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-5"
          aria-label={`Detalhes de ${dados.nome}`}>
          <div className="absolute inset-0 bg-[#0b2335]/75 backdrop-blur-[3px]"
            onClick={() => setAberto(false)} aria-hidden="true" />
          <section ref={painelRef} role="dialog" aria-modal="true"
            aria-label={`Fotos e detalhes de ${dados.nome}`}
            className="relative z-10 h-full w-full overflow-y-auto overscroll-contain bg-white shadow-2xl sm:h-auto sm:max-h-[min(90dvh,900px)] sm:max-w-6xl sm:rounded-[1.5rem]">
            <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-linha bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
              <p className="min-w-0 truncate font-titulo text-base font-bold text-tinta sm:text-lg">{dados.nome}</p>
              <button ref={fecharRef} type="button" onClick={() => setAberto(false)}
                aria-label="Fechar detalhes da suíte"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-fundo-suave text-2xl text-tinta hover:bg-areia focus-visible:outline-2 focus-visible:outline-marca">
                ×
              </button>
            </div>
            <div className="grid gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8 lg:p-8">
              <div className="min-w-0">
                <Gallery images={dados.fotos} titulo={dados.nome} />
              </div>
              <div className="min-w-0 space-y-5">
                <div>
                  {dados.categoria && <p className="text-xs font-semibold uppercase tracking-wider text-marca">{dados.categoria}</p>}
                  <h2 className="mt-1 font-titulo text-2xl font-bold text-tinta sm:text-3xl">{dados.nome}</h2>
                  {dados.descricao && (
                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-tinta-suave sm:text-base">{dados.descricao}</p>
                  )}
                  {dados.descricaoMotor && dados.descricaoMotor.trim() !== dados.descricao?.trim() && (
                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-tinta-suave">{dados.descricaoMotor}</p>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Caracteristica nome="Capacidade" valor={`Até ${pluralizar(dados.ocupacao, "pessoa")}`} />
                  {dados.cama && <Caracteristica nome="Camas" valor={dados.cama} />}
                  {dados.metragem && <Caracteristica nome="Área" valor={`${dados.metragem} m²`} />}
                  {dados.vista && <Caracteristica nome="Vista" valor={dados.vista} />}
                </dl>
                {dados.comodidades.length > 0 && (
                  <section aria-label="Comodidades da suíte">
                    <h3 className="font-titulo text-base font-bold text-tinta">O que a suíte oferece</h3>
                    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {dados.comodidades.map((nome) => (
                        <li key={nome} className="flex items-start gap-2 text-sm text-tinta-suave">
                          <span className="mt-0.5 font-bold text-marca" aria-hidden="true">✓</span>{nome}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <div className="rounded-2xl border border-marca-borda bg-marca-sutil p-4 sm:p-5">
                  {dados.disponivel && dados.diaria > 0 ? (
                    <>
                      <p className="text-xs text-tinta-suave">Diária para as datas escolhidas</p>
                      <p className="mt-1 text-2xl font-extrabold text-marca-ativa">{brl(dados.diaria)}</p>
                      <p className="mt-1 text-sm text-tinta-suave">Total de {pluralizar(dados.noites, "noite")}: <strong className="text-tinta">{brl(dados.total)}</strong></p>
                      {dados.avisoEstadia ? (
                        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                          Exige mínimo de {pluralizar(dados.avisoEstadia, "noite")}.
                        </p>
                      ) : (
                        <a href={dados.reservaUrl} target="_blank" rel="noopener noreferrer"
                          className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-marca px-4 text-sm font-bold text-marca-texto hover:bg-marca-hover">
                          Reservar
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-tinta-suave">{dados.motivoIndisponivel || (dados.disponivel ? "Sem tarifa publicada para estas datas." : "Sem disponibilidade para as datas escolhidas.")}</p>
                  )}
                  {dados.whatsappUrl && (
                    <a href={dados.whatsappUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-green-600 px-3 text-sm font-semibold text-green-700 hover:bg-green-50">
                      Consultar pelo WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

function Caracteristica({ nome, valor }: { nome: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-fundo-suave p-3">
      <dt className="text-xs text-tinta-suave">{nome}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-tinta">{valor}</dd>
    </div>
  );
}
