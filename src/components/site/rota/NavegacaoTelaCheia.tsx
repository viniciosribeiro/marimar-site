"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp, CornerUpLeft, CornerUpRight, ArrowUpLeft, ArrowUpRight, Undo2, RotateCw, Ship, Flag,
  X, ListOrdered, Scan, Box, Layers, LocateFixed, Pause, Play, RotateCcw, PartyPopper,
} from "lucide-react";
import {
  montarPercurso, projetar, pontoEm, rumoEm, proximoPasso, restante, linhaAte, trechoEm, velocidadePrevia,
  zoomPorVelocidade, distancia, formatarDistancia, formatarDuracao,
  type RotaConfig, type Trecho, type EstiloMapa, type Seta, type LngLat,
} from "@/lib/rota-base";
import type { Marcador, Voce, CameraNav } from "./MapaRota";

const MapaRota = dynamic(() => import("./MapaRota"), { ssr: false });

const SETA: Record<Seta, typeof ArrowUp> = {
  frente: ArrowUp, esquerda: CornerUpLeft, direita: CornerUpRight, "leve-esquerda": ArrowUpLeft, "leve-direita": ArrowUpRight,
  retorno: Undo2, rotatoria: RotateCw, barco: Ship, chegada: Flag,
};
const COR_TRECHO = { carro: "bg-blue-500", barco: "bg-cyan-500", pe: "bg-orange-500" } as const;

/** Ângulo a caminho de outro pelo lado mais curto (a câmera não dá a volta inteira). */
function aproximarAngulo(de: number, para: number, fator: number) {
  const d = ((para - de + 540) % 360) - 180;
  return (de + d * fator + 360) % 360;
}

/** Tela cheia: navegador antigo devolve undefined em vez de promessa, ou lança. */
function semErro(f: () => Promise<void> | undefined) {
  try { f()?.catch(() => {}); } catch { /* sem tela cheia */ }
}

