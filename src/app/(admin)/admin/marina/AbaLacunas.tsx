"use client";

import { GraduationCap, X } from "lucide-react";
import { sugerirCategoria } from "@/lib/marina-base";
import { botao, Selo, Vazio, quandoFoi } from "@/components/admin/ui";
import { useAcao } from "@/components/admin/ui-cliente";
import { ignorarLacuna } from "./actions";
import type { Lacuna, Rascunho } from "./tipos";

/**
 * Perguntas que a Marina não soube responder.
 *
 * No site, a detecção é automática (a resposta passa pelo nosso servidor).
 * No WhatsApp, a Marina registra pela rota /api/agent/lacuna. Cada pergunta
 * vira treino com um clique — já com a pergunta preenchida e a categoria
 * sugerida.
 */
export function AbaLacunas({ lacunas, ensinar }: { lacunas: Lacuna[]; ensinar: (r?: Rascunho) => void }) {
  const { executar } = useAcao();

  if (!lacunas.length) {
    return (
      <Vazio icone="🎉" titulo="Nenhuma pergunta sem resposta">
        Quando a Marina disser que não sabe algo — no site ou no WhatsApp — a pergunta aparece aqui para você ensinar.
      </Vazio>
    );
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-sm text-tinta-suave">
        Dúvidas reais de hóspedes. Ensine a resposta e ela passa a responder — a pergunta sai da lista sozinha.
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {lacunas.map((l) => (
          <li key={l.id} className="flex flex-col rounded-2xl border border-linha/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Selo tom={l.canal === "whatsapp" ? "sucesso" : "info"}>{l.canal === "whatsapp" ? "WhatsApp" : "Site"}</Selo>
              <span className="text-[11px] text-tinta-suave">{quandoFoi(l.criado_em)}</span>
            </div>
            <p className="mt-2 font-semibold text-tinta">“{l.pergunta}”</p>
            {l.resposta && (
              <p className="mt-2 line-clamp-3 rounded-xl bg-areia/50 px-3 py-2 text-xs text-tinta-suave">
                <strong className="text-tinta">Ela disse:</strong> {l.resposta}
              </p>
            )}
            <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
              <button onClick={() => { const f = new FormData(); f.set("id", l.id); executar(ignorarLacuna, f); }}
                className={botao("fantasma", "sm")}><X className="h-3.5 w-3.5" /> Não é preciso</button>
              <button onClick={() => ensinar({ tipo: "pergunta", titulo: l.pergunta, lacuna_id: l.id, categoria: sugerirCategoria(l.pergunta) })}
                className={botao("primario", "sm")}><GraduationCap className="h-3.5 w-3.5" /> Ensinar a resposta</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
