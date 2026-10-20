import { after } from "next/server";
import { timingSafeEqual } from "crypto";
import { assinaturaValida } from "@/lib/whatsapp-meta-base";
import { processarAvisoMeta } from "@/lib/whatsapp-oficial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* O atendimento roda depois da resposta à Meta (`after`), dentro deste
   prazo — o mesmo das outras rotas do projeto. Os prazos internos
   (transcrição 15 s, Marina 40 s) cabem nele; o texto sai antes da voz. */
export const maxDuration = 60;

/**
 * Webhook da API oficial do WhatsApp (Meta).
 *
 * GET: a Meta confere o endereço uma vez, com a palavra combinada
 *      (WHATSAPP_META_VERIFY_TOKEN), e espera o `hub.challenge` de volta.
 * POST: cada mensagem. Só passa com a assinatura certa
 *      (WHATSAPP_META_APP_SECRET); responde 200 na hora e atende depois.
 *
 * Falha fechado: sem as variáveis na Vercel, recusa. Se a forma em uso no
 * painel for o WhatsApp Web (QR), as mensagens são ignoradas.
 */
export async function GET(req: Request) {
  const esperado = process.env.WHATSAPP_META_VERIFY_TOKEN?.trim();
  if (!esperado) return new Response("API oficial não configurada", { status: 503 });
  const u = new URL(req.url);
  const token = u.searchParams.get("hub.verify_token") ?? "";
  const desafio = u.searchParams.get("hub.challenge") ?? "";
  const igual = token.length === esperado.length && timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
  if (u.searchParams.get("hub.mode") === "subscribe" && igual && desafio) {
    return new Response(desafio, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("recusado", { status: 403 });
}

export async function POST(req: Request) {
  const segredo = process.env.WHATSAPP_META_APP_SECRET?.trim();
  if (!segredo) return new Response("API oficial não configurada", { status: 503 });
  const bruto = await req.text();
  if (!assinaturaValida(bruto, req.headers.get("x-hub-signature-256"), segredo)) {
    return new Response("assinatura inválida", { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(bruto); } catch { return new Response("corpo inválido", { status: 400 }); }
  after(() => processarAvisoMeta(payload).catch((e) => console.error("[whatsapp-oficial]", (e as Error).message)));
  return new Response("ok", { status: 200 });
}
