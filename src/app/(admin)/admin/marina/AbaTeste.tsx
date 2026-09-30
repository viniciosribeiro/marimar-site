"use client";

import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw, Sparkles, GraduationCap } from "lucide-react";
import { TIPOS, rotuloCategoria, type Tipo } from "@/lib/marina-base";
import { Marcacao } from "@/components/site/Marcacao";
import { Aviso, botao, campo, cn, Selo } from "@/components/admin/ui";
import { Girando } from "@/components/admin/ui-cliente";
import type { DadosMarina, Rascunho } from "./tipos";

type Mensagem = {
  papel: "voce" | "marina";
  conteudo: string;
  fontes?: { id: string; titulo: string; tipo: string; categoria: string }[];
  ms?: number;
  erro?: boolean;
};

/**
 * Conversar com a Marina sem sair do painel.
 *
 * É a MESMA Marina e o MESMO treinamento do chat do site — a diferença é
 * que aqui cada resposta vem com a lista do que ela usou. Se ela respondeu
 * certo, dá para ver por causa de qual item; se respondeu errado, um botão
 * transforma a pergunta em treino.
 *
 * Cada "Nova conversa" começa sem memória: a Marina lembra o que já disse
 * em cada conversa, e testar em cima de uma conversa antiga mistura o que
 * ela disse antes do treino com o treino novo.
 */
