import { NextRequest } from "next/server"; import postgres from "postgres";
export async function POST(request: NextRequest) {
  const key = request.headers.get("authorization")?.replace("Bearer ", "");
  if (key !== process.env.AGENT_API_KEY) return Response.json({ ok: false, erro: "Nao autorizado" }, { status: 401 });
  const { nome, telefone, email, mensagem } = await request.json();
  if (!nome) return Response.json({ ok: false, erro: "Nome obrigatorio" }, { status: 400 });
  const sql=postgres(process.env.DATABASE_URL!,{max:1});
  await sql`INSERT INTO leads (nome, telefone, email, mensagem, origem) VALUES (${nome}, ${telefone||null}, ${email||null}, ${mensagem||null}, 'agente')`;
  await sql.end();
  return Response.json({ ok: true, dados: {}, resumo_texto: "Lead registrado" });
}