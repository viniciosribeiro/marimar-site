"use client";

import { useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { CATEGORIAS, sugerirCategoria } from "@/lib/marina-base";
import { Aviso, botao, campo, cn, Rotulo, Selo, Vazio, quandoFoi } from "@/components/admin/ui";
import { Gaveta, useAcao, Girando } from "@/components/admin/ui-cliente";
import { corrigirResposta } from "./actions";
import type { Conversa, Troca } from "./tipos";

/**
 * Conversas reais do chat do site.
 *
 * Corrigir uma resposta cria uma PERGUNTA E RESPOSTA com a pergunta do
 * hóspede e o texto certo — é o formato que a Marina mais acerta depois.
 */
export function AbaConversas({ conversas }: { conversas: Conversa[] }) {
  const [soProblemas, setSoProblemas] = useState(false);
  const [corrigindo, setCorrigindo] = useState<{ troca: Troca; pergunta: string } | null>(null);

  const temProblema = (c: Conversa) => c.trocas.some((t) => t.sem_resposta || t.marcada);
  const lista = soProblemas ? conversas.filter(temProblema) : conversas;

  return (
    <div className="space-y-4">
      <Aviso tom="info">
        As últimas 30 conversas do chat do site. As do WhatsApp ficam guardadas no OpenClaw e ainda não aparecem aqui —
        mas o que ela não soube responder lá chega em <strong>Sem resposta</strong>.
      </Aviso>

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-xs text-tinta-suave">{lista.length} {lista.length === 1 ? "conversa" : "conversas"}</span>
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-tinta">
          <input type="checkbox" checked={soProblemas} onChange={(e) => setSoProblemas(e.target.checked)} className="h-4 w-4 accent-[var(--marca)]" />
          Só as que precisam de atenção
        </label>
      </div>

      {lista.length === 0 ? (
        <Vazio icone="💬" titulo={soProblemas ? "Nenhuma conversa com problema" : "Nenhuma conversa ainda"}>
          {soProblemas ? "Todas as respostas recentes pareceram certas." : "Quando alguém usar o chat do site, a conversa aparece aqui."}
        </Vazio>
      ) : (
        <ul className="space-y-3">
          {lista.map((c) => <ItemConversa key={c.sessao} c={c} problema={temProblema(c)}
            aoCorrigir={(troca, pergunta) => setCorrigindo({ troca, pergunta })} />)}
        </ul>
      )}

      {corrigindo && <FormCorrecao {...corrigindo} aoFechar={() => setCorrigindo(null)} />}
    </div>
  );
}

function ItemConversa({ c, problema, aoCorrigir }: {
  c: Conversa; problema: boolean; aoCorrigir: (t: Troca, pergunta: string) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const primeira = c.trocas.find((t) => t.papel === "visitante")?.conteudo ?? "(sem pergunta)";
  return (
    <li className="overflow-hidden rounded-2xl border border-linha/80 bg-white shadow-sm">
      <button onClick={() => setAberta((a) => !a)} aria-expanded={aberta}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-areia/25 min-h-14">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-tinta">{primeira}</p>
          <p className="text-[11px] text-tinta-suave">{quandoFoi(c.fim)} · {c.trocas.length} mensagens</p>
        </div>
        {c.trocas.some((t) => t.sem_resposta && !t.correcao) && <Selo tom="aviso">não soube</Selo>}
        {c.trocas.some((t) => t.correcao) && <Selo tom="sucesso">corrigida</Selo>}
        {!problema && <Selo>ok</Selo>}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-tinta-suave transition-transform", aberta && "rotate-180")} />
      </button>
      {aberta && (
        <div className="space-y-3 border-t border-linha/60 bg-fundo-suave/50 p-4">
          {c.trocas.map((t, i) => {
            const pergunta = [...c.trocas.slice(0, i)].reverse().find((x) => x.papel === "visitante")?.conteudo ?? "";
            return (
              <div key={t.id} className={cn("flex", t.papel === "marina" ? "justify-start" : "justify-end")}>
                <div className="max-w-[90%] sm:max-w-[75%]">
                  <div className={cn("rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                    t.papel === "marina" ? "rounded-bl-md border border-linha/70 bg-white text-tinta" : "rounded-br-md bg-tinta text-white",
                    t.sem_resposta && !t.correcao && "border-amber-300")}>
                    {t.conteudo}
                  </div>
                  {t.papel === "marina" && (
                    t.correcao ? (
                      <p className="mt-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><strong>Corrigido para:</strong> {t.correcao}</p>
                    ) : (
                      <button onClick={() => aoCorrigir(t, pergunta)} className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-tinta-suave hover:bg-white hover:text-marca">
                        <Wrench className="h-3.5 w-3.5" /> Corrigir esta resposta
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

function FormCorrecao({ troca, pergunta, aoFechar }: { troca: Troca; pergunta: string; aoFechar: () => void }) {
  const { executar, pendente } = useAcao();
  const [categoria, setCategoria] = useState<string>(sugerirCategoria(pergunta + " " + troca.conteudo));
  return (
    <Gaveta titulo="Corrigir a resposta" descricao="A correção vira uma pergunta e resposta no treinamento." aoFechar={aoFechar}
      rodape={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={aoFechar} className={botao("secundario")}>Cancelar</button>
          <button form="form-correcao" disabled={pendente} className={botao("primario")}>{pendente && <Girando />} Corrigir e ensinar</button>
        </div>
      }>
      <form id="form-correcao" className="space-y-5" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", troca.id);
        fd.set("categoria", categoria);
        const r = await executar(corrigirResposta, fd);
        if (r.ok) aoFechar();
      }}>
        <div className="rounded-2xl border border-linha/70 bg-white p-3 text-sm text-tinta-suave">
          <p className="text-[11px] font-semibold uppercase tracking-wider">Ela respondeu</p>
          <p className="mt-1 whitespace-pre-wrap text-tinta">{troca.conteudo}</p>
        </div>
        <Rotulo rotulo="Pergunta do hóspede" obrigatorio>
          <input name="pergunta" defaultValue={pergunta} required className={campo} />
        </Rotulo>
        <Rotulo rotulo="O que ela deveria ter dito" obrigatorio>
          <textarea name="correcao" rows={5} required autoFocus className={campo + " leading-relaxed"} />
        </Rotulo>
        <Rotulo rotulo="Assunto">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
        </Rotulo>
      </form>
    </Gaveta>
  );
}
