"use client";

import { useState } from "react";
import { cn } from "./ui";

/**
 * "✨ Melhorar texto": pede à própria Marina uma versão mais clara do que
 * está no campo, sem inventar fato nem mudar o sentido (/api/admin/marina/
 * melhorar). Troca o texto na hora e deixa "desfazer" — nada é salvo até a
 * pessoa salvar o formulário.
 */
export function BotaoMelhorar({ valor, aoMelhorar, contexto, className }: {
  valor: string;
  aoMelhorar: (t: string) => void;
  contexto?: string;
  className?: string;
}) {
  const [carregando, setCarregando] = useState(false);
  const [anterior, setAnterior] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function melhorar() {
    if (!valor.trim() || carregando) return;
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/admin/marina/melhorar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: valor, contexto }),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d?.erro ?? "Não consegui melhorar agora."); return; }
      setAnterior(valor);
      aoMelhorar(typeof d.texto === "string" ? d.texto : valor);
    } catch {
      setErro("Falha ao melhorar o texto.");
    } finally {
      setCarregando(false);
    }
  }

  function desfazer() {
    if (anterior != null) { aoMelhorar(anterior); setAnterior(null); }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button type="button" onClick={melhorar} disabled={carregando || !valor.trim()}
        className="inline-flex items-center gap-1 rounded-full border border-marca/40 bg-marca-sutil px-2.5 py-1 text-xs font-medium text-marca transition-colors hover:bg-marca-sutil/70 disabled:opacity-40">
        <span aria-hidden>✨</span> {carregando ? "Melhorando…" : "Melhorar texto"}
      </button>
      {anterior != null && (
        <button type="button" onClick={desfazer} className="text-xs text-tinta-suave underline underline-offset-2">
          desfazer
        </button>
      )}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
