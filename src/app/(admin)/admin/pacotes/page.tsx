import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarPacote, editarPacote, excluirPacote } from "@/lib/admin-actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function PacotesPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login");
  const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM pacotes ORDER BY ordem`; await sql.end();
  const ed=sp.editar ? lista.find((p:any)=>p.id===sp.editar) : null;
  const ff=ed?[{name:"id",type:"hidden",defaultValue:ed.id},{name:"nome",label:"Nome",required:true,defaultValue:ed.nome},{name:"slug",label:"Slug",required:true,defaultValue:ed.slug},{name:"descricao",label:"Descricao",defaultValue:ed.descricao??""},{name:"diaria_minima",label:"Diaria Min",type:"number",defaultValue:ed.diaria_minima},{name:"ordem",label:"Ordem",type:"number",defaultValue:ed.ordem}]:[{name:"nome",label:"Nome",required:true},{name:"slug",label:"Slug",required:true},{name:"descricao",label:"Descricao"},{name:"diaria_minima",label:"Diaria Min",type:"number",defaultValue:1},{name:"ordem",label:"Ordem",type:"number",defaultValue:0}];
  return <CrudPage title="Pacotes" subtitle="Ofertas especiais" lista={lista} columns={["nome","slug","diaria_minima","ativo"]} fields={ff} criarAction={criarPacote} editarAction={editarPacote} excluirAction={excluirPacote} editId={sp.editar} erro={sp.erro} ok={sp.ok} basePath="/admin/pacotes" />;
}