import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { marcarLido } from "@/lib/admin-actions"; import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";
export default async function LeadsPage() {
  const s=await auth(); if(!s?.user) redirect("/admin/login");
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM leads ORDER BY criado_em DESC`; await sql.end();
  return(<div className="p-6"><h1 className="text-2xl font-bold mb-2">Leads</h1><p className="text-sm text-gray-500 mb-4">{lista.length} contatos</p>
    <div className="bg-white rounded-lg shadow overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr><th className="text-left p-3">Nome</th><th className="text-left p-3">Telefone</th><th className="text-left p-3">Email</th><th className="text-left p-3">Origem</th><th className="text-left p-3">Lido</th><th className="text-left p-3">Data</th><th className="text-right p-3">Acoes</th></tr></thead><tbody>
    {lista.map((l:any)=>(<tr key={l.id} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{l.nome}</td><td className="p-3">{l.telefone||"—"}</td><td className="p-3 text-xs">{l.email||"—"}</td><td className="p-3">{l.origem}</td><td className="p-3">{l.lido?"✅":"🔵"}</td><td className="p-3 text-xs text-gray-400">{l.criado_em?new Date(l.criado_em).toLocaleDateString("pt-BR"):"—"}</td><td className="p-3 text-right"><form action={marcarLido} className="inline"><input type="hidden" name="id" value={l.id}/><SubmitButton className="text-xs text-blue-600 hover:underline bg-transparent p-0">{l.lido?"Marcar nao lido":"Marcar lido"}</SubmitButton></form></td></tr>))}
    </tbody></table></div></div>);
}