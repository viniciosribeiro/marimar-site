import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarFaq, editarFaq, excluirFaq } from "@/lib/admin-actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function FaqPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login"); const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false }); const lista=await sql`SELECT * FROM faq ORDER BY ordem`; await sql.end();
  const ed=sp.editar ? lista.find((f:any)=>f.id===sp.editar) : null;
  // "ativo" e "visivel_agente" PRECISAM estar no formulario: a action le os
  // dois do form, e checkbox ausente chega como desligado. Sem eles, editar
  // uma pergunta a desativava e nenhuma FAQ chegava a Marina (ate 28/09/2026).
  const ff=ed?[{name:"id",type:"hidden",defaultValue:ed.id},{name:"pergunta",label:"Pergunta",required:true,defaultValue:ed.pergunta,className:"sm:col-span-2 lg:basis-full"},{name:"resposta",label:"Resposta",type:"textarea",required:true,defaultValue:ed.resposta},{name:"ordem",label:"Ordem",type:"number",defaultValue:ed.ordem},{name:"ativo",label:"Aparece no site",type:"checkbox",defaultValue:ed.ativo?1:0},{name:"visivel_agente",label:"A Marina usa esta resposta",type:"checkbox",defaultValue:ed.visivel_agente?1:0}]:[{name:"pergunta",label:"Pergunta",required:true,className:"sm:col-span-2 lg:basis-full"},{name:"resposta",label:"Resposta",type:"textarea",required:true},{name:"ordem",label:"Ordem",type:"number",defaultValue:0},{name:"visivel_agente",label:"A Marina usa esta resposta",type:"checkbox",defaultValue:1}];
  return <CrudPage title="Perguntas frequentes" subtitle="Aparecem no site e, marcadas, a Marina usa como resposta oficial" lista={lista} columns={["pergunta","visivel_agente","ativo"]} fields={ff} criarAction={criarFaq} editarAction={editarFaq} excluirAction={excluirFaq} editId={sp.editar} erro={sp.erro} ok={sp.ok} basePath="/admin/faq" />;
}