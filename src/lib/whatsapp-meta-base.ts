import { createHmac, timingSafeEqual } from "crypto";

/**
 * API oficial do WhatsApp (Meta, WhatsApp Business Platform / Cloud API):
 * o que não toca rede nem banco. Testes: testes/unit/whatsapp-meta.test.ts.
 *
 * É a segunda forma de ligar a Marina ao WhatsApp, ao lado do WhatsApp Web
 * (QR) do OpenClaw. Qual das duas está em uso fica em
 * `marina_escalonamento_config.whatsapp_modo` ("web" | "oficial") e é
 * trocada na tela /admin/whatsapp. Fluxo e passo a passo na Meta:
 * docs/fluxo-whatsapp-oficial.md.
 */

/** As chaves, todas na Vercel. Sem qualquer uma delas a API oficial fica desligada. */
export const VARIAVEIS_META = [
  ["WHATSAPP_META_TOKEN", "token permanente do usuário do sistema"],
  ["WHATSAPP_META_PHONE_ID", "ID do número de telefone (não é o número)"],
  ["WHATSAPP_META_APP_SECRET", "chave secreta do app, para conferir a assinatura"],
  ["WHATSAPP_META_VERIFY_TOKEN", "palavra combinada para a Meta validar o webhook"],
] as const;

export function faltandoMeta(env: Record<string, string | undefined> = process.env): string[] {
  return VARIAVEIS_META.filter(([nome]) => !env[nome]?.trim()).map(([nome]) => nome);
}

export const metaConfigurada = (env: Record<string, string | undefined> = process.env) => faltandoMeta(env).length === 0;

/**
 * A Meta assina cada aviso com HMAC-SHA256 do corpo bruto, usando a chave
 * secreta do app (`X-Hub-Signature-256: sha256=<hex>`). Sem segredo ou sem
 * assinatura, recusa: um webhook aberto deixaria qualquer um falar com a
 * Marina em nome de um cliente.
 */
export function assinaturaValida(corpoBruto: string, cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || !cabecalho?.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", segredo).update(corpoBruto, "utf8").digest();
  const recebido = Buffer.from(cabecalho.slice(7), "hex");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/* ── o que chega ─────────────────────────────────────────────────── */

export type MensagemRecebida = {
  /** wamid — único por mensagem; usado para não responder duas vezes. */
  id: string;
  /** Número de quem escreveu, só dígitos (o wa_id da Meta). */
  de: string;
  nome: string | null;
  tipo: string;
  texto: string | null;
  midia: { id: string; mime: string | null } | null;
  /** Mensagem respondida (o "responder" do WhatsApp). */
  citadoId: string | null;
  /** true: mensagem que a própria pousada mandou pelo aplicativo (coexistência). */
  eco: boolean;
};

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const so = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

function deUma(m: Record<string, unknown>, nomes: Map<string, string>, eco: boolean): MensagemRecebida | null {
  const id = txt(m.id);
  const de = so(eco ? m.to : m.from);
  if (!id || !de) return null;
  const tipo = txt(m.type) ?? "desconhecido";
  const corpo = (m[tipo] ?? {}) as Record<string, unknown>;
  let texto: string | null = null;
  let midia: MensagemRecebida["midia"] = null;
  switch (tipo) {
    case "text": texto = txt(corpo.body); break;
    case "audio": case "image": case "video": case "document": case "sticker":
      midia = txt(corpo.id) ? { id: txt(corpo.id)!, mime: txt(corpo.mime_type) } : null;
      texto = txt(corpo.caption);
      break;
    case "location": {
      const lat = corpo.latitude, lng = corpo.longitude;
      texto = typeof lat === "number" && typeof lng === "number"
        ? `[Localização enviada pelo cliente: ${lat}, ${lng}${txt(corpo.name) ? ` — ${txt(corpo.name)}` : ""}${txt(corpo.address) ? `, ${txt(corpo.address)}` : ""}]`
        : null;
      break;
    }
    case "interactive": {
      const r = (corpo.button_reply ?? corpo.list_reply ?? {}) as Record<string, unknown>;
      texto = txt(r.title) ?? txt(r.description);
      break;
    }
    case "button": texto = txt(corpo.text) ?? txt(corpo.payload); break;
    case "reaction": return null; // um emoji numa mensagem não pede resposta
    default: texto = null;
  }
  const contexto = (m.context ?? {}) as Record<string, unknown>;
  return { id, de, nome: nomes.get(de) ?? null, tipo, texto, midia, citadoId: txt(contexto.id), eco };
}

/**
 * As mensagens de um aviso da Meta. Ignora status de entrega, reações e
 * avisos de outro número da mesma conta (quando `idDoNumero` é dado).
 */
export function lerEntrada(payload: unknown, idDoNumero?: string | null): MensagemRecebida[] {
  const saida: MensagemRecebida[] = [];
  const p = payload as { object?: string; entry?: unknown[] } | null;
  if (!p || !Array.isArray(p.entry)) return saida;
  for (const entrada of p.entry) {
    const mudancas = (entrada as { changes?: unknown[] })?.changes;
    if (!Array.isArray(mudancas)) continue;
    for (const mudanca of mudancas) {
      const { field, value } = (mudanca ?? {}) as { field?: string; value?: Record<string, unknown> };
      if (!value) continue;
      const meta = (value.metadata ?? {}) as Record<string, unknown>;
      if (idDoNumero && txt(meta.phone_number_id) && txt(meta.phone_number_id) !== idDoNumero) continue;
      const nomes = new Map<string, string>();
      for (const c of Array.isArray(value.contacts) ? value.contacts : []) {
        const cc = c as { wa_id?: string; profile?: { name?: string } };
        if (so(cc.wa_id) && txt(cc.profile?.name)) nomes.set(so(cc.wa_id), txt(cc.profile?.name)!);
      }
      if (field === "messages" && Array.isArray(value.messages)) {
        for (const m of value.messages) { const x = deUma(m as Record<string, unknown>, nomes, false); if (x) saida.push(x); }
      }
      /* Coexistência: o que a Cecília manda pelo aplicativo WhatsApp Business
         chega como "eco". Serve para a Marina saber e ficar quieta. */
      if (field === "smb_message_echoes" && Array.isArray(value.message_echoes)) {
        for (const m of value.message_echoes) { const x = deUma(m as Record<string, unknown>, nomes, true); if (x) saida.push(x); }
      }
    }
  }
  return saida;
}

/* ── o que sai ───────────────────────────────────────────────────── */

export type Parte = { tipo: "texto"; texto: string } | { tipo: "imagem" | "video"; url: string; legenda: string | null };

/** O WhatsApp aceita até 4096 caracteres por mensagem; sobra folga. */
export const LIMITE_TEXTO = 4000;

/** Markdown do chat do site → formatação do WhatsApp. */
export function paraWhatsapp(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t: string, u: string) => (t.trim() === u ? u : `${t.trim()}: ${u}`))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fatiar(texto: string): string[] {
  if (texto.length <= LIMITE_TEXTO) return texto ? [texto] : [];
  const partes: string[] = [];
  let resto = texto;
  while (resto.length > LIMITE_TEXTO) {
    let corte = resto.lastIndexOf("\n\n", LIMITE_TEXTO);
    if (corte < LIMITE_TEXTO / 2) corte = resto.lastIndexOf("\n", LIMITE_TEXTO);
    if (corte < LIMITE_TEXTO / 2) corte = resto.lastIndexOf(" ", LIMITE_TEXTO);
    if (corte <= 0) corte = LIMITE_TEXTO;
    partes.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) partes.push(resto);
  return partes;
}