export function AbaTeste({ dados, ensinar }: { dados: DadosMarina; ensinar: (r?: Rascunho) => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sessao, setSessao] = useState<string>("");
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens, enviando]);

  const sugestoes = [
    ...dados.lacunas.slice(0, 3).map((l) => l.pergunta),
    "Quanto fica para 2 adultos e uma criança de 6 anos?",
    "Que horas é o check-in?",
    "Aceita cachorro?",
    "Como eu chego na pousada?",
  ].slice(0, 6);

  async function enviar(pergunta: string) {
    const msg = pergunta.trim();
    if (!msg || enviando) return;
    const historico = mensagens.filter((m) => !m.erro).map((m) => ({ papel: m.papel, conteudo: m.conteudo }));
    setMensagens((m) => [...m, { papel: "voce", conteudo: msg }]);
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/marina/teste", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagem: msg, historico, sessao }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) {
        setMensagens((m) => [...m, { papel: "marina", conteudo: d?.erro ?? "Não consegui falar com a Marina agora.", erro: true }]);
        return;
      }
      setSessao(d.sessao);
      setMensagens((m) => [...m, { papel: "marina", conteudo: d.resposta, fontes: d.fontes, ms: d.ms }]);
    } catch {
      setMensagens((m) => [...m, { papel: "marina", conteudo: "Sem conexão. Confira a internet e tente de novo.", erro: true }]);
    } finally {
      setEnviando(false);
    }
  }

  const novaConversa = () => { setMensagens([]); setSessao(""); };
  const perguntaAnterior = (i: number) => {
    for (let k = i - 1; k >= 0; k--) if (mensagens[k].papel === "voce") return mensagens[k].conteudo;
    return "";
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-linha/80 bg-white shadow-sm lg:h-[calc(100vh-15rem)]">
        <header className="flex items-center justify-between gap-3 border-b border-linha/60 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca text-sm font-bold text-marca-texto">M</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-tinta">Marina · conversa de teste</p>
              <p className="text-[11px] text-tinta-suave truncate">Mesmo treinamento do site. Nada daqui chega a hóspedes.</p>
            </div>
          </div>
          <button onClick={novaConversa} disabled={!mensagens.length} className={botao("fantasma", "sm")}>
            <RotateCcw className="h-3.5 w-3.5" /> Nova conversa
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-fundo-suave/60 px-4 py-5">
          {!dados.saude.gateway && (
            <Aviso tom="aviso" titulo="A Marina não está ligada a este site.">
              O teste usa a mesma ligação do chat do site (OPENCLAW_GATEWAY_URL e OPENCLAW_GATEWAY_TOKEN na Vercel).
            </Aviso>
          )}
          {mensagens.length === 0 && (
            <div className="mx-auto max-w-md py-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-marca" />
              <p className="mt-3 font-semibold text-tinta">Pergunte como um hóspede perguntaria</p>
              <p className="mt-1 text-sm text-tinta-suave">Embaixo de cada resposta aparece o que ela usou do treinamento.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {sugestoes.map((s) => (
                  <button key={s} onClick={() => enviar(s)} disabled={!dados.saude.gateway}
                    className="min-h-9 rounded-full border border-linha bg-white px-3 text-xs text-tinta hover:border-marca hover:text-marca disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={cn("flex", m.papel === "voce" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[88%] sm:max-w-[75%]", m.papel === "voce" ? "items-end" : "items-start")}>
                <div className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                  m.papel === "voce" ? "rounded-br-md bg-marca text-marca-texto"
                    : m.erro ? "rounded-bl-md border border-red-200 bg-red-50 text-red-900"
                    : "rounded-bl-md border border-linha/70 bg-white text-tinta",
                )}>
                  {m.papel === "marina" && !m.erro ? <Marcacao texto={m.conteudo} /> : m.conteudo}
                </div>
                {m.papel === "marina" && !m.erro && (
                  <div className="mt-2 space-y-2 px-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-tinta-suave">Usou:</span>
                      {m.fontes?.length ? m.fontes.map((f) => (
                        <Selo key={f.id} tom="marca" title={rotuloCategoria(f.categoria)}>
                          {TIPOS[f.tipo as Tipo]?.rotulo ?? (f.tipo === "roteiro" ? "Roteiro" : f.tipo)}: {f.titulo.slice(0, 40)}
                        </Selo>
                      )) : <span className="text-[11px] text-tinta-suave">nenhum item do treinamento (usou outras fontes ou conhecimento geral)</span>}
                      {m.ms && <span className="text-[11px] text-tinta-suave/70">· {(m.ms / 1000).toFixed(1)}s</span>}
                    </div>
                    <button onClick={() => ensinar({ tipo: "pergunta", titulo: perguntaAnterior(i) })}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-marca hover:bg-marca-sutil">
                      <GraduationCap className="h-3.5 w-3.5" /> Ensinar a resposta certa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {enviando && (
            <div className="flex items-center gap-2 text-xs text-tinta-suave"><Girando className="h-3.5 w-3.5" /> A Marina está respondendo…</div>
          )}
          <div ref={fim} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }}
          className="flex items-end gap-2 border-t border-linha/60 bg-white p-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
            placeholder="Escreva como um hóspede…" aria-label="Pergunta"
            className={campo + " max-h-32 min-h-11 resize-none"} disabled={!dados.saude.gateway} />
          <button type="submit" disabled={!texto.trim() || enviando || !dados.saude.gateway} className={botao("primario", "md", "h-11 w-11 shrink-0 px-0")} aria-label="Enviar">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-linha/80 bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold text-tinta">Como ler o teste</p>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-tinta-suave">
            <li><strong className="text-tinta">“Usou”</strong> mostra os itens do treinamento que ela citou. Se o item certo não aparece, reescreva-o mais claro.</li>
            <li><strong className="text-tinta">Preço e vaga</strong> vêm ao vivo do sistema de reservas — o teste mostra valores reais.</li>
            <li><strong className="text-tinta">WhatsApp</strong> usa o mesmo treinamento, lido a cada conversa. Para testar lá, use um número que não converse com ela há um tempo: ela lembra do que disse antes.</li>
          </ul>
        </div>
        {dados.lacunas.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-950">Perguntas reais sem resposta</p>
            <ul className="mt-2 space-y-1.5">
              {dados.lacunas.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <button onClick={() => enviar(l.pergunta)} className="text-left text-xs text-amber-950 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600">
                    {l.pergunta}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
