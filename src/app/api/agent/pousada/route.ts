import { NextRequest } from "next/server";
import postgres from "postgres";

function checkAuth(request: NextRequest): boolean {
  const key = request.headers.get("authorization")?.replace("Bearer ", "");
  return key === process.env.AGENT_API_KEY;
}

function agentOk(dados: any, resumo: string) {
  return Response.json({ ok: true, dados, resumo_texto: resumo, fonte: "local", consultado_em: new Date().toISOString() });
}
function agentErr(msg: string, status = 400) {
  return Response.json({ ok: false, erro: msg }, { status });
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return agentErr("Nao autorizado", 401);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [p] = await sql`SELECT * FROM pousada LIMIT 1`;
  const politicas = await sql`SELECT * FROM politicas LIMIT 1`;
  await sql.end();
  return agentOk({ pousada: p, politicas: politicas?.[0] || null }, `Pousada ${p?.nome || "Marimar"} — ${p?.cidade || "Ilha do Mel"}`);
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return agentErr("Nao autorizado", 401);
  const { nome, telefone, email, mensagem } = await request.json();
  if (!nome) return agentErr("Nome obrigatorio");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`INSERT INTO leads (nome, telefone, email, mensagem, origem) VALUES (${nome}, ${telefone || null}, ${email || null}, ${mensagem || null}, 'agente')`;
  await sql.end();
  return agentOk({}, "Lead registrado com sucesso");
}