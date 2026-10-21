/**
 * A voz da Marina: as regras, sem rede nem banco (testável em testes/unit).
 *
 * Um só lugar decide a voz, e os dois canais a usam do mesmo jeito:
 *   - o site pede o áudio direto ao provedor (src/lib/voz.ts);
 *   - o WhatsApp Web fala pelo OpenClaw, que lê `tts.providers.<provedor>`
 *     da config dele (blocoOpenClaw, enviado por config.patch).
 * Os campos e padrões abaixo são os que o OpenClaw 2026.9.4 lê de fato
 * (extensions/elevenlabs, openai e google). Até 21/10 o painel gravava
 * `speakerVoiceId`/`model` pelo config.set — nomes que o OpenClaw ignora,
 * por um método que ele recusa —, e o WhatsApp seguia com outra voz.
 * Detalhes em docs/voz-marina.md.
 */

export type Provedor = "elevenlabs" | "openai" | "google";
export const PROVEDORES_VOZ: Provedor[] = ["elevenlabs", "openai", "google"];

export type InfoProvedor = {
  nome: string;
  resumo: string;
  /** Variáveis da Vercel que o site aceita (a primeira é a que o manual cita). */
  variaveis: string[];
  /** Onde a pessoa cria a chave (abre numa aba nova). */
  paginaChave: string;
  passos: string[];
  /** O que o painel pede para colar. */
  formato: string;
};

export const PROVEDOR: Record<Provedor, InfoProvedor> = {
  elevenlabs: {
    nome: "ElevenLabs",
    resumo: "As vozes mais naturais em português, inclusive vozes clonadas da sua conta.",
    variaveis: ["ELEVENLABS_API_KEY"],
    paginaChave: "https://elevenlabs.io/app/settings/api-keys",
    passos: ["Entre na sua conta da ElevenLabs.", "Em API Keys, toque em Create API Key (pode deixar todas as permissões).", "Copie a chave e cole aqui."],
    formato: "sk_…",
  },
  openai: {
    nome: "OpenAI",
    resumo: "Vozes da OpenAI, com um campo para dizer o jeito de falar (sotaque, ritmo, simpatia).",
    variaveis: ["OPENAI_API_KEY"],
    paginaChave: "https://platform.openai.com/api-keys",
    passos: ["Entre em platform.openai.com com a sua conta.", "Em API keys, toque em Create new secret key.", "Copie a chave e cole aqui. A voz é cobrada no crédito da API (não na assinatura do ChatGPT)."],
    formato: "sk-…",
  },
  google: {
    nome: "Google",
    resumo: "Vozes do Gemini (Google), com um campo para dizer o jeito de falar.",
    variaveis: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    paginaChave: "https://aistudio.google.com/app/apikey",
    passos: ["Entre no Google AI Studio com a sua conta Google.", "Toque em Create API key (Criar chave de API).", "Copie a chave e cole aqui."],
    formato: "AIza…",
  },
};

/** "a ElevenLabs", "a OpenAI", "o Google" — e as formas com de/conectada. */
export const oProvedor = (p: Provedor) => `${p === "google" ? "o" : "a"} ${PROVEDOR[p].nome}`;
export const doProvedor = (p: Provedor) => `${p === "google" ? "do" : "da"} ${PROVEDOR[p].nome}`;
export const conectadoA = (p: Provedor) => `${PROVEDOR[p].nome} ${p === "google" ? "conectado" : "conectada"}`;

export type Voz = { id: string; nome: string; jeito: string; sugerida?: boolean };

/* As que o OpenClaw 2026.9.4 aceita (OPENAI_TTS_VOICES). Fora desta lista
   ele recusa a voz e o WhatsApp fica mudo. */
