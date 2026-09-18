import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarFaq, editarFaq, excluirFaq } from "@/lib/admin-actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function FaqPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login"); const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false }); const lista=await sql`SELECT * FROM faq ORDER BY ordem`; await sql.end();
  const ed=sp.editar ? lista.find((f:any)=>f.id===sp.editar) : null;
  const ff=ed?[{name:"id",type:"hidden",defaultValue:ed.id},{name:"pergunta",label:"Pergunta",required:true,defaultValue:ed.pergunta},{name:"resposta",label:"Resposta",required:true,defaultValue:ed.resposta},{name:"ordem",label:"Ordem",type:"number",defaultValue:ed.ordem}]:[{name:"pergunta",label:"Pergunta",required:true},{name:"resposta",label:"Resposta",required:true},{name:"ordem",label:"Ordem",type:"number",defaultValue:0}];
  return <CrudPage title="FAQ" subtitle="Perguntas frequentes" lista={lista} columns={["pergunta","visivel_agente","ativo"]} fields={ff} criarAction={criarFaq} editarAction={editarFaq} excluirAction={excluirFaq} editId={sp.editar} erro={sp.erro} ok={sp.ok} basePath="/admin/faq" />;
}