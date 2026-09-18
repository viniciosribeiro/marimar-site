import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server"; import postgres from "postgres";
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM faq WHERE ativo=true AND visivel_agente=true ORDER BY ordem`;
  const texto=lista.map((f:any)=>`• ${f.pergunta}: ${f.resposta.slice(0,200)}`).join("\n");
  await sql.end();
  return Response.json({ ok:true, dados:lista, resumo_texto:texto, fonte:"local", consultado_em:new Date().toISOString() });
}