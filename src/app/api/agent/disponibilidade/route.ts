import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { fetchTarifas, validarConsulta } from "@/lib/worker";
import { buildDeepLink } from "@/lib/deeplink";
import { brl, dataBR, datasExemplo, pluralizar } from "@/lib/format";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const q = request.nextUrl.searchParams;
  /* Sem datas, consulta uma estadia de exemplo (daqui a uma semana). Ate
     28/09/2026 o padrao era "2026-10-15" fixo, que viraria data passada.
     As datas usadas vao sempre escritas no resumo, para a Marina nao
     apresentar o preco de exemplo como se fosse o da data do hospede. */
  const exemplo = datasExemplo();
  const v = validarConsulta({
    checkIn: q.get("check_in") || exemplo.checkIn,
    checkOut: q.get("check_out") || exemplo.checkOut,
    adultos: q.get("adultos"),
    criancas: q.get("criancas"),
  });
  if (!v.ok) return Response.json({ ok: false, erro: v.erro }, { status: 400 });
  const { checkIn: ci, checkOut: co, adultos, criancas } = v.consulta;

  try {
    const data = await fetchTarifas(ci, co, adultos, criancas);
    const todos = [...data.quartos, ...data.indisponiveis];
    const ids = todos.map(r => r.id);
    let locais: { desbravador_room_id: string; nome: string }[] = [];
    if (ids.length > 0) {
      const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
      try {
        locais = await sql<{ desbravador_room_id: string; nome: string }[]>`
          SELECT desbravador_room_id, nome FROM quartos WHERE desbravador_room_id = ANY(${ids})`;
      } finally {
        await sql.end();
      }
    }
    const map = new Map(locais.map((l) => [l.desbravador_room_id, l]));
    const deepLink = buildDeepLink({ checkIn: ci, checkOut: co, adultos, criancas });

    const merged = todos.map(r => {
      const l = map.get(r.id);
      return { id: r.id, nome: l?.nome || r.nome, diaria: r.diaria, total: r.total, ocupacao_max: r.ocupacao_max, disponivel: r.disponivel, valor_adulto: r.valor_adulto, valor_crianca: r.valor_crianca, pacote: r.pacote, deep_link: deepLink };
    });

    const resumo = merged.slice(0, 5).map(r => `• ${r.nome} — ${brl(r.diaria)}/noite, total ${brl(r.total)} (${r.disponivel ? "disponível" : "esgotado"})`).join("\n");
    const quem = pluralizar(adultos, "adulto") + (criancas > 0 ? ` e ${pluralizar(criancas, "criança")}` : "");
    return Response.json({ ok: true, dados: merged, resumo_texto: `Para ${dataBR(ci)} a ${dataBR(co)} (${pluralizar(data.noites, "noite")}, ${quem}):\n${resumo}`, fonte: "worker", consultado_em: new Date().toISOString() });
  } catch (e) {
    console.error("[agent/disponibilidade] Erro:", e);
    return Response.json({ ok: false, erro: "Erro ao consultar disponibilidade" }, { status: 500 });
  }
}
