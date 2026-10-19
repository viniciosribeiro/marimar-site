/**
 * Rota até a pousada, traçada no próprio site. Parte sem banco e sem rede:
 * tipos, padrões, geometria e o texto das instruções. Testes:
 * testes/unit/rota.test.ts. Fluxo e serviços: docs/fluxo-rota.md.
 *
 * Tudo gratuito e sem chave: mapa MapLibre (código aberto) com estilos do
 * OpenFreeMap e relevo dos Terrain Tiles da AWS, rotas do OSRM da FOSSGIS
 * (dados OpenStreetMap), busca de endereço do Photon (Komoot). Os endereços
 * dos serviços ficam na configuração (painel → Rota e mapa), para trocar sem
 * mexer em código. O Mapbox é opcional: com um token público (pk.) no
 * painel, o mapa passa a ser o dele (satélite, prédios e luz da hora).
 */

export type Ponto = { nome: string; lat: number; lng: number };
export type LngLat = [number, number];
export type Terminal = Ponto & { id: string; barcoMin: number; principal?: boolean; observacao?: string };
export type EstiloMapa = { id: string; nome: string; url: string };

/** Como o mapa aparece no site (painel → Rota e mapa → Visual do mapa). */
export type MapaConfig = {
  /** "livre": OpenFreeMap, grátis e sem chave. "mapbox": precisa de token público (pk.). */
  provedor: "livre" | "mapbox";
  mapboxToken: string;
  /** Como o mapa abre: inclinado, com relevo e prédios (3d), ou visto de cima (2d). */
  vista: "3d" | "2d";
};

export type RotaConfig = {
  ativo: boolean;
  pousada: Ponto;
  trapiche: Ponto;
  terminais: Terminal[];
  /** Contorno aproximado da Ilha do Mel ([lng, lat]): dentro dele a rota é só a pé. */
  ilha: LngLat[];
  estilos: EstiloMapa[];
  estiloPadrao: string;
  servicos: { rotaCarro: string; rotaPe: string; busca: string; relevo: string };
  mapa: MapaConfig;
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
    /* Terrain Tiles (AWS Open Data, formato Terrarium): relevo do 3D gratuito. */
    relevo: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  },
  mapa: { provedor: "livre", mapboxToken: "", vista: "3d" },
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
    mapa: {
      provedor: s.mapa?.provedor === "mapbox" ? "mapbox" : "livre",
      mapboxToken: typeof s.mapa?.mapboxToken === "string" ? s.mapa.mapboxToken.trim() : "",
      vista: s.mapa?.vista === "2d" ? "2d" : "3d",
    },
    textos: { ...ROTA_PADRAO.textos, ...(s.textos ?? {}) },
    conferido: s.conferido ?? false,
  };
}

/* ── Mapbox (opcional) ───────────────────────────────────────────── */

/** Token público do Mapbox: começa com "pk.". O secreto ("sk.") nunca vai para o site. */
export const tokenMapboxValido = (t: string) => /^pk\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(t.trim());

/** O token do Mapbox, se ele estiver ligado e o token for público; senão null (mapa gratuito). */
export const mapboxDoSite = (c: Pick<RotaConfig, "mapa">) =>
  c.mapa.provedor === "mapbox" && tokenMapboxValido(c.mapa.mapboxToken) ? c.mapa.mapboxToken.trim() : null;

/** Estilos do Mapbox (Standard: prédios, árvores e luz conforme a hora). */
export const ESTILOS_MAPBOX: EstiloMapa[] = [
  { id: "mapbox-mapa", nome: "Mapa", url: "mapbox://styles/mapbox/standard" },
  { id: "mapbox-satelite", nome: "Satélite", url: "mapbox://styles/mapbox/standard-satellite" },
];

