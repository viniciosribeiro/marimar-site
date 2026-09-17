import { NextRequest } from "next/server"; import postgres from "postgres";
export async function GET(request: NextRequest) {
  const key = request.headers.get("authorization")?.replace("Bearer ", "");
  if (key !== process.env.AGENT_API_KEY) return Response.json({ ok: false, erro: "Nao autorizado" }, { status: 401 });
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM pacotes WHERE ativo=true ORDER BY ordem`;
  const nomes=lista.map((p:any)=>`• ${p.nome} (min ${p.diaria_minima} noites)`).join("\n");
  await sql.end();
  return Response.json({ ok:true, dados:lista, resumo_texto:`${lista.length} pacotes:\n${nomes}`, fonte:"local", consultado_em:new Date().toISOString() });
}