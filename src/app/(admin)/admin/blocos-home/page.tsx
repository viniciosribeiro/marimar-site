import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { alternarBloco, salvarBloco } from "@/lib/admin-actions"; import { CrudForm } from "@/components/admin/CrudForm"; import { SubmitButton } from "@/components/admin/SubmitButton"; import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function BlocosHomePage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login"); const sp=await searchParams; const ei=sp.editar;
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM blocos_home ORDER BY ordem`;
  const ed=ei?lista.find((b:any)=>b.id===ei):null; await sql.end();
  return(<div className="p-6"><h1 className="text-2xl font-bold mb-2">Blocos da Home</h1>
    {ed && <CrudForm action={salvarBloco} fields={[{name:"id",type:"hidden",defaultValue:ed.id},{name:"titulo",label:"Titulo",defaultValue:ed.titulo??""},{name:"subtitulo",label:"Subtitulo",defaultValue:ed.subtitulo??""},{name:"imagem_url",label:"Imagem URL",defaultValue:ed.imagem_url??""}]} submitLabel="Salvar" error={sp.erro} ok={sp.ok} extra={<Link href="/admin/blocos-home" className="text-sm text-gray-500 py-2">Cancelar</Link>} />}
    <div className="bg-white rounded-lg shadow overflow-hidden mt-6"><table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr><th className="text-left p-3">Tipo</th><th className="text-left p-3">Titulo</th><th className="text-left p-3">Ordem</th><th className="text-left p-3">Ativo</th><th className="text-right p-3">Acoes</th></tr></thead><tbody>
    {lista.map((b:any)=>(<tr key={b.id} className="border-b hover:bg-gray-50"><td className="p-3">{b.tipo}</td><td className="p-3">{b.titulo||"—"}</td><td className="p-3">{b.ordem}</td><td className="p-3">{b.ativo?"✅":"—"}</td><td className="p-3 text-right space-x-2"><form action={alternarBloco} className="inline"><input type="hidden" name="id" value={b.id}/><SubmitButton className="text-amber-600 hover:underline text-xs bg-transparent p-0">{b.ativo?"Desativar":"Ativar"}</SubmitButton></form><Link href={`/amin/blocos-home?editar=${b.id}`} className="text-teal-600 hover:underline text-xs">Editar</Link></td></tr>))}
    </tbody></table></div></div>);
}