"use client";

import { useState } from "react";

/** Copia um contato (número, e-mail) e confirma ali mesmo, sem abrir nada. */
export function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [estado, setEstado] = useState<"" | "ok" | "falhou">("");
  return (
    <button type="button" aria-label={`Copiar ${rotulo}`}
      onClick={() => {
        navigator.clipboard?.writeText(texto).then(() => setEstado("ok"), () => setEstado("falhou"));
        setTimeout(() => setEstado(""), 2500);
      }}
      className="inline-flex min-h-11 items-center rounded-full px-3 text-[0.9rem] font-medium text-sn-mare-texto ring-1 ring-sn-linha hover:ring-sn-texto-2">
      <span aria-live="polite">{estado === "ok" ? "Copiado" : estado === "falhou" ? "Não deu para copiar" : "Copiar"}</span>
    </button>
  );
}
