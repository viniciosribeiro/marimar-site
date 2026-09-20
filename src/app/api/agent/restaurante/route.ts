import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { RESTAURANTE, CAFE_DA_MANHA } from "@/lib/conteudo-pousada";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * O restaurante e o cardápio.
 *
 * "O que tem para comer?" é das perguntas mais frequentes de quem está
 * decidindo uma hospedagem, e até agora a Marina não tinha como responder:
 * o cardápio digital existe no admin desde sempre e nenhuma rota o servia.
 *
 * O que fica de fora, de propósito: horários completos e atendimento ao
 * público externo ainda não foram confirmados pela pousada. Em vez de
 * omitir, mandamos o aviso — é a diferença entre a Marina dizer "confirmo
 * com a recepção" e inventar um horário.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  let categorias: Record<string, unknown>[] = [];
  try {
    categorias = await sql`
      SELECT c.id, c.nome, c.descricao, c.horario,
        COALESCE(json_agg(
          json_build_object(
            'nome', i.nome, 'descricao', i.descricao,
            'preco', i.preco, 'preco_promocional', i.preco_promocional,
            'porcao', i.porcao, 'marcadores', i.marcadores,
            'disponivel', i.disponivel, 'destaque', i.destaque
          ) ORDER BY i.ordem
        ) FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
      FROM cardapio_categorias c
      LEFT JOIN cardapio_itens i ON i.categoria_id = c.id AND i.ativo = true
      WHERE c.ativo = true
      GROUP BY c.id ORDER BY c.ordem`;
  } catch { /* cardapio ainda nao migrado neste banco */ }
  await sql.end();

  const linhas: string[] = [
    `${RESTAURANTE.nome} — ${RESTAURANTE.posicao}`,
    `Cozinha: ${RESTAURANTE.cardapioResumo}`,
    "",
    `CAFÉ DA MANHÃ: ${CAFE_DA_MANHA.incluso ? "incluso na diária" : "não incluso"}, ` +
      `${CAFE_DA_MANHA.horario}, ${CAFE_DA_MANHA.estilo}. ` +
      `Tem: ${CAFE_DA_MANHA.itens.join(", ")}.`,
  ];

  if (categorias.length) {
    linhas.push("", "CARDÁPIO:");
    for (const c of categorias) {
      const itens = (c.itens as Record<string, unknown>[]) ?? [];
      linhas.push(`\n${c.nome}${c.horario ? ` (${c.horario})` : ""}`);
      for (const i of itens) {
        const preco = i.preco_promocional ?? i.preco;
        const marcas = Array.isArray(i.marcadores) && i.marcadores.length
          ? ` [${(i.marcadores as string[]).join(", ")}]` : "";
        const fora = i.disponivel === false ? " — ESGOTADO HOJE" : "";
        linhas.push(
          `• ${i.nome}${preco ? ` — ${brl(Number(preco))}` : ""}` +
          `${i.porcao ? ` (${i.porcao})` : ""}${marcas}${fora}`,
        );
      }
    }
  } else {
    linhas.push("", "O cardápio ainda não foi cadastrado no sistema. Não invente pratos nem preços: ofereça falar com a pousada.");
  }

  linhas.push("", `ATENÇÃO: ${RESTAURANTE.avisoPendente}`);

  return Response.json({
    ok: true,
    dados: { restaurante: RESTAURANTE, cafe_da_manha: CAFE_DA_MANHA, cardapio: categorias },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
