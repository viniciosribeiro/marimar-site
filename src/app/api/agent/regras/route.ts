import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { lerRegras, lerAdicionais, calcularOcupacao, textoCriancas, precoAdicional } from "@/lib/regras-hospedagem";

export const dynamic = "force-dynamic";

/**
 * A regra de crianças e os adicionais, com a conta já feita.
 *
 * Existe para a skill `consulta-desbravador`, que consulta o motor direto
 * (sem passar pelo site). Antes de consultar, ela pergunta aqui: "com 2
 * adultos, 2 crianças e 1 bebê, o que mando ao motor?". A resposta sai da
 * MESMA função que a busca do site usa (`calcularOcupacao`) — então o preço
 * do WhatsApp e o do site não podem divergir.
 *
 *   GET /api/agent/regras?adultos=2&criancas=2&bebes=1&noites=2
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const q = request.nextUrl.searchParams;
  const n = (k: string, padrao: number, max: number) => {
    const v = parseInt(q.get(k) ?? "", 10);
    return Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : padrao;
  };
  const { regras, adicionais } = await comSql(async (sql) => ({
    regras: await lerRegras(sql),
    adicionais: (await lerAdicionais(sql)).filter((a) => a.visivelMarina),
  }));
  const ocupacao = calcularOcupacao(
    { adultos: Math.max(1, n("adultos", 2, 20)), criancas: n("criancas", 0, 20), bebes: n("bebes", 0, 10), noites: Math.max(1, n("noites", 1, 60)) },
    regras,
  );
  const texto = textoCriancas(regras);

  return Response.json({
    ok: true,
    dados: { regras, ocupacao, adicionais },
    resumo_texto: [
      texto ?? "A pousada ainda não configurou a regra de crianças: o valor de criança vem do sistema de reservas.",
      ocupacao.explicacao ?? "",
      adicionais.length ? "Adicionais: " + adicionais.map((a) => `${a.nome} (${precoAdicional(a)})`).join("; ") : "",
    ].filter(Boolean).join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
