/**
 * Modo voz do treinamento da Marina — peças puras (sem nada de servidor).
 *
 * Fica separado de `marina-voz.ts` (servidor) pelo mesmo motivo de
 * `chat-textos.ts`: o navegador importa daqui (o painel de voz é um
 * componente de cliente) sem baixar `postgres`, `crypto` nem a chave de
 * ninguém. Só tipos, o leitor do bloco de ação e a conta de custo.
 */

/* ── a ação que a Marina propõe ──────────────────────────────────────
   A Marina, no modo voz, pode pedir uma mudança no painel. Ela devolve,
   no meio da resposta, um bloco [[acao]]{...}[[/acao]] com o nome da ação,
   os dados e a FALA (a pergunta de confirmação que vira áudio). O resto do
   texto não é lido. Quem confirma é a pessoa; o sistema executa depois. */

export type AcaoVozProposta = {
  nome: string;
  dados: Record<string, unknown>;
  /** A frase curta que a Marina fala pedindo confirmação. */
  fala: string;
};

const ABRE = "[[acao]]";
const FECHA = "[[/acao]]";

/**
 * Tira o bloco de ação da resposta da Marina.
 *
 * Tolerante de propósito: aceita o bloco com os marcadores
 * `[[acao]]...[[/acao]]` e, se o modelo esquecer os marcadores, aceita um
 * objeto JSON solto que tenha "nome" e "dados". O que sobra é o texto para
 * falar — mas, se o bloco trouxe "fala", é ela que vale (uma ou duas frases,
 * sem o JSON no meio).
 */
export function extrairAcao(bruto: string): { texto: string; acao: AcaoVozProposta | null } {
  const texto0 = (bruto ?? "").trim();
  if (!texto0) return { texto: "", acao: null };

  const comMarcador = lerEntre(texto0, ABRE, FECHA);
  const cru = comMarcador ?? acharObjeto(texto0);
  if (!cru) return { texto: texto0, acao: null };

  const acao = montarAcao(cru.json);
  if (!acao) {
    /* Tinha um bloco, mas veio quebrado: não falamos o JSON cru. */
    const limpo = (texto0.slice(0, cru.inicio) + texto0.slice(cru.fim)).trim();
    return { texto: limpo || texto0, acao: null };
  }

  const restante = (texto0.slice(0, cru.inicio) + texto0.slice(cru.fim)).trim();
  const fala = acao.fala || restante || "Confirma?";
  return { texto: fala, acao };
}

function lerEntre(t: string, abre: string, fecha: string): { json: string; inicio: number; fim: number } | null {
  const i = t.indexOf(abre);
  if (i < 0) return null;
  const j = t.indexOf(fecha, i + abre.length);
  if (j < 0) return null;
  return { json: t.slice(i + abre.length, j).trim(), inicio: i, fim: j + fecha.length };
}

/** Acha o primeiro objeto JSON equilibrado que contenha "nome". Último recurso. */
function acharObjeto(t: string): { json: string; inicio: number; fim: number } | null {
  const marca = /"nome"\s*:/.exec(t);
  if (!marca) return null;
  let inicio = t.lastIndexOf("{", marca.index);
  while (inicio >= 0) {
    const fim = fimDoObjeto(t, inicio);
    if (fim > 0 && fim > marca.index) return { json: t.slice(inicio, fim), inicio, fim };
    inicio = t.lastIndexOf("{", inicio - 1);
  }
  return null;
}

function fimDoObjeto(t: string, inicio: number): number {
  let nivel = 0, emTexto = false, escapa = false;
  for (let i = inicio; i < t.length; i++) {
    const c = t[i];
    if (emTexto) {
      if (escapa) escapa = false;
      else if (c === "\\") escapa = true;
      else if (c === '"') emTexto = false;
      continue;
    }
    if (c === '"') emTexto = true;
    else if (c === "{") nivel++;
    else if (c === "}") { nivel--; if (nivel === 0) return i + 1; }
  }
  return -1;
}

