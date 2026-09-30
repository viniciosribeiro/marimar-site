import { comSql } from "@/lib/db-conexao";
import { talvezProcessarPrazos } from "@/lib/escalonamento";

export const dynamic = "force-dynamic";

/**
 * O chat do site pergunta: chegou resposta da equipe para mim?
 *
 *   GET /api/chat/chamados?sessao=<id>&depois=<ISO>
 *
 * Pública como o próprio chat, e devolve só mensagens DAQUELA sessão (o id
 * é um UUID aleatório que só o navegador do visitante conhece).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const sessao = (u.searchParams.get("sessao") ?? "").slice(0, 64);
  const depois = new Date(u.searchParams.get("depois") ?? 0);
  if (sessao.length < 8) return Response.json({ pendentes: 0, mensagens: [] });
  try {
    return Response.json(await comSql(async (sql) => {
      await talvezProcessarPrazos(sql);
      const [{ n }] = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM marina_chamados WHERE canal = 'site' AND destino = ${sessao} AND status = 'aguardando'`;
      const mensagens = await sql<{ id: string; conteudo: string; criado_em: Date }[]>`
        SELECT id, conteudo, criado_em FROM chat_mensagens
        WHERE sessao = ${sessao} AND chamado_id IS NOT NULL AND criado_em > ${Number.isNaN(depois.getTime()) ? new Date(0) : depois}
        ORDER BY criado_em LIMIT 20`;
      return { pendentes: n, mensagens: mensagens.map((m) => ({ id: m.id, texto: m.conteudo, quando: m.criado_em.toISOString() })) };
    }), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ pendentes: 0, mensagens: [] });
  }
}
