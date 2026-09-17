import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import postgres from "postgres"; import { ThemeEditor } from "@/components/admin/ThemeEditor";

export const dynamic = "force-dynamic";

export default async function IdentidadeVisualPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [p] = await sql`SELECT * FROM pousada LIMIT 1`;
  await sql.end();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🎨 Identidade Visual</h1>
          <p className="text-sm text-gray-500 mt-1">Configure cores, fontes, logos e SEO do site</p>
        </div>
      </div>
      {sp.ok && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-xl mb-6">{sp.ok}</p>}
      <ThemeEditor initial={p} />
    </div>
  );
}