"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  Home, BedDouble, ScrollText, KeyRound, CreditCard, Palmtree, Compass, Ship, HelpCircle, Layers,
  Sparkles, Search, Maximize2, Minimize2, Plus, Minus, LocateFixed, Headset, Map as IconeMapa, List, ArrowRight, type LucideIcon,
} from "lucide-react";
import type { Area, Ligacao } from "@/lib/cerebro";
import { cn, botao } from "@/components/admin/ui";
import { CORES, ROTULOS } from "./Graficos";

/**
 * Mapa do conhecimento da Marina (30/09/2026, visual novo).
 *
 * A Marina no centro; em volta, uma "estação" por área de assunto, ligada a
 * ela por um cabo curvo. O anel colorido de cada estação é a origem do que
 * ela sabe ali (cadastrado, aprendido com a equipe, mídias). Clicar numa
 * área abre o painel ao lado com os números e os atalhos para ver ou
 * ensinar. Embaixo, as equipes que respondem quando ela não sabe.
 *
 * Nós em HTML (botões de verdade, com teclado e leitor de tela) sobre os
 * cabos em SVG, os dois na mesma caixa de proporção fixa — por isso as
 * posições em porcentagem batem. No celular vira lista: o desenho ficaria
 * com letra miúda.
 */

type Fonte = "manual" | "aprendido" | "midias";
type Setor = { id: string; rotulo: string; chamados: number };
const FONTES: Fonte[] = ["manual", "aprendido", "midias"];

const ICONES: Record<string, LucideIcon> = {
  pousada: Home, quartos: BedDouble, politicas: ScrollText, checkin: KeyRound, pagamentos: CreditCard,
  ilha: Palmtree, passeios: Compass, barcos: Ship, faq: HelpCircle, geral: Layers,
};
const CURTO: Record<string, string> = {
  pousada: "A pousada", quartos: "Quartos", politicas: "Políticas", checkin: "Check-in", pagamentos: "Pagamentos",
  ilha: "Ilha do Mel", passeios: "Passeios", barcos: "Barcos", faq: "Frequentes", geral: "Outros",
};

/* Centro um pouco acima do meio: embaixo fica a faixa da legenda e do zoom. */
const W = 760, H = 520, CX = W / 2, CY = 240, RX = 292, RY = 172;
const r1 = (n: number) => Math.round(n * 10) / 10;
const dois = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, s: string, p = s + "s") => `${n} ${n === 1 ? s : p}`;
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Anel de origem: conic-gradient na proporção de cada fonte. */
function anel(a: Area, origem: Fonte | "todas") {
  const fontes = origem === "todas" ? FONTES : [origem];
  const total = fontes.reduce((s, f) => s + a[f], 0);
  if (!total) return null;
  let acc = 0;
  const partes = fontes.filter((f) => a[f] > 0).map((f) => {
    const de = (acc / total) * 360; acc += a[f];
    return `${CORES[f]} ${de}deg ${(acc / total) * 360}deg`;
  });
  return `conic-gradient(${partes.join(", ")})`;
}

