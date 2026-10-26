"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { LoaderCircle, Search } from "lucide-react";

/**
 * Mantem o GET nativo usado no site: nao modifica datas, adultos, criancas,
 * bebes, regras ou chamadas ao motor. O indicador aparece antes da navegacao.
 */
export function FormularioBuscaDisponibilidade({
  children, action, className, variante,
}: {
  children: ReactNode;
  action?: string;
  className: string;
  variante: "home" | "reservar";
}) {
  const [consultando, setConsultando] = useState(false);

  // O navegador pode preservar a tela antiga no voltar (BFCache).
  useEffect(() => {
    const aoVoltar = () => setConsultando(false);
    window.addEventListener("pageshow", aoVoltar);
    return () => window.removeEventListener("pageshow", aoVoltar);
  }, []);

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    // SeletorDatas bloqueia envios sem check-in/check-out e abre o calendario.
    if (evento.defaultPrevented) return;
    const formulario = evento.currentTarget;
    const entrada = (formulario.elements.namedItem("check_in") as HTMLInputElement | null)?.value;
    const saida = (formulario.elements.namedItem("check_out") as HTMLInputElement | null)?.value;
    if (!entrada || !saida) return;

    // Forcar navegacao de documento GET: elimina falhas intermitentes na
    // transicao client-side/RSC que deixavam "This page couldn't load".
    // Mantem todos os parametros identicos ao formulario original.
    evento.preventDefault();
    const url = new URL(action || "/reservar", window.location.origin);
    const parametros = new URLSearchParams();
    new FormData(formulario).forEach((valor, chave) => {
      if (typeof valor === "string") parametros.append(chave, valor);
    });
    url.search = parametros.toString();
    flushSync(() => setConsultando(true));
    window.location.assign(url.toString());
  }

  const home = variante === "home";

  return (
    <>
      <form method="get" action={action} className={className} onSubmit={aoEnviar} aria-busy={consultando}>
        {children}
        <input type="hidden" name="ver_resultados" value="1" />
        <button type="submit" disabled={consultando}
          className={home
            ? "col-span-2 sm:col-span-1 flex items-center justify-center gap-2 bg-marca hover:bg-marca-hover text-marca-texto px-4 py-2.5 rounded-lg font-semibold transition-marca text-sm self-end disabled:opacity-80"
            : "col-span-2 sm:col-span-1 self-end h-12 rounded-full bg-marca text-marca-texto hover:bg-marca-hover font-semibold shadow-marca transition-marca flex items-center justify-center gap-2 disabled:opacity-80"}>
          {consultando ? <LoaderCircle aria-hidden="true" size={18} className="motion-safe:animate-spin" /> : home ? <Search aria-hidden="true" size={17} /> : null}
          {consultando ? "Consultando..." : home ? "Ver disponibilidade" : "Buscar"}
        </button>
      </form>

      {consultando && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0d2637]/45 px-5 backdrop-blur-[3px]"
          role="status" aria-live="polite" aria-label="Consultando disponibilidade de quartos">
          <div className="flex w-full max-w-sm flex-col items-center rounded-[1.5rem] bg-white px-7 py-9 text-center shadow-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-marca-sutil text-marca">
              <LoaderCircle aria-hidden="true" size={35} className="motion-safe:animate-spin" />
            </div>
            <p className="mt-5 font-titulo text-xl font-bold text-tinta">Buscando suas suítes</p>
            <p className="mt-2 text-sm leading-relaxed text-tinta-suave">
              Estamos conferindo os quartos e valores disponíveis para suas datas.
            </p>
            <p className="mt-3 text-xs text-tinta-suave">A consulta pode levar alguns instantes.</p>
          </div>
        </div>
      )}
    </>
  );
}
