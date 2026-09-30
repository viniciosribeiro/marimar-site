"use client";

import { useState } from "react";
import { Search, Check, X, Pencil, BadgeCheck, Trash2, MessageCircle, Globe, AlertTriangle, CalendarClock, Sparkles } from "lucide-react";
import type { Aprendido } from "@/lib/aprendizado";
import { CATEGORIAS, rotuloCategoria } from "@/lib/marina-base";
import { Aviso, Cartao, Rotulo, Selo, Vazio, botao, campo, cn, quandoFoi } from "@/components/admin/ui";
import { Gaveta, Girando, useAcao, useConfirmar } from "@/components/admin/ui-cliente";
import { aprovarAprendido, rejeitarAprendido, excluirAprendido, editarAprendido, oficializarAprendido } from "./acoes-aprendizado";
import { salvarConfigEscalonamento } from "../equipe/actions";

type Filtro = "revisar" | "em-uso" | "vencidos" | "rejeitados" | "oficiais" | "todos";

/* Data de hoje no fuso da pousada, calculada fora do render. */
const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/**
 * O que a Marina aprendeu com a equipe, e a fila de revisão.
 *
 * "Para revisar" junta o que espera aprovação e o que já está em uso sem
 * ninguém ter olhado (modo automático). Aprovar, editar, rejeitar ou tornar
 * oficial — este último vira um item de Conhecimento, que vale mais.
 */
export function AbaAprendizado({ itens, modo, conflitos }: { itens: Aprendido[]; modo: string; conflitos: Record<string, string> }) {
  const [hoje] = useState(hojeISO);
  const vencido = (a: Aprendido) => !!a.valido_ate && a.valido_ate < hoje && a.status === "ativo";
  const grupos: Record<Filtro, Aprendido[]> = {
    revisar: itens.filter((a) => a.status === "pendente" || (a.status === "ativo" && (!a.revisado || !!a.conflito_id))),
    "em-uso": itens.filter((a) => a.status === "ativo" && !a.conflito_id && !vencido(a)),
    vencidos: itens.filter(vencido),
    rejeitados: itens.filter((a) => a.status === "rejeitado"),
    oficiais: itens.filter((a) => a.status === "oficial"),
    todos: itens,
  };
  const [filtro, setFiltro] = useState<Filtro>(grupos.revisar.length ? "revisar" : "todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Aprendido | null>(null);
  const q = busca.trim().toLowerCase();
  const lista = grupos[filtro].filter((a) => !q || [a.pergunta, a.resposta, ...a.variacoes].some((t) => t.toLowerCase().includes(q)));

  return (
    <div className="space-y-5">
      <Modo modo={modo} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0 [scrollbar-width:none]">
          {([["revisar", "Para revisar"], ["em-uso", "Em uso"], ["vencidos", "Vencidos"], ["rejeitados", "Rejeitados"], ["oficiais", "Viraram oficiais"], ["todos", "Todos"]] as const).map(([v, r]) => (
            <button key={v} onClick={() => setFiltro(v)} aria-pressed={filtro === v}
              className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium",
                filtro === v ? "border-marca bg-marca text-marca-texto" : "border-linha bg-white text-tinta-suave hover:text-tinta")}>
              {r}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", filtro === v ? "bg-white/25" : v === "revisar" && grupos.revisar.length ? "bg-amber-100 text-amber-900" : "bg-areia")}>{grupos[v].length}</span>
            </button>
          ))}
        </div>
        <label className="relative lg:ml-auto lg:w-72">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-suave" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pergunta ou resposta…" className={campo + " pl-10"} />
        </label>
      </div>

      {lista.length === 0 ? (
        <Vazio icone={<Sparkles className="h-6 w-6 text-tinta-suave" />} titulo={filtro === "revisar" ? "Nada para revisar" : "Nada aqui"}>
          {itens.length === 0
            ? "Quando a equipe responder um chamado (Equipe responsável), a resposta aparece aqui e a Marina aprende."
            : "Troque o filtro para ver os outros."}
        </Vazio>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {lista.map((a) => <CartaoAprendido key={a.id} a={a} vencido={vencido(a)} conflito={a.conflito_id ? conflitos[a.conflito_id] ?? "um item cadastrado" : null} editar={() => setEditando(a)} />)}
        </ul>
      )}
      {editando && <FormAprendido key={editando.id} a={editando} fechar={() => setEditando(null)} />}
    </div>
  );
}