const horaDeChegada = (seg: number) =>
  new Date(Date.now() + seg * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

type Props = {
  /** "gps": navegação de verdade, seguindo o celular. "previa": o caminho percorrido sozinho, para ver antes. */
  modo: "gps" | "previa";
  trechos: Trecho[];
  config: RotaConfig;
  marcadores: Marcador[];
  estilos: EstiloMapa[];
  estiloInicial: string;
  tresDInicial: boolean;
  mapbox: string | null;
  aoFalharMapbox: (motivo: string) => void;
  /** GPS: a pessoa saiu do caminho — quem chamou recalcula a rota daqui. */
  aoSairDaRota?: (p: { lat: number; lng: number }) => void;
  aoFechar: () => void;
};

/**
 * Navegação em tela inteira (aprovada pelo Vinicios em 19/10/2026): só o mapa
 * na tela — some o menu do site e os botões da Marina e do WhatsApp. Em cima,
 * a próxima manobra; embaixo, em vidro, a hora de chegada, o que falta, as
 * etapas e "Sair". No Android e no computador pede tela cheia de verdade (a
 * barra do navegador some); o iPhone não deixa um site fazer isso, então lá o
 * mapa cobre a página toda. O "voltar" do celular fecha a navegação.
 *
 * Desenhada no <body> (createPortal): dentro da página, um ancestral com
 * transform (o movimento do site) prendia o `position: fixed` e o menu
 * continuava por cima.
 */
export function NavegacaoTelaCheia({
  modo, trechos, config, marcadores, estilos, estiloInicial, tresDInicial, mapbox, aoFalharMapbox, aoSairDaRota, aoFechar,
}: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const botaoSair = useRef<HTMLButtonElement>(null);
  const percurso = useMemo(() => montarPercurso(trechos), [trechos]);
  /* O ponto de partida fica debaixo da seta: na navegação, só a seta. */
  const semOrigem = useMemo(() => marcadores.filter((m) => m.tipo !== "origem"), [marcadores]);

  const [ao, setAo] = useState(0);
  const [voce, setVoce] = useState<Voce | null>(null);
  const [camera, setCamera] = useState<CameraNav | null>(null);
  const [andado, setAndado] = useState<LngLat[] | null>(null);
  const [seguir, setSeguir] = useState(true);
  const [tresD, setTresD] = useState(tresDInicial);
  const [estilo, setEstilo] = useState(estiloInicial);
  const [enquadrar, setEnquadrar] = useState(0);
  const [etapas, setEtapas] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [chegou, setChegou] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [rodada, setRodada] = useState(0);

  const seguirRef = useRef(seguir);
  const avisos = useRef({ aoFechar, aoSairDaRota });
  useEffect(() => { seguirRef.current = seguir; avisos.current = { aoFechar, aoSairDaRota }; });
  const empurrou = useRef(false);
  const fechado = useRef(false);
  const rolagemAoAbrir = useRef(0);

  /* ── fechar: GPS, tela cheia, histórico ─────────────────────────── */
  const fechar = useCallback((veioDoVoltar = false) => {
    if (fechado.current) return;
    fechado.current = true;
    if (document.fullscreenElement) semErro(() => document.exitFullscreen());
    if (!veioDoVoltar && empurrou.current) {
      empurrou.current = false;
      /* Ao desfazer a entrada do histórico, o Next rola até o #rota do endereço: a página volta para onde estava. */
      const y = rolagemAoAbrir.current;
      window.addEventListener("popstate", () => setTimeout(() => window.scrollTo({ top: y, behavior: "instant" }), 60), { once: true });
      window.history.back();
    }
    avisos.current.aoFechar();
  }, []);

  /* ── abrir: tela cheia, "voltar" fecha, página parada por baixo ─── */
  useEffect(() => {
    const el = raiz.current;
    /* Tela cheia de verdade onde o navegador deixa (Android, computador). */
    if (el && document.fullscreenEnabled && !document.fullscreenElement) {
      semErro(() => el.requestFullscreen({ navigationUI: "hide" })); // sem permissão: fica a tela fixa
    }
    /* O "voltar" do celular fecha só a navegação (a página fica onde estava). */
    rolagemAoAbrir.current = window.scrollY;
    window.history.pushState(null, "", window.location.href);
    empurrou.current = true;
    const aoVoltar = () => { empurrou.current = false; fechar(true); };
    /* Saiu da tela cheia (Esc, gesto de voltar no Android): fecha também. */
    const aoSairDaTelaCheia = () => { if (!document.fullscreenElement) fechar(); };
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("popstate", aoVoltar);
    document.addEventListener("fullscreenchange", aoSairDaTelaCheia);
    window.addEventListener("keydown", aoTeclar);
    const rolagem = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    botaoSair.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      document.removeEventListener("fullscreenchange", aoSairDaTelaCheia);
      window.removeEventListener("keydown", aoTeclar);
      document.documentElement.style.overflow = rolagem;
    };
  }, [fechar]);

  /* A altura do painel de baixo sobe os créditos do mapa (precisam aparecer). */
  useEffect(() => {
    const p = painel.current, r = raiz.current;
    if (!p || !r) return;
    const ro = new ResizeObserver(() => r.style.setProperty("--nav-baixo", `${p.offsetHeight + 12}px`));
    ro.observe(p);
    return () => ro.disconnect();
  }, [chegou]);

  /* ── GPS de verdade ─────────────────────────────────────────────── */
  const aoRef = useRef<number | undefined>(undefined);
  const ultimoFix = useRef(0);
  const ultimaSaida = useRef(0);
  useEffect(() => { aoRef.current = undefined; }, [percurso]);

  useEffect(() => {
    if (modo !== "gps" || !("geolocation" in navigator)) return;
    let trava: WakeLockSentinel | null = null;
    const pedirTrava = async () => {
      try { trava = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock?.request("screen") ?? null; }
      catch { /* sem trava de tela */ }
    };
    void pedirTrava();
    /* A trava cai quando o celular apaga ou troca de app: pede de novo ao voltar. */
    const aoVoltarATela = () => { if (document.visibilityState === "visible") void pedirTrava(); };
    document.addEventListener("visibilitychange", aoVoltarATela);

    const vigia = navigator.geolocation.watchPosition(
      (pos) => {
        setAviso(null);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const agora = Date.now();
        const intervalo = ultimoFix.current ? Math.min(1500, agora - ultimoFix.current) : 0;
        ultimoFix.current = agora;
        const r = projetar(p, percurso, aoRef.current);
        const noCaminho = r.distancia < 25;
        aoRef.current = r.ao;
        setAo(r.ao);
        /* No caminho, o ponto "gruda" na rota e a câmera olha para onde ela vai. */
        const onde = noCaminho ? pontoEm(percurso, r.ao) : p;
        const velocidade = pos.coords.speed ?? null;
        const direcao = noCaminho ? rumoEm(percurso, r.ao) : (pos.coords.heading ?? rumoEm(percurso, r.ao));
        setVoce({ ...onde, precisao: pos.coords.accuracy, direcao, suave: intervalo });
        const tipo = trechoEm(percurso, r.ao)?.tipo ?? "pe";
        const zoom = tipo === "barco" ? 14 : zoomPorVelocidade(velocidade ?? (tipo === "carro" ? 15 : 1.3));
        if (seguirRef.current) setCamera({ ...onde, rumo: direcao, zoom, duracao: intervalo || 900 });
        setAndado(linhaAte(percurso, r.ao));
        if (distancia(p, config.pousada) < 35 || percurso.total - r.ao < 20) { setChegou(true); return; }
        /* Saiu do caminho (e não está no barco): recalcula, no máximo a cada 45 s. */
        if (tipo !== "barco" && r.distancia > 90 && agora - ultimaSaida.current > 45000) {
          ultimaSaida.current = agora;
          avisos.current.aoSairDaRota?.(p);
        }
      },
      () => setAviso("Perdi o sinal de localização. A rota continua na tela."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => {
      navigator.geolocation.clearWatch(vigia);
      document.removeEventListener("visibilitychange", aoVoltarATela);
      trava?.release().catch(() => {});
    };
  }, [modo, percurso, config.pousada]);

  /* ── prévia: o caminho percorrido sozinho, câmera em voo baixo ──── */
  useEffect(() => {
    if (modo !== "previa" || !mapaPronto || pausado || chegou) return;
    let quadro = 0, antes = 0, pos = aoRef.current ?? 0;
    let rumoSuave = rumoEm(percurso, pos, 40), zoomSuave = 17;
    let ultimoAndado = 0;
    const comeco = performance.now();
    const andar = (agora: number) => {
      /* Aparelho lento (poucos quadros por segundo): o passo cresce, o tempo da prévia não. */
      const dt = antes ? Math.min(0.25, (agora - antes) / 1000) : 0;
      antes = agora;
      /* Um respiro antes de começar a andar. */
      if (agora - comeco > 700 || pos > 0) {
        const t = trechoEm(percurso, pos);
        const v = velocidadePrevia(t?.tipo ?? "pe", t ? t.fim - t.ini : percurso.total);
        pos = Math.min(percurso.total, pos + v * dt);
        const suave = 1 - Math.exp(-dt * 2.2);
        rumoSuave = aproximarAngulo(rumoSuave, rumoEm(percurso, pos, Math.max(30, v * 1.4)), suave);
        zoomSuave += (zoomPorVelocidade(v) - zoomSuave) * (1 - Math.exp(-dt * 1.2));
      }
      aoRef.current = pos;
      const onde = pontoEm(percurso, pos);
      setAo(pos);
      setVoce({ ...onde, direcao: rumoSuave, suave: 0 });
      if (seguirRef.current) setCamera({ ...onde, rumo: rumoSuave, zoom: zoomSuave, duracao: 0 });
      if (agora - ultimoAndado > 250) { ultimoAndado = agora; setAndado(linhaAte(percurso, pos)); }
      if (pos >= percurso.total) { setChegou(true); return; }
      quadro = requestAnimationFrame(andar);
    };
    quadro = requestAnimationFrame(andar);
    return () => cancelAnimationFrame(quadro);
  }, [modo, mapaPronto, pausado, chegou, percurso, rodada]);

  /* Mapa aberto: enquanto o GPS não responde, a câmera olha o começo do caminho. */
  function aoMapaPronto() {
    setMapaPronto(true);
    const inicio = pontoEm(percurso, 0);
    setCamera((c) => c ?? { ...inicio, rumo: rumoEm(percurso, 0, 40), zoom: 16.5, duracao: 1200 });
  }

  function recentralizar() {
    setSeguir(true);
    const onde = voce ?? pontoEm(percurso, ao);
    setCamera({ lat: onde.lat, lng: onde.lng, rumo: voce?.direcao ?? rumoEm(percurso, ao), zoom: 17, duracao: 900 });
  }
  function visaoGeral() { setSeguir(false); setEnquadrar((n) => n + 1); }
  function trocarEstilo() {
    const i = estilos.findIndex((e) => e.id === estilo);
    setEstilo(estilos[(i + 1) % estilos.length].id);
  }
  function deNovo() {
    aoRef.current = 0; setAo(0); setAndado(null); setChegou(false); setPausado(false); setSeguir(true); setRodada((n) => n + 1);
  }

  /* ── o que mostrar ──────────────────────────────────────────────── */
  const { atual, depois } = proximoPasso(percurso, ao);
  const passo = percurso.passos[atual];
  const proximo = depois !== null ? percurso.passos[depois] : null;
  const falta = restante(percurso, ao);
  const Seta = SETA[passo?.seta ?? "frente"];
  const SetaDepois = proximo ? SETA[proximo.seta] : null;
  const ateManobra = passo ? Math.max(0, passo.ao - ao) : 0;
  const trechoAgora = trechoEm(percurso, ao);
  const estiloAtual = estilos.find((e) => e.id === estilo);

  const conteudo = (
    <div ref={raiz} className="nav-tela fixed inset-x-0 top-0 z-[100] h-[100dvh] bg-[#e9eee4] text-tinta"
      role="dialog" aria-modal="true" aria-label={modo === "previa" ? "Prévia do caminho até a pousada" : "Navegação até a pousada"}>
      <div className="absolute inset-0">
      <MapaRota key={mapbox ? "mapbox" : "livre"} className="h-full w-full" navegacao estilos={estilos} estilo={estilo}
        marcadores={semOrigem} trechos={trechos} voce={voce} tresD={tresD} centro={pontoEm(percurso, 0)}
        mapbox={mapbox} relevo={config.servicos.relevo} camera={seguir ? camera : null} andado={andado} enquadrar={enquadrar}
        aoMexer={() => setSeguir(false)} aoPronto={aoMapaPronto} aoFalharMapbox={aoFalharMapbox} />
      </div>

      {/* ── em cima: a próxima manobra ── */}
      {!chegou && passo && (
        <div className="pointer-events-none absolute inset-x-3 top-[max(.75rem,env(safe-area-inset-top))] z-10 sm:right-auto sm:w-[26rem]">
          <div className="pointer-events-auto overflow-hidden rounded-[1.75rem] bg-tinta/[.93] text-white shadow-[0_18px_40px_-18px_rgb(0_0_0/.7)] ring-1 ring-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-3.5 p-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[.14]">
                <Seta className="h-8 w-8" strokeWidth={2.4} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[1.65rem] font-bold leading-none tabular-nums">
                  {trechoAgora?.tipo === "barco" && passo.tipo !== "barco" ? "Travessia" : formatarDistancia(ateManobra)}
                </p>
                <p className="mt-1 text-[1.02rem] font-medium leading-snug text-white/95" aria-live="polite">{passo.texto}</p>
              </div>
            </div>
            {proximo && SetaDepois && proximo.ao - passo.ao < 400 && (
              <p className="flex items-center gap-2 bg-black/20 px-4 py-2 text-sm text-white/85 [@media(max-height:30rem)]:hidden">
                <span className="text-white/60">Depois</span> <SetaDepois className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{proximo.texto}</span>
              </p>
            )}
          </div>
          {aviso && <p className="pointer-events-auto mt-2 rounded-2xl bg-amber-50/95 px-4 py-2 text-xs text-amber-900 shadow" role="status">{aviso}</p>}
        </div>
      )}

      {/* ── lado direito: visão geral, 3D/2D, estilo ── */}
      {!chegou && (
        <div className="absolute right-3 top-[calc(max(.75rem,env(safe-area-inset-top))+8.5rem)] z-10 flex flex-col gap-2 sm:top-[max(.75rem,env(safe-area-inset-top))] [@media(max-height:30rem)]:top-[max(.75rem,env(safe-area-inset-top))] [@media(max-height:30rem)]:right-[max(.75rem,env(safe-area-inset-right))]">
          <BotaoRedondo rotulo="Ver o caminho inteiro" aoClicar={visaoGeral} ativo={!seguir}><Scan className="h-5 w-5" /></BotaoRedondo>
          <BotaoRedondo rotulo={tresD ? "Ver de cima (2D)" : "Ver em 3D"} aoClicar={() => setTresD((v) => !v)} ativo={tresD}>
            {tresD ? <Box className="h-5 w-5" /> : <span className="text-xs font-bold">2D</span>}
          </BotaoRedondo>
          {estilos.length > 1 && (
            <BotaoRedondo rotulo={`Visual do mapa: ${estiloAtual?.nome ?? ""} (trocar)`} aoClicar={trocarEstilo}><Layers className="h-5 w-5" /></BotaoRedondo>
          )}
        </div>
      )}

      {/* ── embaixo: chegada, etapas e sair ── */}
      <div ref={painel} className="absolute inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-10 sm:left-3 sm:right-auto sm:w-[26rem]">
        {!seguir && !chegou && (
          <button onClick={recentralizar}
            className="mb-2 ml-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-tinta/90 px-4 text-sm font-semibold text-white shadow-lg backdrop-blur animate-[subir-nav_.25s_ease-out]">
            <LocateFixed className="h-4 w-4" /> Recentralizar
          </button>
        )}
        {chegou ? (
          <div className="vidro-nav rounded-[1.75rem] p-5 text-center animate-[subir-nav_.35s_ease-out]" role="status">
            <PartyPopper className="mx-auto h-9 w-9 text-marca" aria-hidden="true" />
            {modo === "previa" ? (
              <>
                <p className="mt-2 font-serif text-xl font-semibold text-tinta">É assim que você chega</p>
                <p className="mt-1 text-sm text-tinta-suave">No dia, abra esta página e toque em “Começar a navegação”: o mapa segue você até a nossa porta.</p>
              </>
            ) : (
              <p className="mt-2 text-lg font-semibold text-tinta">{config.textos.chegada}</p>
            )}
            <div className="mt-4 flex gap-2">
              {modo === "previa" && (
                <button onClick={deNovo} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-tinta/[.08] font-semibold text-tinta">
                  <RotateCcw className="h-4 w-4" /> Ver de novo
                </button>
              )}
              <button ref={botaoSair} onClick={() => fechar()} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-tinta font-semibold text-white">
                Fechar o mapa
              </button>
            </div>
          </div>
        ) : (
          <div className="vidro-nav rounded-[1.75rem] px-4 pb-3 pt-2">
            <button onClick={() => setEtapas((v) => !v)} aria-label={etapas ? "Esconder as etapas" : "Mostrar as etapas"}
              className="mx-auto mb-1.5 block h-5 w-16"><span className="mx-auto block h-1.5 w-10 rounded-full bg-tinta/20" /></button>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                {modo === "previa" && <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-marca">Prévia do caminho</p>}
                <p className="text-[1.7rem] font-bold leading-none text-emerald-700 tabular-nums">
                  {horaDeChegada(falta.duracao)}<span className="ml-1.5 text-sm font-semibold text-emerald-700/80">chegada</span>
                </p>
              </div>
              <p className="shrink-0 pb-0.5 text-sm text-tinta-suave tabular-nums">{formatarDuracao(falta.duracao)} · {formatarDistancia(falta.distancia)}</p>
            </div>
            {/* progresso por trecho */}
            <div className="mt-2.5 flex h-1.5 gap-1 overflow-hidden rounded-full" aria-hidden="true">
              {percurso.trechos.map((t, i) => {
                /* Largura pelo tempo de cada trecho (100 km de carro não esmagam os 400 m a pé). */
                const feito = Math.max(0, Math.min(1, (ao - t.ini) / Math.max(1, t.fim - t.ini)));
                return (
                  <span key={i} className="relative h-full overflow-hidden rounded-full bg-tinta/10"
                    style={{ flexGrow: Math.max(1, t.duracao), flexBasis: 0, minWidth: percurso.trechos.length > 1 ? "14%" : undefined }}>
                    <span className={`absolute inset-y-0 left-0 ${COR_TRECHO[t.tipo]}`} style={{ width: `${feito * 100}%` }} />
                  </span>
                );
              })}
            </div>
            {etapas && (
              <ol className="mt-3 max-h-[34dvh] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                {percurso.passos.map((p, i) => {
                  const I = SETA[p.seta];
                  const estado = i < atual ? "feito" : i === atual ? "agora" : "depois";
                  return (
                    <li key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm ${estado === "agora" ? "bg-marca/15 font-semibold text-tinta" : estado === "feito" ? "text-tinta-suave/70 line-through" : "bg-tinta/[.04] text-tinta"}`}>
                      <I className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">{p.texto}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEtapas((v) => !v)} aria-expanded={etapas}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-tinta/[.07] font-semibold text-tinta">
                <ListOrdered className="h-4 w-4" /> Etapas
              </button>
              {modo === "previa" && (
                <button onClick={() => setPausado((v) => !v)} aria-label={pausado ? "Continuar" : "Pausar"}
                  className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tinta/[.07] text-tinta">
                  {pausado ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </button>
              )}
              <button ref={botaoSair} onClick={() => fechar()} className="flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-red-600 px-6 font-semibold text-white shadow-[0_10px_22px_-12px_#dc2626]">
                <X className="h-5 w-5" /> Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}

function BotaoRedondo({ rotulo, aoClicar, ativo, children }: { rotulo: string; aoClicar: () => void; ativo?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={aoClicar} aria-label={rotulo} title={rotulo} aria-pressed={ativo}
      className={`flex h-12 w-12 items-center justify-center rounded-full shadow-[0_10px_24px_-12px_rgb(0_0_0/.55)] ring-1 backdrop-blur-xl transition-colors ${ativo ? "bg-tinta text-white ring-white/20" : "bg-white/85 text-tinta ring-white"}`}>
      {children}
    </button>
  );
}
