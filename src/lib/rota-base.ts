/**
 * Rota até a pousada, traçada no próprio site. Parte sem banco e sem rede:
 * tipos, padrões, geometria e o texto das instruções. Testes:
 * testes/unit/rota.test.ts. Fluxo e serviços: docs/fluxo-rota.md.
 *
 * Tudo gratuito e sem chave: mapa MapLibre (código aberto) com estilos do
 * OpenFreeMap, rotas do OSRM da FOSSGIS (dados OpenStreetMap), busca de
 * endereço do Photon (Komoot). Os endereços dos serviços ficam na
 * configuração (painel → Rota e mapa), para trocar sem mexer em código.
 */

export type Ponto = { nome: string; lat: number; lng: number };
export type LngLat = [number, number];
export type Terminal = Ponto & { id: string; barcoMin: number; principal?: boolean; observacao?: string };
export type EstiloMapa = { id: string; nome: string; url: string };

export type RotaConfig = {
  ativo: boolean;
  pousada: Ponto;
  trapiche: Ponto;
  terminais: Terminal[];
  /** Contorno aproximado da Ilha do Mel ([lng, lat]): dentro dele a rota é só a pé. */
  ilha: LngLat[];
  estilos: EstiloMapa[];
  estiloPadrao: string;
  servicos: { rotaCarro: string; rotaPe: string; busca: string };
  textos: { titulo: string; subtitulo: string; dicaSinal: string; chegada: string };
  /** Pontos marcados como "confira": o painel avisa até alguém confirmar. */
  conferido: boolean;
};

export const ROTA_PADRAO: RotaConfig = {
  ativo: true,
  /* A entrada da pousada é pelo restaurante (conteudo-pousada.ts, ENDERECO). */
  pousada: { nome: "Pousada Marimar", lat: -25.5684375, lng: -48.3151875 },
  /* Aproximado a partir do mapa do OpenStreetMap — conferir no painel. */
  trapiche: { nome: "Trapiche de Encantadas", lat: -25.5719, lng: -48.3157 },
  terminais: [
    { id: "pontal", nome: "Terminal de Pontal do Sul", lat: -25.5813, lng: -48.3524, barcoMin: 30, principal: true,
      observacao: "Embarque mais rápido para Encantadas. Há estacionamentos privados perto." },
    { id: "paranagua", nome: "Terminal de Paranaguá", lat: -25.5163, lng: -48.5102, barcoMin: 90,
      observacao: "Travessia mais longa, com menos horários." },
  ],
  /* Contorno grosseiro, com folga na costa — separa a ilha de Pontal do Sul
     (do outro lado do canal), que um retângulo não separa. */
  ilha: [
    [-48.300, -25.482], [-48.283, -25.500], [-48.282, -25.535], [-48.296, -25.556], [-48.300, -25.575],
    [-48.312, -25.592], [-48.328, -25.588], [-48.330, -25.565], [-48.335, -25.550], [-48.360, -25.548],
    [-48.395, -25.530], [-48.385, -25.510], [-48.345, -25.495], [-48.320, -25.480],
  ],
  estilos: [
    { id: "mapa", nome: "Mapa", url: "https://tiles.openfreemap.org/styles/liberty" },
    { id: "claro", nome: "Claro", url: "https://tiles.openfreemap.org/styles/positron" },
    { id: "colorido", nome: "Colorido", url: "https://tiles.openfreemap.org/styles/bright" },
  ],
  estiloPadrao: "mapa",
  servicos: {
    rotaCarro: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
    rotaPe: "https://routing.openstreetmap.de/routed-foot/route/v1/driving",
    busca: "https://photon.komoot.io/api/",
  },
  textos: {
    titulo: "Trace sua rota até a pousada",
    subtitulo: "De onde você estiver: de carro ou ônibus até o terminal, de barco até Encantadas e a pé até a nossa porta.",
    dicaSinal: "O sinal em Encantadas é fraco. Abra a rota antes de embarcar: ela fica guardada neste aparelho.",
    chegada: "Você chegou! A entrada é pelo nosso restaurante, de frente para o mar. Seja bem-vindo(a) 🌴",
  },
  conferido: false,
};

