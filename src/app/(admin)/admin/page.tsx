import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db, quartos, leads } from "@/db";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if ((session.user as any).mustReset) redirect("/admin/trocar-senha");

  const [q] = await db.select({ c: sql<number>`count(*)` }).from(quartos).where(eq(quartos.ativo, true));
  const [l] = await db.select({ c: sql<number>`count(*)` }).from(leads).where(eq(leads.lido, false));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Painel</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Quartos ativos" value={q?.c ?? 0} />
        <Card label="Leads nao lidos" value={l?.c ?? 0} />
        <Card label="Status Worker" value="—" />
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}