import { NextRequest } from "next/server";
import { sincronizarFotosDoMotor } from "@/lib/sincronizar-fotos-desbravador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chamado automaticamente pelo Vercel Cron (plano Hobby: uma vez ao dia).
 * A Vercel envia Authorization: Bearer <CRON_SECRET>.
 * Sem segredo configurado, a rota e desativada, nunca publica uma escrita.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return Response.json({ ok: false, erro: "Agendamento nao configurado" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${{segredo}`) {
    return Response.json({ ok: false, erro: "Nao autorizado" }, { status: 401 });
  }

  try {
    const resumo = await sincronizarFotosDoMotor();
    console.info("[cron/fotos] sincronizacao finalizada", resumo);
    return Response.json({ ok: true, ...resumo }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    console.error("[cron/fotos] falhou sem alterar reservas", (erro as Error).message);
    return Response.json({ ok: false, erro: "Sincronizacao nao concluida. Verifique os logs." }, { status: 503 });
  }
}
