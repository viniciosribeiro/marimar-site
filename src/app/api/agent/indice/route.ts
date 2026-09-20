import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { AREAS } from "@/lib/agent-mapa";

export const dynamic = "force-dynamic";

/**
 * O mapa das suas fontes.
 *
 * Existe porque um agente que não sabe o que pode consultar não fica
 * calado: ele improvisa, ou manda o hóspede procurar em outro lugar. Foi
 * exatamente o que aconteceu quando faltava a foto na rota de quartos e a
 * Marina apontou para o site antigo.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const linhas = [
    "SUAS FONTES. Antes de responder, consulte a que cobre a pergunta.",
    "Se nenhuma cobrir, diga que vai confirmar com a pousada — não improvise.",
    "",
    ...AREAS.map((a) => `${a.rota}\n  ${a.titulo} — ${a.responde.join(" · ")}`),
  ];

  return Response.json({
    ok: true,
    // A funcao de contagem nao sai daqui: e util para o painel, nao para
    // quem consome a rota, e funcao nao sobrevive a um JSON.
    dados: { areas: AREAS.map((a) => ({
      chave: a.chave, titulo: a.titulo, rota: a.rota,
      responde: a.responde, origem: a.origem,
    })) },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
