import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { pluralizar } from "@/lib/format";

export const dynamic = "force-dynamic";

type Pacote = { nome: string; diaria_minima: number | null };

export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const lista = await comSql((sql) => sql<Pacote[]>`SELECT * FROM pacotes WHERE ativo = true ORDER BY ordem`);
  const nomes = lista.map((p) => `• ${p.nome} (mínimo de ${pluralizar(p.diaria_minima ?? 1, "noite")})`).join("\n");
  return Response.json({ ok: true, dados: lista, resumo_texto: `${pluralizar(lista.length, "pacote")}:\n${nomes}`, fonte: "local", consultado_em: new Date().toISOString() });
}