export const VOZES_OPENAI: Voz[] = [
  { id: "marin", nome: "Marin", jeito: "natural e acolhedora", sugerida: true },
  { id: "coral", nome: "Coral", jeito: "calorosa e simpática", sugerida: true },
  { id: "nova", nome: "Nova", jeito: "animada e jovem", sugerida: true },
  { id: "shimmer", nome: "Shimmer", jeito: "clara e luminosa", sugerida: true },
  { id: "sage", nome: "Sage", jeito: "calma e ponderada" },
  { id: "juniper", nome: "Juniper", jeito: "leve" },
  { id: "alloy", nome: "Alloy", jeito: "neutra e equilibrada" },
  { id: "ballad", nome: "Ballad", jeito: "suave e expressiva" },
  { id: "cedar", nome: "Cedar", jeito: "natural, mais grave" },
  { id: "ash", nome: "Ash", jeito: "clara e firme" },
  { id: "echo", nome: "Echo", jeito: "serena" },
  { id: "fable", nome: "Fable", jeito: "expressiva" },
  { id: "onyx", nome: "Onyx", jeito: "grave e profunda" },
  { id: "verse", nome: "Verse", jeito: "versátil" },
];
export const MODELOS_OPENAI = [
  { id: "gpt-4o-mini-tts", nome: "gpt-4o-mini-tts (recomendado: aceita o jeito de falar)" },
  { id: "tts-1-hd", nome: "tts-1-hd (aceita velocidade, sem jeito de falar)" },
  { id: "tts-1", nome: "tts-1 (mais barato)" },
];
/** Só o gpt-4o-mini-tts lê instruções; só os tts-1 aceitam velocidade (a mesma regra do OpenClaw). */
export const openaiAceitaInstrucoes = (modelo: string) => modelo.includes("gpt-4o-mini-tts");
export const openaiAceitaVelocidade = (modelo: string) => !openaiAceitaInstrucoes(modelo);

/* GOOGLE_TTS_VOICES do OpenClaw, com o jeito que o Google descreve. */
export const VOZES_GOOGLE: Voz[] = [
  { id: "Kore", nome: "Kore", jeito: "firme", sugerida: true },
  { id: "Sulafat", nome: "Sulafat", jeito: "calorosa", sugerida: true },
  { id: "Aoede", nome: "Aoede", jeito: "leve", sugerida: true },
  { id: "Achernar", nome: "Achernar", jeito: "suave", sugerida: true },
  { id: "Vindemiatrix", nome: "Vindemiatrix", jeito: "gentil", sugerida: true },
  { id: "Leda", nome: "Leda", jeito: "jovem" },
  { id: "Zephyr", nome: "Zephyr", jeito: "luminosa" },
  { id: "Achird", nome: "Achird", jeito: "amigável" },
  { id: "Despina", nome: "Despina", jeito: "macia" },
  { id: "Callirrhoe", nome: "Callirrhoe", jeito: "tranquila" },
  { id: "Autonoe", nome: "Autonoe", jeito: "luminosa" },
  { id: "Erinome", nome: "Erinome", jeito: "clara" },
  { id: "Laomedeia", nome: "Laomedeia", jeito: "animada" },
  { id: "Pulcherrima", nome: "Pulcherrima", jeito: "direta" },
  { id: "Gacrux", nome: "Gacrux", jeito: "madura" },
  { id: "Puck", nome: "Puck", jeito: "animada" },
  { id: "Charon", nome: "Charon", jeito: "informativa" },
  { id: "Fenrir", nome: "Fenrir", jeito: "empolgada" },
  { id: "Orus", nome: "Orus", jeito: "firme" },
  { id: "Enceladus", nome: "Enceladus", jeito: "sussurrada" },
  { id: "Iapetus", nome: "Iapetus", jeito: "clara" },
  { id: "Umbriel", nome: "Umbriel", jeito: "tranquila" },
  { id: "Algieba", nome: "Algieba", jeito: "macia" },
  { id: "Algenib", nome: "Algenib", jeito: "rouca" },
  { id: "Rasalgethi", nome: "Rasalgethi", jeito: "informativa" },
  { id: "Alnilam", nome: "Alnilam", jeito: "firme" },
  { id: "Schedar", nome: "Schedar", jeito: "uniforme" },
  { id: "Zubenelgenubi", nome: "Zubenelgenubi", jeito: "descontraída" },
  { id: "Sadachbia", nome: "Sadachbia", jeito: "viva" },
  { id: "Sadaltager", nome: "Sadaltager", jeito: "sábia" },
];
export const MODELOS_GOOGLE = [
  { id: "gemini-3.1-flash-tts-preview", nome: "Gemini 3.1 Flash TTS (recomendado)" },
  { id: "gemini-2.5-flash-preview-tts", nome: "Gemini 2.5 Flash TTS" },
  { id: "gemini-2.5-pro-preview-tts", nome: "Gemini 2.5 Pro TTS (mais caro)" },
];
export const MODELOS_ELEVEN = [
  { id: "eleven_multilingual_v2", nome: "Multilingual v2 (recomendado)" },
  { id: "eleven_v3", nome: "v3 (mais expressivo)" },
  { id: "eleven_flash_v2_5", nome: "Flash v2.5 (mais rápido e barato)" },
];

