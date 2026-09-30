"use client";

import { RotateCcw } from "lucide-react";
import type { ItemTreino } from "@/lib/marina";
import { TIPOS, rotuloCategoria, type Tipo } from "@/lib/marina-base";
import { botao, Selo, Vazio, quandoFoi, cn } from "@/components/admin/ui";
import { Gaveta, useAcao, useConfirmar } from "@/components/admin/ui-cliente";
import { voltarVersao } from "./actions";
import type { EntradaHistorico } from "./tipos";

export const ACOES: Record<string, { rotulo: string; tom: "marca" | "sucesso" | "aviso" | "erro" | "neutro" | "info" }> = {
  criou: { rotulo: "Criou", tom: "sucesso" },
  editou: { rotulo: "Editou", tom: "marca" },
  ligou: { rotulo: "Ligou", tom: "sucesso" },
  desligou: { rotulo: "Desligou", tom: "neutro" },
  excluiu: { rotulo: "Mandou para a lixeira", tom: "erro" },
  restaurou: { rotulo: "Restaurou", tom: "sucesso" },
  "voltou-versao": { rotulo: "Voltou a uma versão", tom: "info" },
  testou: { rotulo: "Testou", tom: "aviso" },
};

/** O que mudou entre duas versões, em palavras. */
export function resumoMudanca(h: EntradaHistorico): string[] {
  const a = h.antes ?? {};
  const d = h.depois ?? {};
  if (h.acao === "testou") return [d.verificacao === "ok" ? "Passou no teste." : "Não passou no teste."];
  const saida: string[] = [];
  if (a.titulo !== d.titulo && d.titulo) saida.push(a.titulo ? `Assunto: “${a.titulo}” → “${d.titulo}”` : `Assunto: “${d.titulo}”`);
  if (a.conteudo !== d.conteudo && d.conteudo) saida.push(`Texto: ${String(d.conteudo).slice(0, 140)}${String(d.conteudo).length > 140 ? "…" : ""}`);
  if (a.categoria !== d.categoria && d.categoria && a.categoria) saida.push(`Assunto movido: ${rotuloCategoria(String(a.categoria))} → ${rotuloCategoria(String(d.categoria))}`);
  if (a.tipo !== d.tipo && d.tipo && a.tipo) saida.push(`Tipo: ${TIPOS[a.tipo as Tipo]?.rotulo} → ${TIPOS[d.tipo as Tipo]?.rotulo}`);
  if (JSON.stringify(a.variacoes ?? []) !== JSON.stringify(d.variacoes ?? []) && Array.isArray(d.variacoes) && h.acao !== "criou") saida.push(`Variações: ${(d.variacoes as string[]).length}`);
  return saida;
}

export function HistoricoItem({ item, id, historico, aoFechar }: {
  item?: ItemTreino; id: string; historico: EntradaHistorico[]; aoFechar: () => void;
}) {
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();

  return (
    <Gaveta titulo="Histórico" descricao={item ? item.titulo : "Item apagado de vez — dá para recriar a partir de uma versão."} aoFechar={aoFechar}>
      {historico.length === 0 ? (
        <Vazio icone="🕓" titulo="Sem histórico">As mudanças feitas a partir de agora ficam registradas aqui.</Vazio>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-linha pl-5">
          {historico.map((h, n) => {
            const acao = ACOES[h.acao] ?? { rotulo: h.acao, tom: "neutro" as const };
            const restauravel = h.depois && h.acao !== "testou" && n > 0;
            return (
              <li key={h.id} className="relative">
                <span className={cn("absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-fundo-suave", n === 0 ? "bg-marca" : "bg-linha")} aria-hidden />
                <div className="rounded-2xl border border-linha/80 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo tom={acao.tom}>{acao.rotulo}</Selo>
                    <span className="text-[11px] text-tinta-suave">{quandoFoi(h.criado_em)}{h.autor ? ` · ${h.autor}` : ""}</span>
                    {n === 0 && <span className="ml-auto text-[11px] font-semibold text-marca">versão atual</span>}
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-tinta-suave">
                    {resumoMudanca(h).map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                  {restauravel && (
                    <button disabled={pendente} className={botao("secundario", "sm", "mt-3")}
                      onClick={async () => {
                        if (await confirmar({ titulo: "Voltar para esta versão?", texto: "O item fica como estava neste momento. A versão atual continua no histórico, então dá para desfazer.", confirmar: "Voltar para esta versão", perigo: false })) {
                          const f = new FormData(); f.set("historico_id", h.id);
                          const r = await executar(voltarVersao, f);
                          if (r.ok) aoFechar();
                        }
                      }}>
                      <RotateCcw className="h-3.5 w-3.5" /> Voltar para esta versão
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <span className="hidden">{id}</span>
      {dialogo}
    </Gaveta>
  );
}
