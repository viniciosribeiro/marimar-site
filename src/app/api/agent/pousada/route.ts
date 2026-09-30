import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { receberLead } from "@/lib/leads";
import { lerContato } from "@/lib/pousada";
import { lerRegras, textoCriancas } from "@/lib/regras-hospedagem";
import {
  ENDERECO, CAFE_DA_MANHA, COMODIDADES_CONFIRMADAS, NAO_DISPONIVEL,
} from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

/**
 * A pousada: contato, politicas e o que existe (ou nao) na propriedade.
 *
 * O `resumo_texto` desta rota costumava ser so o nome e a cidade. A skill
 * manda a Marina ler o resumo primeiro — entao check-in, pets e
 * cancelamento estavam no `dados` e nenhum resumo apontava para la. Era o
 * caminho mais curto para ela responder de cabeca justamente as perguntas
 * onde errar vira problema na recepcao.
 *
 * O bloco do que NAO existe e tao importante quanto o do que existe: sem
 * ele, "tem estacionamento?" e respondida por deducao.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const { p, politicas, comodidades, regras } = await comSql(async (sql) => {
    const [p] = await sql`SELECT * FROM pousada LIMIT 1`;
    const politicas = await sql`SELECT * FROM politicas LIMIT 1`;

    let comodidades: { nome: string }[] = [];
    try {
      comodidades = await sql<{ nome: string }[]>`
        SELECT c.nome FROM pousada_comodidades pc
        JOIN comodidades c ON c.id = pc.comodidade_id
        WHERE c.ativo = true ORDER BY c.ordem`;
    } catch { /* tabela ausente neste banco */ }
    return { p, politicas, comodidades, regras: await lerRegras(sql) };
  });

  const pol = politicas?.[0] as Record<string, unknown> | undefined;
  // Contato salvo em Admin → Dados da pousada. Antes era fixo no código e
  // o que a administração mudasse no painel nunca chegava aqui.
  const contato = await lerContato(p ?? null);
  const pagamento = Array.isArray(pol?.formas_pagamento) ? (pol.formas_pagamento as string[]) : [];
  const linhas = [
    `${p?.nome || "Pousada Marimar"} — ${p?.endereco || ENDERECO.completo}`,
    `WhatsApp: ${contato.whatsapp}`,
    ...(contato.email ? [`E-mail: ${contato.email}`] : []),
    ...(contato.horarioRecepcao ? [`Recepção: ${contato.horarioRecepcao}`] : []),
    "",
    "POLITICAS (responda SEMPRE com estes valores, nunca de memoria):",
    `• Check-in: ${pol?.check_in ?? "confirmar com a pousada"}`,
    `• Check-out: ${pol?.check_out ?? "confirmar com a pousada"}`,
    `• Pets: ${pol?.pet ? (pol?.pet_texto || "aceita") : "NAO aceita animais de estimacao"}`,
    `• Cancelamento: ${pol?.cancelamento || "confirmar com a pousada"}`,
    `• Diaria minima padrao: ${pol?.diaria_minima_padrao ?? 1}`,
  ];
  /* A regra configurada (Marina → Regras e adicionais) vence o texto livre:
     é a mesma que o site usa para calcular o preço. */
  linhas.push(`• Crianças: ${textoCriancas(regras) || pol?.criancas_texto || "regras de idade e cobrança dependem da tarifa — consulte a disponibilidade ou confirme com a pousada"}`);
  linhas.push(`• Pagamento: ${pagamento.length ? pagamento.join(", ") : "confirmar com a pousada"}`);
  if (pol?.regras_gerais) linhas.push(`• Regras gerais: ${pol.regras_gerais}`);

  linhas.push(
    "",
    `CAFE DA MANHA: ${CAFE_DA_MANHA.incluso ? "incluso" : "nao incluso"}, ${CAFE_DA_MANHA.horario}, ${CAFE_DA_MANHA.estilo}.`,
    "",
    "A POUSADA TEM: " +
      (comodidades.length
        ? comodidades.map((c) => c.nome).join(", ")
        : COMODIDADES_CONFIRMADAS.join(", ")),
    "",
    "A POUSADA NAO TEM (diga isso com clareza, nao deduza):",
    ...NAO_DISPONIVEL.map((n) => `• ${n.item} — ${n.motivo}`),
  );

  return Response.json({
    ok: true,
    dados: { pousada: p, contato, politicas: pol || null, comodidades, nao_disponivel: NAO_DISPONIVEL },
    resumo_texto: linhas.join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}

/** Registro de lead — duplicava /api/agent/lead; agora e a mesma funcao. */
export async function POST(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  return receberLead(request);
}