function Modo({ modo }: { modo: string }) {
  const { executar, pendente } = useAcao();
  const [atual, setAtual] = useState(modo);
  const trocar = (m: string) => {
    setAtual(m);
    const fd = new FormData();
    fd.set("aprendizado_modo", m);
    executar(salvarConfigEscalonamento, fd);
  };
  return (
    <Cartao titulo="Como a Marina aprende" descricao="Cada resposta da equipe num chamado vira conhecimento aprendido, agrupado com as perguntas de mesmo sentido.">
      <div className="grid gap-2 sm:grid-cols-2">
        {([["aprovacao", "Só depois de aprovado", "A resposta entra na fila; a Marina usa quando alguém aprovar. Recomendado."],
          ["automatico", "Na hora (automático)", "A Marina já usa na próxima pergunta parecida; você revisa depois."]] as const).map(([v, t, d]) => (
          <button key={v} type="button" disabled={pendente} onClick={() => trocar(v)} aria-pressed={atual === v}
            className={cn("rounded-xl border p-3 text-left transition-colors", atual === v ? "border-marca bg-marca/5 ring-1 ring-marca" : "border-linha/80 bg-white hover:border-marca/50")}>
            <span className="flex items-center gap-2 text-sm font-semibold text-tinta">{atual === v && <Check className="h-4 w-4 text-marca" />}{t}</span>
            <span className="mt-0.5 block text-xs text-tinta-suave">{d}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-tinta-suave">
        Em qualquer modo: o que foi cadastrado à mão vale mais e nunca é alterado; nada que identifique o cliente é guardado;
        informação que muda (preço, horário, evento) ganha validade.
      </p>
    </Cartao>
  );
}

function Confianca({ valor }: { valor: number }) {
  const pct = Math.round(valor * 100);
  const cor = pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-tinta-suave" title="Confiança: sobe quando a equipe confirma a mesma resposta ou alguém aprova">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-areia"><span className={cn("block h-full rounded-full", cor)} style={{ width: `${pct}%` }} /></span>
      {pct}%
    </span>
  );
}

function CartaoAprendido({ a, vencido, conflito, editar }: { a: Aprendido; vencido: boolean; conflito: string | null; editar: () => void }) {
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  const Canal = a.origem_canal === "site" ? Globe : MessageCircle;
  const st = a.status === "pendente" ? { t: "Aguardando aprovação", tom: "aviso" as const }
    : a.status === "rejeitado" ? { t: "Rejeitado", tom: "neutro" as const }
      : a.status === "oficial" ? { t: "Virou oficial", tom: "marca" as const }
        : conflito ? { t: "Parado (conflito)", tom: "erro" as const }
          : vencido ? { t: "Vencido", tom: "erro" as const }
            : { t: a.revisado ? "Em uso · revisado" : "Em uso · não revisado", tom: "sucesso" as const };
  return (
    <li className="flex flex-col rounded-2xl border border-linha/80 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Selo tom={st.tom} ponto>{st.t}</Selo>
        <Selo>{rotuloCategoria(a.categoria)}</Selo>
        <Confianca valor={a.confianca} />
        <span className="ml-auto text-xs text-tinta-suave">{a.usos} {a.usos === 1 ? "uso" : "usos"}</span>
      </div>
      <p className="mt-3 font-semibold text-tinta">{a.pergunta}</p>
      {a.variacoes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {a.variacoes.slice(0, 3).map((v) => <span key={v} className="rounded-full bg-areia/60 px-2.5 py-0.5 text-xs text-tinta">{v}</span>)}
          {a.variacoes.length > 3 && <span className="text-xs text-tinta-suave">+{a.variacoes.length - 3} parecidas</span>}
        </div>
      )}
      <p className="mt-2 rounded-xl bg-fundo-suave p-3 text-sm text-tinta">{a.resposta}</p>
      {conflito && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Parecido com o item cadastrado “{conflito}”. O cadastrado continua valendo; este fica parado até alguém aprovar ou rejeitar.</p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-suave">
        <span className="inline-flex items-center gap-1"><Canal className="h-3.5 w-3.5" /> {a.origem_canal === "site" ? "Chat do site" : "WhatsApp"}</span>
        {a.respondido_por && <span>respondido por <b className="text-tinta">{a.respondido_por}</b></span>}
        <span>{quandoFoi(a.criado_em)}</span>
        {a.valido_ate && <span className={cn("inline-flex items-center gap-1", vencido && "font-semibold text-red-700")}><CalendarClock className="h-3.5 w-3.5" /> vale até {a.valido_ate.split("-").reverse().join("/")}</span>}
        {a.revisado_por && <span>revisado por {a.revisado_por}</span>}
      </p>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-linha/60 pt-3 [&]:mt-3">
        {a.status !== "oficial" && (a.status !== "ativo" || !a.revisado || conflito) && (
          <button disabled={pendente} onClick={() => executar(() => aprovarAprendido(a.id), new FormData())} className={botao("primario", "sm")}>
            {pendente ? <Girando /> : <Check className="h-3.5 w-3.5" />} Aprovar
          </button>
        )}
        {a.status !== "oficial" && <button onClick={editar} className={botao("secundario", "sm")}><Pencil className="h-3.5 w-3.5" /> Editar</button>}
        {a.status !== "oficial" && a.status !== "rejeitado" && (
          <button disabled={pendente} onClick={() => executar(() => rejeitarAprendido(a.id), new FormData())} className={botao("fantasma", "sm")}><X className="h-3.5 w-3.5" /> Rejeitar</button>
        )}
        {a.status !== "oficial" && (
          <button disabled={pendente} className={botao("fantasma", "sm")} onClick={async () => {
            if (await confirmar({ titulo: "Tornar conhecimento oficial?", texto: "Vira uma “Pergunta e resposta” em Conhecimento, que vale mais que o aprendido e não vence. O aprendido sai de circulação.", confirmar: "Tornar oficial" })) {
              executar(() => oficializarAprendido(a.id), new FormData());
            }
          }}><BadgeCheck className="h-3.5 w-3.5" /> Tornar oficial</button>
        )}
        {a.status !== "oficial" && (
          <button aria-label="Excluir" className={botao("fantasma", "sm", "ml-auto h-9 w-9 px-0 text-red-700 hover:bg-red-50")} onClick={async () => {
            if (await confirmar({ titulo: "Excluir este aprendizado?", texto: "Some da base. Uma pergunta igual volta a ir para a equipe.", confirmar: "Excluir", perigo: true })) {
              executar(() => excluirAprendido(a.id), new FormData());
            }
          }}><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
      {dialogo}
    </li>
  );
}

function FormAprendido({ a, fechar }: { a: Aprendido; fechar: () => void }) {
  const { executar, pendente } = useAcao();
  const [aprovar, setAprovar] = useState(a.status !== "ativo" || !a.revisado);
  return (
    <Gaveta titulo="Editar aprendizado" descricao="Ajuste antes de a Marina usar. Dados pessoais são removidos ao salvar." aoFechar={fechar}
      rodape={<div className="flex justify-end gap-2"><button onClick={fechar} className={botao("fantasma")}>Cancelar</button>
        <button form="form-aprendido" disabled={pendente} className={botao()}>{pendente && <Girando />} {aprovar ? "Salvar e aprovar" : "Salvar"}</button></div>}>
      <form id="form-aprendido" className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", a.id);
        if (aprovar) fd.set("aprovar", "on");
        const r = await executar(editarAprendido, fd);
        if (r.ok) fechar();
      }}>
        <Rotulo rotulo="Pergunta" obrigatorio><input name="pergunta" required defaultValue={a.pergunta} className={campo} maxLength={600} /></Rotulo>
        <Rotulo rotulo="Outras formas de perguntar" ajuda="Uma por linha. Ajudam a Marina a reconhecer a mesma dúvida.">
          <textarea name="variacoes" rows={4} defaultValue={a.variacoes.join("\n")} className={campo} />
        </Rotulo>
        <Rotulo rotulo="Resposta" obrigatorio><textarea name="resposta" required rows={4} defaultValue={a.resposta} className={campo} maxLength={3000} /></Rotulo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulo rotulo="Assunto">
            <select name="categoria" defaultValue={a.categoria} className={campo}>
              {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
            </select>
          </Rotulo>
          <Rotulo rotulo="Vale até" ajuda="Deixe vazio se não muda com o tempo.">
            <input type="date" name="valido_ate" defaultValue={a.valido_ate ?? ""} className={campo} />
          </Rotulo>
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-linha/80 bg-white px-4 text-sm text-tinta">
          <input type="checkbox" checked={aprovar} onChange={(e) => setAprovar(e.target.checked)} className="h-5 w-5 accent-[var(--color-marca)]" />
          Aprovar ao salvar (a Marina passa a usar)
        </label>
        {a.status === "rejeitado" && <Aviso tom="info">Este item foi rejeitado. Aprovar ao salvar o traz de volta.</Aviso>}
      </form>
    </Gaveta>
  );
}
