/**
 * Blindagem do WhatsApp da Marina (forma QR, pelo OpenClaw): as regras, sem
 * rede nem banco. Testes: testes/unit/whatsapp-saude.test.ts.
 *
 * Duas frentes (docs/blindagem-whatsapp.md):
 *  - o VIGIA lê o `channels.status` do OpenClaw, entende em que estado a
 *    conexão está e decide se destrava sozinho (canal ligado ao celular mas
 *    sem conexão, como em 21/10) ou se só avisa (aparelho removido, duas
 *    cópias no mesmo número);
 *  - o DISJUNTOR segura os envios que o site faz pelo número da Marina
 *    (avisos à equipe, chamados, testes): nada repetido, nada em rajada,
 *    nada para o próprio número, e um intervalo entre um e outro. É o que
 *    o sistema anti-robô do WhatsApp mais vigia num aparelho conectado.
 */

/**
 * - conectado: tudo certo.
 * - travado: ligada ao celular, canal rodando, sem conexão (21/10) → destravar, sem QR.
 * - parado: ligada ao celular, canal desligado → ligar, sem QR.
 * - caido: o WhatsApp removeu o aparelho (401) → só QR novo resolve.
 * - sem_aparelho: nenhum celular ligado (desconectada no painel) → QR.
 * - conflito: duas cópias no mesmo número (440).
 */
export type EstadoConexao = "conectado" | "travado" | "caido" | "sem_aparelho" | "conflito" | "reconectando" | "parado" | "desconhecido";

export type LeituraWhatsapp = {
  estado: EstadoConexao;
  /** Número ligado à Marina (E.164 sem "+"), quando o OpenClaw informa. */
  numero: string | null;
  conectadoDesde: number | null;
  ultimaEntrada: number | null;
  tentativas: number | null;
  erro: string | null;
  saude: string | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A conta do WhatsApp dentro da resposta do `channels.status`, onde quer que venha. */
function contaWhatsapp(dados: unknown): Record<string, unknown> | null {
  const achadas: Record<string, unknown>[] = [];
  const andar = (o: unknown, doWhatsapp: boolean) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach((x) => andar(x, doWhatsapp)); return; }
    const obj = o as Record<string, unknown>;
    const eWhatsapp = doWhatsapp || String(obj.id ?? obj.channel ?? obj.name ?? "").toLowerCase() === "whatsapp";
    if (eWhatsapp && ("connected" in obj || "healthState" in obj || "running" in obj)) achadas.push(obj);
    for (const [k, v] of Object.entries(obj)) andar(v, eWhatsapp || k.toLowerCase() === "whatsapp");
  };
  andar(dados, false);
  /* A conta (com healthState) vale mais que o resumo do canal. */
  return achadas.find((a) => "healthState" in a) ?? achadas[0] ?? null;
}

export function lerSaude(dados: unknown): LeituraWhatsapp | null {
  const c = contaWhatsapp(dados);
  if (!c) return null;
  const saude = txt(c.healthState);
  const queda = c.lastDisconnect && typeof c.lastDisconnect === "object" ? (c.lastDisconnect as Record<string, unknown>) : null;
  const erro = txt(c.lastError) ?? txt(queda?.error);
  const self = (c.self && typeof c.self === "object" ? c.self : {}) as Record<string, unknown>;
  const numero = (txt(self.e164) ?? "").replace(/\D/g, "") || null;
  let estado: EstadoConexao;
  if (c.connected === true) estado = "conectado";
  else if (saude === "logged-out" || /\b401\b/.test(erro ?? "")) estado = "caido";
  else if (c.linked === false) estado = "sem_aparelho";
  else if (saude === "conflict" || /\b440\b/.test(erro ?? "")) estado = "conflito";
  else if (saude === "reconnecting") estado = "reconectando";
  else if (c.running === true) estado = "travado";
  else if (c.running === false || saude === "stopped") estado = "parado";
  else estado = "desconhecido";
  return {
    estado, numero, saude, erro,
    conectadoDesde: num(c.lastConnectedAt),
    ultimaEntrada: num(c.lastInboundAt) ?? num(c.lastMessageAt),
    tentativas: num(c.reconnectAttempts),
  };
}

/* ── vigia ───────────────────────────────────────────────────────── */

export const VIGIA = {
  /** Travado há pelo menos isto antes de mexer: o OpenClaw tem 2 min de tolerância ao conectar. */
  travadoMin: 4,
  /** Entre duas recuperações automáticas. */
  intervaloAcaoMin: 20,
  /** No máximo isto em 24 h; passou, só avisa (um liga-desliga sem fim também chama atenção do WhatsApp). */
  acoesPorDia: 6,
  /** Reconectando há tanto tempo: avisa. */
  reconectandoMin: 15,
  /** Servidor da Marina sem responder há tanto tempo: avisa. */
  semRespostaMin: 10,
};

