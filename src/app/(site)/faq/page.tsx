import postgres from "postgres";
export const dynamic = "force-dynamic";
export default async function FaqPage() {
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM faq WHERE ativo=true ORDER BY ordem`; await sql.end();
  return(<div className="max-w-3xl mx-auto px-4 py-12"><h1 className="text-3xl font-bold mb-8">Perguntas Frequentes</h1><div className="space-y-4">{lista.map((f:any)=>(<details key={f.id} className="bg-white rounded-lg shadow p-4"><summary className="font-medium cursor-pointer">{f.pergunta}</summary><p className="mt-2 text-sm text-gray-600">{f.resposta}</p></details>))}</div></div>);
}