"use client";

import { useId, useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Compass, Film, GripVertical, ImageIcon, Pencil, Plus, Trash2, X, FlaskConical, Check } from "lucide-react";
import type { Roteiro, Etapa } from "@/lib/roteiros";
import { EnviarMidia } from "@/components/admin/EnviarMidia";
import { Marcacao } from "@/components/site/Marcacao";
import { Aviso, Cartao, Rotulo, Selo, Vazio, botao, campo, cn } from "@/components/admin/ui";
import { Dialogo, Gaveta, Girando, useAcao, useConfirmar } from "@/components/admin/ui-cliente";
import { formatarDuracao } from "@/lib/midia-cliente";
import type { MidiaEscolha } from "./tipos";
import {
  salvarRoteiro, alternarRoteiro, excluirRoteiro, ordenarRoteiros,
  salvarEtapa, alternarEtapa, excluirEtapa, ordenarEtapas,
} from "./acoes-roteiros";

/**
 * Mídias de orientação: roteiros prontos que a Marina manda etapa por etapa
 * quando a pergunta bate com as palavras-chave. Ex.: "Como chegar" →
 * 1. trapiche de Paranaguá (vídeo) → 2. barco (vídeo) → 3. caminho até a
 * pousada (vídeo + foto da placa).
 */
export function AbaRoteiros({ roteiros, midias, blobOk }: { roteiros: Roteiro[]; midias: MidiaEscolha[]; blobOk: boolean }) {
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [testando, setTestando] = useState<Roteiro | null>(null);
  const atual = editando && editando !== "novo" ? roteiros.find((r) => r.id === editando) ?? null : null;

  return (
    <div className="space-y-5">
      <Cartao>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-marca/10 text-marca"><Compass className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-semibold text-tinta">Mídias de orientação</h2>
              <p className="mt-0.5 max-w-2xl text-sm text-tinta-suave">
                Roteiros com vídeo e foto que a Marina envia na ordem, quando alguém pergunta como chegar, onde pegar o barco, onde fica o restaurante.
                Ela escolhe o roteiro pelas palavras-chave.
              </p>
            </div>
          </div>
          <button onClick={() => setEditando("novo")} className={botao("primario", "md", "shrink-0")}><Plus className="h-4 w-4" /> Novo roteiro</button>
        </div>
      </Cartao>

      {roteiros.length === 0 ? (
        <Vazio icone={<Compass className="h-6 w-6 text-tinta-suave" />} titulo="Nenhum roteiro ainda"
          acao={<button onClick={() => setEditando("novo")} className={botao()}><Plus className="h-4 w-4" /> Criar o primeiro</button>}>
          Comece pelo “Como chegar à pousada”: grave um vídeo curto em cada ponto do caminho.
        </Vazio>
      ) : (
        <ListaRoteiros key={"lista:" + roteiros.map((r) => r.id).join()} roteiros={roteiros} editar={setEditando} testar={setTestando} />
      )}

      {editando && (
        <Editor key={`editor:${editando}:${atual ? "pronto" : "vazio"}`} roteiro={atual} midias={midias} blobOk={blobOk}
          criado={(id) => setEditando(id)} fechar={() => setEditando(null)} testar={setTestando} />
      )}
      {testando && <Teste roteiro={testando} fechar={() => setTestando(null)} />}
    </div>
  );
}

/* ── lista de roteiros ─────────────────────────────────────────── */

