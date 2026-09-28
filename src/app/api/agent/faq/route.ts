import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";

export const dynamic = "force-dynamic";

type Faq = { id: string; pergunta: string; resposta: string; ordem: number };

/**
 * Perguntas que a pousada respondeu no painel.
 *
 * A resposta vai INTEIRA. Ate 28/09/2026 o resumo cortava em 200
 * caracteres, e a Marina lia metade de uma politica e completava de cabeca
 * — justamente onde a pousada tinha escrito para ela nao improvisar.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const lista = await comSql((sql) => sql<Faq[]>`
    SELECT id, pergunta, resposta, ordem FROM faq
    WHERE ativo = true AND visivel_agente = true ORDER BY ordem`);
  const texto = lista.length
    ? "RESPOSTAS OFICIAIS DA POUSADA (use exatamente o que está escrito):\n" +
      lista.map((f) => `• ${f.pergunta}\n  ${f.resposta.trim()}`).join("\n")
    : "A pousada ainda não cadastrou perguntas frequentes.";
  return Response.json({ ok: true, dados: lista, resumo_texto: texto, fonte: "local", consultado_em: new Date().toISOString() });
}
