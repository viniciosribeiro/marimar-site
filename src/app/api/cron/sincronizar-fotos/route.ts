import { NextRequest } from "next/server";
import { checkAgentAuth } from "@/lib/agent-auth";
import { comSql } from "@/lib/db-conexao";
import { INTERVALO_CARONA_MS, sincronizarFotosDoMotor, ultimaSincronizacao, ultimoErroSincronizacao } from "@/lib/sincronizar-fotos-desbravador";
import { garantirAudioSoFraseCurta } from "@/lib/openclaw-audio";

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
  /* De carona na mesma rodada: o áudio do WhatsApp só da frase curta
     (src/lib/openclaw-audio.ts). Uma conferência curta; depois de aplicado,
     o registro no banco responde sem falar com o gateway. */
  const audio_whatsapp = await garantirAudioSoFraseCurta().catch((e) => ({ modo: null, desejado: "tagged", conferido_em: new Date().toISOString(), aplicado_em: null, erro: (e as Error).message }));
  if (!autorizado(request)) {
    /* Sem chave: a rodada só acontece se a última tem mais de 1 h (a mesma
       regra da carona nas buscas) — e acontece AQUI, antes de responder, e
       não em segundo plano: em 04/11 as rodadas em `after()` morriam sem
       rastro na Vercel. Quem chama fora da hora recebe só o resumo anterior.
       Uma rodada por hora no máximo, com trava no banco contra concorrência. */
    const devida = await comSql(async (sql) => {
      const ultima = await ultimaSincronizacao(sql);
      return !ultima || Date.now() - ultima.em.getTime() >= INTERVALO_CARONA_MS;
    }).catch(() => false);
    if (devida) {
      try {
        const resumo = await sincronizarFotosDoMotor();
        console.info("[cron/fotos] rodada sem chave concluída", { novas: resumo.fotos_novas, removidas: resumo.fotos_removidas });
        return Response.json({ ok: true, modo: "carona-agora", audio_whatsapp, ...resumo }, { headers: { "cache-control": "no-store" } });
      } catch (erro) {
        console.error("[cron/fotos] rodada sem chave não concluiu:", (erro as Error).message);
        return Response.json({ ok: false, modo: "carona-agora", audio_whatsapp, erro: (erro as Error).message }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    }
    /* O resumo da última rodada e o último erro são públicos de propósito:
       só têm nomes de suíte (que já estão no site) e contagens, e são o que
       permite a qualquer pessoa — ou agente sem a chave — ver se a foto nova
       entrou e por que uma rodada não concluiu. Nunca inclua URLs internas. */
    const [ultima, erro] = await comSql(async (sql) => [await ultimaSincronizacao(sql), await ultimoErroSincronizacao(sql)] as const).catch(() => [null, null] as const);
    return Response.json(
      {
        ok: true, modo: "carona", ultima_em: ultima?.em.toISOString() ?? null,
        ultimo_resumo: ultima?.resumo ?? null, ultimo_erro: erro, audio_whatsapp,
        aviso: "Sem chave: a rodada só roda se a última tem mais de 1 hora. Com CRON_SECRET ou AGENT_API_KEY roda sempre.",
      },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    /* `?forcar=1` (só com chave): a lista atual do motor vale, mesmo que o
       histórico a considere antiga — o mesmo que o botão do painel faz. */
    const forcar = request.nextUrl.searchParams.get("forcar") === "1";
    const resumo = await sincronizarFotosDoMotor({ forcar });
    console.info("[cron/fotos] sincronização concluída", resumo);
    return Response.json({ ok: true, modo: "imediato", audio_whatsapp, ...resumo }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    console.error("[cron/fotos] não concluiu; nada foi alterado:", (erro as Error).message);
    return Response.json({ ok: false, erro: (erro as Error).message }, { status: 503 });
  }
}
