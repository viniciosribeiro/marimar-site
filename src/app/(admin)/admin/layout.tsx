import { AdminNav, type ContagensPainel } from "@/components/admin/AdminNav";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import "./admin.css";

/**
 * O casco do painel ("Central"): 7 áreas no lugar dos grupos de telas.
 * O mapa das áreas mora em `src/components/admin/areas.ts`; o estudo que o
 * originou, em `docs/estudo-painel-central.md` (fase 1, 19/10/2026).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await auth().catch(() => null);
  const usuario = sessao?.user as { role?: string } | undefined;
  /* Perfil Técnico = papel "master". Quem não entrou (login) não consulta nada. */
  const tecnico = usuario?.role === "master";

  /* O número da área Atendimento: tudo o que espera alguém. Cada parte
     isolada — antes das migrations 0016/0019 as tabelas não existem. */
  const contagens: ContagensPainel = { atendimento: 0, porItem: {} };
  if (usuario) {
    const [chamados, lacunas, aprovar, contatos] = await comSql(async (sql) => {
      const um = async (q: Promise<{ n: number }[]>) => (await q.catch(() => [{ n: 0 }]))[0]?.n ?? 0;
      return Promise.all([
        um(sql`SELECT count(*)::int AS n FROM marina_chamados WHERE status = 'aguardando'`),
        um(sql`SELECT count(*)::int AS n FROM marina_lacunas WHERE status = 'aberta'`),
        um(sql`SELECT count(*)::int AS n FROM marina_aprendizado WHERE status = 'pendente'`),
        um(sql`SELECT count(*)::int AS n FROM leads WHERE lido = false`),
      ]);
    }).catch(() => [0, 0, 0, 0]);
    contagens.atendimento = chamados + lacunas + aprovar + contatos;
    contagens.porItem = {
      "/admin/equipe?aba=chamados": chamados,
      "/admin/marina?aba=sem-resposta": lacunas,
      "/admin/marina?aba=aprendizado": aprovar,
      "/admin/leads": contatos,
    };
  }

  return <AdminNav nome="Pousada Marimar" tecnico={tecnico} contagens={contagens}>{children}</AdminNav>;
}