/** Luz do Mapbox Standard pela hora na ilha: amanhecer, dia, entardecer ou noite. */
export function luzDaHora(hora: number): "dawn" | "day" | "dusk" | "night" {
  if (hora >= 5 && hora < 7) return "dawn";
  if (hora >= 7 && hora < 17) return "day";
  if (hora >= 17 && hora < 19) return "dusk";
  return "night";
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

/** O desenho da seta da instrução (navegação em tela inteira). */
export type Seta = "frente" | "esquerda" | "direita" | "leve-esquerda" | "leve-direita" | "retorno" | "rotatoria" | "barco" | "chegada";

export type Passo = { texto: string; distancia: number; local: LngLat; seta?: Seta };

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

/** A seta de uma manobra do OSRM. */
export function setaDoPasso(m: Pick<ManobraOsrm, "type" | "modifier">): Seta {
  if (m.type === "arrive") return "chegada";
  if (/roundabout|rotary/.test(m.type)) return "rotatoria";
  switch (m.modifier) {
    case "left": case "sharp left": return "esquerda";
    case "right": case "sharp right": return "direita";
    case "slight left": return "leve-esquerda";
    case "slight right": return "leve-direita";
    case "uturn": return "retorno";
    default: return "frente";
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
    .map((s) => ({ texto: textoPasso(s), distancia: s.distance, local: s.maneuver.location, seta: setaDoPasso(s.maneuver) }));
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
    passos: [{ texto: tipo === "barco" ? `Embarque para ${para.nome}` : `Siga até ${para.nome}`, distancia: d, local: [de.lng, de.lat], seta: tipo === "barco" ? "barco" : "frente" }],
    aproximado: tipo !== "barco",
  };
}

/* ── percurso: a rota inteira numa linha só ─────────────────────── */

/**
 * Para a navegação em tela inteira: os trechos (carro, barco, a pé) viram uma
 * linha só, com os metros acumulados em cada ponto. "ao" é quanto do caminho
 * já ficou para trás — daí saem a próxima instrução, o que falta, a direção
 * do caminho e a parte já andada (cinza no mapa).
 */
export type PassoPercurso = { texto: string; seta: Seta; tipo: Trecho["tipo"]; ao: number };
export type Percurso = {
  linha: LngLat[];
  /** Metros do início até cada ponto de `linha`. */
  acum: number[];
  total: number;
  trechos: { tipo: Trecho["tipo"]; ini: number; fim: number; duracao: number; para: string }[];
  passos: PassoPercurso[];
};

const metros = (a: LngLat, b: LngLat) => distancia({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
const iguais = (a: LngLat | undefined, b: LngLat) => !!a && a[0] === b[0] && a[1] === b[1];

/** Rumo de a para b, em graus (0 = norte, sentido horário). */
export function rumo(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180, f1 = a.lat * r, f2 = b.lat * r, dl = (b.lng - a.lng) * r;
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/** Seta de uma instrução sem seta (rota salva antes de 19/10/2026): lida do texto. */
export function setaDoTexto(t: string): Seta {
  if (/retorno/i.test(t)) return "retorno";
  if (/rotatória/i.test(t)) return "rotatoria";
  if (/embarque/i.test(t)) return "barco";
  if (/chegou|chegada/i.test(t)) return "chegada";
  if (/levemente à esquerda/i.test(t)) return "leve-esquerda";
  if (/levemente à direita/i.test(t)) return "leve-direita";
  if (/esquerda/i.test(t)) return "esquerda";
  if (/direita/i.test(t)) return "direita";
  return "frente";
}

/** Ponto da linha mais perto de p, entre os índices de e ate (aproximação plana). */
function maisPerto(p: { lat: number; lng: number }, linha: LngLat[], acum: number[], de: number, ate: number) {
  const k = 111320, cos = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * k * cos, py = p.lat * k;
  if (ate <= de) return { ao: acum[de] ?? 0, distancia: Math.hypot(px - linha[de][0] * k * cos, py - linha[de][1] * k) };
  let melhor = { ao: acum[de], distancia: Infinity };
  for (let i = de; i < ate; i++) {
    const ax = linha[i][0] * k * cos, ay = linha[i][1] * k, bx = linha[i + 1][0] * k * cos, by = linha[i + 1][1] * k;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < melhor.distancia) melhor = { ao: acum[i] + t * (acum[i + 1] - acum[i]), distancia: d };
  }
  return melhor;
}

export function montarPercurso(trechos: Trecho[]): Percurso {
  const linha: LngLat[] = [], acum: number[] = [];
  const faixas: Percurso["trechos"] = [];
  const passos: PassoPercurso[] = [];
  for (const t of trechos) {
    if (!t.linha.length) continue;
    const i0 = iguais(linha[linha.length - 1], t.linha[0]) ? linha.length - 1 : linha.length;
    for (const pt of t.linha) {
      const ultimo = linha[linha.length - 1];
      if (iguais(ultimo, pt)) continue;
      acum.push(ultimo ? acum[acum.length - 1] + metros(ultimo, pt) : 0);
      linha.push(pt);
    }
    const i1 = linha.length - 1;
    faixas.push({ tipo: t.tipo, ini: acum[i0], fim: acum[i1], duracao: t.duracao, para: t.para.nome });
    for (const p of t.passos) {
      const chegada = /^Você chegou ao destino/.test(p.texto);
      passos.push({
        texto: chegada ? `Chegada: ${t.para.nome}` : p.texto,
        seta: chegada ? "chegada" : p.seta ?? setaDoTexto(p.texto),
        tipo: t.tipo,
        ao: maisPerto({ lng: p.local[0], lat: p.local[1] }, linha, acum, i0, i1).ao,
      });
    }
  }
  const total = acum[acum.length - 1] ?? 0;
  const ultimo = trechos[trechos.length - 1];
  if (ultimo && !passos.some((p) => p.seta === "chegada" && total - p.ao < 30)) {
    passos.push({ texto: `Chegada: ${ultimo.para.nome}`, seta: "chegada", tipo: ultimo.tipo, ao: total });
  }
  passos.sort((a, b) => a.ao - b.ao);
  return { linha, acum, total, trechos: faixas, passos };
}

/**
 * Onde, no percurso, fica a posição p. Com `perto` (o "ao" anterior), procura
 * primeiro ali em volta — a rota pode passar duas vezes pela mesma rua.
 */
export function projetar(p: { lat: number; lng: number }, perc: Percurso, perto?: number): { ao: number; distancia: number } {
  const n = perc.linha.length;
  if (!n) return { ao: 0, distancia: Infinity };
  if (perto !== undefined) {
    let de = 0;
    while (de < n - 1 && perc.acum[de + 1] < perto - 200) de++;
    let ate = de;
    while (ate < n - 1 && perc.acum[ate] < perto + 3000) ate++;
    const r = maisPerto(p, perc.linha, perc.acum, de, ate);
    if (r.distancia < 60) return r;
  }
  return maisPerto(p, perc.linha, perc.acum, 0, n - 1);
}

/** O ponto que fica `ao` metros depois do início. */
export function pontoEm(perc: Percurso, ao: number): { lat: number; lng: number } {
  const { linha, acum } = perc;
  if (!linha.length) return { lat: 0, lng: 0 };
  if (ao <= 0 || linha.length === 1) return { lng: linha[0][0], lat: linha[0][1] };
  if (ao >= perc.total) return { lng: linha[linha.length - 1][0], lat: linha[linha.length - 1][1] };
  let lo = 0, hi = acum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acum[m] <= ao) lo = m; else hi = m; }
  const t = acum[hi] > acum[lo] ? (ao - acum[lo]) / (acum[hi] - acum[lo]) : 0;
  return { lng: linha[lo][0] + (linha[hi][0] - linha[lo][0]) * t, lat: linha[lo][1] + (linha[hi][1] - linha[lo][1]) * t };
}

/** Para onde o caminho segue a partir de `ao` (olhando `adiante` metros à frente). */
export function rumoEm(perc: Percurso, ao: number, adiante = 25): number {
  const fim = Math.min(perc.total, ao + adiante);
  if (fim - ao < 1) return rumo(pontoEm(perc, Math.max(0, ao - adiante)), pontoEm(perc, ao));
  return rumo(pontoEm(perc, ao), pontoEm(perc, fim));
}

/** A próxima instrução (a primeira manobra à frente) e a seguinte. */
export function proximoPasso(perc: Percurso, ao: number): { atual: number; depois: number | null } {
  const i = perc.passos.findIndex((p) => p.ao > ao + 8);
  const atual = i < 0 ? perc.passos.length - 1 : i;
  return { atual, depois: atual + 1 < perc.passos.length ? atual + 1 : null };
}

/** O trecho em que a pessoa está (ou o próximo, no intervalo entre dois). */
export function trechoEm(perc: Percurso, ao: number) {
  return perc.trechos.find((t) => ao <= t.fim) ?? perc.trechos[perc.trechos.length - 1];
}

/** Metros e segundos que faltam: o tempo de cada trecho, proporcional ao que falta dele. */
export function restante(perc: Percurso, ao: number): { distancia: number; duracao: number } {
  const duracao = perc.trechos.reduce((s, t) => {
    if (ao <= t.ini) return s + t.duracao;
    if (ao >= t.fim || t.fim <= t.ini) return s;
    return s + (t.duracao * (t.fim - ao)) / (t.fim - t.ini);
  }, 0);
  return { distancia: Math.max(0, perc.total - ao), duracao };
}

/** A parte já andada (fica cinza no mapa). */
export function linhaAte(perc: Percurso, ao: number): LngLat[] {
  if (ao <= 0 || !perc.linha.length) return [];
  const pts: LngLat[] = [];
  for (let i = 0; i < perc.linha.length && perc.acum[i] < ao; i++) pts.push(perc.linha[i]);
  const p = pontoEm(perc, ao);
  pts.push([p.lng, p.lat]);
  return pts.length >= 2 ? pts : [];
}

/** Prévia do caminho: velocidade (m/s) do sobrevoo em cada trecho — uns 20 a 30 s por trecho. */
export function velocidadePrevia(tipo: Trecho["tipo"], comprimento: number): number {
  if (tipo === "pe") return Math.max(14, comprimento / 30);
  if (tipo === "barco") return Math.max(60, comprimento / 12);
  return Math.max(150, comprimento / 22);
}

/** Zoom da câmera pela velocidade: devagar, perto do chão; rápido, mais alto. */
export const zoomPorVelocidade = (v: number) => Math.min(17.6, Math.max(11.5, 18.6 - Math.log2(Math.max(1, v) / 5)));

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
