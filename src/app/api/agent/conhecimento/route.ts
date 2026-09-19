import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { lerConfig, lerEnsinamentos, ensinamentosEmTexto } from "@/lib/marina";

export const dynamic = "force-dynamic";

/**
 * O que a administração ensinou à Marina.
 *
 * É a rota que faz o painel da Cecília valer também no WhatsApp: ela
 * escreve um fato novo no admin e a Marina passa a usar na conversa
 * seguinte, sem reinstalar habilidade e sem abrir a Hostinger.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const config = await lerConfig(sql);
  const ensinamentos = await lerEnsinamentos(sql);
  await sql.end();

  const texto = ensinamentosEmTexto(config, ensinamentos);

  return Response.json({
    ok: true,
    dados: { tom: config.tom, ...ensinamentos },
    resumo_texto: texto || "A administracao ainda nao cadastrou ensinamentos.",
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
