"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Navigation, LocateFixed, Car, Bus, Ship, Footprints, Search, Share2, Smartphone, Compass, Box, X, ChevronDown,
  MapPin, Loader2, RotateCcw, PartyPopper, QrCode,
} from "lucide-react";
import {
  distancia, naIlha, terminalPadrao, urlOsrm, trechoDoOsrm, trechoReto, formatarDistancia, formatarDuracao,
  detectarAparelho, linksExternos, distanciaAteLinha, type RotaConfig, type Trecho, type Ponto, type Aparelho,
} from "@/lib/rota-base";
import type { Marcador, Voce } from "./MapaRota";

/* O mapa pesa: só baixa no navegador, quando esta seção existe. */
const MapaRota = dynamic(() => import("./MapaRota"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-areia/60 text-sm text-tinta-suave">Carregando o mapa…</div>,
});

type Origem = Ponto & { fonte: "gps" | "busca" | "link" | "salva" };
type Sugestao = { nome: string; detalhe: string; lat: number; lng: number };
type Modo = "carro" | "onibus";

const CHAVE_SALVA = "marimar:rota-salva";
const ICONE_TRECHO = { carro: Car, barco: Ship, pe: Footprints } as const;
const COR_TRECHO = { carro: "bg-blue-600", barco: "bg-cyan-600", pe: "bg-orange-600" } as const;

/**
 * Planejador de rota até a pousada — dentro do site, sem mandar a pessoa
 * para outro app. Serve a três situações:
 *  - quem está no continente (celular ou computador): carro/ônibus até o
 *    terminal, barco até Encantadas, a pé até a porta;
 *  - quem já está na ilha: rota a pé;
 *  - quem está andando com o celular: navegação ao vivo (posição, próxima
 *    instrução, "você chegou").
 * Os apps do aparelho (Apple Maps, Google Maps, Waze) ficam como plano B.
 * Fluxo, serviços e limites: docs/fluxo-rota.md.
 */