function ListaRoteiros({ roteiros, editar, testar }: { roteiros: Roteiro[]; editar: (id: string) => void; testar: (r: Roteiro) => void }) {
  const [ordem, setOrdem] = useState(roteiros.map((r) => r.id));
  const { executar } = useAcao();
  const sensores = useSensores();
  const idDnd = useId();
  const porId = new Map(roteiros.map((r) => [r.id, r]));

  const soltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const nova = arrayMove(ordem, ordem.indexOf(String(e.active.id)), ordem.indexOf(String(e.over.id)));
    setOrdem(nova);
    executar(() => ordenarRoteiros(nova), new FormData());
  };

  return (
    <DndContext id={idDnd} sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
      <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3">
          {ordem.map((id) => {
            const r = porId.get(id);
            return r ? <CartaoRoteiro key={id} r={r} editar={editar} testar={testar} /> : null;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function CartaoRoteiro({ r, editar, testar }: { r: Roteiro; editar: (id: string) => void; testar: (r: Roteiro) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: r.id });
  const { executar, pendente } = useAcao();
  const etapasVivas = r.etapas.filter((e) => e.ativo);
  const capas = etapasVivas.map((e) => e.video?.thumb_url ?? e.foto?.url).filter(Boolean).slice(0, 4) as string[];

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={cn("rounded-2xl border bg-white p-4 shadow-sm", isDragging ? "border-marca shadow-xl" : "border-linha/80", !r.ativo && "bg-fundo-suave")}>
      <div className="flex items-start gap-3">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Arrastar para reordenar"
          className="-ml-1 flex h-10 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-tinta-suave hover:bg-areia/60">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("font-semibold", r.ativo ? "text-tinta" : "text-tinta-suave")}>{r.titulo}</h3>
            <Selo tom={r.ativo ? "sucesso" : "neutro"} ponto>{r.ativo ? "Em uso" : "Desligado"}</Selo>
            <Selo>{etapasVivas.length} {etapasVivas.length === 1 ? "etapa" : "etapas"}</Selo>
          </div>
          {r.descricao && <p className="mt-0.5 text-sm text-tinta-suave">{r.descricao}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.gatilhos.slice(0, 8).map((g) => <span key={g} className="rounded-full bg-areia/70 px-2.5 py-0.5 text-xs text-tinta">{g}</span>)}
            {r.gatilhos.length > 8 && <span className="text-xs text-tinta-suave">+{r.gatilhos.length - 8}</span>}
          </div>
          {capas.length > 0 && (
            <div className="mt-3 flex gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {capas.map((c, i) => <img key={i} src={c} alt="" className="h-12 w-16 rounded-lg object-cover" loading="lazy" />)}
            </div>
          )}
          {r.ativo && etapasVivas.length === 0 && (
            <p className="mt-2 text-xs text-amber-800">Sem etapas ligadas: a Marina ainda não usa este roteiro.</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-linha/60 pt-3">
        <button onClick={() => editar(r.id)} className={botao("secundario", "sm")}><Pencil className="h-3.5 w-3.5" /> Editar</button>
        <button onClick={() => testar(r)} disabled={!r.ativo || !etapasVivas.length} className={botao("secundario", "sm")}><FlaskConical className="h-3.5 w-3.5" /> Testar</button>
        <button disabled={pendente} onClick={() => executar(() => alternarRoteiro(r.id, !r.ativo), new FormData())} className={botao("fantasma", "sm")}>
          {r.ativo ? "Desligar" : "Ligar"}
        </button>
      </div>
    </li>
  );
}

/* ── editor ──────────────────────────────────────────────────── */

function Editor({ roteiro, midias, blobOk, criado, fechar, testar }: {
  roteiro: Roteiro | null; midias: MidiaEscolha[]; blobOk: boolean;
  criado: (id: string) => void; fechar: () => void; testar: (r: Roteiro) => void;
}) {
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  const [gatilhos, setGatilhos] = useState<string[]>(roteiro?.gatilhos ?? []);
  const [novoGatilho, setNovoGatilho] = useState("");
  const [etapaAberta, setEtapaAberta] = useState<string | "nova" | null>(null);

  const adicionarGatilho = () => {
    const partes = novoGatilho.split(/[,;\n]+/).map((g) => g.trim()).filter(Boolean);
    if (partes.length) setGatilhos((g) => [...g, ...partes.filter((p) => !g.some((x) => x.toLowerCase() === p.toLowerCase()))]);
    setNovoGatilho("");
  };

  return (
    <Gaveta titulo={roteiro ? roteiro.titulo : "Novo roteiro"} descricao={roteiro ? "Roteiro de orientação" : "Primeiro o nome e as palavras-chave; depois as etapas."} aoFechar={fechar}
      rodape={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {roteiro ? (
            <button className={botao("fantasma", "md", "text-red-700 hover:bg-red-50")} onClick={async () => {
              if (await confirmar({ titulo: "Excluir este roteiro?", texto: "A Marina deixa de usar. As etapas somem; os vídeos e fotos continuam na biblioteca.", confirmar: "Excluir", perigo: true })) {
                const r = await executar(() => excluirRoteiro(roteiro.id), new FormData());
                if (r.ok) fechar();
              }
            }}><Trash2 className="h-4 w-4" /> Excluir roteiro</button>
          ) : <span />}
          <button form="form-roteiro" disabled={pendente} className={botao()}>{pendente && <Girando />} {roteiro ? "Salvar" : "Criar e adicionar etapas"}</button>
        </div>
      }>
      <form id="form-roteiro" className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const pendenteDigitado = novoGatilho.trim();
        fd.set("gatilhos", [...gatilhos, ...(pendenteDigitado ? [pendenteDigitado] : [])].join("\n"));
        if (roteiro) fd.set("id", roteiro.id);
        fd.set("ativo", roteiro && !roteiro.ativo ? "off" : "on");
        const r = (await executar(salvarRoteiro, fd)) as { ok: boolean; id?: string };
        if (pendenteDigitado && r.ok) { setGatilhos((g) => [...g, pendenteDigitado]); setNovoGatilho(""); }
        if (r.ok && !roteiro && r.id) criado(r.id);
      }}>
        <Rotulo rotulo="Nome do roteiro" obrigatorio>
          <input name="titulo" required defaultValue={roteiro?.titulo ?? ""} placeholder="Ex.: Como chegar à pousada" className={campo} maxLength={160} />
        </Rotulo>
        <Rotulo rotulo="Descrição" ajuda="Para você lembrar do que se trata. A Marina também lê.">
          <input name="descricao" defaultValue={roteiro?.descricao ?? ""} placeholder="Do estacionamento em Paranaguá até a recepção" className={campo} maxLength={500} />
        </Rotulo>
        <div>
          <p className="text-sm font-medium text-tinta">Palavras-chave <span className="text-red-600">*</span></p>
          <p className="text-xs text-tinta-suave">O que as pessoas escrevem quando precisam deste roteiro. Quanto mais jeitos de perguntar, melhor.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {gatilhos.map((g) => (
              <span key={g} className="inline-flex items-center gap-1 rounded-full bg-marca/10 py-1 pl-3 pr-1 text-sm text-tinta">
                {g}
                <button type="button" aria-label={`Tirar ${g}`} onClick={() => setGatilhos((x) => x.filter((y) => y !== g))}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-marca/20"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={novoGatilho} onChange={(e) => setNovoGatilho(e.target.value)} placeholder="como chegar, onde pego o barco, trapiche…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarGatilho(); } }}
              className={campo} aria-label="Nova palavra-chave" />
            <button type="button" onClick={adicionarGatilho} className={botao("secundario", "md", "shrink-0")}><Plus className="h-4 w-4" /> Pôr</button>
          </div>
        </div>
      </form>

      {roteiro && (
        <section className="mt-8 space-y-3 border-t border-linha/70 pt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-tinta">Etapas</h3>
              <p className="text-xs text-tinta-suave">A Marina manda nesta ordem. Arraste para trocar.</p>
            </div>
            {roteiro.etapas.some((e) => e.ativo) && roteiro.ativo && (
              <button onClick={() => testar(roteiro)} className={botao("secundario", "sm")}><FlaskConical className="h-3.5 w-3.5" /> Testar</button>
            )}
          </div>

          {roteiro.etapas.length === 0 && etapaAberta !== "nova" && (
            <Aviso tom="info">Nenhuma etapa ainda. Cada etapa é um ponto do caminho: um vídeo, uma foto opcional e uma frase.</Aviso>
          )}

          <ListaEtapas key={roteiro.etapas.map((e) => e.id + e.ativo).join()} roteiro={roteiro} midias={midias} blobOk={blobOk}
            aberta={etapaAberta} abrir={setEtapaAberta} />

          {etapaAberta === "nova" ? (
            <FormEtapa roteiroId={roteiro.id} etapa={null} numero={roteiro.etapas.length + 1} midias={midias} blobOk={blobOk} fechar={() => setEtapaAberta(null)} />
          ) : (
            <button onClick={() => setEtapaAberta("nova")} className={botao("secundario", "md", "w-full border-dashed")}><Plus className="h-4 w-4" /> Adicionar etapa</button>
          )}
        </section>
      )}
      {dialogo}
    </Gaveta>
  );
}

function ListaEtapas({ roteiro, midias, blobOk, aberta, abrir }: {
  roteiro: Roteiro; midias: MidiaEscolha[]; blobOk: boolean; aberta: string | null; abrir: (id: string | null) => void;
}) {
  const [ordem, setOrdem] = useState(roteiro.etapas.map((e) => e.id));
  const { executar } = useAcao();
  const sensores = useSensores();
  const idDnd = useId();
  const porId = new Map(roteiro.etapas.map((e) => [e.id, e]));

  const soltar = (ev: DragEndEvent) => {
    if (!ev.over || ev.active.id === ev.over.id) return;
    const nova = arrayMove(ordem, ordem.indexOf(String(ev.active.id)), ordem.indexOf(String(ev.over.id)));
    setOrdem(nova);
    executar(() => ordenarEtapas(nova), new FormData());
  };

  return (
    <DndContext id={idDnd} sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
      <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {ordem.map((id, i) => {
            const e = porId.get(id);
            if (!e) return null;
            return aberta === id
              ? <li key={id}><FormEtapa roteiroId={roteiro.id} etapa={e} numero={i + 1} midias={midias} blobOk={blobOk} fechar={() => abrir(null)} /></li>
              : <LinhaEtapa key={id} e={e} numero={i + 1} editar={() => abrir(id)} />;
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function LinhaEtapa({ e, numero, editar }: { e: Etapa; numero: number; editar: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: e.id });
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  const capa = e.video?.thumb_url ?? e.foto?.url;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={cn("flex items-center gap-2 rounded-xl border bg-white p-2", isDragging ? "border-marca shadow-lg" : "border-linha/80", !e.ativo && "opacity-60")}>
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Arrastar etapa"
        className="flex h-10 w-7 shrink-0 touch-none items-center justify-center rounded-lg text-tinta-suave hover:bg-areia/60"><GripVertical className="h-4 w-4" /></button>
      <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-tinta-suave">{numero}</span>
      <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-areia">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {capa ? <img src={capa} alt="" className="h-full w-full object-cover" /> : <Compass className="m-auto mt-3.5 h-5 w-5 text-tinta-suave" />}
        {e.video?.duracao_seg ? <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] text-white">{formatarDuracao(e.video.duracao_seg)}</span> : null}
      </span>
      <button onClick={editar} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-tinta">{e.titulo ?? `Etapa ${numero}`}</span>
        <span className="flex items-center gap-2 text-xs text-tinta-suave">
          {e.video && <span className="inline-flex items-center gap-0.5"><Film className="h-3 w-3" /> vídeo</span>}
          {e.foto && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3 w-3" /> foto</span>}
          {e.texto && <span className="truncate">{e.texto}</span>}
          {e.video && !e.video.url_whatsapp && <span className="shrink-0 text-amber-700">· vai como link no WhatsApp</span>}
        </span>
      </button>
      <button disabled={pendente} onClick={() => executar(() => alternarEtapa(e.id, !e.ativo), new FormData())}
        className={botao("fantasma", "sm", "hidden sm:inline-flex")}>{e.ativo ? "Desligar" : "Ligar"}</button>
      <button onClick={editar} aria-label="Editar etapa" className={botao("fantasma", "sm", "h-9 w-9 px-0")}><Pencil className="h-4 w-4" /></button>
      <button aria-label="Excluir etapa" className={botao("fantasma", "sm", "h-9 w-9 px-0 text-red-700 hover:bg-red-50")} onClick={async () => {
        if (await confirmar({ titulo: "Excluir esta etapa?", texto: "A mídia continua na biblioteca.", confirmar: "Excluir", perigo: true })) executar(() => excluirEtapa(e.id), new FormData());
      }}><Trash2 className="h-4 w-4" /></button>
      {dialogo}
    </li>
  );
}

function FormEtapa({ roteiroId, etapa, numero, midias, blobOk, fechar }: {
  roteiroId: string; etapa: Etapa | null; numero: number; midias: MidiaEscolha[]; blobOk: boolean; fechar: () => void;
}) {
  const { executar, pendente } = useAcao();
  const [videoId, setVideoId] = useState(etapa?.video?.id ?? "");
  const [fotoId, setFotoId] = useState(etapa?.foto?.id ?? "");
  const [ativo, setAtivo] = useState(etapa?.ativo ?? true);

  return (
    <form className="space-y-4 rounded-2xl border-2 border-marca/40 bg-fundo-suave p-4" onSubmit={async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.currentTarget);
      fd.set("roteiro_id", roteiroId);
      if (etapa) fd.set("id", etapa.id);
      fd.set("video_id", videoId);
      fd.set("foto_id", fotoId);
      fd.set("ativo", ativo ? "on" : "off");
      const r = await executar(salvarEtapa, fd);
      if (r.ok) fechar();
    }}>
      <p className="text-sm font-semibold text-tinta">{etapa ? `Etapa ${numero}` : `Nova etapa (${numero}ª)`}</p>
      <Rotulo rotulo="Título da etapa" ajuda="Ex.: Estacionamento em Paranaguá, No barco, Chegando na pousada.">
        <input name="titulo" defaultValue={etapa?.titulo ?? ""} className={campo} maxLength={160} />
      </Rotulo>
      <EscolherMidia tipo="video" rotulo="Vídeo" valor={videoId} mudar={setVideoId} midias={midias} blobOk={blobOk} />
      <EscolherMidia tipo="foto" rotulo="Foto (opcional)" valor={fotoId} mudar={setFotoId} midias={midias} blobOk={blobOk} />
      <Rotulo rotulo="Texto que a Marina manda junto" ajuda="Curto e prático: o que a pessoa faz neste ponto.">
        <textarea name="texto" rows={3} defaultValue={etapa?.texto ?? ""} className={campo} maxLength={2000}
          placeholder="Do estacionamento, siga a placa azul até o trapiche. O barco sai de hora em hora." />
      </Rotulo>
      <label className="flex min-h-11 items-center gap-3 text-sm text-tinta">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-5 w-5 accent-[var(--color-marca)]" />
        Etapa ligada (a Marina envia)
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={fechar} className={botao("fantasma")}>Cancelar</button>
        <button disabled={pendente} className={botao()}>{pendente ? <Girando /> : <Check className="h-4 w-4" />} {etapa ? "Salvar etapa" : "Adicionar"}</button>
      </div>
    </form>
  );
}

/** Escolhe da biblioteca (orientação primeiro) ou envia na hora — da câmera inclusive. */
function EscolherMidia({ tipo, rotulo, valor, mudar, midias, blobOk }: {
  tipo: "foto" | "video"; rotulo: string; valor: string; mudar: (id: string) => void; midias: MidiaEscolha[]; blobOk: boolean;
}) {
  const [aberto, setAberto] = useState<"lista" | "enviar" | null>(null);
  const opcoes = midias.filter((m) => m.tipo === tipo)
    .sort((a, b) => Number(b.secao === "orientacao") - Number(a.secao === "orientacao"));
  const escolhida = opcoes.find((m) => m.id === valor);
  const Icone = tipo === "video" ? Film : ImageIcon;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-tinta">{rotulo}</p>
      {escolhida ? (
        <div className="flex items-center gap-3 rounded-xl border border-linha/80 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {escolhida.capa ? <img src={escolhida.capa} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <span className="flex h-14 w-20 items-center justify-center rounded-lg bg-areia"><Icone className="h-5 w-5 text-tinta-suave" /></span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-tinta">{escolhida.titulo ?? escolhida.alt}</span>
            {escolhida.duracao_seg ? <span className="text-xs text-tinta-suave">{formatarDuracao(escolhida.duracao_seg)}</span> : null}
          </span>
          <button type="button" onClick={() => setAberto("lista")} className={botao("fantasma", "sm")}>Trocar</button>
          <button type="button" onClick={() => mudar("")} aria-label="Tirar" className={botao("fantasma", "sm", "h-9 w-9 px-0")}><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAberto("enviar")} className={botao("secundario", "md")}><Plus className="h-4 w-4" /> {tipo === "video" ? "Gravar ou enviar" : "Tirar ou enviar"}</button>
          <button type="button" onClick={() => setAberto("lista")} disabled={!opcoes.length} className={botao("secundario", "md")}><Icone className="h-4 w-4" /> Da biblioteca</button>
        </div>
      )}
      {aberto === "enviar" && (
        <div className="mt-2">
          <EnviarMidia album="secao:orientacao" aceitar={tipo} configurado={blobOk} compacto
            aoConcluir={(ids) => { if (ids[0]) { mudar(ids[0]); setAberto(null); } }} />
        </div>
      )}
      {aberto === "lista" && (
        <Dialogo titulo={tipo === "video" ? "Escolher vídeo" : "Escolher foto"} aoFechar={() => setAberto(null)}>
          <ul className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {opcoes.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { mudar(m.id); setAberto(null); }}
                  className={cn("block w-full overflow-hidden rounded-xl border text-left", m.id === valor ? "border-marca ring-2 ring-marca" : "border-linha/80")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.capa ? <img src={m.capa} alt="" className="aspect-video w-full object-cover" loading="lazy" /> : <span className="flex aspect-video items-center justify-center bg-areia"><Icone className="h-5 w-5" /></span>}
                  <span className="block truncate px-2 py-1.5 text-xs text-tinta">{m.titulo ?? m.alt}</span>
                  <span className="block truncate px-2 pb-1.5 text-[10px] text-tinta-suave">{m.album}</span>
                </button>
              </li>
            ))}
          </ul>
        </Dialogo>
      )}
    </div>
  );
}