export type MemoriaVigia = {
  estado: EstadoConexao | "inalcancavel";
  desde: number;
  numero: string | null;
  /** Desde quando ESTE número está ligado à Marina (troca de número = período de adaptação). */
  numeroDesde: number | null;
  /** Horários das recuperações automáticas (últimas 24 h). */
  acoes: number[];
  /** Estado que já foi avisado (não repete o aviso). */
  avisado: string | null;
  ultimaVez: number;
  historico: { em: number; texto: string }[];
};

export const MEMORIA_VAZIA: MemoriaVigia = { estado: "desconhecido", desde: 0, numero: null, numeroDesde: null, acoes: [], avisado: null, ultimaVez: 0, historico: [] };

export type DecisaoVigia = { acao: "nada" | "destravar"; alerta: string | null; memoria: MemoriaVigia };

const minutos = (ms: number) => ms / 60_000;

/**
 * O que fazer agora. `leitura` null = o servidor da Marina não respondeu.
 * `modo` "oficial": a forma QR está pausada de propósito — não mexe.
 */
export function decidirVigia(leitura: LeituraWhatsapp | null, antes: MemoriaVigia, agora: number, modo: string): DecisaoVigia {
  const estado: MemoriaVigia["estado"] = modo === "oficial" ? "parado" : leitura ? leitura.estado : "inalcancavel";
  const mudou = estado !== antes.estado;
  const numero = leitura?.numero ?? antes.numero;
  const trocouNumero = !!leitura?.numero && leitura.numero !== antes.numero;
  const memoria: MemoriaVigia = {
    ...antes,
    estado,
    desde: mudou || !antes.desde ? agora : antes.desde,
    numero,
    numeroDesde: trocouNumero ? agora : antes.numeroDesde ?? (numero ? agora : null),
    acoes: antes.acoes.filter((t) => agora - t < 24 * 3600_000),
    ultimaVez: agora,
    historico: [...antes.historico],
  };
  const anotar = (texto: string) => { memoria.historico = [{ em: agora, texto }, ...memoria.historico].slice(0, 20); };
  if (mudou && antes.desde) anotar(`Estado: ${ROTULO[estado]}`);
  if (trocouNumero) anotar(`Número conectado: +${leitura!.numero} (período de adaptação de ${ADAPTACAO_DIAS} dias)`);

  if (modo === "oficial") { memoria.avisado = null; return { acao: "nada", alerta: null, memoria }; }

  const ha = minutos(agora - memoria.desde);
  let alerta: string | null = null;
  const avisar = (chave: string, texto: string) => {
    if (memoria.avisado === chave) return;
    memoria.avisado = chave;
    alerta = texto;
  };

  switch (estado) {
    case "conectado":
      if (antes.avisado) alerta = "✅ A Marina voltou ao WhatsApp.";
      memoria.avisado = null;
      return { acao: "nada", alerta, memoria };
    case "caido":
      avisar("caido", "⚠️ A Marina saiu do WhatsApp: o aparelho foi removido (código 401). Religue pelo QR em Marina → WhatsApp da Marina.");
      return { acao: "nada", alerta, memoria };
    case "sem_aparelho":
      avisar("sem_aparelho", "⚠️ A Marina não está ligada a nenhum celular. Conecte pelo QR em Marina → WhatsApp da Marina.");
      return { acao: "nada", alerta, memoria };
    case "conflito":
      avisar("conflito", "⚠️ Duas cópias da Marina usaram o mesmo número (código 440). Deixe só um OpenClaw ligado e reinicie o gateway.");
      return { acao: "nada", alerta, memoria };
    case "reconectando":
      if (ha >= VIGIA.reconectandoMin) avisar("reconectando", `⚠️ A Marina está tentando reconectar ao WhatsApp há ${Math.round(ha)} minutos.`);
      return { acao: "nada", alerta, memoria };
    case "inalcancavel":
      if (ha >= VIGIA.semRespostaMin) avisar("inalcancavel", `⚠️ O servidor da Marina (OpenClaw, Hostinger) não responde há ${Math.round(ha)} minutos.`);
      return { acao: "nada", alerta, memoria };
    case "travado":
    case "parado": {
      if (ha < VIGIA.travadoMin) return { acao: "nada", alerta: null, memoria };
      const ultima = memoria.acoes.at(-1);
      if (memoria.acoes.length >= VIGIA.acoesPorDia) {
        avisar("esgotado", `⚠️ A Marina está sem conexão com o WhatsApp e o destravamento automático já tentou ${VIGIA.acoesPorDia} vezes hoje. No terminal: openclaw gateway restart.`);
        return { acao: "nada", alerta, memoria };
      }
      if (ultima && minutos(agora - ultima) < VIGIA.intervaloAcaoMin) return { acao: "nada", alerta: null, memoria };
      memoria.acoes = [...memoria.acoes, agora];
      anotar("Destravamento automático (parar e ligar o canal)");
      return { acao: "destravar", alerta: null, memoria };
    }
    default:
      return { acao: "nada", alerta: null, memoria };
  }
}

