import { comSql } from "./db-conexao";
import type { Envio, Template } from "./envio-whatsapp";
import { erroDaMeta, faltandoMeta, paraVariavel, type Parte } from "./whatsapp-meta-base";

/**
 * Conversa com a Graph API da Meta (WhatsApp Cloud API). Nunca lança:
 * devolve `{ ok, id | erro }` como o envio pelo OpenClaw
 * (src/lib/envio-whatsapp.ts), para quem chama não precisar saber por qual
 * das duas formas a mensagem saiu.
 *
 * `WHATSAPP_META_GRAPH_URL` existe só para o teste local apontar para a Meta
 * simulada (testes/meta-simulada.mjs); em produção fica vazio.
 */

const versao = () => process.env.WHATSAPP_META_API_VERSION?.trim() || "v23.0";
const base = () => (process.env.WHATSAPP_META_GRAPH_URL?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");
const endereco = (caminho: string) => `${base()}/${versao()}/${caminho}`;
const autorizacao = () => ({ authorization: `Bearer ${process.env.WHATSAPP_META_TOKEN}` });

type Chamada = { ok: true; dados: Record<string, unknown> } | { ok: false; erro: string };

async function chamar(caminho: string, init: RequestInit = {}, prazoMs = 20_000): Promise<Chamada> {
  const faltam = faltandoMeta().filter((v) => v === "WHATSAPP_META_TOKEN" || v === "WHATSAPP_META_PHONE_ID");
  if (faltam.length) return { ok: false, erro: `API oficial sem configurar na Vercel: ${faltam.join(", ")}.` };
  try {
    const r = await fetch(endereco(caminho), {
      ...init,
      headers: { ...autorizacao(), ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...init.headers },
      signal: AbortSignal.timeout(prazoMs),
    });
    const corpo = await r.json().catch(() => null);
    if (!r.ok || (corpo as { error?: unknown })?.error) return { ok: false, erro: erroDaMeta(corpo, r.status) };
    return { ok: true, dados: (corpo ?? {}) as Record<string, unknown> };
  } catch (e) {
    return { ok: false, erro: `não consegui falar com a Meta: ${(e as Error).message}` };
  }
}

const numeroDoTelefone = () => process.env.WHATSAPP_META_PHONE_ID!.trim();
const so = (n: string) => n.replace(/\D/g, "");

/** Manda e guarda o texto pelo id: quando a equipe responde citando, o código do chamado vem junto. */
async function mandar(para: string, corpo: Record<string, unknown>, guardar?: string): Promise<Envio> {
  const r = await chamar(`${numeroDoTelefone()}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: so(para), ...corpo }),
  });
  if (!r.ok) return { ok: false, via: "meta", erro: r.erro };
  const id = ((r.dados.messages as { id?: string }[] | undefined)?.[0]?.id ?? null) as string | null;
  if (!id) return { ok: false, via: "meta", erro: "A Meta aceitou, mas não devolveu o id da mensagem." };
  if (guardar) {
    await comSql((sql) => sql`
      INSERT INTO integracoes (chave, valor) VALUES (${"wa_env:" + id}, ${guardar.slice(0, 4000)})
      ON CONFLICT (chave) DO NOTHING`).catch(() => {});
  }
  return { ok: true, via: "meta", id };
}

export const enviarTextoMeta = (para: string, texto: string) =>
  mandar(para, { type: "text", text: { preview_url: true, body: texto.slice(0, 4096) } }, texto);

export const enviarMidiaMeta = (para: string, p: Exclude<Parte, { tipo: "texto" }>) =>
  mandar(para, p.tipo === "video"
    ? { type: "video", video: { link: p.url, ...(p.legenda ? { caption: p.legenda.slice(0, 1000) } : {}) } }
    : { type: "image", image: { link: p.url, ...(p.legenda ? { caption: p.legenda.slice(0, 1000) } : {}) } });

/** Modelo aprovado na Meta, com uma variável no corpo (o texto). */
export const enviarTemplateMeta = (para: string, t: Template, texto: string) =>
  mandar(para, {
    type: "template",
    template: { name: t.nome, language: { code: t.idioma || "pt_BR" }, components: [{ type: "body", parameters: [{ type: "text", text: paraVariavel(texto) }] }] },
  }, texto);

/** Sobe o áudio (mp3) e manda como mensagem de voz. */
export async function enviarAudioMeta(para: string, audio: ArrayBuffer, mime = "audio/mpeg"): Promise<Envio> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([audio], { type: mime }), "marina.mp3");
  const r = await chamar(`${numeroDoTelefone()}/media`, { method: "POST", body: form }, 15_000);
  if (!r.ok) return { ok: false, via: "meta", erro: r.erro };
  const id = typeof r.dados.id === "string" ? r.dados.id : null;
  if (!id) return { ok: false, via: "meta", erro: "A Meta não devolveu o id do áudio." };
  return mandar(para, { type: "audio", audio: { id } });
}

/** Tique azul e "digitando…" enquanto a Marina pensa. */
export async function marcarLidaMeta(idMensagem: string): Promise<void> {
  await chamar(`${numeroDoTelefone()}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: idMensagem, typing_indicator: { type: "text" } }),
  }, 8_000);
}

/** Baixa uma mídia recebida (áudio do cliente, por exemplo). */
export async function baixarMidiaMeta(idMidia: string, limiteBytes = 10 * 1024 * 1024): Promise<{ ok: true; bytes: ArrayBuffer; mime: string } | { ok: false; erro: string }> {
  const info = await chamar(encodeURIComponent(idMidia));
  if (!info.ok) return info;
  const url = typeof info.dados.url === "string" ? info.dados.url : null;
  if (!url) return { ok: false, erro: "A Meta não devolveu o endereço da mídia." };
  if (Number(info.dados.file_size) > limiteBytes) return { ok: false, erro: "Arquivo grande demais." };
  try {
    const r = await fetch(url, { headers: autorizacao(), signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return { ok: false, erro: `download da mídia: ${r.status}` };
    const bytes = await r.arrayBuffer();
    if (bytes.byteLength > limiteBytes) return { ok: false, erro: "Arquivo grande demais." };
    return { ok: true, bytes, mime: String(info.dados.mime_type ?? r.headers.get("content-type") ?? "application/octet-stream") };
  } catch (e) {
    return { ok: false, erro: `download da mídia: ${(e as Error).message}` };
  }
}

/** O número ligado à API: o painel usa para "Testar a ligação com a Meta". */
export async function infoNumeroMeta(): Promise<{ ok: true; numero: string | null; nome: string | null; qualidade: string | null } | { ok: false; erro: string }> {
  const r = await chamar(`${numeroDoTelefone()}?fields=display_phone_number,verified_name,quality_rating`);
  if (!r.ok) return r;
  const t = (v: unknown) => (typeof v === "string" && v ? v : null);
  return { ok: true, numero: t(r.dados.display_phone_number), nome: t(r.dados.verified_name), qualidade: t(r.dados.quality_rating) };
}

/**
 * O envio da equipe e dos chamados quando a forma em uso é a oficial
 * (chamado por `enviarWhatsapp`). Com modelo, manda o modelo; sem, texto
 * livre — que a Meta só aceita até 24 h depois da última mensagem da pessoa.
 */
export function enviarPelaMeta(numero: string, texto: string, template?: Template | null): Promise<Envio> {
  return template ? enviarTemplateMeta(numero, template, texto) : enviarTextoMeta(numero, texto);
}
