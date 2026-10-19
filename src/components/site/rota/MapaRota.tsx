"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapaML, Marker as MarcadorML, LngLatBounds as LimitesML, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { luzDaHora, type EstiloMapa, type LngLat, type Trecho } from "@/lib/rota-base";

/**
 * O mapa da rota. Dois motores, a mesma tela:
 *  - gratuito (padrão): MapLibre GL com os estilos do OpenFreeMap e, no 3D,
 *    relevo dos Terrain Tiles (AWS) e prédios em pé;
 *  - Mapbox (opcional, painel → Rota e mapa): Mapbox GL com o estilo
 *    Standard — prédios, árvores, satélite e a luz da hora na ilha. Se o
 *    Mapbox não abrir (token errado, cota, rede), avisa `aoFalharMapbox` e
 *    quem chamou volta para o gratuito.
 * Carrega só no navegador e só quando a seção aparece — o resto do site não
 * paga o peso do mapa. Abre em 3D (inclinado) por padrão; dá para trocar.
 *
 * Trechos: carro (linha cheia), barco (tracejado animado), a pé (pontilhado).
 * Marcadores: pousada, trapiche, terminal, origem e "você" (ponto azul com
 * halo e cone; na navegação, uma seta deitada no chão).
 */

export type Marcador = { id: string; tipo: "pousada" | "trapiche" | "terminal" | "origem"; lat: number; lng: number; nome: string; arrastavel?: boolean };
/** `suave`: em quantos ms o ponto desliza até a posição nova (GPS de verdade); 0 = salta. */
export type Voce = { lat: number; lng: number; precisao?: number; direcao?: number | null; suave?: number };
/** Câmera da navegação: o mapa acompanha a pessoa, virado para onde o caminho vai. `duracao` 0 = salta (a cada quadro). */
export type CameraNav = { lat: number; lng: number; rumo: number; zoom: number; duracao: number };

type Props = {
  estilos: EstiloMapa[];
  estilo: string;
  marcadores: Marcador[];
  trechos: Trecho[];
  voce?: Voce | null;
  tresD?: boolean;
  centro: { lat: number; lng: number };
  /** Token público do Mapbox: com ele, o mapa é o do Mapbox. */
  mapbox?: string | null;
  /** Relevo do 3D gratuito (formato Terrarium). */
  relevo?: string;
  /** Navegação: a câmera segue a pessoa. null/undefined = câmera livre. */
  camera?: CameraNav | null;
  /** A parte do caminho já andada (fica cinza). */
  andado?: LngLat[] | null;
  /** Mudar este número enquadra o caminho inteiro ("visão geral"). */
  enquadrar?: number;
  /** Tela de navegação: sem botões de zoom, "você" vira seta. */
  navegacao?: boolean;
  /** Abre com um voo suave até a pousada quando a seção aparece. */
  intro?: boolean;
  /** A pessoa mexeu no mapa (arrastou, girou, deu zoom): a câmera para de seguir. */
  aoMexer?: () => void;
  /** O mapa terminou de abrir. */
  aoPronto?: () => void;
  aoMover?: (id: string, lat: number, lng: number) => void;
  aoFalhar?: (motivo: string) => void;
  aoFalharMapbox?: (motivo: string) => void;
  className?: string;
};

type Lib = { Marker: typeof import("maplibre-gl").Marker; LngLatBounds: typeof import("maplibre-gl").LngLatBounds };
/** O que só o Mapbox tem (configuração do estilo Standard). */
type ExtraMapbox = { setConfigProperty?: (importId: string, chave: string, valor: unknown) => void };

const COR = { carro: "#2563eb", barco: "#0891b2", pe: "#ea580c" };
const ICONE: Record<Marcador["tipo"], string> = { pousada: "🏡", trapiche: "⚓", terminal: "⛴️", origem: "📍" };
const PITCH_3D = 58;
const PITCH_NAV = 62;
const semMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Hora na Ilha do Mel (Brasília), para a luz do Mapbox Standard. */
function horaNaIlha(): number {
  try { return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date())); }
  catch { return new Date().getHours(); }
}

function elementoMarcador(m: Marcador): HTMLElement {
  /* O mapa posiciona o elemento externo com transform/position inline; o
     desenho (gota girada) fica num filho, senão um sobrescreve o outro e o
     pino sai do lugar ou deixa de arrastar. */
  const el = document.createElement("div");
  el.className = `rota-pino${m.arrastavel ? " rota-pino--arrastavel" : ""}`;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", m.nome);
  el.title = m.arrastavel ? `${m.nome} — arraste para ajustar` : m.nome;
  el.innerHTML = `<div class="rota-marcador rota-marcador--${m.tipo}"><span class="rota-marcador__pulso"></span><span class="rota-marcador__icone">${ICONE[m.tipo]}</span></div>`;
  return el;
}

