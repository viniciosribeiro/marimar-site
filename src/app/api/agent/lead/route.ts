import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server"; import postgres from "postgres";
export async function POST(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const { nome, telefone, email, mensagem } = await request.json();
  if (!nome) return Response.json({ ok: false, erro: "Nome obrigatorio" }, { status: 400 });
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false });
  await sql`INSERT INTO leads (nome, telefone, email, mensagem, origem) VALUES (${nome}, ${telefone||null}, ${email||null}, ${mensagem||null}, 'agente')`;
  await sql.end();
  return Response.json({ ok: true, dados: {}, resumo_texto: "Lead registrado" });
}