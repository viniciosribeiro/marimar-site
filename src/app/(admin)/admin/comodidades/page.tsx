import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarComodidade, editarComodidade, excluirComodidade } from "./actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function ComodidadesPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login");
  const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!,{max:1}); const lista=await sql`SELECT * FROM comodidades ORDER BY ordem`; await sql.end();
  const ed=sp.editar ? lista.find((c:any)=>c.id===sp.editar) : null;
  const ff=ed?[{name:"id",type:"hidden",defaultValue:ed.id},{name:"nome",label:"Nome",required:true,defaultValue:ed.nome},{name:"slug",label:"Slug",required:true,defaultValue:ed.slug},{name:"icone",label:"Icone",defaultValue:ed.icone??"check"},{name:"escopo",label:"Escopo",type:"select",defaultValue:ed.escopo??"quarto",options:[{value:"quarto",label:"Quarto"},{value:"pousada",label:"Pousada"}]},{name:"ordem",label:"Ordem",type:"number",defaultValue:ed.ordem}]:[{name:"nome",label:"Nome",required:true},{name:"slug",label:"Slug",required:true},{name:"icone",label:"Icone",defaultValue:"check"},{name:"escopo",label:"Escopo",type:"select",defaultValue:"quarto",options:[{value:"quarto",label:"Quarto"},{value:"pousada",label:"Pousada"}]},{name:"ordem",label:"Ordem",type:"number",defaultValue:0}];
  return <CrudPage title="Comodidades" subtitle="Itens que os quartos oferecem" lista={lista} columns={["nome","slug","escopo","ativo"]} fields={ff} criarAction={criarComodidade} editarAction={editarComodidade} excluirAction={excluirComodidade} editId={sp.editar} erro={sp.erro} ok={sp.ok} basePath="/admin/comodidades" />;
}