/**
 * A resposta da Marina em mensagens de WhatsApp, na ordem em que ela
 * escreveu: texto, e cada `![descrição](url)` sozinho na linha vira foto
 * ou vídeo (o mesmo combinado do chat do site).
 */
export function partirResposta(resposta: string): Parte[] {
  const partes: Parte[] = [];
  let bloco: string[] = [];
  const fecharTexto = () => {
    for (const t of fatiar(paraWhatsapp(bloco.join("\n")))) partes.push({ tipo: "texto", texto: t });
    bloco = [];
  };
  for (const linha of resposta.split("\n")) {
    const m = linha.match(/^\s*!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\s*$/);
    if (!m) { bloco.push(linha); continue; }
    fecharTexto();
    const video = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(m[2]);
    partes.push({ tipo: video ? "video" : "imagem", url: m[2], legenda: m[1].trim() || null });
  }
  fecharTexto();
  return partes;
}

/** Variável de template: a Meta recusa quebra de linha, tabulação e mais de 4 espaços seguidos. */
export function paraVariavel(texto: string, limite = 1000): string {
  return texto.replace(/\s*\n+\s*/g, " · ").replace(/\t/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, limite);
}

/** Erros da Meta que quem opera entende. */
export function erroDaMeta(corpo: unknown, status: number): string {
  const e = (corpo as { error?: { message?: string; code?: number; error_data?: { details?: string } } } | null)?.error;
  const codigo = e?.code;
  if (codigo === 131047) return "Passaram mais de 24 h desde a última mensagem desta pessoa: só um modelo aprovado pela Meta pode ser enviado.";
  if (codigo === 131026) return "A Meta não conseguiu entregar: o número pode não ter WhatsApp.";
  if (codigo === 190) return "O token da Meta venceu ou foi revogado (WHATSAPP_META_TOKEN).";
  if (codigo === 132001) return "O modelo de mensagem não existe ou não foi aprovado na Meta (confira o nome e o idioma).";
  if (codigo === 131056) return "Muitas mensagens seguidas para este número; a Meta pediu para esperar.";
  const detalhe = e?.error_data?.details ?? e?.message;
  return `A Meta recusou (${status}${codigo ? `, código ${codigo}` : ""}): ${String(detalhe ?? "sem detalhe").slice(0, 200)}`;
}

/**
 * Onde a Marina está, quando é o WhatsApp oficial. Vai como mensagem de
 * sistema montada no servidor, como no chat do site (src/lib/chat.ts).
 */
export const CONTEXTO_WHATSAPP_OFICIAL = [
  "Você está atendendo pelo WHATSAPP OFICIAL da pousada (API da Meta).",
  "",
  "FOTOS E VÍDEOS: para mandar, escreva em markdown — ![descrição](url) — numa",
  "linha sozinha; o sistema envia como foto (ou vídeo, se a url for .mp4).",
  "Use somente URLs que vieram da rota /api/agent/quartos (campos `fotos` e",
  "`videos`) ou dos ROTEIROS DE ORIENTAÇÃO do treinamento. Até três fotos por",
  "vez. Nunca diga que enviou uma mídia que você não escreveu na resposta.",
  "",
  "ÁUDIO: quando o cliente manda áudio, ele chega aqui já transcrito, entre",
  "[Áudio do cliente: ...]. Responda normalmente, em texto; o sistema pode",
  "mandar a sua resposta também em áudio.",
  "",
  "LINKS: só páginas do NOSSO site (marimar-site.vercel.app) e o link oficial",
  "de reserva do motor Desbravador. Nunca aponte para pousadamarimarilhadomel.com.br",
  "nem pousadamarimar.com.br. Sem o link certo, não invente.",
  "",
  "Nunca afirme escassez (\"últimas vagas\") sem esse dado ter vindo da",
  "consulta de disponibilidade nesta mesma conversa.",
].join("\n");
