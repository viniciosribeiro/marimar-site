import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";

export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const lista = await sql`
    SELECT q.*, c.nome as cat_nome
    FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id
    WHERE q.ativo = true ORDER BY q.ordem
  `;
  const nomes = lista.map((q: any) => `• ${q.nome} (ate ${q.ocupacao_max} pessoas)`).join("\n");
  await sql.end();
  return Response.json({ ok: true, dados: lista, resumo_texto: `Catalogo com ${lista.length} quartos:\n${nomes}`, fonte: "local", consultado_em: new Date().toISOString() });
}