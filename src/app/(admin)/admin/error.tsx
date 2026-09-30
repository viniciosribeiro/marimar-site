"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Pagina, botao } from "@/components/admin/ui";

/**
 * Erro inesperado numa tela do painel.
 *
 * Diz o que fazer em vez de mostrar código: tentar de novo resolve a maior
 * parte (banco acordando, conexão que caiu). O detalhe técnico vai para o
 * console, e o código do erro aparece pequeno para quem for investigar.
 */
export default function ErroPainel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[painel]", error); }, [error]);
  return (
    <Pagina>
      <div className="mx-auto max-w-md rounded-2xl border border-linha/80 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-2xl" aria-hidden>⚠️</div>
        <h1 className="mt-4 text-lg font-semibold text-tinta">Esta tela não abriu</h1>
        <p className="mt-2 text-sm leading-relaxed text-tinta-suave">
          Pode ser uma instabilidade passageira na conexão com o banco de dados. Tente de novo — se continuar, veja Sistema → Diagnóstico.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={reset} className={botao("primario")}><RefreshCw className="h-4 w-4" /> Tentar de novo</button>
          <Link href="/admin" className={botao("secundario")}>Voltar ao início</Link>
        </div>
        {error.digest && <p className="mt-5 font-mono text-[11px] text-tinta-suave/70">código {error.digest}</p>}
      </div>
    </Pagina>
  );
}
