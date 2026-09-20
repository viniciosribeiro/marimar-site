import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { TRAVESSIA, CHEGADA_ETAPAS, ENDERECO, SOBRE_A_ILHA } from "@/lib/conteudo-pousada";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Como chegar na pousada.
 *
 * Provavelmente a pergunta mais feita de todas, e a Marina não tinha nada:
 * esse conteúdo vivia só na página do site. Sem ele ela improvisava ou
 * mandava o hóspede perguntar na recepção — para a pergunta que decide se
 * a viagem acontece.
 *
 * Dois detalhes aqui evitam prejuízo de verdade para o hóspede: o destino
 * Encantadas (quem embarca para Nova Brasília desembarca longe da pousada)
 * e o preço da travessia, que é de terceiros e muda — vai sempre com a data
 * da consulta e o site oficial.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const linhas = [
    `ENDEREÇO: ${ENDERECO.completo ?? [ENDERECO.logradouro, ENDERECO.bairro, ENDERECO.cidade].filter(Boolean).join(", ")}`,
    "",
    "O CAMINHO, EM TRÊS ETAPAS:",
    ...CHEGADA_ETAPAS.map((e) => `${e.n}. ${e.titulo} — ${e.texto}`),
    "",
    `TRAVESSIA: ${TRAVESSIA.operadora}, ${TRAVESSIA.duracao}. Site oficial: ${TRAVESSIA.site}`,
    `⚠ ${TRAVESSIA.avisoDestino}`,
    `Terminais: ${TRAVESSIA.terminais.map((t) => `${t.nome} (${t.endereco})`).join(" | ")}`,
    "",
    `PREÇOS DA TRAVESSIA (de terceiros, consultados em ${TRAVESSIA.precos.consultadoEm} — ` +
      `SEMPRE diga a data e mande o site oficial, porque mudam):`,
    `ida ${brl(TRAVESSIA.precos.ida)} · volta ${brl(TRAVESSIA.precos.volta)} · ` +
      `ida e volta ${brl(TRAVESSIA.precos.idaEVolta)} · gratuidade: ${TRAVESSIA.precos.gratuidade}`,
    "",
    `ESTACIONAMENTO: ${TRAVESSIA.estacionamento}`,
    "",
    `NA ILHA: ${SOBRE_A_ILHA.acesso}`,
    `BAGAGEM: ${SOBRE_A_ILHA.bagagem}`,
  ];

  return Response.json({
    ok: true,
    dados: { endereco: ENDERECO, travessia: TRAVESSIA, etapas: CHEGADA_ETAPAS, ilha: SOBRE_A_ILHA },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