export const JEITO_PADRAO =
  "Fale em português do Brasil, com sotaque brasileiro natural, voz calorosa e simpática de recepcionista de pousada na praia. Ritmo tranquilo.";

export type OpcoesVoz = {
  provedor: Provedor;
  elevenlabs: { voz: string | null; modelo: string; estabilidade: number; semelhanca: number; velocidade: number };
  openai: { voz: string; modelo: string; instrucoes: string; velocidade: number };
  google: { voz: string; modelo: string; estilo: string };
};

export const OPCOES_PADRAO: OpcoesVoz = {
  provedor: "elevenlabs",
  elevenlabs: { voz: null, modelo: "eleven_multilingual_v2", estabilidade: 50, semelhanca: 75, velocidade: 100 },
  openai: { voz: "marin", modelo: "gpt-4o-mini-tts", instrucoes: JEITO_PADRAO, velocidade: 100 },
  google: { voz: "Kore", modelo: "gemini-3.1-flash-tts-preview", estilo: JEITO_PADRAO },
};

const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n))) : padrao;
};
const daLista = (v: unknown, lista: { id: string }[], padrao: string) => {
  const t = texto(v, 80);
  return t && lista.some((x) => x.id === t) ? t : padrao;
};

/**
 * Junta o que está gravado: os ajustes da ElevenLabs nas colunas de
 * `marina_config` (de antes de 21/10) e o resto no JSON `voz_marina` de
 * `integracoes`. Valor estranho volta ao padrão: uma voz inválida no
 * OpenClaw deixaria o WhatsApp mudo.
 */
export function normalizarOpcoes(
  eleven: { voz_id: string | null; voz_modelo: string; voz_estabilidade: number; voz_semelhanca: number; voz_velocidade: number },
  bruto: unknown,
): OpcoesVoz {
  const j = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, Record<string, unknown> | unknown>;
  const o = (j.openai ?? {}) as Record<string, unknown>;
  const g = (j.google ?? {}) as Record<string, unknown>;
  const provedor = PROVEDORES_VOZ.includes(j.provedor as Provedor) ? (j.provedor as Provedor) : "elevenlabs";
  return {
    provedor,
    elevenlabs: {
      voz: texto(eleven.voz_id, 80),
      modelo: daLista(eleven.voz_modelo, MODELOS_ELEVEN, OPCOES_PADRAO.elevenlabs.modelo),
      estabilidade: numero(eleven.voz_estabilidade, 0, 100, 50),
      semelhanca: numero(eleven.voz_semelhanca, 0, 100, 75),
      velocidade: numero(eleven.voz_velocidade, 70, 120, 100),
    },
    openai: {
      voz: daLista(o.voz, VOZES_OPENAI, OPCOES_PADRAO.openai.voz),
      modelo: daLista(o.modelo, MODELOS_OPENAI, OPCOES_PADRAO.openai.modelo),
      instrucoes: texto(o.instrucoes, 600) ?? JEITO_PADRAO,
      velocidade: numero(o.velocidade, 70, 130, 100),
    },
    google: {
      voz: daLista(g.voz, VOZES_GOOGLE, OPCOES_PADRAO.google.voz),
      modelo: daLista(g.modelo, MODELOS_GOOGLE, OPCOES_PADRAO.google.modelo),
      estilo: texto(g.estilo, 600) ?? JEITO_PADRAO,
    },
  };
}

/** A voz escolhida em uma linha, para a tela. */
export function rotuloVoz(o: OpcoesVoz, nomeEleven?: string | null): string {
  const p = PROVEDOR[o.provedor].nome;
  if (o.provedor === "elevenlabs") return o.elevenlabs.voz ? `${p} · ${nomeEleven || o.elevenlabs.voz}` : `${p} · sem voz escolhida`;
  if (o.provedor === "openai") return `${p} · ${VOZES_OPENAI.find((v) => v.id === o.openai.voz)?.nome ?? o.openai.voz}`;
  return `${p} · ${o.google.voz}`;
}

