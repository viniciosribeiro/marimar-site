import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarPacote, editarPacote, excluirPacote } from "@/lib/admin-actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function PacotesPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login");
  const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false }); const lista=await sql`SELECT * FROM pacotes ORDER BY ordem`; await sql.end();
  const ed=sp.editar ? lista.find((p:any)=>p.id===sp.editar) : null;
  const dataIso=(d:any)=>d?new Date(d).toISOString().slice(0,10):"";
  const linhas=(v:any)=>Array.isArray(v)?v.join("\n"):"";
  // "ativo" precisa estar no form de edicao: sem ele, salvar desativava o pacote.
  const comuns=(e:any)=>[{name:"nome",label:"Nome",required:true,defaultValue:e?.nome},{name:"slug",label:"Endereço (slug)",required:true,defaultValue:e?.slug},{name:"descricao",label:"Descrição",type:"textarea",defaultValue:e?.descricao??""},{name:"inclusos",label:"O que está incluso",type:"textarea",rows:4,ajuda:"Um item por linha. A Marina e o site mostram esta lista.",defaultValue:linhas(e?.inclusos)},{name:"vigencia_inicio",label:"Válido de",type:"date",defaultValue:dataIso(e?.vigencia_inicio)},{name:"vigencia_fim",label:"Válido até",type:"date",defaultValue:dataIso(e?.vigencia_fim)},{name:"diaria_minima",label:"Mínimo de noites",type:"number",defaultValue:e?.diaria_minima??1},{name:"ordem",label:"Ordem",type:"number",defaultValue:e?.ordem??0}];
  const ff=ed?[{name:"id",type:"hidden",defaultValue:ed.id},...comuns(ed),{name:"ativo",label:"Ativo",type:"checkbox",defaultValue:ed.ativo?1:0}]:comuns(null);
  return <CrudPage title="Pacotes" subtitle="Ofertas especiais com o que está incluso. A Marina apresenta os pacotes ativos." lista={lista} columns={["nome","slug","diaria_minima","ativo"]} fields={ff} criarAction={criarPacote} editarAction={editarPacote} excluirAction={excluirPacote} editId={sp.editar} erro={sp.erro} ok={sp.ok} basePath="/admin/pacotes" />;
}