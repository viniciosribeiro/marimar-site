"use client";

import { useId, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Plus, Pencil, Trash2, Send, Clock, MessageCircle, Globe, CheckCircle2, AlertTriangle, Timer, Reply, X, Play,
} from "lucide-react";
import { SETORES, rotuloSetor, type ConfigEscalonamento } from "@/lib/escalonamento-base";
import type { Chamado } from "@/lib/escalonamento";
import { Aviso, Cartao, Rotulo, Selo, Vazio, botao, campo, cn, quandoFoi } from "@/components/admin/ui";
import { Abas, Gaveta, Girando, useAcao, useConfirmar } from "@/components/admin/ui-cliente";
import {
  salvarContato, alternarContato, excluirContato, ordenarContatos, testarEnvio,
  salvarConfigEscalonamento, responderPeloPainel, reenviarAoCliente, cancelarChamado, rodarPrazosAgora,
} from "./actions";

export type ContatoPainel = {
  id: string; nome: string; numero: string; setores: string[]; dias: number[]; hora_inicio: string; hora_fim: string;
  ordem: number; ativo: boolean; ultimo_teste_em: string | null; ultimo_teste_ok: boolean | null; ultimo_teste_erro: string | null;
  no_horario: boolean;
};

type Aba = "equipe" | "chamados" | "config";
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Seg a Sex", "Todos os dias", "Sáb, Dom". */
function textoDias(d: number[]) {
  const s = [...d].sort();
  if (s.length === 7) return "Todos os dias";
  if (s.length >= 3 && s.every((x, i) => i === 0 || x === s[i - 1] + 1)) return `${DIAS[s[0]]} a ${DIAS[s[s.length - 1]]}`;
  return s.map((x) => DIAS[x]).join(", ");
}
const formatarNumero = (n: string) => {
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${n}`;
};

export function PainelEquipe({ contatos, config, chamados, gatewayOk, abaInicial }: {
  contatos: ContatoPainel[]; config: ConfigEscalonamento; chamados: Chamado[]; gatewayOk: boolean; abaInicial: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [aba, setAba] = useState<Aba>((["equipe", "chamados", "config"].includes(abaInicial) ? abaInicial : "equipe") as Aba);
  const trocar = (a: Aba) => { setAba(a); router.replace(`${pathname}?aba=${a}`, { scroll: false }); };
  const aguardando = chamados.filter((c) => c.status === "aguardando").length;
  const comErro = chamados.filter((c) => c.entrega_erro && c.status !== "entregue").length;

  return (
    <div className="space-y-6">
      {!config.ativo && (
        <Aviso tom="aviso" titulo="O escalonamento está desligado."
          acao={<button onClick={() => trocar("config")} className={botao("secundario", "sm")}>Ligar</button>}>
          Enquanto estiver desligado, quando a Marina não souber ela só anota a pergunta em Marina → Sem resposta.
        </Aviso>
      )}
      {!gatewayOk && (
        <Aviso tom="erro" titulo="O site não está ligado ao OpenClaw.">
          Sem o gateway, o site não consegue mandar WhatsApp: a própria Marina manda os avisos (ela recebe o texto pronto). Veja Sistema → Integrações.
        </Aviso>
      )}
      <Abas atual={aba} aoTrocar={trocar} abas={[
        { id: "equipe", rotulo: "Equipe", contador: contatos.filter((c) => c.ativo).length },
        { id: "chamados", rotulo: "Chamados", contador: aguardando, alerta: comErro > 0 },
        { id: "config", rotulo: "Prazos e WhatsApp" },
      ]} />
      {aba === "equipe" && <AbaContatos contatos={contatos} />}
      {aba === "chamados" && <AbaChamados chamados={chamados} contatos={contatos} />}
      {aba === "config" && <AbaConfig config={config} />}
    </div>
  );
}

/* ── equipe ─────────────────────────────────────────────────────── */

function AbaContatos({ contatos }: { contatos: ContatoPainel[] }) {
  const [editando, setEditando] = useState<ContatoPainel | "novo" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-tinta-suave">
          A Marina avisa quem cuida do assunto e está no horário; empate, vale a ordem da lista (arraste para mudar).
          Sem resposta no prazo, passa para o próximo.
        </p>
        <button onClick={() => setEditando("novo")} className={botao("primario", "md", "shrink-0")}><Plus className="h-4 w-4" /> Adicionar pessoa</button>
      </div>
      {contatos.length === 0 ? (
        <Vazio icone="📱" titulo="Ninguém cadastrado ainda"
          acao={<button onClick={() => setEditando("novo")} className={botao()}><Plus className="h-4 w-4" /> Cadastrar a primeira pessoa</button>}>
          Cadastre pelo menos uma pessoa com “Qualquer assunto” — é quem recebe o que não tiver dono.
        </Vazio>
      ) : (
        <ListaContatos key={contatos.map((c) => c.id + c.ativo).join()} contatos={contatos} editar={setEditando} />
      )}
      {editando && <FormContato key={editando === "novo" ? "novo" : editando.id} contato={editando === "novo" ? null : editando} fechar={() => setEditando(null)} />}
    </div>
  );
}

function useSensores() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function ListaContatos({ contatos, editar }: { contatos: ContatoPainel[]; editar: (c: ContatoPainel) => void }) {
  const [ordem, setOrdem] = useState(contatos.map((c) => c.id));
  const { executar } = useAcao();
  const sensores = useSensores();
  const idDnd = useId();
  const porId = new Map(contatos.map((c) => [c.id, c]));
  const soltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const nova = arrayMove(ordem, ordem.indexOf(String(e.active.id)), ordem.indexOf(String(e.over.id)));
    setOrdem(nova);
    executar(() => ordenarContatos(nova), new FormData());
  };
  return (
    <DndContext id={idDnd} sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
      <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
        <ul className="grid gap-3 lg:grid-cols-2">
          {ordem.map((id, i) => { const c = porId.get(id); return c ? <CartaoContato key={id} c={c} posicao={i + 1} editar={editar} /> : null; })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function CartaoContato({ c, posicao, editar }: { c: ContatoPainel; posicao: number; editar: (c: ContatoPainel) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={cn("rounded-2xl border bg-white p-4 shadow-sm", isDragging ? "border-marca shadow-xl" : "border-linha/80", !c.ativo && "bg-fundo-suave")}>
      <div className="flex items-start gap-3">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Arrastar para mudar a prioridade"
          className="-ml-1 flex h-10 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-tinta-suave hover:bg-areia/60"><GripVertical className="h-4 w-4" /></button>
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marca/10 text-sm font-bold text-marca" title="Prioridade">{posicao}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("font-semibold", c.ativo ? "text-tinta" : "text-tinta-suave")}>{c.nome}</h3>
            {!c.ativo ? <Selo>Desligado</Selo> : c.no_horario ? <Selo tom="sucesso" ponto>No horário</Selo> : <Selo tom="neutro" ponto>Fora do horário</Selo>}
          </div>
          <p className="mt-0.5 font-mono text-sm text-tinta">{formatarNumero(c.numero)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-tinta-suave"><Clock className="h-3.5 w-3.5" /> {textoDias(c.dias)} · {c.hora_inicio}–{c.hora_fim}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.setores.map((s) => <span key={s} className="rounded-full bg-areia/70 px-2.5 py-0.5 text-xs text-tinta">{rotuloSetor(s)}</span>)}
          </div>
          {c.ultimo_teste_em && (
            <p className={cn("mt-2 text-xs", c.ultimo_teste_ok ? "text-emerald-700" : "text-red-700")}>
              {c.ultimo_teste_ok ? "✓ Teste enviado" : `× Teste falhou: ${c.ultimo_teste_erro}`} · {quandoFoi(c.ultimo_teste_em)}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-linha/60 pt-3">
        <button onClick={() => editar(c)} className={botao("secundario", "sm")}><Pencil className="h-3.5 w-3.5" /> Editar</button>
        <button disabled={pendente || !c.ativo} onClick={() => executar(() => testarEnvio(c.id), new FormData())} className={botao("secundario", "sm")}>
          {pendente ? <Girando /> : <Send className="h-3.5 w-3.5" />} Testar envio
        </button>
        <button disabled={pendente} onClick={() => executar(() => alternarContato(c.id, !c.ativo), new FormData())} className={botao("fantasma", "sm")}>{c.ativo ? "Desligar" : "Ligar"}</button>
        <button aria-label="Excluir" className={botao("fantasma", "sm", "ml-auto text-red-700 hover:bg-red-50")} onClick={async () => {
          if (await confirmar({ titulo: `Excluir ${c.nome}?`, texto: "A pessoa deixa de receber chamados. O histórico dos chamados continua.", confirmar: "Excluir", perigo: true })) {
            executar(() => excluirContato(c.id), new FormData());
          }
        }}><Trash2 className="h-4 w-4" /></button>
      </div>
      {dialogo}
    </li>
  );
}

function FormContato({ contato, fechar }: { contato: ContatoPainel | null; fechar: () => void }) {
  const { executar, pendente } = useAcao();
  const [ativo, setAtivo] = useState(contato?.ativo ?? true);
  return (
    <Gaveta titulo={contato ? `Editar ${contato.nome}` : "Nova pessoa da equipe"} descricao="Quem recebe as perguntas que a Marina não sabe." aoFechar={fechar}
      rodape={<div className="flex justify-end gap-2"><button onClick={fechar} className={botao("fantasma")}>Cancelar</button>
        <button form="form-contato" disabled={pendente} className={botao()}>{pendente && <Girando />} Salvar</button></div>}>
      <form id="form-contato" className="space-y-5" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (contato) fd.set("id", contato.id);
        fd.set("ativo", ativo ? "on" : "off");
        const r = await executar(salvarContato, fd);
        if (r.ok) fechar();
      }}>
        <Rotulo rotulo="Nome" obrigatorio><input name="nome" required defaultValue={contato?.nome ?? ""} className={campo} maxLength={80} placeholder="Ex.: Cecília (recepção)" /></Rotulo>
        <Rotulo rotulo="WhatsApp" obrigatorio ajuda="Com DDD. O 55 do Brasil entra sozinho.">
          <input name="numero" required inputMode="tel" defaultValue={contato ? formatarNumero(contato.numero) : ""} className={campo} placeholder="(41) 99999-1234" />
        </Rotulo>
        <fieldset>
          <legend className="text-sm font-medium text-tinta">Assuntos que atende</legend>
          <p className="text-xs text-tinta-suave">“Qualquer assunto” recebe o que ninguém mais atende.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SETORES.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-linha/80 bg-white px-3 text-sm has-[:checked]:border-marca has-[:checked]:bg-marca/5">
                <input type="checkbox" name="setores" value={s.id} defaultChecked={contato ? contato.setores.includes(s.id) : s.id === "geral"} className="h-4 w-4 accent-[var(--color-marca)]" />
                {s.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-tinta">Dias de atendimento</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DIAS.map((d, i) => (
              <label key={d} className="flex h-11 w-12 cursor-pointer items-center justify-center rounded-xl border border-linha/80 bg-white text-sm has-[:checked]:border-marca has-[:checked]:bg-marca has-[:checked]:text-marca-texto">
                <input type="checkbox" name="dias" value={i} defaultChecked={contato ? contato.dias.includes(i) : true} className="sr-only" />{d}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Rotulo rotulo="Das"><input type="time" name="hora_inicio" defaultValue={contato?.hora_inicio ?? "08:00"} className={campo} /></Rotulo>
          <Rotulo rotulo="Até"><input type="time" name="hora_fim" defaultValue={contato?.hora_fim ?? "20:00"} className={campo} /></Rotulo>
        </div>
        <p className="-mt-2 text-xs text-tinta-suave">Fora do horário a pessoa ainda pode receber, mas só se ninguém do assunto estiver no horário.</p>
        <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-linha/80 bg-white px-4">
          <span className="text-sm text-tinta">Recebe chamados</span>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)}
            className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors checked:bg-marca before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5" />
        </label>
      </form>
    </Gaveta>
  );
}

/* ── chamados ───────────────────────────────────────────────────── */

type Filtro = "aguardando" | "respondidos" | "problemas" | "todos";

const STATUS: Record<string, { rotulo: string; tom: "aviso" | "sucesso" | "erro" | "neutro" | "info" }> = {
  aguardando: { rotulo: "Aguardando equipe", tom: "aviso" },
  respondido: { rotulo: "Respondido · não entregue", tom: "erro" },
  entregue: { rotulo: "Entregue ao cliente", tom: "sucesso" },
  expirado: { rotulo: "Expirado", tom: "erro" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

function AbaChamados({ chamados, contatos }: { chamados: Chamado[]; contatos: ContatoPainel[] }) {
  const [filtro, setFiltro] = useState<Filtro>(chamados.some((c) => c.status === "aguardando") ? "aguardando" : "todos");
  const { executar, pendente } = useAcao();
  const lista = chamados.filter((c) =>
    filtro === "todos" ? true
      : filtro === "aguardando" ? c.status === "aguardando"
        : filtro === "respondidos" ? c.status === "entregue"
          : (c.status === "respondido" || c.status === "expirado" || !!c.entrega_erro) && c.status !== "entregue");
  const nomes = new Map(contatos.map((c) => [c.id, c.nome]));
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
          {([["aguardando", "Aguardando"], ["problemas", "Com problema"], ["respondidos", "Entregues"], ["todos", "Todos"]] as const).map(([v, r]) => (
            <button key={v} onClick={() => setFiltro(v)} aria-pressed={filtro === v}
              className={cn("min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium",
                filtro === v ? "border-marca bg-marca text-marca-texto" : "border-linha bg-white text-tinta-suave hover:text-tinta")}>{r}</button>
          ))}
        </div>
        <button disabled={pendente} onClick={() => executar(rodarPrazosAgora, new FormData())} className={botao("secundario", "sm", "shrink-0")}
          title="Lembretes, repasses e avisos que já venceram">{pendente ? <Girando /> : <Play className="h-3.5 w-3.5" />} Conferir prazos agora</button>
      </div>
      {lista.length === 0 ? (
        <Vazio icone="🎉" titulo={filtro === "aguardando" ? "Nenhum cliente esperando" : "Nada aqui"}>
          {filtro === "aguardando" ? "Quando a Marina não souber algo, o chamado aparece aqui até a equipe responder." : "Troque o filtro para ver outros chamados."}
        </Vazio>
      ) : (
        <ul className="space-y-3">{lista.map((c) => <CartaoChamado key={c.id} c={c} nomes={nomes} />)}</ul>
      )}
    </div>
  );
}

function CartaoChamado({ c, nomes }: { c: Chamado; nomes: Map<string, string> }) {
  const [respondendo, setRespondendo] = useState(false);
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  const st = STATUS[c.status] ?? { rotulo: c.status, tom: "neutro" as const };
  const Canal = c.canal === "site" ? Globe : MessageCircle;
  const minutos = c.respondido_em ? Math.round((new Date(c.respondido_em).getTime() - new Date(c.notificado_em ?? c.criado_em).getTime()) / 60000) : null;
  return (
    <li className="rounded-2xl border border-linha/80 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-tinta px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white">#{c.codigo}</span>
        <Selo tom={st.tom} ponto>{st.rotulo}</Selo>
        <span className="inline-flex items-center gap-1 text-xs text-tinta-suave"><Canal className="h-3.5 w-3.5" /> {c.canal === "site" ? "Chat do site" : "WhatsApp"}</span>
        <span className="text-xs text-tinta-suave">· {rotuloSetor(c.setor)} · {quandoFoi(c.criado_em)}</span>
      </div>
      <p className="mt-2 font-medium text-tinta">“{c.pergunta}”</p>
      {c.contexto && <p className="mt-1 text-sm text-tinta-suave">Contexto: {c.contexto}</p>}
      {c.resposta_equipe && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> {c.respondido_por}{minutos !== null && ` · em ${minutos < 60 ? `${minutos} min` : `${Math.round(minutos / 60)} h`}`}</p>
          <p className="mt-1">{c.resposta_equipe}</p>
          {c.resposta_final && <p className="mt-2 border-t border-emerald-200 pt-2 text-xs text-emerald-900"><b>O cliente recebeu:</b> {c.resposta_final}</p>}
        </div>
      )}
      {c.entrega_erro && c.status !== "entregue" && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {c.entrega_erro}</p>
      )}
      {c.tentativas.length > 0 && (
        <ol className="mt-3 space-y-1 border-l-2 border-linha pl-3 text-xs text-tinta-suave">
          {c.tentativas.map((t, i) => (
            <li key={i}>
              {t.tipo === "lembrete" ? "⏰ Lembrete para" : t.tipo === "repasse" ? "🔁 Repassado para" : "📨 Avisado:"} <b className="text-tinta">{t.contato_id ? nomes.get(t.contato_id) ?? t.nome : t.nome}</b>
              {" "}· {quandoFoi(t.em)} {t.ok ? "" : <span className="text-red-700">— não enviado ({t.erro})</span>}
            </li>
          ))}
        </ol>
      )}
      {c.status === "aguardando" && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-linha/60 pt-3">
          <button onClick={() => setRespondendo((v) => !v)} className={botao("primario", "sm")}><Reply className="h-3.5 w-3.5" /> Responder pelo painel</button>
          <button className={botao("fantasma", "sm")} onClick={async () => {
            if (await confirmar({ titulo: `Cancelar o chamado #${c.codigo}?`, texto: "O cliente não recebe resposta nenhuma por aqui.", confirmar: "Cancelar chamado", perigo: true })) {
              executar(() => cancelarChamado(c.id), new FormData());
            }
          }}><X className="h-3.5 w-3.5" /> Cancelar</button>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-tinta-suave"><Timer className="h-3.5 w-3.5" /> esperando desde {quandoFoi(c.criado_em)}</span>
        </div>
      )}
      {c.status === "respondido" && c.resposta_final && (
        <div className="mt-3 border-t border-linha/60 pt-3">
          <button disabled={pendente} onClick={() => executar(() => reenviarAoCliente(c.id), new FormData())} className={botao("secundario", "sm")}>
            {pendente ? <Girando /> : <Send className="h-3.5 w-3.5" />} Tentar entregar de novo
          </button>
        </div>
      )}
      {respondendo && (
        <form className="mt-3 space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("id", c.id);
          const r = await executar(responderPeloPainel, fd);
          if (r.ok) setRespondendo(false);
        }}>
          <textarea name="texto" rows={3} required className={campo} placeholder="A informação, do jeito que você diria. A Marina ajusta o tom antes de mandar." />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRespondendo(false)} className={botao("fantasma", "sm")}>Fechar</button>
            <button disabled={pendente} className={botao("primario", "sm")}>{pendente ? <Girando /> : <Send className="h-3.5 w-3.5" />} Enviar ao cliente</button>
          </div>
        </form>
      )}
      {dialogo}
    </li>
  );
}

