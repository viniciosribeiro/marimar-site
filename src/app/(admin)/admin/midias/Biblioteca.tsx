"use client";

import { useId, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search, Star, Play, GripVertical, Check, Images, Film, Trash2, FolderInput, X, Upload, MessageCircleHeart, Globe, Info,
} from "lucide-react";
import type { Album, MidiaBiblioteca } from "@/lib/biblioteca";
import { formatarBytes, formatarDuracao } from "@/lib/midia-cliente";
import { tituloQuarto } from "@/lib/format";
import { EnviarMidia } from "@/components/admin/EnviarMidia";
import { Aviso, Rotulo, Selo, Vazio, botao, campo, cn } from "@/components/admin/ui";
import { Gaveta, Girando, useAcao, useConfirmar, avisar } from "@/components/admin/ui-cliente";
import { editarMidia, definirCapa, reordenar, moverLote, excluirLote } from "./actions";

type Filtro = "tudo" | "foto" | "video" | "sem-uso" | "sem-legenda";

const albumDe = (m: MidiaBiblioteca) => (m.quarto_id ? `quarto:${m.quarto_id}` : `secao:${m.secao}`);
const nomeAlbum = (a: Album) => (a.chave.startsWith("quarto:") ? tituloQuarto(a.nome) : a.nome);

/**
 * Biblioteca de mídia.
 *
 * Pensada para quem nunca mexeu num sistema: escolhe o álbum (onde a mídia
 * aparece), envia pelo celular ou computador, arrasta para ordenar, toca na
 * estrela para escolher a capa. Tudo o mais fica na gaveta de detalhes.
 */
