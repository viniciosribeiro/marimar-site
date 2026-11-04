import { NextRequest, after } from "next/server";
import { checkAgentAuth } from "@/lib/agent-auth";
import { comSql } from "@/lib/db-conexao";
import { sincronizarFotosDoMotor, talvezSincronizarFotos, ultimaSincronizacao, ultimoErroSincronizacao } from "@/lib/sincronizar-fotos-desbravador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronização das fotos das suítes com o Desbravador
 * (docs/fluxo-fotos-desbravador.md). A Vercel chama uma vez por dia
 * (vercel.json).
 *
 * Com chave (`CRON_SECRET` da Vercel ou a `AGENT_API_KEY`): roda agora e
 * devolve o resumo completo. Sem chave: faz o MESMO que uma busca em
 * /reservar faz — agenda uma rodada depois da resposta, no máximo uma por
 * hora — e devolve só isso. É por isso que a `CRON_SECRET` deixou de ser
 * obrigatória em 04/11/2026: a Vercel só manda o cabeçalho quando a variável
 * existe, e ela nunca foi criada; sem o cabeçalho, a rodada diária era
 * recusada e ninguém via. Quem chama sem chave não ganha nada que uma busca
 * no site já não provoque, nem lê nada além da hora da última rodada.
 */
function autorizado(request: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (segredo && segredo.length >= 16 && request.headers.get("authorization") === `Bearer ${segredo}`) return true;
  return checkAgentAuth(request);
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    after(() => comSql((sql) => talvezSincronizarFotos(sql)).catch(() => {}));
    /* O resumo da última rodada e o último erro são públicos de propósito:
       só têm nomes de suíte (que já estão no site) e contagens, e são o que
       permite a qualquer pessoa — ou agente sem a chave — ver se a foto nova
       entrou e por que uma rodada não concluiu. Nunca inclua URLs internas. */
    const [ultima, erro] = await comSql(async (sql) => [await ultimaSincronizacao(sql), await ultimoErroSincronizacao(sql)] as const).catch(() => [null, null] as const);
    return Response.json(
      {
        ok: true, modo: "carona", ultima_em: ultima?.em.toISOString() ?? null,
        ultimo_resumo: ultima?.resumo ?? null, ultimo_erro: erro,
        aviso: "Sem chave: a rodada roda em segundo plano, no máximo uma vez por hora. Com CRON_SECRET ou AGENT_API_KEY a resposta traz o resumo na hora.",
      },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const resumo = await sincronizarFotosDoMotor();
    console.info("[cron/fotos] sincronização concluída", resumo);
    return Response.json({ ok: true, modo: "imediato", ...resumo }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    console.error("[cron/fotos] não concluiu; nada foi alterado:", (erro as Error).message);
    return Response.json({ ok: false, erro: (erro as Error).message }, { status: 503 });
  }
}
