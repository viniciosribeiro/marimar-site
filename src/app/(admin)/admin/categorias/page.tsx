import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarCategoria, editarCategoria, excluirCategoria } from "./actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function CategoriasPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string; novo?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login");
  const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false }); const lista=await sql`SELECT * FROM categorias ORDER BY ordem`; await sql.end();
  const ed=sp.editar ? lista.find((c:any)=>c.id===sp.editar) : null;
  const ff=ed?[{name:"id",type:"hidden",defaultValue:ed.id},{name:"nome",label:"Nome",required:true,defaultValue:ed.nome},{name:"slug",label:"Slug",required:true,defaultValue:ed.slug},{name:"descricao",label:"Descricao",defaultValue:ed.descricao??""},{name:"ordem",label:"Ordem",type:"number",defaultValue:ed.ordem}]:[{name:"nome",label:"Nome",required:true},{name:"slug",label:"Slug",required:true},{name:"descricao",label:"Descricao"},{name:"ordem",label:"Ordem",type:"number",defaultValue:0}];
  return <CrudPage title="Categorias" subtitle="Agrupe os quartos por tipo" lista={lista} columns={["nome","slug","ordem","ativo"]} fields={ff} criarAction={criarCategoria} editarAction={editarCategoria} excluirAction={excluirCategoria} editId={sp.editar} erro={sp.erro} ok={sp.ok} basePath="/admin/categorias" />;
}