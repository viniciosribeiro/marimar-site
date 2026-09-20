import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { ATRACOES, AVISO_DISTANCIAS } from "@/lib/conteudo-pousada";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Passeios oferecidos e atrações da ilha — o "o que fazer por aí". */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  let passeios: { nome: string; descricao: string | null; duracao: string | null; preco_referencia: number | null }[] = [];
  try {
    passeios = await sql`
      SELECT nome, descricao, duracao, preco_referencia
      FROM passeios WHERE ativo = true ORDER BY ordem`;
  } catch { /* tabela ausente */ }
  await sql.end();

  const linhas: string[] = [];

  if (passeios.length) {
    linhas.push("PASSEIOS OFERECIDOS:");
    for (const p of passeios) {
      linhas.push(
        `• ${p.nome}${p.duracao ? ` — ${p.duracao}` : ""}` +
        `${p.preco_referencia ? ` — a partir de ${brl(p.preco_referencia)}` : ""}` +
        `${p.descricao ? `\n  ${p.descricao}` : ""}`,
      );
    }
    linhas.push("", "Valor de passeio é REFERÊNCIA: confirme com a pousada antes de prometer preço.");
  } else {
    linhas.push("Nenhum passeio cadastrado no sistema. Não invente: ofereça falar com a pousada.");
  }

  linhas.push("", "ATRAÇÕES DA ILHA:");
  for (const a of ATRACOES) {
    linhas.push(`• ${a.nome} (${a.distanciaTexto}) — ${a.resumo}`);
  }
  linhas.push("", AVISO_DISTANCIAS);

  return Response.json({
    ok: true,
    dados: { passeios, atracoes: ATRACOES },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
