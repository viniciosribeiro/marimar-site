import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { registrarUso } from "@/lib/aprendizado";

export const dynamic = "force-dynamic";

/**
 * A Marina respondeu usando algo da seção APRENDIDO COM A EQUIPE.
 *
 *   POST { "pergunta": "a pergunta do cliente", "canal": "whatsapp" }
 *
 * Conta o uso (o painel mostra o que mais se usa e a taxa de resolução
 * sozinha). Sem dado do cliente: só a pergunta, que nem é guardada — serve
 * para achar o item.
 */
export async function POST(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const corpo = await request.json().catch(() => null);
  const pergunta = typeof corpo?.pergunta === "string" ? corpo.pergunta.trim() : "";
  if (pergunta.length < 4) return Response.json({ ok: false, erro: "Informe a pergunta." }, { status: 400 });
  const item = await comSql((sql) => registrarUso(sql, pergunta, corpo?.canal === "site" ? "site" : "whatsapp"));
  return Response.json({
    ok: true,
    dados: { contado: !!item, item: item ? { pergunta: item.pergunta } : null },
    resumo_texto: item ? "Uso registrado." : "Nenhum item aprendido corresponde a esta pergunta.",
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
