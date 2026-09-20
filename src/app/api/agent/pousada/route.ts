import { checkAgentAuth } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";
import {
  ENDERECO, CONTATO, CAFE_DA_MANHA, COMODIDADES_CONFIRMADAS, NAO_DISPONIVEL,
} from "@/lib/conteudo-pousada";

function checkAuth(request: NextRequest): boolean {
  return checkAgentAuth(request);
}

function agentOk(dados: any, resumo: string) {
  return Response.json({ ok: true, dados, resumo_texto: resumo, fonte: "local", consultado_em: new Date().toISOString() });
}
function agentErr(msg: string, status = 400) {
  return Response.json({ ok: false, erro: msg }, { status });
}

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
  if (!checkAuth(request)) return agentErr("Nao autorizado", 401);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const [p] = await sql`SELECT * FROM pousada LIMIT 1`;
  const politicas = await sql`SELECT * FROM politicas LIMIT 1`;

  let comodidades: { nome: string }[] = [];
  try {
    comodidades = await sql<{ nome: string }[]>`
      SELECT c.nome FROM pousada_comodidades pc
      JOIN comodidades c ON c.id = pc.comodidade_id
      WHERE c.ativo = true ORDER BY c.ordem`;
  } catch { /* tabela ausente neste banco */ }
  await sql.end();

  const pol = politicas?.[0] as Record<string, unknown> | undefined;
  const linhas = [
    `${p?.nome || "Pousada Marimar"} — ${ENDERECO.completo}`,
    `WhatsApp: ${CONTATO.whatsapp}`,
    "",
    "POLITICAS (responda SEMPRE com estes valores, nunca de memoria):",
    `• Check-in: ${pol?.check_in ?? "confirmar com a pousada"}`,
    `• Check-out: ${pol?.check_out ?? "confirmar com a pousada"}`,
    `• Pets: ${pol?.pet ? (pol?.pet_texto || "aceita") : "NAO aceita animais de estimacao"}`,
    `• Cancelamento: ${pol?.cancelamento || "confirmar com a pousada"}`,
    `• Diaria minima padrao: ${pol?.diaria_minima_padrao ?? 1}`,
  ];
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

  return agentOk(
    { pousada: p, politicas: pol || null, comodidades, nao_disponivel: NAO_DISPONIVEL },
    linhas.join("\n"),
  );
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return agentErr("Nao autorizado", 401);
  const { nome, telefone, email, mensagem } = await request.json();
  if (!nome) return agentErr("Nome obrigatorio");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  await sql`INSERT INTO leads (nome, telefone, email, mensagem, origem) VALUES (${nome}, ${telefone || null}, ${email || null}, ${mensagem || null}, 'agente')`;
  await sql.end();
  return agentOk({}, "Lead registrado com sucesso");
}