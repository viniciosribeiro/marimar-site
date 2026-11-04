import { NextRequest } from "next/server";
import { checkAgentAuth } from "@/lib/agent-auth";
import { sincronizarFotosDoMotor } from "@/lib/sincronizar-fotos-desbravador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronização das fotos das suítes com o Desbravador
 * (docs/fluxo-fotos-desbravador.md). A Vercel chama uma vez por dia
 * (vercel.json) com `Authorization: Bearer <CRON_SECRET>`; qualquer outro
 * agendador pode chamar com a CRON_SECRET ou com a AGENT_API_KEY — a mesma
 * regra do /api/cron/chamados. Sem nenhuma das duas na Vercel, recusa.
 */
function autorizado(request: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (segredo && segredo.length >= 16 && request.headers.get("authorization") === `Bearer ${segredo}`) return true;
  return checkAgentAuth(request);
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) return Response.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  try {
    const resumo = await sincronizarFotosDoMotor();
    console.info("[cron/fotos] sincronização concluída", resumo);
    return Response.json({ ok: true, ...resumo }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    console.error("[cron/fotos] não concluiu; nada foi alterado:", (erro as Error).message);
    return Response.json({ ok: false, erro: (erro as Error).message }, { status: 503 });
  }
}
