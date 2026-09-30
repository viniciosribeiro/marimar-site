"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapaML, Marker as MarcadorML, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EstiloMapa, Trecho } from "@/lib/rota-base";

/**
 * O mapa da rota. MapLibre GL (código aberto, sem chave) com os estilos do
 * OpenFreeMap. Carrega só no navegador e só quando a seção aparece —
 * o resto do site não paga o peso do mapa.
 *
 * Trechos: carro (linha cheia), barco (tracejado animado), a pé (pontilhado).
 * Marcadores: pousada, trapiche, terminal, origem e "você" (ponto azul com
 * halo de precisão e cone de direção).
 */

export type Marcador = { id: string; tipo: "pousada" | "trapiche" | "terminal" | "origem"; lat: number; lng: number; nome: string; arrastavel?: boolean };
export type Voce = { lat: number; lng: number; precisao?: number; direcao?: number | null };

type Props = {
  estilos: EstiloMapa[];
  estilo: string;
  marcadores: Marcador[];
  trechos: Trecho[];
  voce?: Voce | null;
  seguir?: boolean;
  tresD?: boolean;
  centro: { lat: number; lng: number };
  aoMover?: (id: string, lat: number, lng: number) => void;
  aoFalhar?: (motivo: string) => void;
  className?: string;
};

const COR = { carro: "#2563eb", barco: "#0891b2", pe: "#ea580c" };
const ICONE: Record<Marcador["tipo"], string> = { pousada: "🏡", trapiche: "⚓", terminal: "⛴️", origem: "📍" };

function elementoMarcador(m: Marcador): HTMLElement {
  /* O MapLibre posiciona o elemento externo com transform/position
     inline; o desenho (gota girada) fica num filho, senão um sobrescreve
     o outro e o pino sai do lugar ou deixa de arrastar. */
  const el = document.createElement("div");
  el.className = `rota-pino${m.arrastavel ? " rota-pino--arrastavel" : ""}`;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", m.nome);
  el.title = m.arrastavel ? `${m.nome} — arraste para ajustar` : m.nome;
  el.innerHTML = `<div class="rota-marcador rota-marcador--${m.tipo}"><span class="rota-marcador__pulso"></span><span class="rota-marcador__icone">${ICONE[m.tipo]}</span></div>`;
  return el;
}

function elementoVoce(): HTMLElement {
  const el = document.createElement("div");
  el.className = "rota-voce";
  el.setAttribute("aria-label", "Você está aqui");
  el.innerHTML = `<span class="rota-voce__cone"></span><span class="rota-voce__halo"></span><span class="rota-voce__ponto"></span>`;
  return el;
}

const geojson = (t: Trecho[], tipo: Trecho["tipo"]) => ({
  type: "FeatureCollection" as const,
  features: t.filter((x) => x.tipo === tipo).map((x) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: x.linha } })),
});

