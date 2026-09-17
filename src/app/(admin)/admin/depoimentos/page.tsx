import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarDepoimento, editarDepoimento, excluirDepoimento } from "@/lib/admin-actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function DepoimentosPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login"); const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM depoimentos ORDER BY ordem`; await sql.end();
  const ed=sp.editar ? lista.find((d:any)=>d.id===sp.editar) : null;
  const ff=ed?[{name:"id",type:"hidden",defaultValue:ed.id},{name:"autor",label:"Autor",required:true,defaultValue:ed.autor},{name:"origem",label:"Origem",defaultValue:ed.origem??""},{name:"nota",label:"Nota",type:"number",defaultValue:ed.nota},{name:"texto",label:"Texto",required:true,defaultValue:ed.texto},{name:"ordem",label:"Ordem",type:"number",defaultValue:ed.ordem}]:[{name:"autor",label:"Autor",required:true},{name:"origem",label:"Origem"},{name:"nota",label:"Nota",type:"number",defaultValue:5},{name:"texto",label:"Texto",required:true},{name:"ordem",label:"Ordem",type:"number",defaultValue:0}];
  return <CrudPage title="Depoimentos" subtitle="Avaliacoes dos hospedes" lista={lista} columns={["autor","origem","nota","ativo"]} fields={ff} criarAction={criarDepoimento} editarAction={editarDepoimento} excluirAction={excluirDepoimento} editId={sp.editar} erro={sp.erro} ok={sp.ok} basePath="/admin/depoimentos" />;
}