export const ROTULO: Record<MemoriaVigia["estado"], string> = {
  conectado: "conectada", travado: "ligada ao celular, sem conexão", caido: "aparelho removido (401)", sem_aparelho: "sem celular ligado",
  conflito: "duas cópias no mesmo número (440)", reconectando: "reconectando", parado: "parada",
  desconhecido: "desconhecido", inalcancavel: "servidor sem resposta",
};

/* ── disjuntor de envios ─────────────────────────────────────────── */

export const DISJUNTOR = {
  /** Mesmo texto para o mesmo número: no máximo uma vez neste intervalo. */
  repetidaMin: 30,
  porNumeroHora: 20,
  totalHora: 90,
  total10Min: 30,
  /** Entre um envio e outro (o site espera, não descarta). */
  intervaloMs: 3000,
};

/**
 * Número recém-conectado: os primeiros dias são os mais vigiados pelo
 * WhatsApp (a queda de 18/10 veio 25 h depois da troca de número). Nesse
 * período o disjuntor fica com metade dos limites e o dobro do intervalo.
 */
export const ADAPTACAO_DIAS = 3;

export function emAdaptacao(numeroDesde: number | null, agora: number): boolean {
  return numeroDesde != null && agora - numeroDesde < ADAPTACAO_DIAS * 24 * 3600_000;
}

export type EnvioRegistrado = { numero: string; chave: string; em: number };

export type DecisaoEnvio = { ok: true; esperarMs: number } | { ok: false; motivo: string };

const so = (n: string) => n.replace(/\D/g, "");

/** Mesmo número com ou sem o 9 (o WhatsApp de DDD 31+ guarda sem). */
export function mesmoCelular(a: string, b: string): boolean {
  const x = so(a), y = so(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const sem9 = (n: string) => (/^55\d{2}9\d{8}$/.test(n) ? n.slice(0, 4) + n.slice(5) : n);
  return sem9(x) === sem9(y);
}

export function decidirEnvio(historico: EnvioRegistrado[], numero: string, chave: string, agora: number, proprio: string | null, adaptacao = false): DecisaoEnvio {
  const f = adaptacao ? 0.5 : 1;
  const lim = {
    porNumeroHora: Math.floor(DISJUNTOR.porNumeroHora * f),
    totalHora: Math.floor(DISJUNTOR.totalHora * f),
    total10Min: Math.floor(DISJUNTOR.total10Min * f),
    intervaloMs: DISJUNTOR.intervaloMs / f,
  };
  if (proprio && mesmoCelular(numero, proprio)) {
    return { ok: false, motivo: "é o número da própria Marina; mandar para si mesma não chega a ninguém e parece robô para o WhatsApp" };
  }
  const recentes = historico.filter((h) => agora - h.em < 3600_000);
  if (recentes.some((h) => h.chave === chave && agora - h.em < DISJUNTOR.repetidaMin * 60_000)) {
    return { ok: false, motivo: `a mesma mensagem já foi para este número há menos de ${DISJUNTOR.repetidaMin} minutos` };
  }
  if (recentes.filter((h) => mesmoCelular(h.numero, numero)).length >= lim.porNumeroHora) {
    return { ok: false, motivo: `já foram ${lim.porNumeroHora} mensagens para este número na última hora${adaptacao ? " (número em período de adaptação)" : ""}` };
  }
  if (recentes.length >= lim.totalHora || recentes.filter((h) => agora - h.em < 600_000).length >= lim.total10Min) {
    return { ok: false, motivo: `muitas mensagens automáticas em pouco tempo; o site segurou para proteger o número${adaptacao ? " (período de adaptação)" : ""}` };
  }
  const ultimo = recentes.reduce((m, h) => Math.max(m, h.em), 0);
  return { ok: true, esperarMs: Math.max(0, lim.intervaloMs - (agora - ultimo)) };
}

/* ── alerta no celular ───────────────────────────────────────────── */

/* Sem letras e números que se confundem ao digitar no celular (i, l, o, 0, 1). */
const LETRAS_TOPICO = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Nome do tópico do ntfy que o painel cria. No ntfy.sh o nome do tópico é a
 * senha: quem souber o nome lê os avisos. Por isso 10 letras sorteadas
 * (~49 bits), e o aviso nunca leva dado de cliente.
 */
export function novoTopico(sorteio: Uint8Array): string {
  return "marimar-" + Array.from(sorteio.slice(0, 10), (b) => LETRAS_TOPICO[b % LETRAS_TOPICO.length]).join("");
}

/** O tópico de um endereço do ntfy (a última parte). Sem tópico, null. */
export function topicoDe(url: string | null): string | null {
  if (!url) return null;
  try {
    const t = new URL(url).pathname.split("/").filter(Boolean).pop();
    return t ? decodeURIComponent(t) : null;
  } catch {
    return null;
  }
}
