import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { salvarPoliticas } from "@/lib/admin-actions"; import { CrudForm } from "@/components/admin/CrudForm";

export const dynamic = "force-dynamic";
export default async function PoliticasPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login"); const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false }); const lista=await sql`SELECT * FROM politicas LIMIT 1`;
  const p=lista[0]; await sql.end();
  return(<div className="p-5 sm:p-8"><h1 className="text-2xl font-bold mb-2">Politicas</h1>
    <CrudForm action={salvarPoliticas} fields={[{name:"id",type:"hidden",defaultValue:p?.id},{name:"diaria_minima",label:"Diaria Minima Padrao",type:"number",defaultValue:p?.diaria_minima_padrao??1},{name:"check_in",label:"Check-in",defaultValue:p?.check_in??"14:00"},{name:"check_out",label:"Check-out",defaultValue:p?.check_out??"12:00"},{name:"cancelamento",label:"Cancelamento",defaultValue:p?.cancelamento??""},{name:"pet",label:"Aceita Pets?",type:"checkbox",defaultValue:p?.pet?1:0},{name:"pet_texto",label:"Regras Pets",defaultValue:p?.pet_texto??""},{name:"regras_gerais",label:"Regras Gerais",defaultValue:p?.regras_gerais??""}]} submitLabel="Salvar" error={sp.erro} ok={sp.ok} />
    <div className="bg-white rounded-lg shadow p-4 mt-6"><h2 className="font-semibold text-sm mb-2">Valores atuais</h2><pre className="text-xs text-gray-500">{JSON.stringify({diaria_minima:p?.diaria_minima_padrao,check_in:p?.check_in,check_out:p?.check_out,pet:p?.pet,cancelamento:p?.cancelamento?.slice(0,100)},null,2)}</pre></div>
  </div>);
}