/** Junta o que está salvo com o padrão: campo novo no código funciona sem cadastro. */
export function mesclarRota(salvo: unknown): RotaConfig {
  const s = (salvo && typeof salvo === "object" ? salvo : {}) as Partial<RotaConfig>;
  const num = (v: unknown, p: number) => (typeof v === "number" && Number.isFinite(v) ? v : p);
  const ponto = (v: Partial<Ponto> | undefined, p: Ponto): Ponto => ({ nome: v?.nome?.trim() || p.nome, lat: num(v?.lat, p.lat), lng: num(v?.lng, p.lng) });
  const terminais = Array.isArray(s.terminais) && s.terminais.length
    ? s.terminais.map((t, i) => ({ ...ROTA_PADRAO.terminais[i] ?? ROTA_PADRAO.terminais[0], ...t, ...ponto(t, ROTA_PADRAO.terminais[i] ?? ROTA_PADRAO.terminais[0]), barcoMin: num(t.barcoMin, 45) }))
    : ROTA_PADRAO.terminais;
  const estilos = Array.isArray(s.estilos) && s.estilos.length ? s.estilos.filter((e) => e?.url) : ROTA_PADRAO.estilos;
  return {
    ativo: s.ativo ?? ROTA_PADRAO.ativo,
    pousada: ponto(s.pousada, ROTA_PADRAO.pousada),
    trapiche: ponto(s.trapiche, ROTA_PADRAO.trapiche),
    terminais,
    ilha: Array.isArray(s.ilha) && s.ilha.length >= 3 ? s.ilha : ROTA_PADRAO.ilha,
    estilos,
    estiloPadrao: estilos.some((e) => e.id === s.estiloPadrao) ? s.estiloPadrao! : estilos[0].id,
    servicos: { ...ROTA_PADRAO.servicos, ...(s.servicos ?? {}) },
    textos: { ...ROTA_PADRAO.textos, ...(s.textos ?? {}) },
    conferido: s.conferido ?? false,
  };
}

/* ── geometria ───────────────────────────────────────────────────── */

