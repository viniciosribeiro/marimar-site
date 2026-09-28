import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { lerConteudo } from "@/lib/conteudo-editavel";
import { comSql } from "@/lib/db-conexao";
import { lerContato } from "@/lib/pousada";

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
  const { EVENTOS } = await comSql(lerConteudo);
  const contato = await lerContato();

  const linhas = [
    `A pousada recebe: ${EVENTOS.tipos.join(", ")}.`,
    `Espaços: ${EVENTOS.espacos.join(", ")}.`,
    ...(EVENTOS.capacidade ? [`Capacidade: ${EVENTOS.capacidade}.`] : []),
    "",
    ...(EVENTOS.avisoPendente?.trim() ? [`⚠ ${EVENTOS.avisoPendente}`] : []),
    // Capacidade só pode ser dita quando a pousada a cadastrou no painel.
    EVENTOS.capacidade
      ? "NÃO informe valor nem pacote de evento — nem aproximado."
      : "NÃO informe capacidade, valor ou pacote de evento — nem aproximado.",
    `Encaminhe: ${contato.whatsapp}.`,
  ];

  return Response.json({
    ok: true,
    dados: { eventos: EVENTOS, contato },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