/* ── teste ──────────────────────────────────────────────────── */

/**
 * Pergunta à Marina com a primeira palavra-chave, pelo mesmo caminho da aba
 * Testar (mesmo treinamento, mesmos códigos), e mostra a resposta como o
 * hóspede veria — com os vídeos tocando.
 */
function Teste({ roteiro, fechar }: { roteiro: Roteiro; fechar: () => void }) {
  const [pergunta, setPergunta] = useState(roteiro.gatilhos[0] ? `Oi! ${roteiro.gatilhos[0]}?` : roteiro.titulo);
  const [estado, setEstado] = useState<{ carregando: boolean; resposta?: string; erro?: string; usou?: boolean }>({ carregando: false });

  const perguntar = async () => {
    setEstado({ carregando: true });
    try {
      const r = await fetch("/api/admin/marina/teste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mensagem: pergunta }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "falhou");
      setEstado({ carregando: false, resposta: d.resposta, usou: (d.fontes ?? []).some((f: { id: string }) => f.id === roteiro.id) });
    } catch (e) {
      setEstado({ carregando: false, erro: (e as Error).message });
    }
  };

  return (
    <Dialogo titulo={`Testar “${roteiro.titulo}”`} aoFechar={fechar}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} className={campo} aria-label="Pergunta"
            onKeyDown={(e) => { if (e.key === "Enter") perguntar(); }} />
          <button onClick={perguntar} disabled={estado.carregando || !pergunta.trim()} className={botao("primario", "md", "shrink-0")}>
            {estado.carregando ? <Girando /> : "Perguntar"}
          </button>
        </div>
        {estado.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
        {estado.resposta && (
          <>
            <div className="max-h-[55vh] overflow-y-auto rounded-2xl rounded-bl-md border border-linha/70 bg-white px-4 py-3 text-sm leading-relaxed text-tinta">
              <Marcacao texto={estado.resposta} />
            </div>
            {estado.usou
              ? <Aviso tom="sucesso">A Marina usou este roteiro.</Aviso>
              : <Aviso tom="aviso">A Marina não citou este roteiro. Acrescente palavras-chave parecidas com a pergunta.</Aviso>}
          </>
        )}
        <p className="text-xs text-tinta-suave">É o mesmo teste da aba Testar: nada disto vai para um hóspede.</p>
      </div>
    </Dialogo>
  );
}

function useSensores() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
