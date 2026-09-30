/**
 * Escalonamento e aprendizado: a parte que não toca banco nem rede.
 *
 * Tudo aqui é função pura — é o que os testes (`testes/unit/escalonamento.test.ts`)
 * exercitam, e o que as telas podem importar sem levar o driver do Postgres.
 * Fluxo completo: docs/fluxo-escalonamento.md.
 */

/* ── setores da equipe ───────────────────────────────────────────── */

export const SETORES = [
  { id: "reservas", rotulo: "Reservas", pistas: /reserv|vaga|disponib|di[aá]ria|pre[cç]o|valor|tarifa|cancel|alterar data|remarc/i },
  { id: "financeiro", rotulo: "Financeiro", pistas: /pagamento|pagar|pix|cart[aã]o|d[eé]bito|cr[eé]dito|reembolso|estorno|nota fiscal|boleto|parcel|sinal/i },
  { id: "recepcao", rotulo: "Recepção", pistas: /check.?in|check.?out|chegada|sa[ií]da|bagagem|mala|recep[cç][aã]o|chave|guard/i },
  { id: "manutencao", rotulo: "Manutenção", pistas: /ar.condicionado|chuveiro|quebr|vazament|energia|tomada|wi.?fi|internet|limpeza|toalha|len[cç]o|barulho/i },
  { id: "passeios", rotulo: "Passeios", pistas: /passeio|trilha|tour|farol|gruta|fortaleza|barco|lancha|mergulho|surf/i },
  { id: "restaurante", rotulo: "Restaurante", pistas: /restaurante|card[aá]pio|caf[eé]|almo[cç]o|jantar|bebida|comida|vegan|vegetarian|alerg|gl[uú]ten/i },
  { id: "eventos", rotulo: "Eventos", pistas: /casamento|evento|festa|anivers[aá]rio|confraterniza|grupo/i },
  { id: "geral", rotulo: "Qualquer assunto", pistas: /$^/ },
] as const;

export type Setor = (typeof SETORES)[number]["id"];
export const rotuloSetor = (id: string) => SETORES.find((s) => s.id === id)?.rotulo ?? "Qualquer assunto";
export const setorValido = (id: unknown): Setor =>
  (SETORES.some((s) => s.id === id) ? id : "geral") as Setor;

/** Chuta o setor pelo texto da pergunta. A Marina pode mandar o assunto; isto é o plano B. */
export function setorPara(texto: string): Setor {
  return (SETORES.find((s) => s.id !== "geral" && s.pistas.test(texto))?.id ?? "geral") as Setor;
}

/* ── código do chamado ───────────────────────────────────────────── */

/* Sem 0/O, 1/I/L: quem digita o código no celular não confunde. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function gerarCodigo(aleatorio: () => number = Math.random): string {
  let c = "";
  for (let i = 0; i < 4; i++) c += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  return c;
}

/**
 * Quais dos códigos em aberto aparecem no texto (com ou sem "#", em
 * qualquer caixa). Procurar só os códigos que existem — e não "qualquer
 * palavra de 4 letras" — evita confundir um "SIM!" ou um "OBRIGADA" com um chamado.
 */
export function codigosNoTexto(texto: string, abertos: string[]): string[] {
  const t = ` ${texto.toUpperCase()} `;
  return abertos.filter((c) => new RegExp(`(^|[^A-Z0-9])#?${c}([^A-Z0-9]|$)`).test(t));
}

/* ── números ─────────────────────────────────────────────────────── */