/* ── o que vai para o OpenClaw ───────────────────────────────────── */

/**
 * Os campos de `tts.providers.<provedor>` como o OpenClaw lê. `null` apaga
 * um campo antigo (o config.patch é merge patch, RFC 7386): velocidade
 * num gpt-4o-mini-tts, por exemplo, faria a OpenAI recusar o áudio.
 */
export function camposDoProvedor(o: OpcoesVoz, chave?: string | null): Record<string, unknown> {
  const comChave = chave ? { apiKey: chave } : {};
  if (o.provedor === "elevenlabs") {
    const e = o.elevenlabs;
    return {
      ...comChave,
      voiceId: e.voz, modelId: e.modelo, languageCode: "pt", applyTextNormalization: "on",
      voiceSettings: { stability: e.estabilidade / 100, similarityBoost: e.semelhanca / 100, style: 0, useSpeakerBoost: true, speed: e.velocidade / 100 },
    };
  }
  if (o.provedor === "openai") {
    const a = o.openai;
    return {
      ...comChave,
      model: a.modelo, voice: a.voz,
      instructions: openaiAceitaInstrucoes(a.modelo) ? a.instrucoes : null,
      speed: openaiAceitaVelocidade(a.modelo) && a.velocidade !== 100 ? a.velocidade / 100 : null,
    };
  }
  const g = o.google;
  return { ...comChave, model: g.modelo, voiceName: g.voz, audioProfile: g.estilo, speakerName: null };
}

/** O modelo de IA não troca a voz no meio da resposta (o OpenClaw deixa, de fábrica). */
export const TRAVA_DO_MODELO = { allowProvider: false, allowVoice: false, allowModelId: false, allowVoiceSettings: false };

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
/** Camada que mexe na voz (e por isso precisa receber a mesma voz). */
const mexeNaVoz = (tts: Obj | undefined) =>
  Boolean(tts && (tts.provider !== undefined || tts.providers !== undefined || tts.persona !== undefined || PROVEDORES_VOZ.some((p) => tts[p] !== undefined)));

/**
 * O merge patch para o config.patch: a voz na camada geral e em toda
 * camada que a redefine (agente, canal WhatsApp, conta, persona ativa).
 * Se só a geral mudasse, uma dessas continuaria falando por cima.
 */
export function patchDaVoz(o: OpcoesVoz, configAtual: unknown, chave?: string | null): Obj {
  const campos = camposDoProvedor(o, chave);
  const bloco = (extra: Obj = {}) => ({ provider: o.provedor, modelOverrides: TRAVA_DO_MODELO, providers: { [o.provedor]: campos }, ...extra });
  const cfg = obj(configAtual) ?? {};
  const tts: Obj = bloco();

  /* persona ativa que tem a própria versão deste provedor */
  const personaAtiva = typeof obj(cfg.tts)?.persona === "string" ? String(obj(cfg.tts)!.persona) : null;
  const personas = obj(obj(cfg.tts)?.personas);
  if (personaAtiva && obj(personas?.[personaAtiva])) {
    tts.personas = { [personaAtiva]: { provider: o.provedor, providers: { [o.provedor]: campos } } };
  }
  const patch: Obj = { tts };

  const agentes = Array.isArray(obj(cfg.agents)?.list) ? (obj(cfg.agents)!.list as unknown[]) : [];
  const comVoz = agentes.map(obj).filter((a): a is Obj => Boolean(a && typeof a.id === "string" && mexeNaVoz(obj(a.tts))));
  if (comVoz.length) patch.agents = { list: comVoz.map((a) => ({ id: a.id, tts: bloco() })) };

  const wa = obj(obj(cfg.channels)?.whatsapp);
  const canal: Obj = {};
  if (mexeNaVoz(obj(wa?.tts))) canal.tts = bloco();
  const contas = obj(wa?.accounts);
  const contasComVoz = Object.entries(contas ?? {}).filter(([, c]) => mexeNaVoz(obj(obj(c)?.tts)));
  if (contasComVoz.length) canal.accounts = Object.fromEntries(contasComVoz.map(([id]) => [id, { tts: bloco() }]));
  if (Object.keys(canal).length) patch.channels = { whatsapp: canal };
  return patch;
}

