import { NextRequest } from "next/server";
import { sincronizarFotosDoMotor } from "@/lib/sincronizar-fotos-desbravador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * A Vercel chama automaticamente o endpoint com Authorization Bearer.
 * Nunca sincroniza se CRON_SECRET nao estiver configurado.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return Response.json({ ok: false, erro: "Agendamento nao configurado" }, { status: 503 });
  if (request.headers.get("authorization") !== "Bearer " + segredo) {
    return Response.json({ ok: false, erro: "Nao autorizado" }, { status: 401 });
  }

  try {
    const resumo = await sincronizarFotosDoMotor();
    console.info("[cron/fotos] sincronizacao finalizada", resumo);
    return Response.json({ ok: true, ...resumo }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    console.error("[cron/fotos] falhou; as reservas permanecem intactas", (erro as Error).message);
    return Response.json({ ok: false, erro: "Sincronizacao nao concluida. Consulte logs." }, { status: 503 });
  }
}
