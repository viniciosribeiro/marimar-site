import { pluralizar } from "@/lib/format";
import postgres from "postgres"; import { notFound } from "next/navigation"; import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function PacoteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const [p]=await sql`SELECT * FROM pacotes WHERE slug=${slug} AND ativo=true`;
  if(!p) { await sql.end(); notFound(); } await sql.end();
  return(<div className="max-w-4xl mx-auto px-4 py-12"><Link href="/pacotes" className="text-sm text-teal-600 hover:underline">&larr; Voltar</Link><h1 className="text-3xl font-bold mt-4 mb-2">{p.nome}</h1>{p.descricao&&<p className="text-gray-600 mb-6">{p.descricao}</p>}<div className="bg-gray-50 rounded-xl p-6"><h3 className="font-semibold mb-2">Incluso:</h3>{p.inclusos&&Array.isArray(p.inclusos)&&<ul className="space-y-1">{p.inclusos.map((item:string,i:number)=>(<li key={i} className="flex items-center gap-2 text-sm">✓ {item}</li>))}</ul>}<div className="mt-4 text-sm text-gray-500">Diária mínima: {pluralizar(p.diaria_minima, "noite")}</div></div></div>);
}