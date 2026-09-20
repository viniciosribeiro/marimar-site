import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { SOBRE_A_ILHA, ATRACOES, CUIDADOS_AMBIENTAIS, AVISO_DISTANCIAS } from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

/** A Ilha do Mel: como funciona, o que ver, o que respeitar. */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const linhas = [
    `ACESSO: ${SOBRE_A_ILHA.acesso}`,
    `BAGAGEM: ${SOBRE_A_ILHA.bagagem}`,
    "",
    "O QUE VER:",
    ...ATRACOES.map((a) => `• ${a.nome} (${a.distanciaTexto}) — ${a.texto}`),
    "",
    AVISO_DISTANCIAS,
    "",
    "CUIDADOS AMBIENTAIS (a ilha é área de preservação; vale avisar antes da viagem):",
    ...CUIDADOS_AMBIENTAIS.map((c) => `• ${typeof c === "string" ? c : JSON.stringify(c)}`),
  ];

  return Response.json({
    ok: true,
    dados: { ilha: SOBRE_A_ILHA, atracoes: ATRACOES, cuidados: CUIDADOS_AMBIENTAIS },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