/* ── o que o WhatsApp vai usar, lido da config do OpenClaw ───────── */

function juntar(base: Obj, por: Obj | undefined): Obj {
  if (!por) return base;
  const r: Obj = { ...base };
  for (const [k, v] of Object.entries(por)) {
    r[k] = obj(v) && obj(base[k]) ? juntar(obj(base[k])!, obj(v)) : v;
  }
  return r;
}

export type VozEfetiva = {
  provedor: string | null;
  voz: string | null;
  modelo: string | null;
  /** Ajustes lidos (para conferir com o site). */
  campos: Obj;
  /** "geral", "agente main", "canal WhatsApp", "conta default", "persona x". */
  camadas: string[];
  auto: string | null;
  travado: boolean;
  temChave: boolean;
};

/**
 * Refaz a conta que o OpenClaw 2026.9.4 faz (resolveEffectiveTtsConfig):
 * geral → agente → canal → conta, e a persona ativa por cima do provedor.
 * O arquivo de preferências (`settings/tts.json`) não aparece pelo RPC:
 * fica dito na tela.
 */
export function vozDoWhatsapp(configOpenClaw: unknown): VozEfetiva {
  const cfg = obj(configOpenClaw) ?? {};
  const camadas: string[] = [];
  let tts: Obj = obj(cfg.tts) ?? {};
  if (Object.keys(tts).length) camadas.push("geral");

  const bindings = Array.isArray(cfg.bindings) ? (cfg.bindings as unknown[]).map(obj) : [];
  const ligado = bindings.find((b) => obj(b?.match)?.channel === "whatsapp")?.agentId;
  const lista = Array.isArray(obj(cfg.agents)?.list) ? (obj(cfg.agents)!.list as unknown[]).map(obj) : [];
  const agente = lista.find((a) => a?.id === ligado) ?? lista.find((a) => a?.default === true) ?? lista[0];
  if (obj(agente?.tts)) { tts = juntar(tts, obj(agente!.tts)); camadas.push(`agente ${agente!.id}`); }

  const wa = obj(obj(cfg.channels)?.whatsapp);
  if (obj(wa?.tts)) { tts = juntar(tts, obj(wa!.tts)); camadas.push("canal WhatsApp"); }
  const contas = obj(wa?.accounts);
  const conta = obj(contas?.default) ?? (contas ? obj(Object.values(contas)[0]) : undefined);
  if (obj(conta?.tts)) { tts = juntar(tts, obj(conta!.tts)); camadas.push("conta do WhatsApp"); }

  let provedor = typeof tts.provider === "string" ? tts.provider : null;
  const personaId = typeof tts.persona === "string" ? tts.persona : null;
  const persona = personaId ? obj(obj(tts.personas)?.[personaId]) : undefined;
  if (persona && typeof persona.provider === "string") provedor = persona.provider;
  const nome = provedor ?? "";
  let campos: Obj = obj(obj(tts.providers)?.[nome]) ?? obj(tts[nome]) ?? {};
  const daPersona = obj(obj(persona?.providers)?.[nome]);
  if (daPersona) { campos = juntar(campos, daPersona); camadas.push(`persona ${personaId}`); }

  /* Cada provedor lê o seu campo (voiceId / voice / voiceName ?? voice). */
  const voz = nome === "elevenlabs" ? campos.voiceId : nome === "google" ? campos.voiceName ?? campos.voice : campos.voice;
  const modelo = nome === "elevenlabs" ? campos.modelId : campos.model;
  const mo = obj(tts.modelOverrides);
  return {
    provedor, voz: typeof voz === "string" ? voz : null, modelo: typeof modelo === "string" ? modelo : null,
    campos, camadas, auto: typeof tts.auto === "string" ? tts.auto : null,
    travado: mo?.enabled === false || (mo?.allowVoice === false && mo?.allowProvider === false),
    temChave: typeof campos.apiKey === "string" && campos.apiKey.length > 0,
  };
}

/**
 * O que o WhatsApp vai falar diferente do site, em português. Vazio =
 * mesma voz. Compara só o que muda o timbre: provedor, voz e modelo.
 */
