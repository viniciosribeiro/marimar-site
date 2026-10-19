"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, ExternalLink } from "lucide-react";
import { AREAS, TAREFAS, tirarAcento } from "./areas";
import { cn } from "./ui";

type Acao = { rotulo: string; href: string; onde: string; chaves: string; externo?: boolean };

/**
 * "O que você quer fazer?" (Ctrl+K / ⌘K). Procura nas telas e em tarefas
 * escritas do jeito que a pousada fala ("trocar a foto do topo", "horário do
 * café"), sem acento e por palavras soltas. Fase 1 do estudo do painel.
 */
export function PaletaTarefas({ aberta, aoFechar, tecnico }: { aberta: boolean; aoFechar: () => void; tecnico: boolean }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [cursor, setCursor] = useState(0);
  const campoRef = useRef<HTMLInputElement>(null);

  const todas = useMemo<Acao[]>(() => {
    const telas = AREAS.flatMap((a) => a.itens
      .filter((i) => tecnico || !i.tecnico)
      .filter((i) => !(a.id === "hoje" && i.href !== "/admin"))
      .map((i) => ({ rotulo: i.rotulo, href: i.href, onde: a.nome, chaves: `${a.nome} ${i.chaves ?? ""}` })));
    const tarefas = TAREFAS.filter((t) => tecnico || !t.tecnico)
      .map((t) => ({ rotulo: t.rotulo, href: t.href, onde: t.externo ? "Site" : "Tarefa", chaves: t.chaves, externo: t.externo }));
    return [...tarefas, ...telas];
  }, [tecnico]);

  const achadas = useMemo(() => {
    const termos = tirarAcento(busca).split(/\s+/).filter((t) => t.length > 1);
    if (!termos.length) return todas.slice(0, 9);
    return todas
      .map((a) => {
        const alvo = tirarAcento(`${a.rotulo} ${a.chaves}`);
        const nome = tirarAcento(a.rotulo);
        if (!termos.every((t) => alvo.includes(t))) return null;
        const nota = termos.reduce((n, t) => n + (nome.includes(t) ? 2 : 1), 0);
        return { a, nota };
      })
      .filter((x): x is { a: Acao; nota: number } => !!x)
      .sort((x, y) => y.nota - x.nota)
      .slice(0, 12)
      .map((x) => x.a);
  }, [busca, todas]);

  useEffect(() => {
    if (!aberta) return;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => campoRef.current?.focus(), 30);
    return () => { document.body.style.overflow = ""; clearTimeout(t); };
  }, [aberta]);

  if (!aberta) return null;

  const fechar = () => { setBusca(""); setCursor(0); aoFechar(); };
  const ir = (a: Acao | undefined) => {
    if (!a) return;
    fechar();
    if (a.externo) window.open(a.href, "_blank", "noopener");
    else if (a.href.startsWith("/api/")) window.location.href = a.href;
    else router.push(a.href);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-tinta/25 px-3 pt-[max(9vh,env(safe-area-inset-top))] backdrop-blur-[3px]"
      role="dialog" aria-modal="true" aria-label="O que você quer fazer?" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="vidro-forte w-full max-w-xl overflow-hidden rounded-[2rem] animate-[mola_.28s_ease-out]">
        <div className="flex items-center gap-3 border-b border-white/70 px-5">
          <Search className="h-5 w-5 shrink-0 text-tinta-suave" />
          <input ref={campoRef} value={busca} placeholder="O que você quer fazer? Ex.: trocar a foto do topo"
            aria-label="O que você quer fazer?"
            onChange={(e) => { setBusca(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") fechar();
              else if (e.key === "Enter") ir(achadas[cursor]);
              else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(achadas.length - 1, c + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
            }}
            className="min-h-14 w-full bg-transparent text-base text-tinta outline-none placeholder:text-tinta-suave/70" />
          <kbd className="hidden sm:inline rounded-md border border-white/80 bg-white/60 px-1.5 text-[10px] text-tinta-suave">Esc</kbd>
        </div>
        <ul className="max-h-[56vh] overflow-y-auto p-2" role="listbox">
          {achadas.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-tinta-suave">
              Nada encontrado. Tente outra palavra, como “foto”, “preço” ou “Marina”.
            </li>
          ) : achadas.map((a, i) => (
            <li key={`${a.href}-${a.rotulo}`}>
              <button type="button" role="option" aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)} onClick={() => ir(a)}
                className={cn("flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm transition-colors",
                  i === cursor ? "vidro-bolha text-tinta" : "text-tinta hover:bg-white/50")}>
                <span className="min-w-0 flex-1 truncate font-medium">{a.rotulo}</span>
                <span className="shrink-0 text-xs text-tinta-suave">{a.onde}</span>
                {a.externo ? <ExternalLink className="h-4 w-4 shrink-0 text-tinta-suave" />
                  : i === cursor && <CornerDownLeft className="h-4 w-4 shrink-0 text-tinta-suave" />}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-white/70 px-5 py-2.5 text-[11px] text-tinta-suave">
          Escreva do seu jeito: “foto”, “preço”, “café”, “criança”, “WhatsApp”… · Enter abre · Esc fecha
        </p>
      </div>
    </div>
  );
}