export default function MapaRota({ estilos, estilo, marcadores, trechos, voce, seguir, tresD, centro, aoMover, aoFalhar, className }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaML | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const pinos = useRef<Map<string, MarcadorML>>(new Map());
  const pinoVoce = useRef<MarcadorML | null>(null);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState<string | null>(null);
  const dados = useRef({ trechos, tresD });
  dados.current = { trechos, tresD };

  /* Camadas da rota: precisam ser recriadas a cada troca de estilo. */
  function desenharCamadas(m: MapaML) {
    for (const tipo of ["carro", "barco", "pe"] as const) {
      const id = `rota-${tipo}`;
      if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: geojson(dados.current.trechos, tipo) });
      if (!m.getLayer(`${id}-borda`)) {
        m.addLayer({ id: `${id}-borda`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": tipo === "carro" ? 9 : 7, "line-opacity": 0.9 } });
      }
      if (!m.getLayer(id)) {
        m.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": COR[tipo], "line-width": tipo === "carro" ? 5 : 4,
            ...(tipo === "barco" ? { "line-dasharray": [2, 2] } : tipo === "pe" ? { "line-dasharray": [0.6, 1.6] } : {}),
          } });
      }
    }
    aplicar3D(m, dados.current.tresD ?? false);
  }

  function aplicar3D(m: MapaML, ligado: boolean) {
    m.easeTo({ pitch: ligado ? 55 : 0, duration: 600 });
    /* Prédios em 3D quando o estilo tem a camada de edifícios (OpenMapTiles). */
    const fonte = Object.entries(m.getStyle()?.sources ?? {}).find(([, s]) => (s as { type: string }).type === "vector")?.[0];
    if (ligado && fonte && !m.getLayer("predios-3d")) {
      try {
        m.addLayer({ id: "predios-3d", type: "fill-extrusion", source: fonte, "source-layer": "building", minzoom: 14,
          paint: { "fill-extrusion-color": "#e7ded2", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.75 } });
      } catch { /* estilo sem edifícios: fica só a inclinação */ }
    }
    if (!ligado && m.getLayer("predios-3d")) m.removeLayer("predios-3d");
  }

  /* cria o mapa uma vez */
  useEffect(() => {
    let vivo = true;
    let animacao = 0;
    const meusPinos = pinos.current;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (!vivo || !caixa.current) return;
        /* Worker servido como estático (scripts/copiar-maplibre.mjs). */
        ml.setWorkerUrl(`${window.location.origin}/vendor/maplibre/maplibre-gl-worker.mjs`);
        lib.current = ml;
        const url = estilos.find((e) => e.id === estilo)?.url ?? estilos[0]?.url;
        const m = new ml.Map({
          container: caixa.current, style: url, center: [centro.lng, centro.lat], zoom: 13,
          attributionControl: false, cooperativeGestures: false,
        });
        m.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
        m.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
        m.addControl(new ml.AttributionControl({ compact: true, customAttribution: "Rotas: OSRM · FOSSGIS · © OpenStreetMap" }), "bottom-right");
        m.on("style.load", () => desenharCamadas(m));
        m.on("load", () => { if (vivo) setPronto(true); });
        m.on("error", (e) => {
          const msg = String((e as { error?: { message?: string } }).error?.message ?? "");
          if (/style|Failed to fetch|NetworkError|load/i.test(msg) && !m.isStyleLoaded()) {
            setFalhou("O mapa não carregou (sem internet?). O passo a passo continua abaixo.");
            aoFalhar?.(msg);
          }
        });
        mapa.current = m;
        /* Barco: tracejado andando, como uma travessia. */
        let passo = 0;
        const sequencia = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0]];
        const animar = () => {
          if (!vivo) return;
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && m.getLayer("rota-barco")) {
            passo = (passo + 1) % (sequencia.length * 6);
            if (passo % 6 === 0) m.setPaintProperty("rota-barco", "line-dasharray", sequencia[passo / 6]);
          }
          animacao = requestAnimationFrame(animar);
        };
        animacao = requestAnimationFrame(animar);
      } catch (e) {
        setFalhou("Este aparelho não conseguiu abrir o mapa. O passo a passo continua abaixo.");
        aoFalhar?.((e as Error).message);
      }
    })();
    return () => {
      vivo = false;
      cancelAnimationFrame(animacao);
      mapa.current?.remove();
      mapa.current = null;
      meusPinos.clear();
      pinoVoce.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* estilo */
  useEffect(() => {
    const m = mapa.current;
    const url = estilos.find((e) => e.id === estilo)?.url;
    if (m && pronto && url) m.setStyle(url);
  }, [estilo, estilos, pronto]);

  /* trechos */
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto) return;
    for (const tipo of ["carro", "barco", "pe"] as const) {
      (m.getSource(`rota-${tipo}`) as GeoJSONSource | undefined)?.setData(geojson(trechos, tipo));
    }
    const pontos = trechos.flatMap((t) => t.linha);
    if (pontos.length && lib.current && !seguir) {
      const b = new lib.current.LngLatBounds(pontos[0], pontos[0]);
      pontos.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: { top: 60, bottom: 60, left: 50, right: 50 }, maxZoom: 16, duration: 900 });
    }
  }, [trechos, pronto, seguir]);

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

  /* você */
  useEffect(() => {
    const m = mapa.current, ml = lib.current;
    if (!m || !ml || !pronto) return;
    if (!voce) { pinoVoce.current?.remove(); pinoVoce.current = null; return; }
    if (!pinoVoce.current) pinoVoce.current = new ml.Marker({ element: elementoVoce() }).setLngLat([voce.lng, voce.lat]).addTo(m);
    pinoVoce.current.setLngLat([voce.lng, voce.lat]);
    const el = pinoVoce.current.getElement();
    el.style.setProperty("--direcao", `${voce.direcao ?? 0}deg`);
    el.dataset.direcao = voce.direcao == null ? "nao" : "sim";
    if (seguir) m.easeTo({ center: [voce.lng, voce.lat], zoom: Math.max(m.getZoom(), 16), bearing: voce.direcao ?? m.getBearing(), duration: 800 });
  }, [voce, seguir, pronto]);

  /* 3D */
  useEffect(() => {
    const m = mapa.current;
    if (m && pronto && m.isStyleLoaded()) aplicar3D(m, !!tresD);
  }, [tresD, pronto]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {/* A CSS do MapLibre põe `position: relative` no container: o
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