export function diferencas(o: OpcoesVoz, w: VozEfetiva): string[] {
  const esperado = camposDoProvedor(o);
  const fora: string[] = [];
  if (w.provedor !== o.provedor) fora.push(`provedor: o WhatsApp usa ${w.provedor ?? "o padrão do OpenClaw"}, o site usa ${PROVEDOR[o.provedor].nome}`);
  else {
    const voz = esperado.voiceId ?? esperado.voice ?? esperado.voiceName;
    const modelo = esperado.modelId ?? esperado.model;
    if (w.voz !== voz) fora.push(`voz: o WhatsApp usa ${w.voz ?? "a padrão do OpenClaw"}, o site usa ${String(voz)}`);
    if (modelo && w.modelo && w.modelo !== modelo) fora.push(`modelo: o WhatsApp usa ${w.modelo}, o site usa ${String(modelo)}`);
  }
  if (!w.travado) fora.push("o modelo de IA ainda pode trocar a voz no meio da resposta");
  return fora;
}

/* ── áudio do Google ─────────────────────────────────────────────── */

/** O Gemini devolve PCM 16 bits, 24 kHz, mono; o navegador toca WAV (o mesmo cabeçalho do OpenClaw). */
export function pcmParaWav(pcm: Uint8Array, taxa = 24_000): Uint8Array {
  const cab = new DataView(new ArrayBuffer(44));
  const escrever = (pos: number, s: string) => { for (let i = 0; i < s.length; i++) cab.setUint8(pos + i, s.charCodeAt(i)); };
  escrever(0, "RIFF"); cab.setUint32(4, 36 + pcm.length, true); escrever(8, "WAVE");
  escrever(12, "fmt "); cab.setUint32(16, 16, true); cab.setUint16(20, 1, true); cab.setUint16(22, 1, true);
  cab.setUint32(24, taxa, true); cab.setUint32(28, taxa * 2, true); cab.setUint16(32, 2, true); cab.setUint16(34, 16, true);
  escrever(36, "data"); cab.setUint32(40, pcm.length, true);
  const r = new Uint8Array(44 + pcm.length);
  r.set(new Uint8Array(cab.buffer), 0); r.set(pcm, 44);
  return r;
}

/** O texto que vai ao Gemini: o jeito de falar antes da fala (composeGoogleTtsText do OpenClaw). */
export const textoGoogle = (estilo: string, fala: string) => [estilo.trim(), fala].filter(Boolean).join("\n\n");

/**
 * As opções a partir dos campos da tela (FormData no salvar, JSON no
 * "Ouvir"): os dois passam por aqui, para a prova tocar exatamente a voz
 * que vai ser salva.
 */
export function opcoesDeCampos(ler: (campo: string) => unknown): OpcoesVoz {
  const s = (k: string) => { const v = ler(k); return typeof v === "string" ? v : v == null ? null : String(v); };
  const n = (k: string) => Number(ler(k));
  return normalizarOpcoes(
    { voz_id: s("eleven_voz"), voz_modelo: s("eleven_modelo") ?? "", voz_estabilidade: n("eleven_estabilidade"), voz_semelhanca: n("eleven_semelhanca"), voz_velocidade: n("eleven_velocidade") },
    {
      provedor: s("provedor"),
      openai: { voz: s("openai_voz"), modelo: s("openai_modelo"), instrucoes: s("openai_instrucoes"), velocidade: n("openai_velocidade") },
      google: { voz: s("google_voz"), modelo: s("google_modelo"), estilo: s("google_estilo") },
    },
  );
}

/** O caminho inverso de opcoesDeCampos: os campos que a tela manda. */
export function camposDaTela(o: OpcoesVoz): Record<string, string | number> {
  return {
    provedor: o.provedor,
    eleven_voz: o.elevenlabs.voz ?? "", eleven_modelo: o.elevenlabs.modelo, eleven_estabilidade: o.elevenlabs.estabilidade,
    eleven_semelhanca: o.elevenlabs.semelhanca, eleven_velocidade: o.elevenlabs.velocidade,
    openai_voz: o.openai.voz, openai_modelo: o.openai.modelo, openai_instrucoes: o.openai.instrucoes, openai_velocidade: o.openai.velocidade,
    google_voz: o.google.voz, google_modelo: o.google.modelo, google_estilo: o.google.estilo,
  };
}
