import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { AVALIACOES } from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

/**
 * O que hóspedes disseram — sempre com a plataforma.
 *
 * A origem não é enfeite: uma nota sem fonte é indistinguível de uma nota
 * inventada, e a regra do projeto proíbe depoimento sem identificar de onde
 * veio. Por isso o resumo repete a plataforma em cada linha, mesmo ficando
 * repetitivo: é mais fácil a Marina citar certo quando o dado já chega
 * citado.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  let depoimentos: { autor: string; origem: string | null; nota: number; texto: string }[] = [];
  try {
    depoimentos = await sql`
      SELECT autor, origem, nota, texto FROM depoimentos
      WHERE ativo = true ORDER BY ordem, criado_em DESC LIMIT 20`;
  } catch { /* tabela ausente */ }
  await sql.end();

  const linhas: string[] = [
    "REGRA: toda nota ou depoimento que você citar precisa vir com a plataforma de origem.",
    "Nunca escreva um depoimento que não esteja nesta lista.",
    "",
  ];

  if (depoimentos.length) {
    for (const d of depoimentos) {
      linhas.push(`• ${d.nota}/5 — "${d.texto}" — ${d.autor}${d.origem ? ` (${d.origem})` : " (origem não informada: NÃO cite a plataforma)"}`);
    }
  } else {
    linhas.push("Nenhum depoimento cadastrado. Não invente nenhum.");
  }

  return Response.json({
    ok: true,
    dados: { depoimentos, notas_agregadas: AVALIACOES },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