export function PlanejadorRota({ config }: { config: RotaConfig }) {
  /* iPhone, Android ou computador — lido do navegador, "computador" no servidor. */
  const aparelho = useSyncExternalStore<Aparelho>(() => () => {}, () => detectarAparelho(navigator.userAgent), () => "desktop");
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [modo, setModo] = useState<Modo>("carro");
  const [terminalId, setTerminalId] = useState<string>(terminalPadrao(config).id);
  const [trechos, setTrechos] = useState<Trecho[] | null>(null);
  const [carregando, setCarregando] = useState<"gps" | "rota" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [estilo, setEstilo] = useState(config.estiloPadrao);
  const [tresD, setTresD] = useState(false);
  const [navegando, setNavegando] = useState(false);
  const [voce, setVoce] = useState<Voce | null>(null);
  const [passo, setPasso] = useState(0);
  const [chegou, setChegou] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const vigia = useRef<number | null>(null);
  const trava = useRef<WakeLockSentinel | null>(null);
  const ultimoRecalculo = useRef(0);

  const terminal = terminalPadrao(config, terminalId);
  const todosPassos = useMemo(() => (trechos ?? []).flatMap((t) => t.passos.map((p) => ({ ...p, tipo: t.tipo }))), [trechos]);
  const linhaToda = useMemo(() => (trechos ?? []).flatMap((t) => t.linha), [trechos]);
  const total = useMemo(() => (trechos ?? []).reduce((s, t) => ({ d: s.d + t.distancia, t: s.t + t.duracao }), { d: 0, t: 0 }), [trechos]);

  /* ── calcular a rota ─────────────────────────────────────────── */
  const calcular = useCallback(async (o: Origem, m: Modo, tId: string) => {
    setCarregando("rota"); setErro(null); setChegou(false); setPasso(0);
    const t = terminalPadrao(config, tId);
    const buscar = async (base: string, de: Ponto, para: Ponto) => {
      try {
        const r = await fetch(urlOsrm(base, de, para), { signal: AbortSignal.timeout(12000) });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    };
    try {
      let novos: Trecho[];
      if (naIlha(o, config)) {
        const pe = await buscar(config.servicos.rotaPe, o, config.pousada);
        novos = [trechoDoOsrm("pe", "A pé até a pousada", o, config.pousada, pe)];
      } else {
        const [carro, pe] = await Promise.all([
          buscar(config.servicos.rotaCarro, o, t),
          buscar(config.servicos.rotaPe, config.trapiche, config.pousada),
        ]);
        const estrada = trechoDoOsrm("carro", m === "onibus" ? `De ônibus até ${t.nome}` : `De carro até ${t.nome}`, o, t, carro);
        if (m === "onibus") estrada.duracao *= 1.35; // ônibus para no caminho: estimativa, não horário
        novos = [
          estrada,
          trechoReto("barco", `Barco até ${config.trapiche.nome}`, t, config.trapiche, t.barcoMin),
          trechoDoOsrm("pe", "A pé até a pousada", config.trapiche, config.pousada, pe),
        ];
      }
      setTrechos(novos);
      if (novos.some((x) => x.aproximado)) setErro("Não consegui o traçado exato de um trecho (sem sinal?). Mostrei uma estimativa em linha reta.");
      try { localStorage.setItem(CHAVE_SALVA, JSON.stringify({ origem: o, modo: m, terminalId: tId, trechos: novos, em: Date.now() })); } catch { /* modo privado */ }
    } finally {
      setCarregando(null);
    }
  }, [config]);

  /* ── ao abrir: link compartilhado, ou a última rota salva ────── */
  useEffect(() => {
    /* Depois da primeira pintura: URL e armazenamento só existem no navegador. */
    const inicio = setTimeout(() => {
    const q = new URLSearchParams(window.location.search);
    const de = q.get("de")?.split(",").map(Number);
    const m = q.get("modo") === "onibus" ? "onibus" : "carro";
    const tId = q.get("terminal") ?? terminalPadrao(config).id;
    if (de && de.length === 2 && de.every(Number.isFinite)) {
      const o: Origem = { nome: "Ponto compartilhado", lat: de[0], lng: de[1], fonte: "link" };
      setOrigem(o); setModo(m); setTerminalId(tId);
      void calcular(o, m, tId);
      return;
    }
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_SALVA) ?? "null");
      if (s?.trechos?.length && Date.now() - s.em < 7 * 86400000) {
        setOrigem({ ...s.origem, fonte: "salva" }); setModo(s.modo); setTerminalId(s.terminalId); setTrechos(s.trechos);
      }
    } catch { /* nada salvo */ }
    }, 0);
    return () => clearTimeout(inicio);
  }, [config, calcular]);

  /* ── origem pelo GPS ─────────────────────────────────────────── */
  function usarLocalizacao() {
    if (!("geolocation" in navigator)) { setErro("Este aparelho não informa a localização. Digite seu endereço."); return; }
    setCarregando("gps"); setErro(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const o: Origem = { nome: "Sua localização", lat: p.coords.latitude, lng: p.coords.longitude, fonte: "gps" };
        setOrigem(o); setVoce({ lat: o.lat, lng: o.lng, precisao: p.coords.accuracy });
        void calcular(o, modo, terminalId);
      },
      (e) => {
        setCarregando(null);
        setErro(e.code === e.PERMISSION_DENIED
          ? aparelho === "ios"
            ? "A localização está bloqueada. No iPhone: Ajustes → Privacidade → Serviços de Localização → Safari → “Durante o uso”. Ou digite seu endereço abaixo."
            : aparelho === "android"
              ? "A localização está bloqueada. Toque no cadeado ao lado do endereço do site → Permissões → Localização. Ou digite seu endereço abaixo."
              : "O navegador não liberou a localização. Clique no ícone do cadeado na barra de endereço, ou digite seu endereço abaixo."
          : "Não consegui achar sua localização agora. Tente de novo em um lugar aberto, ou digite seu endereço.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  /* ── origem por endereço (Photon, gratuito) ──────────────────── */
  useEffect(() => {
    const q = busca.trim();
    if (q.length < 3) return;
    const pausa = setTimeout(async () => {
      try {
        const u = new URL(config.servicos.busca);
        u.searchParams.set("q", q); u.searchParams.set("limit", "5");
        u.searchParams.set("lat", String(config.pousada.lat)); u.searchParams.set("lon", String(config.pousada.lng));
        const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        setSugestoes((d.features ?? []).map((f: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }) => ({
          nome: f.properties.name ?? f.properties.street ?? q,
          detalhe: [f.properties.street && f.properties.name !== f.properties.street ? f.properties.street : "", f.properties.city, f.properties.state].filter(Boolean).join(", "),
          lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        })));
      } catch { setSugestoes([]); }
    }, 350);
    return () => clearTimeout(pausa);
  }, [busca, config]);

  function escolher(s: Sugestao) {
    const o: Origem = { nome: s.nome, lat: s.lat, lng: s.lng, fonte: "busca" };
    setOrigem(o); setBusca(""); setSugestoes([]);
    void calcular(o, modo, terminalId);
  }

  /* ── navegação ao vivo ───────────────────────────────────────── */
  const parar = useCallback(() => {
    if (vigia.current !== null) navigator.geolocation.clearWatch(vigia.current);
    vigia.current = null;
    trava.current?.release().catch(() => {});
    trava.current = null;
    setNavegando(false);
  }, []);

  /* A cada nova posição: chegou? próxima instrução? saiu da rota? Usa o
     estado mais recente por uma ref — este callback nasce uma vez só. */
  const atual = useRef({ trechos, todosPassos, linhaToda, modo, terminalId });
  useEffect(() => { atual.current = { trechos, todosPassos, linhaToda, modo, terminalId }; });
  function aoAndar(p: { lat: number; lng: number }) {
    const a = atual.current;
    if (!a.trechos) return;
    if (distancia(p, config.pousada) < 35) { setChegou(true); parar(); return; }
    setPasso((i) => {
      let j = i;
      while (j < a.todosPassos.length - 1 && distancia(p, { lng: a.todosPassos[j].local[0], lat: a.todosPassos[j].local[1] }) < 25) j++;
      return j;
    });
    const noBarco = a.trechos.some((t) => t.tipo === "barco" && distanciaAteLinha(p, t.linha) < 1500);
    if (!noBarco && distanciaAteLinha(p, a.linhaToda) > 90 && Date.now() - ultimoRecalculo.current > 45000) {
      ultimoRecalculo.current = Date.now();
      void calcular({ nome: "Sua localização", lat: p.lat, lng: p.lng, fonte: "gps" }, a.modo, a.terminalId);
    }
  }

  async function navegar() {
    if (!trechos) return;
    /* iPhone: a bússola precisa de permissão, pedida no toque. */
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE?.requestPermission === "function") { try { await DOE.requestPermission(); } catch { /* segue sem bússola */ } }
    try { trava.current = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock?.request("screen") ?? null; } catch { /* sem trava de tela */ }
    setNavegando(true);
    vigia.current = navigator.geolocation.watchPosition(
      (p) => {
        const agora = { lat: p.coords.latitude, lng: p.coords.longitude };
        setVoce((v) => ({ ...agora, precisao: p.coords.accuracy, direcao: p.coords.heading ?? v?.direcao ?? null }));
        aoAndar(agora);
      },
      () => setErro("Perdi o sinal de localização. A rota continua na tela."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  }

  /* bússola: gira o cone do "você" (Android: absoluto; iPhone: webkitCompassHeading) */
  useEffect(() => {
    if (!navegando) return;
    const girar = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const graus = e.webkitCompassHeading ?? (e.absolute && e.alpha !== null ? 360 - e.alpha : null);
      if (graus !== null && graus !== undefined) setVoce((v) => (v ? { ...v, direcao: Math.round(graus) } : v));
    };
    const evento = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(evento, girar as EventListener);
    return () => window.removeEventListener(evento, girar as EventListener);
  }, [navegando]);

  useEffect(() => () => parar(), [parar]);

  /* ── compartilhar / QR ───────────────────────────────────────── */
  const linkRota = origem ? `${typeof window !== "undefined" ? window.location.origin : ""}/como-chegar?de=${origem.lat.toFixed(5)},${origem.lng.toFixed(5)}&terminal=${terminalId}&modo=${modo}#rota` : "";
  async function compartilhar() {
    const url = linkRota || `${window.location.origin}/como-chegar#rota`;
    try {
      if (navigator.share) { await navigator.share({ title: "Rota até a Pousada Marimar", url }); return; }
      await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2200);
    } catch { /* cancelado */ }
  }
  async function mostrarQr() {
    if (qr) { setQr(null); return; }
    const QR = await import("qrcode");
    setQr(await QR.toString(linkRota || `${window.location.origin}/como-chegar#rota`, { type: "svg", margin: 1, width: 180, color: { dark: "#0f172a", light: "#ffffff" } }));
  }

  const externos = linksExternos(config.pousada);
  const marcadores: Marcador[] = [
    { id: "pousada", tipo: "pousada", ...config.pousada },
    ...(trechos && trechos.length > 1 ? [{ id: "trapiche", tipo: "trapiche" as const, ...config.trapiche }, { id: "terminal", tipo: "terminal" as const, nome: terminal.nome, lat: terminal.lat, lng: terminal.lng }] : []),
    ...(origem && origem.fonte !== "gps" ? [{ id: "origem", tipo: "origem" as const, ...origem }] : []),
  ];
  const proximo = todosPassos[passo];

  return (
    <div id="rota" className="scroll-mt-24">
      <div className={navegando ? "fixed inset-0 z-[60] flex flex-col bg-white" : "grid gap-5 lg:grid-cols-[minmax(0,24rem)_1fr]"}>
        {/* ── painel ── */}
        {!navegando && (
          <div className="order-2 space-y-4 lg:order-1">
            <div className="rounded-marca border border-linha/70 bg-white p-5 shadow-marca">
              <h3 className="font-semibold text-tinta">{config.textos.titulo}</h3>
              <p className="mt-1 text-sm text-tinta-suave">{config.textos.subtitulo}</p>

              <button onClick={usarLocalizacao} disabled={carregando !== null}
                className="mt-4 flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-marca px-5 font-semibold text-marca-texto shadow-marca transition-marca hover:bg-marca-hover disabled:opacity-60">
                {carregando === "gps" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
                {origem?.fonte === "gps" ? "Atualizar minha localização" : "Usar minha localização"}
              </button>

              <div className="relative mt-3">
                <label className="relative block">
                  <span className="sr-only">Ou digite de onde vai sair</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-suave" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ou digite de onde vai sair (cidade, endereço)"
                    className="w-full min-h-12 rounded-full border border-linha bg-white pl-11 pr-4 text-sm text-tinta outline-none focus:border-marca focus:ring-2 focus:ring-marca/20" autoComplete="off" />
                </label>
                {busca.trim().length >= 3 && sugestoes.length > 0 && (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-linha bg-white shadow-lg">
                    {sugestoes.map((s, i) => (
                      <li key={i}><button onClick={() => escolher(s)} className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-areia/60">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-marca" />
                        <span><span className="block text-sm text-tinta">{s.nome}</span><span className="block text-xs text-tinta-suave">{s.detalhe}</span></span>
                      </button></li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[{ nome: "Curitiba", lat: -25.4284, lng: -49.2733 }, { nome: "Aeroporto Afonso Pena", lat: -25.5317, lng: -49.1757 }, { nome: "Já estou em Encantadas", lat: config.trapiche.lat, lng: config.trapiche.lng }].map((p) => (
                  <button key={p.nome} onClick={() => { const o: Origem = { ...p, fonte: "busca" }; setOrigem(o); void calcular(o, modo, terminalId); }}
                    className="rounded-full border border-linha bg-areia/40 px-3 py-1.5 text-xs text-tinta hover:border-marca">{p.nome}</button>
                ))}
              </div>

              {origem && !naIlha(origem, config) && (
                <div className="mt-4 space-y-3 border-t border-linha/70 pt-4">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como vai até o terminal">
                    {([["carro", "De carro", Car], ["onibus", "De ônibus", Bus]] as const).map(([v, r, I]) => (
                      <button key={v} role="radio" aria-checked={modo === v} onClick={() => { setModo(v); void calcular(origem, v, terminalId); }}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-medium ${modo === v ? "border-marca bg-marca/10 text-tinta" : "border-linha text-tinta-suave"}`}>
                        <I className="h-4 w-4" /> {r}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2" role="radiogroup" aria-label="Terminal de embarque">
                    {config.terminais.map((t) => (
                      <button key={t.id} role="radio" aria-checked={terminalId === t.id} onClick={() => { setTerminalId(t.id); void calcular(origem, modo, t.id); }}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${terminalId === t.id ? "border-marca bg-marca/5" : "border-linha/70"}`}>
                        <Ship className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                        <span><span className="block text-sm font-medium text-tinta">{t.nome} <span className="font-normal text-tinta-suave">· barco ~{t.barcoMin} min</span></span>
                          {t.observacao && <span className="block text-xs text-tinta-suave">{t.observacao}</span>}</span>
                      </button>
                    ))}
                  </div>
                  {modo === "onibus" && <p className="text-xs text-tinta-suave">De ônibus o tempo é uma estimativa: confira os horários da linha até o litoral antes de sair.</p>}
                </div>
              )}
              {erro && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900" role="status">{erro}</p>}
            </div>

            {trechos && (
              <div className="rounded-marca border border-linha/70 bg-white p-5 shadow-marca">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-tinta-suave">{origem?.fonte === "salva" ? "Última rota salva" : `Saindo de ${origem?.nome}`}</p>
                    <p className="text-2xl font-bold text-tinta">{formatarDuracao(total.t)} <span className="text-base font-normal text-tinta-suave">· {formatarDistancia(total.d)}</span></p>
                  </div>
                  {carregando === "rota" && <Loader2 className="h-5 w-5 animate-spin text-marca" />}
                </div>
                <ol className="mt-4 space-y-2">
                  {trechos.map((t, i) => {
                    const I = ICONE_TRECHO[t.tipo];
                    return (
                      <li key={i} className="rounded-2xl border border-linha/60">
                        <button onClick={() => setAberto(aberto === i ? null : i)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={aberto === i}>
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${COR_TRECHO[t.tipo]}`}><I className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-tinta">{t.titulo}</span>
                            <span className="block text-xs text-tinta-suave">{formatarDuracao(t.duracao)} · {formatarDistancia(t.distancia)}{t.aproximado ? " · estimativa" : ""}</span>
                          </span>
                          <ChevronDown className={`h-4 w-4 text-tinta-suave transition-transform ${aberto === i ? "rotate-180" : ""}`} />
                        </button>
                        {aberto === i && (
                          <ol className="space-y-1.5 border-t border-linha/60 px-4 py-3 text-sm text-tinta">
                            {t.passos.map((p, j) => <li key={j} className="flex justify-between gap-3"><span>{p.texto}</span><span className="shrink-0 text-xs text-tinta-suave">{p.distancia ? formatarDistancia(p.distancia) : ""}</span></li>)}
                            {t.tipo === "barco" && <li className="text-xs text-tinta-suave">Horários e preços da travessia: veja acima nesta página.</li>}
                          </ol>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {aparelho !== "desktop" && (
                  <button onClick={navegar} className="mt-4 flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-tinta px-5 font-semibold text-white">
                    <Navigation className="h-5 w-5" /> Começar a navegação
                  </button>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={compartilhar} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-linha px-4 text-sm text-tinta hover:border-marca">
                    <Share2 className="h-4 w-4" /> {copiado ? "Link copiado" : "Enviar a rota"}
                  </button>
                  {aparelho === "desktop" && (
                    <button onClick={mostrarQr} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-linha px-4 text-sm text-tinta hover:border-marca">
                      <QrCode className="h-4 w-4" /> Abrir no celular
                    </button>
                  )}
                </div>
                {qr && (
                  <div className="mt-3 flex items-center gap-4 rounded-2xl bg-areia/50 p-3">
                    <span className="h-[120px] w-[120px] shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
                    <p className="text-xs text-tinta-suave"><Smartphone className="mb-1 h-4 w-4" />Aponte a câmera do celular: a mesma rota abre lá, pronta para navegar.</p>
                  </div>
                )}
                <p className="mt-3 text-xs text-tinta-suave">{config.textos.dicaSinal}</p>
              </div>
            )}

            <div className="rounded-marca border border-linha/70 bg-white p-4 text-sm">
              <p className="mb-2 text-xs text-tinta-suave">Prefere o app de mapas do seu aparelho?</p>
              <div className="flex flex-wrap gap-2">
                {aparelho === "ios" && <a href={externos.apple} className="rounded-full border border-linha px-4 py-2 text-tinta hover:border-marca">Apple Maps</a>}
                <a href={externos.google} target="_blank" rel="noopener noreferrer" className="rounded-full border border-linha px-4 py-2 text-tinta hover:border-marca">Google Maps</a>
                {aparelho !== "desktop" && <a href={externos.waze} className="rounded-full border border-linha px-4 py-2 text-tinta hover:border-marca">Waze</a>}
              </div>
            </div>
          </div>
        )}

        {/* ── mapa ── */}
        <div className={navegando ? "relative flex-1" : "order-1 lg:order-2"}>
          <div className={`relative overflow-hidden ${navegando ? "h-full" : "h-[58vh] min-h-[22rem] rounded-marca border border-linha/70 lg:h-[40rem]"}`}>
            <MapaRota className="h-full w-full" estilos={config.estilos} estilo={estilo} marcadores={marcadores} trechos={trechos ?? []}
              voce={voce} seguir={navegando} tresD={tresD} centro={config.pousada} />
            <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
              <div className="flex overflow-hidden rounded-full bg-white/95 p-1 shadow-lg backdrop-blur">
                {config.estilos.map((e) => (
                  <button key={e.id} onClick={() => setEstilo(e.id)} aria-pressed={estilo === e.id}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${estilo === e.id ? "bg-tinta text-white" : "text-tinta"}`}>{e.nome}</button>
                ))}
              </div>
              <button onClick={() => setTresD((v) => !v)} aria-pressed={tresD} title="Ver em 3D"
                className={`flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold shadow-lg ${tresD ? "bg-tinta text-white" : "bg-white/95 text-tinta"}`}><Box className="h-3.5 w-3.5" /> 3D</button>
            </div>

            {navegando && (
              <>
                <div className="absolute inset-x-3 top-3 z-20 rounded-2xl bg-tinta p-4 text-white shadow-2xl">
                  {proximo ? (
                    <>
                      <p className="text-xs uppercase tracking-wider text-white/70">{proximo.tipo === "barco" ? "Travessia" : "Próximo"}</p>
                      <p className="mt-0.5 text-lg font-semibold leading-snug">{proximo.texto}</p>
                      {voce && <p className="mt-1 text-sm text-white/80">em {formatarDistancia(distancia(voce, { lat: proximo.local[1], lng: proximo.local[0] }))} · faltam {formatarDistancia(distancia(voce, config.pousada))} até a pousada</p>}
                    </>
                  ) : <p className="font-semibold">Procurando sua posição…</p>}
                </div>
                <div className="absolute inset-x-3 bottom-4 z-20 flex gap-2">
                  <button onClick={() => setVoce((v) => (v ? { ...v } : v))} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white font-semibold text-tinta shadow-xl">
                    <Compass className="h-5 w-5" /> Centralizar
                  </button>
                  <button onClick={parar} className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-6 font-semibold text-white shadow-xl">
                    <X className="h-5 w-5" /> Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {chegou && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-tinta/50 p-6" role="dialog" aria-label="Você chegou">
          <div className="max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <PartyPopper className="mx-auto h-10 w-10 text-marca" />
            <p className="mt-3 text-lg font-semibold text-tinta">{config.textos.chegada}</p>
            <button onClick={() => setChegou(false)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-marca px-6 font-semibold text-marca-texto">
              <RotateCcw className="h-4 w-4" /> Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