/* ── configuração ───────────────────────────────────────────────── */

function Min({ nome, rotulo, ajuda, valor }: { nome: string; rotulo: string; ajuda: string; valor: number }) {
  return (
    <Rotulo rotulo={rotulo} ajuda={ajuda}>
      <div className="flex items-center gap-2">
        <input type="number" name={nome} min={5} defaultValue={valor} className={campo + " max-w-32"} inputMode="numeric" />
        <span className="text-sm text-tinta-suave">minutos</span>
      </div>
    </Rotulo>
  );
}

function AbaConfig({ config }: { config: ConfigEscalonamento }) {
  const { executar, pendente } = useAcao();
  const [ativo, setAtivo] = useState(config.ativo);
  const [modo, setModo] = useState(config.whatsapp_modo);
  return (
    <form className="grid gap-6 lg:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      fd.set("ativo", ativo ? "on" : "off");
      fd.set("whatsapp_modo", modo);
      executar(salvarConfigEscalonamento, fd);
    }}>
      <Cartao titulo="Escalonamento" descricao="Quando a Marina não sabe, perguntar à equipe.">
        <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-linha/80 bg-fundo-suave px-4">
          <span className="text-sm font-medium text-tinta">{ativo ? "Ligado — a Marina pergunta à equipe" : "Desligado — só anota em Sem resposta"}</span>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)}
            className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors checked:bg-marca before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5" />
        </label>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Min nome="lembrete_min" rotulo="Lembrete para a equipe" ajuda="Depois do aviso, se ninguém respondeu." valor={config.lembrete_min} />
          <Min nome="proximo_min" rotulo="Passar para o próximo" ajuda="Depois do aviso, vai para a próxima pessoa." valor={config.proximo_min} />
          <Min nome="aviso_cliente_min" rotulo="Avisar o cliente que ainda está vendo" ajuda="Contado da pergunta do cliente." valor={config.aviso_cliente_min} />
          <Min nome="desistir_min" rotulo="Desistir e passar o contato da recepção" ajuda="Contado da pergunta do cliente." valor={config.desistir_min} />
        </div>
      </Cartao>
      <Cartao titulo="WhatsApp" descricao="Como o número da pousada está ligado ao OpenClaw.">
        <div className="space-y-2">
          {([["web", "Pelo aparelho (WhatsApp Web / OpenClaw)", "Sem limite de 24 horas. É o modo de hoje."],
            ["oficial", "API oficial da Meta (WhatsApp Business Platform)", "Mensagem livre só até 24 h depois da última mensagem da pessoa; depois disso, só template aprovado."]] as const).map(([v, t, a]) => (
            <label key={v} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", modo === v ? "border-marca bg-marca/5" : "border-linha/80 bg-white")}>
              <input type="radio" name="modo" checked={modo === v} onChange={() => setModo(v)} className="mt-1 h-4 w-4 accent-[var(--color-marca)]" />
              <span><span className="block text-sm font-medium text-tinta">{t}</span><span className="block text-xs text-tinta-suave">{a}</span></span>
            </label>
          ))}
        </div>
        {modo === "oficial" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Rotulo rotulo="Template para o cliente" ajuda="Nome do template aprovado na Meta, com 1 variável (o texto)."><input name="template_cliente" defaultValue={config.template_cliente ?? ""} className={campo} /></Rotulo>
            <Rotulo rotulo="Template para a equipe" ajuda="Idem, para avisos à equipe."><input name="template_equipe" defaultValue={config.template_equipe ?? ""} className={campo} /></Rotulo>
            <Rotulo rotulo="Idioma do template"><input name="template_idioma" defaultValue={config.template_idioma} className={campo} /></Rotulo>
          </div>
        )}
        <Aviso tom="info" className="mt-4">
          Os prazos rodam sozinhos quando alguém usa o chat ou a Marina, e pelo endereço <code className="font-mono text-xs">/api/cron/chamados</code> — para garantir, peça para um agendador chamá-lo a cada 5 minutos (ver o manual).
        </Aviso>
      </Cartao>
      <div className="lg:col-span-2 flex justify-end">
        <button disabled={pendente} className={botao("primario", "lg")}>{pendente && <Girando />} Salvar configuração</button>
      </div>
    </form>
  );
}

