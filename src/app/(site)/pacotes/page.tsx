import { resumir } from "@/lib/format";
import postgres from "postgres"; import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function PacotesPage() {
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM pacotes WHERE ativo=true ORDER BY ordem`; await sql.end();
  return(<div className="max-w-7xl mx-auto px-4 py-12"><h1 className="text-3xl font-bold mb-2">Pacotes</h1><p className="text-gray-500 mb-8">Ofertas especiais para sua estadia</p><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{lista.map((p:any)=>(<Link key={p.id} href={`/pacotes/${p.slug}`} className="bg-white rounded-xl shadow hover:shadow-lg overflow-hidden group"><div className="h-40 bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center"><span className="text-4xl">🎁</span></div><div className="p-4"><h3 className="font-semibold text-lg group-hover:text-teal-600">{p.nome}</h3><p className="text-sm text-gray-500 mt-1">{resumir(p.descricao, 110)}</p></div></Link>))}</div></div>);
}