export function Biblioteca({ midias, albuns, albumInicial, blobOk }: {
  midias: MidiaBiblioteca[]; albuns: Album[]; albumInicial: string; blobOk: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [album, setAlbum] = useState(albuns.some((a) => a.chave === albumInicial) ? albumInicial : "todas");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [aberta, setAberta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const trocarAlbum = (a: string) => {
    setAlbum(a);
    setSelecao(new Set());
    router.replace(`${pathname}?album=${encodeURIComponent(a)}`, { scroll: false });
  };

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return midias.filter((m) => {
      if (album !== "todas" && albumDe(m) !== album) return false;
      if (filtro === "foto" && m.tipo !== "foto") return false;
      if (filtro === "video" && m.tipo !== "video") return false;
      if (filtro === "sem-uso" && m.usos.length) return false;
      if (filtro === "sem-legenda" && (m.descricao || (m.alt && !/^(foto|vídeo) da pousada marimar$/i.test(m.alt)))) return false;
      if (!q) return true;
      return [m.titulo, m.descricao, m.alt].some((t) => t?.toLowerCase().includes(q));
    });
  }, [midias, album, busca, filtro]);

  /* Reordenar só faz sentido dentro de um álbum, sem filtro de busca. As
     fotos e os vídeos têm ordens separadas (a sequência de vídeos da suíte
     — entrada, interior, banheiro, vista — não se mistura com as fotos). */
  const podeOrdenar = album !== "todas" && !busca && (filtro === "foto" || filtro === "video" || filtro === "tudo");
  const albumAtual = albuns.find((a) => a.chave === album);
  const midiaAberta = midias.find((m) => m.id === aberta) ?? null;

  const grupos = [
    { titulo: "Site", itens: albuns.filter((a) => a.chave.startsWith("secao:") && a.chave !== "secao:orientacao") },
    { titulo: "Suítes", itens: albuns.filter((a) => a.chave.startsWith("quarto:")) },
    { titulo: "Marina", itens: albuns.filter((a) => a.chave === "secao:orientacao") },
  ];

  const alternar = (id: string) => setSelecao((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      {/* ── álbuns ── */}
      <nav aria-label="Álbuns" className="lg:sticky lg:top-6 lg:self-start">
        <label className="lg:hidden">
          <span className="mb-1 block text-xs font-medium text-tinta-suave">Álbum</span>
          <select value={album} onChange={(e) => trocarAlbum(e.target.value)} className={campo + " min-h-12 text-base"}>
            <option value="todas">Todas as mídias ({midias.length})</option>
            {grupos.map((g) => (
              <optgroup key={g.titulo} label={g.titulo}>
                {g.itens.map((a) => <option key={a.chave} value={a.chave}>{nomeAlbum(a)} ({a.total})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="hidden space-y-4 lg:block">
          <BotaoAlbum ativo={album === "todas"} onClick={() => trocarAlbum("todas")} nome="Todas as mídias" total={midias.length} />
          {grupos.map((g) => (
            <div key={g.titulo}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-tinta-suave">{g.titulo}</p>
              <div className="space-y-0.5">
                {g.itens.map((a) => (
                  <BotaoAlbum key={a.chave} ativo={album === a.chave} onClick={() => trocarAlbum(a.chave)}
                    nome={nomeAlbum(a)} total={a.total} capa={a.capa} apagado={a.quartoAtivo === false} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className={cn("min-w-0 space-y-4", selecao.size > 0 && "pb-40 lg:pb-0")}>
        {/* ── cabeçalho do álbum + enviar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-tinta">{albumAtual ? nomeAlbum(albumAtual) : "Todas as mídias"}</h2>
            <p className="text-xs text-tinta-suave">{albumAtual?.descricao ?? "Escolha um álbum para enviar e ordenar."}</p>
          </div>
          {album !== "todas" && (
            <button onClick={() => setEnviando((v) => !v)} className={botao(enviando ? "secundario" : "primario", "md", "shrink-0")}>
              {enviando ? <><X className="h-4 w-4" /> Fechar envio</> : <><Upload className="h-4 w-4" /> Enviar fotos e vídeos</>}
            </button>
          )}
        </div>

        {album !== "todas" && enviando && (
          <EnviarMidia album={album} configurado={blobOk} />
        )}
        {album === "todas" && (
          <Aviso tom="info">Para enviar ou ordenar, escolha primeiro o álbum — é ele que diz onde a mídia vai aparecer.</Aviso>
        )}

        {/* ── busca e filtros ── */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-suave" />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título ou legenda…" className={campo + " pl-10"} />
          </label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 [scrollbar-width:none]">
            {([["tudo", "Tudo"], ["foto", "Fotos"], ["video", "Vídeos"], ["sem-legenda", "Sem legenda"], ["sem-uso", "Sem uso"]] as const).map(([v, r]) => (
              <button key={v} onClick={() => setFiltro(v)} aria-pressed={filtro === v}
                className={cn("min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium",
                  filtro === v ? "border-marca bg-marca text-marca-texto" : "border-linha bg-white text-tinta-suave hover:text-tinta")}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {podeOrdenar && lista.length > 1 && (
          <p className="flex items-center gap-1.5 text-xs text-tinta-suave">
            <GripVertical className="h-3.5 w-3.5" /> Arraste pela alça para mudar a ordem. Fotos e vídeos têm ordens separadas.
          </p>
        )}

        {selecao.size > 0 && <BarraLote ids={[...selecao]} albuns={albuns} limpar={() => setSelecao(new Set())} />}

        {/* ── grade ── */}
        {lista.length === 0 ? (
          <Vazio icone={<Images className="h-6 w-6 text-tinta-suave" />} titulo={busca || filtro !== "tudo" ? "Nada encontrado" : "Este álbum está vazio"}
            acao={album !== "todas" && !enviando ? <button onClick={() => setEnviando(true)} className={botao()}><Upload className="h-4 w-4" /> Enviar agora</button> : undefined}>
            {busca || filtro !== "tudo" ? "Tente outra palavra ou outro filtro." : "Envie fotos e vídeos pelo celular ou pelo computador."}
          </Vazio>
        ) : podeOrdenar ? (
          <GradeOrdenavel key={album + lista.map((m) => m.id).join()} lista={lista} selecao={selecao} alternar={alternar} abrir={setAberta} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {lista.map((m) => <Cartao key={m.id} m={m} selecionada={selecao.has(m.id)} alternar={alternar} abrir={setAberta} />)}
          </ul>
        )}
      </div>

      {midiaAberta && <Detalhe m={midiaAberta} albuns={albuns} fechar={() => setAberta(null)} />}
    </div>
  );
}

function BotaoAlbum({ ativo, onClick, nome, total, capa, apagado }: {
  ativo: boolean; onClick: () => void; nome: string; total: number; capa?: string | null; apagado?: boolean;
}) {
  return (
    <button onClick={onClick} aria-current={ativo ? "true" : undefined}
      className={cn("flex w-full min-h-10 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors",
        ativo ? "bg-marca text-marca-texto" : "text-tinta hover:bg-areia/60", apagado && !ativo && "opacity-60")}>
      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-areia">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {capa && <img src={capa} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{nome}</span>
      <span className={cn("text-xs tabular-nums", ativo ? "text-marca-texto/80" : "text-tinta-suave")}>{total}</span>
    </button>
  );
}

function GradeOrdenavel({ lista, selecao, alternar, abrir }: {
  lista: MidiaBiblioteca[]; selecao: Set<string>; alternar: (id: string) => void; abrir: (id: string) => void;
}) {
  const [ordem, setOrdem] = useState(lista.map((m) => m.id));
  /* id estável: sem ele o dnd-kit gera ids diferentes no servidor e no navegador. */
  const idDnd = useId();
  const { executar } = useAcao();
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const porId = new Map(lista.map((m) => [m.id, m]));

  const soltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = ordem.indexOf(String(e.active.id));
    const para = ordem.indexOf(String(e.over.id));
    const nova = arrayMove(ordem, de, para);
    setOrdem(nova);
    /* Fotos e vídeos: ordens separadas — grava cada tipo na sua sequência. */
    const fotos = nova.filter((id) => porId.get(id)?.tipo === "foto");
    const videos = nova.filter((id) => porId.get(id)?.tipo === "video");
    executar(async () => {
      await reordenar(fotos);
      return reordenar(videos);
    }, new FormData());
  };

  return (
    <DndContext id={idDnd} sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
      <SortableContext items={ordem} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {ordem.map((id) => {
            const m = porId.get(id);
            return m ? <CartaoOrdenavel key={id} m={m} selecionada={selecao.has(id)} alternar={alternar} abrir={abrir} /> : null;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function CartaoOrdenavel(p: { m: MidiaBiblioteca; selecionada: boolean; alternar: (id: string) => void; abrir: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.m.id });
  return (
    <Cartao {...p} refNo={setNodeRef}
      estilo={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      arrastando={isDragging}
      alca={
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" aria-label="Arrastar para reordenar"
          className="flex h-10 w-10 touch-none items-center justify-center rounded-xl bg-white/90 text-tinta shadow-sm backdrop-blur hover:bg-white">
          <GripVertical className="h-4 w-4" />
        </button>
      } />
  );
}

function Cartao({ m, selecionada, alternar, abrir, alca, refNo, estilo, arrastando }: {
  m: MidiaBiblioteca; selecionada: boolean; alternar: (id: string) => void; abrir: (id: string) => void;
  alca?: React.ReactNode; refNo?: (el: HTMLElement | null) => void; estilo?: React.CSSProperties; arrastando?: boolean;
}) {
  const { executar } = useAcao();
  const imagem = m.tipo === "video" ? m.thumb_url : m.url;
  return (
    <li ref={refNo} style={estilo}
      className={cn("group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow",
        selecionada ? "border-marca ring-2 ring-marca" : "border-linha/80", arrastando && "shadow-2xl ring-2 ring-marca/50")}>
      <button type="button" onClick={() => abrir(m.id)} className="relative block aspect-square w-full bg-areia" aria-label={`Abrir ${m.titulo ?? m.alt}`}>
        {imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagem} alt={m.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-tinta-suave"><Film className="h-8 w-8" /></span>
        )}
        {m.tipo === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tinta/70 text-white"><Play className="h-5 w-5 translate-x-0.5" fill="currentColor" /></span>
          </span>
        )}
        <span className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pb-2 pl-2.5 pt-8 text-left", alca ? "pr-14" : "pr-2.5")}>
          <span className="block truncate text-xs font-medium text-white">{m.titulo || m.descricao || m.alt}</span>
          {m.tipo === "video" && m.duracao_seg ? <span className="text-[11px] text-white/80">{formatarDuracao(m.duracao_seg)}</span> : null}
        </span>
      </button>

      {/* seleção */}
      <button type="button" onClick={() => alternar(m.id)} aria-pressed={selecionada} aria-label={selecionada ? "Tirar da seleção" : "Selecionar"}
        className={cn("absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-sm transition-opacity",
          selecionada ? "border-marca bg-marca text-marca-texto" : "border-white bg-black/25 text-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100")}>
        <Check className="h-4 w-4" />
      </button>

      {/* capa */}
      {m.tipo === "foto" && (
        <button type="button" onClick={() => { const f = new FormData(); executar(() => definirCapa(m.id), f); }}
          aria-label={m.destaque ? "É a capa (tocar para remover)" : "Definir como capa"} title={m.destaque ? "Capa" : "Definir como capa"}
          className={cn("absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full shadow-sm",
            m.destaque ? "bg-amber-400 text-white" : "bg-black/25 text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100")}>
          <Star className="h-4 w-4" fill={m.destaque ? "currentColor" : "none"} />
        </button>
      )}
      {alca && <span className="absolute bottom-2 right-2">{alca}</span>}
    </li>
  );
}

function BarraLote({ ids, albuns, limpar }: { ids: string[]; albuns: Album[]; limpar: () => void }) {
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  const [destino, setDestino] = useState("");
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-linha/80 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur lg:sticky lg:top-4 lg:bottom-auto lg:rounded-2xl lg:border lg:py-2.5 lg:shadow-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-full text-sm font-semibold text-tinta sm:mr-auto sm:w-auto">{ids.length} {ids.length === 1 ? "selecionada" : "selecionadas"}</span>
        <select value={destino} onChange={(e) => setDestino(e.target.value)} className={cn(campo, "min-h-10 w-auto min-w-0 basis-full py-2 text-sm sm:max-w-60 sm:basis-auto")} aria-label="Mover para">
          <option value="">Mover para…</option>
          {albuns.map((a) => <option key={a.chave} value={a.chave}>{a.chave.startsWith("quarto:") ? `Suíte ${tituloQuarto(a.nome)}` : a.nome}</option>)}
        </select>
        <button disabled={!destino || pendente} onClick={async () => { const r = await executar(() => moverLote(ids, destino), new FormData()); if (r.ok) limpar(); }}
          className={botao("secundario", "md", "flex-1 sm:flex-none")}><FolderInput className="h-4 w-4" /> Mover</button>
        <button disabled={pendente} onClick={async () => {
          if (await confirmar({ titulo: `Excluir ${ids.length === 1 ? "esta mídia" : `${ids.length} mídias`}?`, texto: "Somem do site e a Marina deixa de enviar. Os arquivos são apagados e não dá para desfazer.", confirmar: "Excluir", perigo: true })) {
            const r = await executar(() => excluirLote(ids), new FormData());
            if (r.ok) limpar();
          }
        }} className={botao("perigo", "md", "flex-1 sm:flex-none")}><Trash2 className="h-4 w-4" /> Excluir</button>
        <button onClick={limpar} className={botao("fantasma", "md")} aria-label="Limpar seleção"><X className="h-4 w-4" /></button>
      </div>
      {dialogo}
    </div>
  );
}

function Detalhe({ m, albuns, fechar }: { m: MidiaBiblioteca; albuns: Album[]; fechar: () => void }) {
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  const [destino, setDestino] = useState(albumDe(m));
  const cabeNoZap = m.tipo === "video" && (m.url_whatsapp || ((m.bytes ?? Infinity) <= 15.5 * 1024 * 1024 && /mp4/.test(m.formato ?? "")));

  return (
    <Gaveta titulo={m.tipo === "video" ? "Vídeo" : "Foto"} descricao={m.titulo ?? undefined} aoFechar={fechar}
      rodape={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button className={botao("fantasma", "md", "text-red-700 hover:bg-red-50")} onClick={async () => {
            if (await confirmar({ titulo: "Excluir esta mídia?", texto: "Some do site e a Marina deixa de enviar. O arquivo é apagado e não dá para desfazer.", confirmar: "Excluir", perigo: true })) {
              const r = await executar(() => excluirLote([m.id]), new FormData());
              if (r.ok) fechar();
            }
          }}><Trash2 className="h-4 w-4" /> Excluir</button>
          <button form="form-midia" disabled={pendente} className={botao()}>{pendente && <Girando />} Salvar</button>
        </div>
      }>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl bg-tinta">
          {m.tipo === "video" ? (
            <video src={m.url} poster={m.thumb_url ?? undefined} controls playsInline preload="metadata" className="max-h-[50vh] w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt={m.alt} className="max-h-[50vh] w-full object-contain" />
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Selo>{m.tipo === "video" ? "Vídeo" : "Foto"}</Selo>
          {m.largura && m.altura ? <Selo>{m.largura}×{m.altura}</Selo> : null}
          {m.duracao_seg ? <Selo>{formatarDuracao(m.duracao_seg)}</Selo> : null}
          {m.bytes ? <Selo>{formatarBytes(m.bytes)}</Selo> : null}
          {m.destaque && <Selo tom="aviso">Capa</Selo>}
          {m.tipo === "video" && (cabeNoZap
            ? <Selo tom="sucesso" title="A Marina consegue enviar este vídeo no WhatsApp">WhatsApp ok{m.bytes_whatsapp ? ` (${formatarBytes(m.bytes_whatsapp)})` : ""}</Selo>
            : <Selo tom="aviso" title="Sem versão até 16 MB: a Marina manda o link da página">WhatsApp: vai como link</Selo>)}
        </div>

        <form id="form-midia" className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("id", m.id);
          await executar(editarMidia, fd);
        }}>
          <Rotulo rotulo="Título" ajuda={m.tipo === "video" ? "Ex.: Entrada, Interior, Banheiro, Vista da varanda." : "Opcional."}>
            <input name="titulo" defaultValue={m.titulo ?? ""} className={campo} maxLength={200} />
          </Rotulo>
          <Rotulo rotulo="Legenda" ajuda="Aparece junto da mídia no site e a Marina usa ao enviar.">
            <textarea name="descricao" rows={2} defaultValue={m.descricao ?? ""} className={campo} maxLength={1000} />
          </Rotulo>
          <Rotulo rotulo="Texto alternativo" obrigatorio ajuda="Descreva o que se vê, para quem usa leitor de tela e para o Google.">
            <input name="alt" required defaultValue={m.alt} className={campo} maxLength={300} />
          </Rotulo>
          <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-linha/80 bg-white px-4">
            <span className="text-sm text-tinta">A Marina pode enviar</span>
            <input type="checkbox" name="visivel_marina" defaultChecked={m.visivel_marina}
              className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors checked:bg-marca before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5" />
          </label>
        </form>

        {m.tipo === "foto" && (
          <button onClick={() => executar(() => definirCapa(m.id), new FormData())} className={botao(m.destaque ? "secundario" : "suave", "md", "w-full")}>
            <Star className="h-4 w-4" fill={m.destaque ? "currentColor" : "none"} /> {m.destaque ? "Remover da capa" : "Usar como capa do álbum"}
          </button>
        )}

        <div className="rounded-2xl border border-linha/80 bg-white p-4">
          <p className="text-sm font-semibold text-tinta">Mover para outro álbum</p>
          <div className="mt-2 flex gap-2">
            <select value={destino} onChange={(e) => setDestino(e.target.value)} className={campo} aria-label="Álbum">
              {albuns.map((a) => <option key={a.chave} value={a.chave}>{a.chave.startsWith("quarto:") ? `Suíte ${tituloQuarto(a.nome)}` : a.nome}</option>)}
            </select>
            <button disabled={destino === albumDe(m) || pendente} onClick={() => executar(() => moverLote([m.id], destino), new FormData())}
              className={botao("secundario", "md", "shrink-0")}>Mover</button>
          </div>
        </div>

        <div className="rounded-2xl border border-linha/80 bg-white p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-tinta"><Info className="h-4 w-4" /> Onde é usada</p>
          {m.usos.length === 0 ? (
            <p className="mt-1 text-sm text-tinta-suave">Em nenhum lugar ainda. Mova para uma suíte ou seção, ou use num roteiro da Marina.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {m.usos.map((u, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-tinta">
                  {u.tipo === "marina" ? <MessageCircleHeart className="mt-0.5 h-4 w-4 shrink-0 text-marca" /> : <Globe className="mt-0.5 h-4 w-4 shrink-0 text-tinta-suave" />}
                  {u.href ? <a href={u.href} className="hover:underline" onClick={() => avisar("Abrindo…", "info")}>{u.onde}</a> : u.onde}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {dialogo}
    </Gaveta>
  );
}