/** Distância em metros (haversine). */
export function distancia(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ponto dentro do contorno da ilha (raio cruzando as arestas). */
export function naIlha(p: { lat: number; lng: number }, c: Pick<RotaConfig, "ilha">): boolean {
  let dentro = false;
  const poli = c.ilha;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Distância de um ponto até a linha (em metros, aproximação plana — serve para "saiu da rota?"). */
export function distanciaAteLinha(p: { lat: number; lng: number }, linha: LngLat[]): number {
  if (!linha.length) return Infinity;
  const k = 111320, cosLat = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * k * cosLat, py = p.lat * k;
  let menor = Infinity;
  for (let i = 0; i < linha.length - 1; i++) {
    const ax = linha[i][0] * k * cosLat, ay = linha[i][1] * k;
    const bx = linha[i + 1][0] * k * cosLat, by = linha[i + 1][1] * k;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    menor = Math.min(menor, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return linha.length === 1 ? Math.hypot(px - linha[0][0] * k * cosLat, py - linha[0][1] * k) : menor;
}

/** O terminal: o escolhido pela pessoa, senão o principal. */
export const terminalPadrao = (c: RotaConfig, id?: string | null) =>
  c.terminais.find((t) => t.id === id) ?? c.terminais.find((t) => t.principal) ?? c.terminais[0];

/* ── OSRM ────────────────────────────────────────────────────────── */

export const urlOsrm = (base: string, de: { lat: number; lng: number }, para: { lat: number; lng: number }) =>
  `${base.replace(/\/+$/, "")}/${de.lng.toFixed(6)},${de.lat.toFixed(6)};${para.lng.toFixed(6)},${para.lat.toFixed(6)}?overview=full&geometries=geojson&steps=true`;

export type Passo = { texto: string; distancia: number; local: LngLat };

type ManobraOsrm = { type: string; modifier?: string; location: LngLat; exit?: number };
type PassoOsrm = { maneuver: ManobraOsrm; name?: string; ref?: string; distance: number; mode?: string };

const LADO: Record<string, string> = {
  left: "à esquerda", right: "à direita", "slight left": "levemente à esquerda", "slight right": "levemente à direita",
  "sharp left": "bem à esquerda", "sharp right": "bem à direita", straight: "em frente", uturn: "retorne",
};

/* "na Rua…", "na BR-277", "no Caminho…": o artigo pelo tipo de via. */
const FEMININAS = /^(rua|avenida|av\.?|estrada|rodovia|travessa|alameda|praça|praca|trilha|via|ponte|marginal|ladeira|servidão|servidao|passarela|praia|orla|BR|PR|SC|SP)\b/i;
export const artigo = (via: string) => (FEMININAS.test(via.trim()) || /^[A-Z]{2}-\d/.test(via.trim()) ? "pela" : "pelo");

/** Instrução do OSRM em português do dia a dia. */
export function textoPasso(p: PassoOsrm): string {
  const m = p.maneuver, via = p.name?.trim() || p.ref?.trim() || "";
  const pela = via ? ` ${artigo(via)} ${via}` : "";
  const lado = m.modifier ? LADO[m.modifier] ?? "" : "";
  switch (m.type) {
    case "depart": return `Saia${pela}`;
    case "arrive": return "Você chegou ao destino deste trecho";
    case "roundabout": case "rotary": case "exit roundabout": case "exit rotary":
      return `Na rotatória, pegue a ${m.exit ?? 1}ª saída${pela}`;
    case "fork": return `Na bifurcação, siga ${lado || "em frente"}${pela}`;
    case "merge": return `Entre ${lado ? lado + " " : ""}na via${pela}`;
    case "on ramp": return `Pegue o acesso ${lado}${pela}`.replace("  ", " ");
    case "off ramp": return `Pegue a saída ${lado}${pela}`.replace("  ", " ");
    case "end of road": return `No fim da rua, vire ${lado}${pela}`;
    case "continue": case "new name": return m.modifier === "uturn" ? "Faça o retorno" : `Continue ${lado && m.modifier !== "straight" ? lado : "em frente"}${pela}`;
    case "turn": default:
      if (m.modifier === "uturn") return "Faça o retorno";
      if (m.modifier === "straight") return `Siga em frente${pela}`;
      return `Vire ${lado}${pela}`;
  }
}

export type Trecho = {
  tipo: "carro" | "barco" | "pe";
  titulo: string;
  de: Ponto; para: Ponto;
  distancia: number; duracao: number;
  linha: LngLat[];
  passos: Passo[];
  /** Traçado aproximado (linha reta) porque o serviço de rota não respondeu. */
  aproximado?: boolean;
};

/** Converte a resposta do OSRM num trecho; sem rota, linha reta com tempo estimado. */
export function trechoDoOsrm(tipo: "carro" | "pe", titulo: string, de: Ponto, para: Ponto, resposta: unknown): Trecho {
  const r = (resposta as { routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] }; legs: { steps: PassoOsrm[] }[] }[] })?.routes?.[0];
  if (!r) return trechoReto(tipo, titulo, de, para);
  const passos = (r.legs?.[0]?.steps ?? [])
    .filter((s) => s.maneuver && (s.distance > 0 || s.maneuver.type === "arrive"))
    .map((s) => ({ texto: textoPasso(s), distancia: s.distance, local: s.maneuver.location }));
  return { tipo, titulo, de, para, distancia: r.distance, duracao: r.duration, linha: r.geometry.coordinates, passos };
}

/** Velocidades de estimativa quando não há rota: a pé 4,5 km/h, carro 50 km/h, barco 18 km/h. */
const VELOCIDADE = { pe: 1.25, carro: 13.9, barco: 5 };

export function trechoReto(tipo: Trecho["tipo"], titulo: string, de: Ponto, para: Ponto, duracaoMin?: number): Trecho {
  const d = distancia(de, para);
  return {
    tipo, titulo, de, para, distancia: d,
    duracao: duracaoMin ? duracaoMin * 60 : (d * (tipo === "carro" ? 1.3 : 1.15)) / VELOCIDADE[tipo],
    linha: [[de.lng, de.lat], [para.lng, para.lat]],
    passos: [{ texto: tipo === "barco" ? `Embarque para ${para.nome}` : `Siga até ${para.nome}`, distancia: d, local: [de.lng, de.lat] }],
    aproximado: tipo !== "barco",
  };
}

/* ── texto ───────────────────────────────────────────────────────── */

export const formatarDistancia = (m: number) =>
  m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`;

export function formatarDuracao(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

/* ── apps do aparelho (plano B) ──────────────────────────────────── */

export type Aparelho = "ios" | "android" | "desktop";

export function detectarAparelho(ua: string): Aparelho {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Links para abrir o destino num app de mapas, a pé (na ilha não há carro). */
export function linksExternos(p: { lat: number; lng: number }) {
  const d = `${p.lat},${p.lng}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${d}&travelmode=walking`,
    apple: `https://maps.apple.com/?daddr=${d}&dirflg=w`,
    waze: `https://waze.com/ul?ll=${d}&navigate=yes`,
  };
}
