"use client";

import Link from "next/link";
import { GraduationCap, Send, X } from "lucide-react";
import { sugerirCategoria } from "@/lib/marina-base";
import { Aviso, botao, cn, Selo, Vazio, quandoFoi } from "@/components/admin/ui";
import { useAcao } from "@/components/admin/ui-cliente";
import { avisarEquipeDaLacuna, ignorarLacuna } from "./actions";
import type { Lacuna, Rascunho } from "./tipos";

/**
 * Perguntas que a Marina não soube responder — e, ao lado de cada uma, o que
 * aconteceu com o aviso à equipe (30/09/2026: "Sem resposta" e os chamados
 * passaram a andar juntos).
 *
 * No site, a detecção é automática (a resposta passa pelo nosso servidor).
 * No WhatsApp, a Marina abre o chamado pela rota /api/agent/chamados. A
 * pergunta sai da lista quando alguém ensina a resposta aqui ou quando a
 * equipe responde o chamado.
 */
export function AbaLacunas({ lacunas, ensinar, escalonamentoAtivo }: {
  lacunas: Lacuna[]; ensinar: (r?: Rascunho) => void; escalonamentoAtivo: boolean;
}) {
  const { executar, pendente } = useAcao();
  const avisar = (id: string) => { const f = new FormData(); f.set("id", id); executar(avisarEquipeDaLacuna, f); };

  const desligado = !escalonamentoAtivo && (
    <Aviso tom="aviso" titulo="O aviso à equipe está desligado"
      acao={<Link href="/admin/equipe?aba=config" className={botao("secundario", "sm")}>Ligar</Link>}>
      Com ele ligado, cada pergunta que a Marina não sabe vai na hora para o WhatsApp de quem cuida do assunto, e a resposta volta para o cliente e vira aprendizado.
    </Aviso>
  );

  if (!lacunas.length) {
    return (
      <div className="space-y-4">
        {desligado}
        <Vazio icone="🎉" titulo="Nenhuma pergunta sem resposta">
          Quando a Marina disser que não sabe algo — no site ou no WhatsApp — a pergunta aparece aqui, junto com o aviso à equipe.
        </Vazio>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {desligado}
      <p className="px-1 text-sm text-tinta-suave">
        Dúvidas reais de hóspedes e o que aconteceu com o aviso à equipe. Quando a equipe responde pelo WhatsApp, a resposta vai ao cliente e a pergunta sai da lista.
        Você também pode ensinar a resposta direto aqui.
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {lacunas.map((l) => {
          const c = l.chamado;
          const aguardando = c?.status === "aguardando";
          const falhou = (c && c.ok === false) || (!c && !!l.aviso_erro);
          const tom = !c ? (l.aviso_erro ? "aviso" : "neutro") : falhou ? "erro" : aguardando ? "info" : "sucesso";
          return (
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

              {/* o aviso à equipe */}
              <div className={cn("mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed",
                tom === "erro" ? "border-red-200 bg-red-50 text-red-900"
                  : tom === "aviso" ? "border-amber-200 bg-amber-50 text-amber-950"
                  : tom === "sucesso" ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : tom === "info" ? "border-sky-200 bg-sky-50 text-sky-950" : "border-linha bg-areia/30 text-tinta-suave")}>
                {!c && !l.aviso_erro && <>Equipe ainda não avisada.</>}
                {!c && l.aviso_erro && <><strong>Equipe não avisada:</strong> {l.aviso_erro}</>}
                {c && c.ok === false && <><strong>Chamado #{c.codigo}: o aviso não chegou</strong>{c.quem ? ` a ${c.quem}` : ""}. {c.erro}</>}
                {c && c.ok !== false && aguardando && <><strong>📨 Equipe avisada</strong>{c.quem ? `: ${c.quem}` : ""} · #{c.codigo} · esperando a resposta{c.em ? ` (avisada ${quandoFoi(c.em)})` : ""}.</>}
                {c && c.ok !== false && !aguardando && <><strong>Chamado #{c.codigo}:</strong> {c.status === "entregue" ? "respondido e entregue ao cliente" : c.status === "respondido" ? "respondido, falta entregar" : c.status === "expirado" ? "a equipe não respondeu a tempo" : c.status}.</>}
                {!l.tem_sessao && l.canal === "site" && !c && <span className="mt-1 block opacity-80">O cliente já saiu da conversa: a resposta da equipe serve para a Marina aprender.</span>}
              </div>

              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
                <button onClick={() => { const f = new FormData(); f.set("id", l.id); executar(ignorarLacuna, f); }}
                  className={botao("fantasma", "sm")}><X className="h-3.5 w-3.5" /> Não é preciso</button>
                {escalonamentoAtivo && (!c || aguardando) && (
                  <button onClick={() => avisar(l.id)} disabled={pendente}
                    className={botao(falhou || !c ? "secundario" : "fantasma", "sm")}>
                    <Send className="h-3.5 w-3.5" /> {c ? "Avisar de novo" : "Avisar a equipe"}
                  </button>
                )}
                <button onClick={() => ensinar({ tipo: "pergunta", titulo: l.pergunta, lacuna_id: l.id, categoria: sugerirCategoria(l.pergunta) })}
                  className={botao("primario", "sm")}><GraduationCap className="h-3.5 w-3.5" /> Ensinar a resposta</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
