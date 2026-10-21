import { NextRequest } from "next/server";
import { checkAgentAuth } from "@/lib/agent-auth";
import { comSql } from "@/lib/db-conexao";
import { processarPrazos } from "@/lib/escalonamento";
import { vigiarWhatsapp } from "@/lib/whatsapp-vigia";

export const dynamic = "force-dynamic";

/**
 * Prazos dos chamados (lembrete à equipe, próximo da fila, aviso ao
 * cliente e desistência) e o vigia do WhatsApp da Marina. Chame a cada 5 minutos, de qualquer agendador
 * (cron do OpenClaw, cron-job.org, Vercel Cron):
 *
 *   curl -H "Authorization: Bearer <CRON_SECRET ou AGENT_API_KEY>" https://<site>/api/cron/chamados
 *
 * Falha fechada: sem chave configurada, ninguém roda. O chat do site e as
 * rotas de chamado também rodam os prazos de carona (no máximo 1x/min).
 */
function autorizado(request: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (segredo && segredo.length >= 16 && request.headers.get("authorization") === `Bearer ${segredo}`) return true;
  return checkAgentAuth(request);
}

async function rodar(request: NextRequest) {
  if (!autorizado(request)) return Response.json({ ok: false, erro: "Nao autorizado" }, { status: 401 });
  const n = await comSql((sql) => processarPrazos(sql));
  /* O mesmo agendador mantém o vigia do WhatsApp rodando (docs/blindagem-whatsapp.md). */
  const vigia = await comSql((sql) => vigiarWhatsapp(sql, "agendador")).catch((e) => ({ rodou: false, erro: (e as Error).message }));
  return Response.json({ ok: true, dados: { ...n, vigia }, consultado_em: new Date().toISOString() });
}

export const GET = rodar;
export const POST = rodar;
