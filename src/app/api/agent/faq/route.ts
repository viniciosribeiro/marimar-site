import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";

export const dynamic = "force-dynamic";

type Faq = { id: string; pergunta: string; resposta: string; ordem: number };

export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const lista = await comSql((sql) => sql<Faq[]>`
    SELECT * FROM faq WHERE ativo = true AND visivel_agente = true ORDER BY ordem`);
  const texto = lista.map((f) => `• ${f.pergunta}: ${f.resposta.slice(0, 200)}`).join("\n");
  return Response.json({ ok: true, dados: lista, resumo_texto: texto, fonte: "local", consultado_em: new Date().toISOString() });
}