function elementoVoce(navegacao: boolean): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Você está aqui");
  if (navegacao) {
    /* Seta de GPS deitada no chão (gira e inclina com o mapa). */
    el.className = "rota-seta";
    el.innerHTML = `<span class="rota-seta__halo"></span><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 41 42 24 33 7 42Z"/></svg>`;
  } else {
    el.className = "rota-voce";
    el.innerHTML = `<span class="rota-voce__cone"></span><span class="rota-voce__halo"></span><span class="rota-voce__ponto"></span>`;
  }
  return el;
}

const geojson = (t: Trecho[], tipo: Trecho["tipo"]) => ({
  type: "FeatureCollection" as const,
  features: t.filter((x) => x.tipo === tipo).map((x) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: x.linha } })),
});
const linhaGeo = (l: LngLat[] | null | undefined) => ({
  type: "FeatureCollection" as const,
  features: l && l.length >= 2 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: l } }] : [],
});

export default function MapaRota({
  estilos, estilo, marcadores, trechos, voce, tresD, centro, mapbox, relevo, camera, andado, enquadrar, navegacao, intro,
  aoMexer, aoPronto, aoMover, aoFalhar, aoFalharMapbox, className,
}: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaML | null>(null);
  const lib = useRef<Lib | null>(null);
  const pinos = useRef<Map<string, MarcadorML>>(new Map());
  const pinoVoce = useRef<MarcadorML | null>(null);
  const deslize = useRef(0);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState<string | null>(null);
  /* O que os callbacks do mapa (criados uma vez) precisam ler sempre atualizado. */
  const dados = useRef({ trechos, tresD, andado, relevo, aoMexer, aoPronto, aoFalharMapbox, aoFalhar });
  dados.current = { trechos, tresD, andado, relevo, aoMexer, aoPronto, aoFalharMapbox, aoFalhar };
  const estiloAplicado = useRef<string | undefined>(undefined);
  const usaMapbox = !!mapbox;

  /* Camadas da rota: recriadas a cada troca de estilo. */
  function desenharCamadas(m: MapaML) {
    /* No Mapbox Standard a luz escurece tudo à noite; a rota continua acesa. */
    const acesa = usaMapbox ? { "line-emissive-strength": 1 } : {};
    for (const tipo of ["carro", "barco", "pe"] as const) {
      const id = `rota-${tipo}`;
      if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: geojson(dados.current.trechos, tipo) });
      if (!m.getLayer(`${id}-brilho`)) {
        m.addLayer({ id: `${id}-brilho`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": COR[tipo], "line-width": tipo === "carro" ? 18 : 14, "line-blur": 8, "line-opacity": 0.28, ...acesa } as never });
      }
      if (!m.getLayer(`${id}-borda`)) {
        m.addLayer({ id: `${id}-borda`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": tipo === "carro" ? 9 : 7, "line-opacity": 0.95, ...acesa } as never });
      }
      if (!m.getLayer(id)) {
        m.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": COR[tipo], "line-width": tipo === "carro" ? 5 : 4, ...acesa,
            ...(tipo === "barco" ? { "line-dasharray": [2, 2] } : tipo === "pe" ? { "line-dasharray": [0.6, 1.6] } : {}),
          } as never });
      }
    }
    if (!m.getSource("rota-andada")) m.addSource("rota-andada", { type: "geojson", data: linhaGeo(dados.current.andado) });
    if (!m.getLayer("rota-andada")) {
      m.addLayer({ id: "rota-andada", type: "line", source: "rota-andada", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#94a3b8", "line-width": 7, "line-opacity": 0.95, ...acesa } as never });
    }
    if (usaMapbox) {
      const mb = m as unknown as ExtraMapbox;
      try { mb.setConfigProperty?.("basemap", "lightPreset", luzDaHora(horaNaIlha())); } catch { /* estilo sem luz */ }
    }
    aplicar3D(m, dados.current.tresD ?? false, false);
  }

  /** Relevo, céu e prédios. A inclinação da câmera fica com quem move a câmera. */
  function aplicar3D(m: MapaML, ligado: boolean, inclinar: boolean) {
    if (inclinar && !navegacao) m.easeTo({ pitch: ligado ? PITCH_3D : 0, duration: semMovimento() ? 0 : 900 });
    try {
      if (usaMapbox) {
        const mb = m as unknown as ExtraMapbox;
        try { mb.setConfigProperty?.("basemap", "show3dObjects", ligado); } catch { /* estilo sem a opção */ }
        if (ligado) {
          if (!m.getSource("mapbox-dem")) m.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 } as never);
          m.setTerrain({ source: "mapbox-dem", exaggeration: 1.3 });
        } else m.setTerrain(null);
        return;
      }
      const url = dados.current.relevo;
      if (ligado && url) {
        if (!m.getSource("relevo")) {
          m.addSource("relevo", { type: "raster-dem", tiles: [url], encoding: "terrarium", tileSize: 256, maxzoom: 15,
            attribution: "Relevo: Mapzen · AWS Terrain Tiles" });
        }
        m.setTerrain({ source: "relevo", exaggeration: 1.3 });
        m.setSky({ "sky-color": "#7cc4ef", "horizon-color": "#f3ead9", "fog-color": "#eef4f6", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.85, "atmosphere-blend": 0.8 });
      } else if (!ligado) {
        m.setTerrain(null);
      }
      /* Prédios em pé, quando o estilo tem a camada de edifícios e ainda não os ergue. */
      const estilo = m.getStyle();
      const jaTem = estilo?.layers?.some((l) => l.type === "fill-extrusion" && l.id !== "predios-3d");
      const fonte = Object.entries(estilo?.sources ?? {}).find(([, s]) => (s as { type: string }).type === "vector")?.[0];
      if (ligado && !jaTem && fonte && !m.getLayer("predios-3d")) {
        m.addLayer({ id: "predios-3d", type: "fill-extrusion", source: fonte, "source-layer": "building", minzoom: 14,
          paint: { "fill-extrusion-color": "#e7ded2", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.8 } });
      }
      if (!ligado && m.getLayer("predios-3d")) m.removeLayer("predios-3d");
    } catch { /* estilo sem relevo/edifícios: fica só a inclinação */ }
  }

  /* cria o mapa uma vez (trocar de motor = o componente é recriado, ver `key` em quem usa) */
  useEffect(() => {
    let vivo = true;
    let animacao = 0;
    let carregou = false;
    const meusPinos = pinos.current;
    const url = estilos.find((e) => e.id === estilo)?.url ?? estilos[0]?.url;
    const inicio = {
      center: [centro.lng, centro.lat] as [number, number],
      zoom: intro ? 12 : 13,
      pitch: navegacao ? PITCH_NAV : 0,
      bearing: 0,
    };
    (async () => {
      try {
        let m: MapaML;
        if (mapbox) {
          const mb = (await import("mapbox-gl")).default;
          if (!vivo || !caixa.current) return;
          m = new mb.Map({
            container: caixa.current, style: url, ...inicio, accessToken: mapbox, language: "pt",
            attributionControl: false, cooperativeGestures: false, performanceMetricsCollection: false,
            config: { basemap: { lightPreset: luzDaHora(horaNaIlha()), show3dObjects: !!tresD } },
          }) as unknown as MapaML;
          lib.current = { Marker: mb.Marker as unknown as Lib["Marker"], LngLatBounds: mb.LngLatBounds as unknown as Lib["LngLatBounds"] };
          if (!navegacao) m.addControl(new mb.NavigationControl({ visualizePitch: true }) as never, "top-right");
          m.addControl(new mb.AttributionControl({ compact: true, customAttribution: "Rotas: OSRM · FOSSGIS · © OpenStreetMap" }) as never, "bottom-right");
        } else {
          const ml = await import("maplibre-gl");
          if (!vivo || !caixa.current) return;
          /* Worker servido como estático (scripts/copiar-maplibre.mjs). */
          ml.setWorkerUrl(`${window.location.origin}/vendor/maplibre/maplibre-gl-worker.mjs`);
          lib.current = { Marker: ml.Marker, LngLatBounds: ml.LngLatBounds };
          m = new ml.Map({ container: caixa.current, style: url, ...inicio, attributionControl: false, cooperativeGestures: false, maxPitch: 75 });
          if (!navegacao) {
            m.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
            m.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
          }
          m.addControl(new ml.AttributionControl({ compact: true, customAttribution: "Rotas: OSRM · FOSSGIS · © OpenStreetMap" }), "bottom-right");
        }
        m.on("style.load", () => desenharCamadas(m));
        estiloAplicado.current = url;
        m.on("load", () => {
          carregou = true;
          if (!vivo) return;
          /* Na navegação os créditos começam fechados (botão "i"): o mapa fica livre. */
          if (navegacao) caixa.current?.querySelectorAll(".maplibregl-compact-show, .mapboxgl-compact-show")
            .forEach((el) => el.classList.remove("maplibregl-compact-show", "mapboxgl-compact-show"));
          setPronto(true);
          dados.current.aoPronto?.();
        });
        m.on("error", (e) => {
          const erro = (e as { error?: { message?: string; status?: number } }).error;
          const msg = String(erro?.message ?? "");
          /* Só o estilo que não abriu derruba o mapa; um ladrilho que falhou (relevo, rua) não. */
          const deLadrilho = !!(e as { sourceId?: string }).sourceId || /tile|terrarium|elevation/i.test(msg);
          /* Mapbox recusou (token, cota) ou não abriu: quem chamou volta para o gratuito. */
          if (mapbox && (erro?.status === 401 || erro?.status === 403 || (!carregou && !deLadrilho))) {
            dados.current.aoFalharMapbox?.(msg || `HTTP ${erro?.status}`);
            return;
          }
          if (!carregou && !deLadrilho && /style|Failed to fetch|NetworkError|load/i.test(msg)) {
            setFalhou("O mapa não carregou (sem internet?). O passo a passo continua abaixo.");
            dados.current.aoFalhar?.(msg);
          }
        });
        /* A pessoa mexeu no mapa (com o dedo ou o mouse, não por código). */
        for (const ev of ["dragstart", "rotatestart", "pitchstart", "zoomstart"] as const) {
          m.on(ev, (e: { originalEvent?: Event }) => { if (e.originalEvent) dados.current.aoMexer?.(); });
        }
        mapa.current = m;
        /* Barco: tracejado andando, como uma travessia. */
        let passo = 0;
        const sequencia = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0]];
        const animar = () => {
          if (!vivo) return;
          if (!semMovimento() && m.getLayer("rota-barco")) {
            passo = (passo + 1) % (sequencia.length * 6);
            if (passo % 6 === 0) m.setPaintProperty("rota-barco", "line-dasharray", sequencia[passo / 6]);
          }
          animacao = requestAnimationFrame(animar);
        };
        animacao = requestAnimationFrame(animar);
      } catch (e) {
        if (mapbox) { dados.current.aoFalharMapbox?.((e as Error).message); return; }
        setFalhou("Este aparelho não conseguiu abrir o mapa. O passo a passo continua abaixo.");
        dados.current.aoFalhar?.((e as Error).message);
      }
    })();
    return () => {
      vivo = false;
      cancelAnimationFrame(animacao);
      cancelAnimationFrame(deslize.current);
      mapa.current?.remove();
      mapa.current = null;
      meusPinos.clear();
      pinoVoce.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* abertura: um voo suave até a pousada, quando o mapa aparece na tela */
  useEffect(() => {
    const m = mapa.current, el = caixa.current;
    if (!m || !el || !pronto || !intro || navegacao || trechos.length) return;
    const voar = () => {
      const alvo = { center: [centro.lng, centro.lat] as [number, number], zoom: 16.3, pitch: tresD ? PITCH_3D + 4 : 0, bearing: tresD ? -28 : 0 };
      if (semMovimento()) m.jumpTo(alvo);
      else m.flyTo({ ...alvo, duration: 3600, curve: 1.25, essential: false });
    };
    const olho = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) { olho.disconnect(); voar(); } }, { threshold: 0.35 });
    olho.observe(el);
    return () => olho.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto]);

  /* estilo */
  useEffect(() => {
    const m = mapa.current;
    const url = estilos.find((e) => e.id === estilo)?.url;
    if (m && pronto && url && url !== estiloAplicado.current) { estiloAplicado.current = url; m.setStyle(url); }
  }, [estilo, estilos, pronto]);

  /* trechos */
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto) return;
    for (const tipo of ["carro", "barco", "pe"] as const) {
      (m.getSource(`rota-${tipo}`) as GeoJSONSource | undefined)?.setData(geojson(trechos, tipo));
    }
    if (!navegacao) enquadrarCaminho(m, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trechos, pronto]);

  function enquadrarCaminho(m: MapaML, nav: boolean) {
    const pontos = trechos.flatMap((t) => t.linha);
    if (!pontos.length || !lib.current) return;
    const b: LimitesML = new lib.current.LngLatBounds(pontos[0], pontos[0]);
    pontos.forEach((p) => b.extend(p));
    const alto = caixa.current?.clientHeight ?? 600;
    m.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    m.fitBounds(b, {
      padding: nav ? { top: Math.min(200, alto * 0.26), bottom: Math.min(220, alto * 0.3), left: 40, right: 40 } : { top: 60, bottom: 60, left: 50, right: 50 },
      maxZoom: 16.5, pitch: tresD ? (nav ? 45 : 50) : 0, bearing: 0, duration: semMovimento() ? 0 : 1300,
    });
  }

  /* visão geral (pedida por um botão) */
  useEffect(() => {
    const m = mapa.current;
    if (m && pronto && enquadrar) enquadrarCaminho(m, !!navegacao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquadrar]);

  /* câmera da navegação: segue a pessoa, virada para onde o caminho vai */
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto || !camera) return;
    const alto = caixa.current?.clientHeight ?? 700;
    /* A pessoa fica no terço de baixo: sobra tela para o caminho à frente. */
    const opcoes = {
      center: [camera.lng, camera.lat] as [number, number], bearing: camera.rumo, zoom: camera.zoom,
      pitch: tresD ? PITCH_NAV : 0, padding: { top: alto * 0.4, bottom: 0, left: 0, right: 0 },
    };
    if (camera.duracao <= 0 || semMovimento()) m.jumpTo(opcoes);
    else m.easeTo({ ...opcoes, duration: camera.duracao, easing: (t: number) => t });
  }, [camera, pronto, tresD]);

  /* parte já andada */
  useEffect(() => {
    const m = mapa.current;
    if (m && pronto) (m.getSource("rota-andada") as GeoJSONSource | undefined)?.setData(linhaGeo(andado));
  }, [andado, pronto]);

  /* marcadores */
  useEffect(() => {
    const m = mapa.current, ml = lib.current;
    if (!m || !ml || !pronto) return;
    const vistos = new Set<string>();
    for (const mk of marcadores) {
      vistos.add(mk.id);
      let p = pinos.current.get(mk.id);
      if (!p) {
        p = new ml.Marker({ element: elementoMarcador(mk), draggable: !!mk.arrastavel, anchor: "bottom" }).setLngLat([mk.lng, mk.lat]).addTo(m);
        if (mk.arrastavel) p.on("dragend", () => { const ll = p!.getLngLat(); aoMover?.(mk.id, ll.lat, ll.lng); });
        pinos.current.set(mk.id, p);
      } else {
        p.setLngLat([mk.lng, mk.lat]);
      }
    }
    for (const [id, p] of pinos.current) if (!vistos.has(id)) { p.remove(); pinos.current.delete(id); }
  }, [marcadores, pronto, aoMover]);

  /* você: desliza até a posição nova (GPS) ou salta (prévia, a cada quadro) */
  useEffect(() => {
    const m = mapa.current, ml = lib.current;
    if (!m || !ml || !pronto) return;
    if (!voce) { pinoVoce.current?.remove(); pinoVoce.current = null; return; }
    if (!pinoVoce.current) {
      pinoVoce.current = new ml.Marker(navegacao
        ? { element: elementoVoce(true), rotationAlignment: "map", pitchAlignment: "map" }
        : { element: elementoVoce(false) }).setLngLat([voce.lng, voce.lat]).addTo(m);
    }
    const pino = pinoVoce.current;
    if (navegacao) pino.setRotation(voce.direcao ?? 0);
    else {
      const el = pino.getElement();
      el.style.setProperty("--direcao", `${voce.direcao ?? 0}deg`);
      el.dataset.direcao = voce.direcao == null ? "nao" : "sim";
    }
    cancelAnimationFrame(deslize.current);
    const de = pino.getLngLat();
    const tempo = voce.suave && !semMovimento() ? voce.suave : 0;
    if (!tempo) { pino.setLngLat([voce.lng, voce.lat]); return; }
    const t0 = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / tempo);
      pino.setLngLat([de.lng + (voce.lng - de.lng) * t, de.lat + (voce.lat - de.lat) * t]);
      if (t < 1) deslize.current = requestAnimationFrame(passo);
    };
    deslize.current = requestAnimationFrame(passo);
  }, [voce, pronto, navegacao]);

  /* 3D ↔ 2D */
  useEffect(() => {
    const m = mapa.current;
    if (m && pronto && m.isStyleLoaded()) aplicar3D(m, !!tresD, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tresD, pronto]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {/* A CSS do mapa põe `position: relative` no container: o
          posicionamento absoluto fica numa caixa por fora, e o mapa ocupa 100%. */}
      <div className="absolute inset-0"><div ref={caixa} className="h-full w-full" /></div>
      {!pronto && !falhou && (
        <div className="absolute inset-0 flex items-center justify-center bg-areia/60 text-sm text-tinta-suave">
          <span className="animate-pulse">Carregando o mapa…</span>
        </div>
      )}
      {falhou && (
        <div className="absolute inset-0 flex items-center justify-center bg-areia/90 p-6 text-center text-sm text-tinta">{falhou}</div>
      )}
    </div>
  );
}