function montarAcao(json: string): AcaoVozProposta | null {
  let obj: unknown;
  try { obj = JSON.parse(json); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const nome = typeof o.nome === "string" ? o.nome.trim() : "";
  if (!nome) return null;
  const dados = o.dados && typeof o.dados === "object" && !Array.isArray(o.dados)
    ? (o.dados as Record<string, unknown>) : {};
  const fala = typeof o.fala === "string" ? o.fala.trim() : "";
  return { nome, dados, fala };
}

/* ── a resposta da pessoa a um "confirma?" ───────────────────────────
   Decidida AQUI, sem ida à Marina, quando é clara (sim/não) — é o caminho
   rápido e o que impede o loop de confirmação. Só o que fica em dúvida
   (repetir o pedido com outras palavras, corrigir, perguntar outra coisa)
   volta à Marina, com a ação pendente no contexto.

   Cuidado de português: "para" e "muda" no MEIO da frase são comuns ("pode
   salvar para mim", "sim, muda") e NÃO querem dizer não — por isso só
   valem no começo da fala. */

/**
 * "sim"     — confirma (executa a ação pendente, sem ida à Marina).
 * "nao"     — cancela e pronto.
 * "corrige" — "não, é às 15h" / "sim, mas muda…": cancela e a Marina propõe de novo.
 * "outra"   — repetir o pedido, ensinar outra coisa, perguntar: vai à Marina COM
 *             a ação pendente no contexto (se ela repropuser a mesma, vale como sim).
 */
export type RespostaConfirmacao = "sim" | "nao" | "corrige" | "outra";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const palavras = (texto: string) => semAcento((texto ?? "").toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
const conjunto = (s: string) => new Set(s.split(" "));

/** Primeira palavra que, sozinha, já é um "sim". */
const SIM_1 = conjunto("sim s isso pode confirma confirmo confirmado confirmada claro ok okay oquei beleza blz certo certinho correto perfeito exato exatamente manda faz faca salva salvar salve grava gravar grave guarda guardar guarde anota anotar positivo afirmativo ta uhum aham bora segue show top maravilha otimo legal fechado combinado concordo aprovado aprovo autorizo yes pronto tranquilo");
/** Primeira palavra que, sozinha, já é um "não". "para" só no começo da fala. */
const NAO_1 = conjunto("nao n negativo cancela cancelar cancelado cancele esquece esqueca para pare parar espera espere errado errada");
/** Inícios de duas palavras. */
const SIM_2 = ["e isso", "e sim", "com certeza", "de acordo"];
const NAO_2 = ["deixa pra", "deixa para", "deixa quieto", "deixa assim", "nada disso", "nem pensar", "agora nao", "melhor nao", "de jeito"];

/** O que pode vir depois de um sim sem mudar nada ("sim, pode salvar pra mim"). */
const ENCHIMENTO_SIM = conjunto("pode sim s salva salvar salve grava gravar grave guarda guardar guarde confirma confirmo confirmar confirmado faz fazer faca isso mesmo por favor obrigado obrigada valeu claro ok okay oquei beleza blz certo certinho ser manda vai la ai entao tudo bem perfeito otimo show e marina ja agora senhor senhora com certeza exato exatamente positivo uhum aham ta bom yes top legal pronto combinado fechado segue bora anota anotar aqui pra para mim gente nos muito tranquilo correto obg vlw isso");
/** O que pode vir depois de um não sem trazer correção ("não, obrigado, por enquanto"). */
const ENCHIMENTO_NAO = conjunto("obrigado obrigada valeu tudo bem ta bom por enquanto agora ainda nao nada deixa precisa quero mesmo obg vlw e marina pode cancelar cancela esquece isso assim melhor so ok beleza certo pra para la quieto nem pensar disso jeito nenhum ai um pouco momento minuto segundo");
/** Depois de um sim, isto anuncia uma correção. */
const RESSALVA = conjunto("mas porem exceto menos troca trocar muda mudar corrige corrigir altera alterar verdade vez");
/** Pergunta: vai à Marina (nunca confirma nada sozinho). */
const PERGUNTA_1 = conjunto("como quando quanto quanta quantos quantas qual quais onde quem sera repete repetir explica explicar");

function comeca(p: string[], lista: string[]): number {
  for (const f of lista) {
    const ps = f.split(" ");
    if (ps.every((x, i) => p[i] === x)) return ps.length;
  }
  return 0;
}

export function classificarResposta(texto: string): RespostaConfirmacao {
  const p = palavras(texto);
  if (p.length === 0) return "outra";
  const ePergunta = /\?/.test(texto) || PERGUNTA_1.has(p[0]) || (p[0] === "o" && p[1] === "que") || (p[0] === "por" && p[1] === "que")
    || p.some((x) => x.startsWith("repet") || x.startsWith("explic"));

  const nao = comeca(p, NAO_2) || (NAO_1.has(p[0]) ? 1 : 0);
  if (nao) {
    const resto = p.slice(nao);
    return resto.every((x) => ENCHIMENTO_NAO.has(x)) ? "nao" : "corrige";
  }
  if (ePergunta) return "outra";

  const sim = comeca(p, SIM_2) || (SIM_1.has(p[0]) ? 1 : 0);
  if (sim) {
    const resto = p.slice(sim);
    if (resto.every((x) => ENCHIMENTO_SIM.has(x))) return "sim";
    if (resto.some((x) => RESSALVA.has(x))) return "corrige";
    return "outra";
  }
  return "outra";
}

/** Normaliza para comparar: minúsculas, sem acento, sem pontuação. */
function normalizarValor(v: unknown): unknown {
  if (typeof v === "string") {
    return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  if (Array.isArray(v)) return v.map(normalizarValor);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>).sort()
      .filter((k) => (v as Record<string, unknown>)[k] != null && (v as Record<string, unknown>)[k] !== "")
      .map((k) => [k, normalizarValor((v as Record<string, unknown>)[k])]);
  }
  return v;
}

/** A Marina repropôs a MESMA ação (mesmo nome e mesmos dados, sem contar acento/caixa)? */
export function mesmaAcao(
  a: { nome: string; dados?: Record<string, unknown> } | null | undefined,
  b: { nome: string; dados?: Record<string, unknown> } | null | undefined,
): boolean {
  if (!a || !b || a.nome !== b.nome) return false;
  return JSON.stringify(normalizarValor(a.dados ?? {})) === JSON.stringify(normalizarValor(b.dados ?? {}));
}

/* ── custo (estimativa) ──────────────────────────────────────────────
   A voz é a única coisa aqui que custa por fora: a ElevenLabs cobra a
   síntese por caractere e a transcrição por minuto. O OpenClaw (o "cérebro")
   é à parte e não entra nesta conta. Os preços são EDITÁVEIS no painel e o
   que mostramos é sempre uma ESTIMATIVA — serve para não tomar um susto na
   fatura, não para fechar contabilidade. */

export type PrecosVoz = {
  /** Centavos de real por 1000 caracteres falados (TTS). */
  ttsCentavos1k: number;
  /** Centavos de real por minuto transcrito (STT). */
  sttCentavosMin: number;
  /** Teto do mês, em centavos. 0 = sem teto. */
  limiteCentavos: number;
  /** A partir de quantos % do teto avisar. */
  avisarPct: number;
};

export const PRECOS_VOZ_PADRAO: PrecosVoz = {
  ttsCentavos1k: 110,
  sttCentavosMin: 4,
  limiteCentavos: 3000,
  avisarPct: 80,
};

export function normalizarPrecos(bruto: unknown): PrecosVoz {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const num = (v: unknown, padrao: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
  };
  return {
    ttsCentavos1k: num(o.ttsCentavos1k, PRECOS_VOZ_PADRAO.ttsCentavos1k, 0, 100000),
    sttCentavosMin: num(o.sttCentavosMin, PRECOS_VOZ_PADRAO.sttCentavosMin, 0, 100000),
    limiteCentavos: num(o.limiteCentavos, PRECOS_VOZ_PADRAO.limiteCentavos, 0, 100000000),
    avisarPct: num(o.avisarPct, PRECOS_VOZ_PADRAO.avisarPct, 1, 100),
  };
}

/** Estimativa, em centavos, de uma soma de caracteres falados e segundos ouvidos. */
export function estimarCentavos(ttsCaracteres: number, sttSegundos: number, p: PrecosVoz): number {
  const car = Math.max(0, ttsCaracteres) / 1000 * p.ttsCentavos1k;
  const min = Math.max(0, sttSegundos) / 60 * p.sttCentavosMin;
  return Math.round(car + min);
}

export type EstadoGasto = {
  usoCentavos: number;
  limiteCentavos: number;
  /** "ok" | "aviso" (passou do avisarPct) | "estourou" (chegou no teto). */
  nivel: "ok" | "aviso" | "estourou";
  pct: number;
};

export function estadoGasto(usoCentavos: number, p: PrecosVoz): EstadoGasto {
  const uso = Math.max(0, Math.round(usoCentavos));
  if (p.limiteCentavos <= 0) return { usoCentavos: uso, limiteCentavos: 0, nivel: "ok", pct: 0 };
  const pct = Math.round((uso / p.limiteCentavos) * 100);
  const nivel = uso >= p.limiteCentavos ? "estourou" : pct >= p.avisarPct ? "aviso" : "ok";
  return { usoCentavos: uso, limiteCentavos: p.limiteCentavos, nivel, pct };
}

/** "R$ 12,34" a partir de centavos. */
export function emReais(centavos: number): string {
  return "R$ " + (Math.max(0, Math.round(centavos)) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
