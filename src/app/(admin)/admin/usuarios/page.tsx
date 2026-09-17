import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres";
export const dynamic = "force-dynamic";
export default async function UsuariosPage() {
  const s=await auth(); if(!s?.user) redirect("/admin/login");
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT id, email, nome, papel, must_reset, ultimo_login, criado_em FROM usuarios ORDER BY criado_em DESC`; await sql.end();
  return(<div className="p-6"><h1 className="text-2xl font-bold mb-2">Usuarios</h1><p className="text-sm text-gray-500 mb-4">{lista.length} usuarios cadastrados</p>
    <div className="bg-white rounded-lg shadow overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr><th className="text-left p-3">Nome</th><th className="text-left p-3">Email</th><th className="text-left p-3">Papel</th><th className="text-left p-3">Reset</th><th className="text-left p-3">Ultimo Login</th></tr></thead><tbody>{lista.map((u:any)=>(<tr key={u.id} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{u.nome}</td><td className="p-3 text-gray-500">{u.email}</td><td className="p-3">{u.papel}</td><td className="p-3">{u.must_reset?"⚠️ Sim":"✅"}</td><td className="p-3 text-xs text-gray-400">{u.ultimo_login?new Date(u.ultimo_login).toLocaleString("pt-BR"):"—"}</td></tr>))}</tbody></table></div>
  </div>);
}