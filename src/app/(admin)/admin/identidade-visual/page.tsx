import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { ThemeEditor } from "@/components/admin/ThemeEditor";

export const dynamic = "force-dynamic";

export default async function IdentidadeVisualPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  // to_jsonb traz `tema` quando a coluna existe e omite quando nao existe,
  // entao a tela funciona antes e depois da migration.
  const [row] = await sql`SELECT to_jsonb(x) AS dados FROM pousada x LIMIT 1`;
  const p = (row?.dados ?? null) as any;
  await sql.end();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🎨 Identidade Visual</h1>
          <p className="text-sm text-gray-500 mt-1">Configure cores, fontes, logos e SEO do site</p>
        </div>
      </div>
      {sp.ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl mb-6">✅ {sp.ok}</p>}
      {sp.erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl mb-6">⚠️ {sp.erro}</p>}
      <ThemeEditor initial={p} />
    </div>
  );
}