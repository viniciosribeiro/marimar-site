import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { lerContatos, lerConfigEscalonamento } from "@/lib/escalonamento";
import { rotuloSetor } from "@/lib/escalonamento-base";

export const dynamic = "force-dynamic";

/**
 * Os números da equipe responsável (Admin → Equipe responsável).
 *
 * A Marina consulta para saber quando quem escreve é da EQUIPE, e não um
 * hóspede: mensagem de alguém daqui vai para /api/agent/chamados/resposta.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const { contatos, ativo } = await comSql(async (sql) => ({
    contatos: (await lerContatos(sql)).filter((c) => c.ativo),
    ativo: (await lerConfigEscalonamento(sql)).ativo,
  }));
  const dados = contatos.map((c) => ({ nome: c.nome, numero: c.numero, setores: c.setores, horario: `${c.hora_inicio}–${c.hora_fim}` }));
  return Response.json({
    ok: true,
    dados: { escalonamento_ativo: ativo, equipe: dados },
    resumo_texto: dados.length
      ? `Equipe (${ativo ? "escalonamento ligado" : "escalonamento DESLIGADO"}):\n` +
        dados.map((c) => `• ${c.nome} — +${c.numero} — ${c.setores.map(rotuloSetor).join(", ")}`).join("\n")
      : "Nenhum contato da equipe cadastrado.",
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