export function MapaConhecimento({ areas, ligacoes, setores }: { areas: Area[]; ligacoes: Ligacao[]; setores: Setor[] }) {
  const [modo, setModo] = useState<"mapa" | "lista">("mapa");
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState<Fonte | "todas">("todas");
  const [equipe, setEquipe] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<string>(() => [...areas].sort((a, b) => b.total - a.total)[0]?.id ?? "geral");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [telaCheia, setTelaCheia] = useState(false);
  const caixa = useRef<HTMLElement>(null);
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const valor = (a: Area) => (origem === "todas" ? a.total : a[origem]);
  const totalConteudos = areas.reduce((s, a) => s + valor(a), 0);
  const vazias = areas.filter((a) => valor(a) === 0);
  const termo = semAcento(busca.trim());
  const casa = (a: Area) => !termo || semAcento(`${a.rotulo} ${CURTO[a.id] ?? ""}`).includes(termo);
  const daEquipe = (a: Area) => !equipe || ligacoes.some((l) => l.area === a.id && l.setor === equipe);
  const atual = areas.find((a) => a.id === selecionada) ?? areas[0];
  const indice = areas.findIndex((a) => a.id === atual?.id);

  const pos = useMemo(() => new Map(areas.map((a, i) => {
    const ang = -Math.PI / 2 + (i / areas.length) * Math.PI * 2;
    return [a.id, { x: CX + Math.cos(ang) * RX, y: CY + Math.sin(ang) * RY, ang }];
  })), [areas]);

  /* Cabo curvo: controle deslocado para o lado, sempre no mesmo sentido. */
  const cabo = (id: string) => {
    const p = pos.get(id)!;
    const mx = (CX + p.x) / 2, my = (CY + p.y) / 2, dx = p.x - CX, dy = p.y - CY;
    return `M${CX},${CY} Q${r1(mx - dy * 0.18)},${r1(my + dx * 0.18)} ${r1(p.x)},${r1(p.y)}`;
  };

  function alternarTelaCheia() {
    const el = caixa.current;
    if (!el) return;
    if (document.fullscreenElement) { document.exitFullscreen?.(); setTelaCheia(false); }
    else if (el.requestFullscreen) {
      el.requestFullscreen().then(() => setTelaCheia(true)).catch(() => {});
      const sair = () => { if (!document.fullscreenElement) { setTelaCheia(false); document.removeEventListener("fullscreenchange", sair); } };
      document.addEventListener("fullscreenchange", sair);
    }
  }
  const aproximar = (d: number) => setZoom((z) => Math.min(1.8, Math.max(0.6, Math.round((z + d) * 10) / 10)));

  function buscar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const achou = areas.find(casa);
    if (achou) setSelecionada(achou.id);
  }

  const verConteudos = (id: string) => `/admin/marina?aba=conhecimento&categoria=${id}`;
  const adicionar = (id: string) => `/admin/marina?aba=conhecimento&categoria=${id}&novo=1`;
  const equipesDa = (id: string) => ligacoes.filter((l) => l.area === id).sort((a, b) => b.peso - a.peso);

  return (
    <section ref={caixa} aria-labelledby="mapa-titulo"
      className={cn("min-w-0 rounded-2xl border border-linha/80 bg-white shadow-sm", telaCheia && "overflow-auto p-4 sm:p-6")}>
      {/* cabeçalho e ferramentas */}
      <div className="flex flex-col gap-3 px-5 pt-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="mapa-titulo" className="text-base font-semibold text-tinta">Mapa do conhecimento</h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-tinta-suave">
            {[plural(totalConteudos, "conteúdo"), plural(areas.length, "área"), plural(setores.length, "equipe")].map((t) => (
              <span key={t} className="rounded-full bg-areia/60 px-2.5 py-1 font-medium text-tinta">{t}</span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Ver como" className="hidden rounded-full border border-linha bg-white p-0.5 md:inline-flex">
            {([["mapa", "Mapa", IconeMapa], ["lista", "Lista", List]] as const).map(([v, r, I]) => (
              <button key={v} type="button" role="radio" aria-checked={modo === v} onClick={() => setModo(v)}
                className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", modo === v ? "bg-marca text-marca-texto" : "text-tinta-suave hover:text-tinta")}>
                <I size={14} aria-hidden />{r}
              </button>
            ))}
          </div>
          <label className="relative min-w-0 basis-full sm:basis-auto sm:flex-none">
            <span className="sr-only">Buscar assunto</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={buscar} placeholder="Buscar assunto"
              className="min-h-9 w-full rounded-full border border-linha bg-white pl-8 pr-3 text-sm text-tinta placeholder:text-tinta-suave/70 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/25 sm:w-44" />
          </label>
          <label>
            <span className="sr-only">Origem do conhecimento</span>
            <select value={origem} onChange={(e) => setOrigem(e.target.value as Fonte | "todas")}
              className="min-h-9 rounded-full border border-linha bg-white px-3 text-sm text-tinta focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/25">
              <option value="todas">Todas as origens</option>
              {FONTES.map((f) => <option key={f} value={f}>{ROTULOS[f]}</option>)}
            </select>
          </label>
          <button type="button" onClick={alternarTelaCheia} className={botao("secundario", "sm", "hidden h-9 w-9 !px-0 md:inline-flex")}
            aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} title={telaCheia ? "Sair da tela cheia" : "Tela cheia"}>
            {telaCheia ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {/* ── mapa ── */}
          <div className={cn("relative hidden overflow-hidden rounded-2xl border border-linha/60 bg-[radial-gradient(circle,rgb(0_0_0/0.06)_1px,transparent_1px)] [background-size:18px_18px]", modo === "mapa" && "md:block")}
            style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size" }}
            onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; arrasto.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { const a = arrasto.current; if (a) setPan({ x: a.px + e.clientX - a.x, y: a.py + e.clientY - a.y }); }}
            onPointerUp={() => { arrasto.current = null; }}>
            <div className="absolute inset-0 origin-center cursor-grab active:cursor-grabbing"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
                <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="currentColor" className="text-linha" strokeDasharray="2 6" />
                {areas.map((a) => {
                  const sel = a.id === atual?.id;
                  const daEq = equipe && ligacoes.some((l) => l.area === a.id && l.setor === equipe);
                  const fraco = !casa(a) || !daEquipe(a);
                  return (
                    <path key={a.id} d={cabo(a.id)} fill="none"
                      stroke={sel ? "var(--marca)" : daEq ? CORES.aprendido : "#cfd4dc"}
                      strokeWidth={sel ? 2.6 : valor(a) ? 1.8 : 1.2} strokeDasharray={valor(a) ? undefined : "4 5"}
                      opacity={fraco ? 0.25 : 1} className={cn(sel && "cerebro-fluxo")} />
                  );
                })}
              </svg>

              {/* Marina */}
              <div className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: "50%", top: `${(CY / H) * 100}%` }}>
                <span className="relative flex items-center justify-center rounded-full bg-marca text-marca-texto shadow-[0_12px_30px_-10px_var(--marca)]"
                  style={{ width: "clamp(56px, 11cqw, 88px)", height: "clamp(56px, 11cqw, 88px)" }}>
                  <span className="absolute inset-0 rounded-full bg-marca/30 motion-safe:animate-ping [animation-duration:2.8s]" aria-hidden />
                  <Sparkles className="relative h-1/2 w-1/2" aria-hidden />
                </span>
                <b className="mt-1.5 text-sm text-tinta">Marina</b>
                <span className="text-[11px] text-tinta-suave">Assistente</span>
              </div>

              {/* áreas */}
              {areas.map((a, i) => {
                const p = pos.get(a.id)!;
                const Icone = ICONES[a.id] ?? Layers;
                const sel = a.id === atual?.id;
                const v = valor(a);
                const fundo = anel(a, origem);
                const fraco = !casa(a) || !daEquipe(a);
                return (
                  <button key={a.id} type="button" onClick={() => setSelecionada(a.id)} aria-pressed={sel}
                    aria-label={`${a.rotulo}: ${plural(v, "conteúdo")}`}
                    className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl border px-2 pb-1.5 pt-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca",
                      sel ? "border-marca bg-[color-mix(in_srgb,var(--marca)_9%,white)] shadow-md" : "border-transparent bg-white/90 hover:shadow-sm",
                      fraco && "opacity-30")}
                    style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, width: "clamp(78px, 15cqw, 116px)" }}>
                    <span className="absolute left-1.5 top-1 text-[10px] font-semibold tabular-nums text-tinta-suave/80">{dois(i + 1)}</span>
                    <span className={cn("relative flex items-center justify-center rounded-full p-[3px]", !fundo && "border-2 border-dashed border-gray-300 p-0")}
                      style={{ width: "clamp(40px, 7cqw, 56px)", height: "clamp(40px, 7cqw, 56px)", background: fundo ?? undefined }}>
                      <span className={cn("flex h-full w-full items-center justify-center rounded-full bg-white", sel ? "text-marca" : fundo ? "text-tinta" : "text-gray-400")}>
                        <Icone className="h-[45%] w-[45%]" aria-hidden />
                      </span>
                    </span>
                    <span className="mt-1 block w-full truncate text-[12px] font-semibold leading-tight text-tinta">{CURTO[a.id] ?? a.rotulo}</span>
                    <span className={cn("block text-[11px] tabular-nums leading-tight", v ? "text-tinta-suave" : "text-gray-400")}>{v ? plural(v, "conteúdo") : "sem conteúdo"}</span>
                  </button>
                );
              })}
            </div>

            {/* legenda */}
            <ul className="absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-linha/60 bg-white/95 px-3 py-2 text-[11px] text-tinta-suave shadow-sm backdrop-blur">
              {FONTES.map((f) => (
                <li key={f} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[f] }} aria-hidden />{f === "aprendido" ? "Aprendido" : f === "midias" ? "Mídias" : "Cadastrado"}</li>
              ))}
              <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-gray-400" aria-hidden />Sem conteúdo</li>
            </ul>

            {/* zoom */}
            <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-linha/60 bg-white/95 shadow-sm">
              <button type="button" onClick={() => aproximar(0.2)} className="flex h-9 w-9 items-center justify-center text-tinta hover:bg-areia/60" aria-label="Aproximar"><Plus size={16} /></button>
              <button type="button" onClick={() => aproximar(-0.2)} className="flex h-9 w-9 items-center justify-center border-t border-linha/60 text-tinta hover:bg-areia/60" aria-label="Afastar"><Minus size={16} /></button>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="flex h-9 w-9 items-center justify-center border-t border-linha/60 text-tinta hover:bg-areia/60" aria-label="Centralizar"><LocateFixed size={15} /></button>
              <button type="button" onClick={alternarTelaCheia} className="flex h-9 w-9 items-center justify-center border-t border-linha/60 text-tinta hover:bg-areia/60" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}>
                {telaCheia ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          {/* ── lista (sempre no celular; no computador, quando escolhida) ── */}
          <ul className={cn("space-y-2", modo === "mapa" && "md:hidden")}>
            {areas.map((a, i) => ({ a, i })).filter(({ a }) => casa(a) && daEquipe(a)).map(({ a, i }) => {
              const Icone = ICONES[a.id] ?? Layers;
              const sel = a.id === atual?.id;
              const v = valor(a);
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => setSelecionada(a.id)} aria-pressed={sel}
                    className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors", sel ? "border-marca bg-marca/10" : "border-linha/70 hover:bg-areia/30")}>
                    <span className="w-6 text-xs font-semibold tabular-nums text-tinta-suave">{dois(i + 1)}</span>
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", v ? "bg-areia/70 text-tinta" : "border border-dashed border-gray-300 text-gray-400")}><Icone size={17} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-tinta">{a.rotulo}</span>
                      <span className="mt-1 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-areia/50">
                        {(origem === "todas" ? FONTES : [origem]).map((f) => a[f] > 0 && <span key={f} style={{ flexGrow: a[f], background: CORES[f] }} />)}
                      </span>
                    </span>
                    <span className={cn("text-sm font-bold tabular-nums", v ? "text-tinta" : "text-gray-400")}>{v}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* equipes de apoio */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-tinta-suave">Equipes de apoio</span>
            {setores.length === 0 ? (
              <Link href="/admin/equipe" className="text-sm font-medium text-marca hover:underline">Cadastrar a equipe →</Link>
            ) : setores.map((s) => (
              <button key={s.id} type="button" onClick={() => setEquipe((e) => (e === s.id ? null : s.id))} aria-pressed={equipe === s.id}
                className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  equipe === s.id ? "border-orange-300 bg-orange-50 text-tinta" : "border-linha bg-white text-tinta-suave hover:text-tinta")}>
                <Headset size={13} aria-hidden />{s.rotulo}
                <span className="rounded-full bg-areia/70 px-1.5 tabular-nums text-tinta">{s.chamados}</span>
              </button>
            ))}
            {equipe && <button type="button" onClick={() => setEquipe(null)} className="text-xs text-tinta-suave underline">limpar</button>}
          </div>
        </div>

        {/* ── painel do assunto ── */}
        {atual && (
          <aside className="flex flex-col gap-4" aria-live="polite">
            <div className="rounded-2xl border border-linha/70 bg-fundo-suave/60 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-marca">Assunto selecionado</p>
              <p className="mt-0.5 text-xs text-tinta-suave">Área {dois(indice + 1)} de {dois(areas.length)}</p>
              <div className="mt-3 flex items-center gap-3">
                {(() => { const I = ICONES[atual.id] ?? Layers; return <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-marca/10 text-marca"><I size={22} aria-hidden /></span>; })()}
                <h3 className="text-lg font-semibold leading-tight text-tinta">{atual.rotulo}</h3>
              </div>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-tinta">{atual.total}</span>
                <span className="text-sm text-tinta-suave">{atual.total === 1 ? "conteúdo disponível" : "conteúdos disponíveis"}</span>
              </p>

              <p className="mt-4 text-xs font-semibold text-tinta">Origem do conhecimento</p>
              <ul className="mt-2 space-y-2">
                {FONTES.map((f) => (
                  <li key={f} className="text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[f] }} aria-hidden />
                      <span className="flex-1 text-tinta-suave">{ROTULOS[f]}</span>
                      <b className="tabular-nums text-tinta">{atual[f]}</b>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-areia/60">
                      <span className="block h-full rounded-full" style={{ width: `${atual.total ? (atual[f] / atual.total) * 100 : 0}%`, background: CORES[f] }} />
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs font-semibold text-tinta">Quem responde quando ela não sabe</p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {equipesDa(atual.id).length ? equipesDa(atual.id).map((l) => (
                  <span key={l.setor} className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] text-tinta">
                    {setores.find((s) => s.id === l.setor)?.rotulo ?? l.setor} · {plural(l.peso, "chamado")}
                  </span>
                )) : <span className="text-xs text-tinta-suave">Nenhum chamado deste assunto no período.</span>}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <Link href={verConteudos(atual.id)} className={botao("primario", "md", "w-full")}>Ver conteúdos <ArrowRight size={15} aria-hidden /></Link>
                <Link href={adicionar(atual.id)} className="text-center text-sm font-medium text-marca hover:underline">+ Adicionar conteúdo</Link>
              </div>
            </div>

            {vazias.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">Sua base pode crescer</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">
                  {plural(vazias.length, "área")} sem conteúdo{origem !== "todas" ? ` de “${ROTULOS[origem]}”` : ""}: {vazias.map((a) => CURTO[a.id] ?? a.rotulo).join(", ")}.
                  Cada uma é uma pergunta que ela vai mandar para a equipe.
                </p>
                <Link href={adicionar(vazias[0].id)} className={botao("secundario", "sm", "mt-3")}>Completar base</Link>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
