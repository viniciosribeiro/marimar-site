import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { EVENTOS, CONTATO } from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

/**
 * Casamentos, festas e eventos.
 *
 * Capacidade, valores e pacotes são montados sob consulta — e é exatamente
 * por isso que esta rota existe. Sem ela a Marina responderia de cabeça a
 * uma pergunta cujo erro custa um casamento remarcado.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const linhas = [
    `A pousada recebe: ${EVENTOS.tipos.join(", ")}.`,
    `Espaços: ${EVENTOS.espacos.join(", ")}.`,
    "",
    `⚠ ${EVENTOS.avisoPendente}`,
    "NÃO informe capacidade, valor ou pacote de evento — nem aproximado.",
    `Encaminhe: ${CONTATO.whatsapp}.`,
  ];

  return Response.json({
    ok: true,
    dados: { eventos: EVENTOS, contato: CONTATO },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
