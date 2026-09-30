import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { ThemeEditor } from "@/components/admin/ThemeEditor";
import { blobConfigurado } from "@/lib/blob";

export const dynamic = "force-dynamic";

export default async function IdentidadeVisualPage() {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  // to_jsonb traz `tema` quando a coluna existe e omite quando nao existe,
  // entao a tela funciona antes e depois da migration.
  const [row] = await sql`SELECT to_jsonb(x) AS dados FROM pousada x LIMIT 1`;
  const p = (row?.dados ?? null) as any;
  await sql.end();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 mx-auto w-full max-w-7xl min-w-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-titulo text-2xl sm:text-[1.75rem] font-bold tracking-tight text-tinta">Identidade visual</h1>
          <p className="text-sm text-tinta-suave mt-1">Cores, fontes, logo e como o site aparece no Google. O painel também veste estas cores.</p>
        </div>
      </div>
      <ThemeEditor initial={p} blobOk={blobConfigurado()} />
    </div>
  );
}