/** Só dígitos, com DDI. Número brasileiro sem o 55 ganha o 55. */
export function normalizarNumero(bruto: string): string | null {
  const d = (bruto ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

export const mesmoNumero = (a: string | null | undefined, b: string | null | undefined) => {
  const x = normalizarNumero(a ?? ""), y = normalizarNumero(b ?? "");
  if (!x || !y) return false;
  /* O WhatsApp às vezes entrega celular brasileiro sem o 9 depois do DDD. */
  const sem9 = (n: string) => (n.startsWith("55") && n.length === 13 ? n.slice(0, 4) + n.slice(5) : n);
  return x === y || sem9(x) === sem9(y);
};

export const mascararNumero = (n: string) => (n.length > 6 ? `${n.slice(0, 4)}•••${n.slice(-4)}` : "•••");

/* ── privacidade ─────────────────────────────────────────────────── */

/**
 * Tira do texto o que identifica o cliente: e-mail, telefone, documentos,
 * cartão e "meu nome é Fulano". Roda em tudo o que vai para a base de
 * aprendizado e para a mensagem da equipe — a base guarda PERGUNTAS, não pessoas.
 */
export function anonimizar(texto: string): string {
  return (texto ?? "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[cartão]")
    .replace(/(\+?\d{2}[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g, "[telefone]")
    .replace(/([Mm]eu nome [eé]|[Mm]e chamo|[Ss]ou (?:o|a))\s+[A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+)*/g, "$1 [nome]")
    .trim();
}

/**
 * A pergunta como ela entra na base de aprendizado: anonimizada e sem as
 * frases que só identificavam a pessoa ("Meu nome é [nome].").
 */
export function perguntaParaBase(texto: string): string {
  return anonimizar(texto)
    .replace(/([Mm]eu nome [eé]|[Mm]e chamo|[Ss]ou (?:o|a)) \[nome\][.,!;]?\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ── horário de atendimento ──────────────────────────────────────── */

export type ContatoEquipe = {
  id: string; nome: string; numero: string; setores: string[]; dias: number[];
  hora_inicio: string; hora_fim: string; ordem: number; ativo: boolean;
};

/** Dia da semana (0 = domingo) e minutos do dia em São Paulo. */
export function agoraEmSaoPaulo(agora: Date): { dia: number; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(agora);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { dia: dias.indexOf(v("weekday")), minutos: Number(v("hour")) * 60 + Number(v("minute")) };
}

const minutosDe = (hhmm: string) => {
  const [h, m] = (hhmm ?? "").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** Dentro do horário? Aceita virada da meia-noite (ex.: 22:00 às 06:00). */
export function dentroDoHorario(c: Pick<ContatoEquipe, "dias" | "hora_inicio" | "hora_fim">, agora: Date): boolean {
  const { dia, minutos } = agoraEmSaoPaulo(agora);
  const ini = minutosDe(c.hora_inicio), fim = minutosDe(c.hora_fim);
  if (ini === fim) return c.dias.includes(dia);
  if (ini < fim) return c.dias.includes(dia) && minutos >= ini && minutos < fim;
  /* Madrugada: depois do início conta o dia de hoje; antes do fim, o de ontem. */
  return minutos >= ini ? c.dias.includes(dia) : minutos < fim && c.dias.includes((dia + 6) % 7);
}

/**
 * Quem avisar. Ordem: quem atende o setor (antes de quem atende "qualquer
 * assunto"), quem está no horário (antes de quem não está) e a prioridade
 * cadastrada. Quem já foi avisado neste chamado fica de fora — é assim que
 * o repasse anda para o próximo da fila.
 */
export function escolherContato(contatos: ContatoEquipe[], setor: string, jaAvisados: string[], agora: Date): ContatoEquipe | null {
  const candidatos = contatos.filter((c) => c.ativo && !jaAvisados.includes(c.id));
  if (!candidatos.length) return null;
  const nota = (c: ContatoEquipe) =>
    (c.setores.includes(setor) ? 0 : c.setores.includes("geral") ? 1 : 2) * 10 +
    (dentroDoHorario(c, agora) ? 0 : 1);
  return [...candidatos].sort((a, b) => nota(a) - nota(b) || a.ordem - b.ordem)[0];
}

/* ── WhatsApp: janela de 24 horas ────────────────────────────────── */

/**
 * Na API oficial do WhatsApp (Meta), só se manda mensagem livre até 24 h
 * depois da última mensagem da pessoa; fora disso, só template aprovado.
 * No WhatsApp ligado pelo aparelho (modo "web", que é o do OpenClaw hoje)
 * essa regra não existe.
 */
export function janelaAberta(ultimaMensagem: Date | string | null, agora: Date, modo: string): boolean {
  if (modo !== "oficial") return true;
  if (!ultimaMensagem) return false;
  return agora.getTime() - new Date(ultimaMensagem).getTime() < 24 * 3600 * 1000;
}

/* ── prazos ──────────────────────────────────────────────────────── */

export type ConfigEscalonamento = {
  ativo: boolean;
  lembrete_min: number; proximo_min: number; aviso_cliente_min: number; desistir_min: number;
  whatsapp_modo: string; template_cliente: string | null; template_equipe: string | null; template_idioma: string;
  aprendizado_modo: string; validade_dias: number;
};

export const CONFIG_ESCALONAMENTO_PADRAO: ConfigEscalonamento = {
  ativo: false, lembrete_min: 20, proximo_min: 45, aviso_cliente_min: 30, desistir_min: 240,
  whatsapp_modo: "web", template_cliente: null, template_equipe: null, template_idioma: "pt_BR",
  aprendizado_modo: "aprovacao", validade_dias: 30,
};

export type Acao = "lembrete" | "proximo" | "avisar_cliente" | "desistir";

/**
 * O que fazer com um chamado parado, agora. Função pura: o processador de
 * prazos (`processarPrazos`) só executa o que ela devolve.
 */
export function acoesDePrazo(
  c: { status: string; criado_em: Date | string; notificado_em: Date | string | null; lembrete_em: Date | string | null; cliente_avisado_em: Date | string | null },
  cfg: Pick<ConfigEscalonamento, "lembrete_min" | "proximo_min" | "aviso_cliente_min" | "desistir_min">,
  agora: Date,
): Acao[] {
  if (c.status !== "aguardando") return [];
  const min = (d: Date | string | null) => (d ? (agora.getTime() - new Date(d).getTime()) / 60000 : null);
  const desdeCriado = min(c.criado_em)!;
  if (desdeCriado >= cfg.desistir_min) return ["desistir"];
  const acoes: Acao[] = [];
  const desdeAviso = min(c.notificado_em);
  if (desdeAviso !== null) {
    if (desdeAviso >= cfg.proximo_min) acoes.push("proximo");
    else if (desdeAviso >= cfg.lembrete_min && !c.lembrete_em) acoes.push("lembrete");
  } else {
    acoes.push("proximo"); // ninguém foi avisado ainda (ex.: equipe vazia na hora): tenta de novo
  }
  if (desdeCriado >= cfg.aviso_cliente_min && !c.cliente_avisado_em) acoes.push("avisar_cliente");
  return acoes;
}

/* ── significado: agrupar perguntas parecidas ────────────────────── */

const VAZIAS = new Set(("a o as os um uma uns umas de da do das dos em no na nos nas por pra para pro com sem e ou que " +
  "se me te voce voces vc vcs eu ele ela nos isso isto esse essa este esta ai ali aqui la tem ter ha e eh " +
  "qual quais como quando onde porque por que quanto quanta quantos quantas sera seria pode podem posso gostaria " +
  "queria quero saber favor ola oi bom boa dia tarde noite obrigado obrigada tudo bem ja mais muito muita so tambem " +
  "minha meu nossa nosso sua seu la lo").split(" "));

/* Palavras que dizem a mesma coisa para quem pergunta a uma pousada. */
const SINONIMOS: Record<string, string> = {
  aceitam: "aceit", aceita: "aceit", aceito: "aceit", aceitar: "aceit", recebem: "aceit", recebe: "aceit",
  cachorro: "pet", cachorra: "pet", cao: "pet", gato: "pet", animal: "pet", animais: "pet", pets: "pet",
  wifi: "internet", "wi-fi": "internet", net: "internet",
  estacionar: "estacion", estacionamento: "estacion", carro: "estacion",
  cafe: "cafe", manha: "cafe",
  debito: "debito", credito: "credito", cartao: "cartao", cartoes: "cartao",
  valor: "preco", valores: "preco", custa: "preco", custo: "preco", preco: "preco", precos: "preco",
  horario: "hora", horarios: "hora", hora: "hora", horas: "hora",
  crianca: "crianca", criancas: "crianca", filho: "crianca", filhos: "crianca", filha: "crianca", bebe: "bebe",
  quarto: "quarto", quartos: "quarto", suite: "quarto", suites: "quarto",
};

export function normalizarTexto(t: string): string {
  return (t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Raiz grosseira em português: tira plural e terminações comuns. */
function raiz(p: string): string {
  if (SINONIMOS[p]) return SINONIMOS[p];
  let r = p;
  for (const suf of ["amente", "mente", "coes", "cao", "oes", "ais", "eis", "ando", "endo", "indo", "ados", "idas", "ado", "ido", "ar", "er", "ir", "es", "s"]) {
    if (r.length - suf.length >= 4 && r.endsWith(suf)) { r = r.slice(0, -suf.length); break; }
  }
  return r;
}

export function termos(t: string): string[] {
  return [...new Set(normalizarTexto(t).split(" ").filter((p) => p.length > 1 && !VAZIAS.has(p)).map(raiz))];
}

function trigramas(t: string): Set<string> {
  const s = ` ${termos(t).sort().join(" ")} `;
  const g = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) g.add(s.slice(i, i + 3));
  return g;
}

const dice = <T,>(a: Set<T>, b: Set<T>) => {
  if (!a.size || !b.size) return 0;
  let comum = 0;
  for (const x of a) if (b.has(x)) comum++;
  return (2 * comum) / (a.size + b.size);
};

/**
 * Quão parecidas são duas perguntas, de 0 a 1.
 *
 * Mistura palavras-raiz (com sinônimos do dia a dia da pousada) e pedaços
 * de 3 letras (pega erro de digitação e variações de palavra). Não é
 * entendimento de verdade — é o suficiente para "aceitam cartão de débito?"
 * e "vcs aceitam débito?" caírem no mesmo grupo, e "aceita cachorro?" não.
 * Ver os casos em testes/unit/escalonamento.test.ts.
 */
export function similaridade(a: string, b: string): number {
  const ta = new Set(termos(a)), tb = new Set(termos(b));
  if (!ta.size || !tb.size) return 0;
  return 0.65 * dice(ta, tb) + 0.35 * dice(trigramas(a), trigramas(b));
}

/** A partir daqui, duas perguntas são "a mesma pergunta". */
export const LIMIAR_MESMA_PERGUNTA = 0.62;

/** Informação que muda com o tempo pede validade (preço, horário, evento, data). */
export const pedeValidade = (texto: string) =>
  /pre[cç]o|valor|r\$|tarifa|promo|desconto|hor[aá]rio|abre|fecha|evento|show|feriado|r[eé]veillon|carnaval|temporada|card[aá]pio|dispon/i.test(texto);

/* ── textos ──────────────────────────────────────────────────────── */

export const quando = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

/** A mensagem que vai para o WhatsApp da equipe. */
export function textoParaEquipe(c: { codigo: string; pergunta: string; contexto: string | null; canal: string; setor: string; criado_em: Date | string }, tipo: "novo" | "lembrete" | "repasse"): string {
  const canal = c.canal === "site" ? "chat do site" : "WhatsApp";
  const topo = tipo === "lembrete"
    ? `⏰ *Lembrete — chamado #${c.codigo}* (cliente aguardando desde ${quando(c.criado_em)})`
    : tipo === "repasse"
      ? `🔁 *Chamado #${c.codigo}* — quem foi avisado antes não respondeu, então veio para você.`
      : `🙋 *Chamado #${c.codigo}* — a Marina precisa de ajuda`;
  return [
    topo,
    "",
    `*Pergunta do cliente:* ${c.pergunta}`,
    c.contexto ? `*Contexto:* ${c.contexto}` : null,
    `*Canal:* ${canal} · *Assunto:* ${rotuloSetor(c.setor)}`,
    "",
    `Responda *esta mensagem* (ou escreva #${c.codigo} na resposta) com a informação. A Marina repassa ao cliente no tom dela, pelo ${canal}.`,
  ].filter((l) => l !== null).join("\n");
}

/** O que a Marina diz ao cliente quando escala. Ela pode dizer com as palavras dela. */
export function textoAoClienteAoEscalar(algumNoHorario: boolean, canal: string): string {
  const onde = canal === "site" ? "aqui no chat" : "por aqui";
  return algumNoHorario
    ? `Essa eu prefiro confirmar com a equipe da pousada para não te passar nada errado. Já perguntei e te respondo ${onde} assim que me retornarem 😊`
    : `Essa eu prefiro confirmar com a equipe da pousada para não te passar nada errado. Já deixei a pergunta com eles — como estão fora do horário agora, pode levar um pouquinho, mas te respondo ${onde} 😊`;
}
