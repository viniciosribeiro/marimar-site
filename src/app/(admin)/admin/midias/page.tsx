import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { criarMidia, excluirMidia } from "@/lib/admin-actions"; import { CrudPage } from "@/components/admin/CrudPage";

export const dynamic = "force-dynamic";
export default async function MidiasPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const s=await auth(); if(!s?.user) redirect("/admin/login"); const sp=await searchParams;
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false }); const lista=await sql`SELECT * FROM midias ORDER BY criado_em DESC`; await sql.end();
  const ff=[{name:"url",label:"URL da imagem",required:true},{name:"alt",label:"Texto alternativo",required:true},{name:"quarto_id",label:"ID do Quarto"}];
  return <CrudPage title="Midias" subtitle="Fotos e videos dos quartos" lista={lista} columns={["url","alt","tipo","destaque"]} fields={ff} criarAction={criarMidia} excluirAction={excluirMidia} erro={sp.erro} ok={sp.ok} basePath="/admin/midias" />;
}