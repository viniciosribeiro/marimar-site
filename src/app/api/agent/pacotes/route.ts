import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { dataBR, pluralizar } from "@/lib/format";

export const dynamic = "force-dynamic";

type Pacote = {
  nome: string; slug: string; descricao: string | null; inclusos: string[] | null;
  diaria_minima: number | null; vigencia_inicio: Date | null; vigencia_fim: Date | null;
};

/**
 * Pacotes vigentes.
 *
 * Antes o resumo dizia só nome e mínimo de noites: descrição e itens
 * inclusos existiam no banco e a Marina não via. E pacote vencido continuava
 * sendo oferecido — agora só entra o que está dentro da validade.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const lista = await comSql((sql) => sql<Pacote[]>`
    SELECT nome, slug, descricao, inclusos, diaria_minima, vigencia_inicio, vigencia_fim
    FROM pacotes
    WHERE ativo = true
      AND (vigencia_fim IS NULL OR vigencia_fim::date >= current_date)
    ORDER BY ordem`);

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://marimar-site.vercel.app").replace(/\/+$/, "");
  const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

  const blocos = lista.map((p) => {
    const partes = [`• ${p.nome} — mínimo de ${pluralizar(p.diaria_minima ?? 1, "noite")}`];
    if (p.descricao?.trim()) partes.push(`  ${p.descricao.trim()}`);
    if (p.inclusos?.length) partes.push(`  Inclui: ${p.inclusos.join("; ")}`);
    const ini = iso(p.vigencia_inicio), fim = iso(p.vigencia_fim);
    if (ini || fim) partes.push(`  Válido${ini ? ` de ${dataBR(ini)}` : ""}${fim ? ` até ${dataBR(fim)}` : ""}`);
    partes.push(`  ${base}/pacotes/${p.slug}`);
    return partes.join("\n");
  });

  return Response.json({
    ok: true,
    dados: lista,
    resumo_texto: lista.length
      ? `${pluralizar(lista.length, "pacote")} vigente(s):\n${blocos.join("\n")}\nPreço só pela consulta de disponibilidade, com as datas do hóspede.`
      : "Nenhum pacote vigente no momento.",
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
