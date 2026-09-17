import { NextRequest } from "next/server";
import { fetchTarifas } from "@/lib/worker";
import { buildDeepLink } from "@/lib/deeplink";
import postgres from "postgres";

export async function GET(request: NextRequest) {
  const key = request.headers.get("authorization")?.replace("Bearer ", "");
  if (key !== process.env.AGENT_API_KEY) return Response.json({ ok: false, erro: "Nao autorizado" }, { status: 401 });

  const q = request.nextUrl.searchParams;
  const ci = q.get("check_in") || "2026-10-15";
  const co = q.get("check_out") || "2026-10-17";
  const adultos = parseInt(q.get("adultos") || "2");
  const criancas = parseInt(q.get("criancas") || "0");

  try {
    const data = await fetchTarifas(ci, co, adultos, criancas);
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const ids = [...data.quartos, ...data.indisponiveis].map(r => r.id);
    const locais = ids.length > 0 ? await sql`SELECT * FROM quartos WHERE desbravador_room_id = ANY(${ids})` : [];
    const map = new Map(locais.map((l: any) => [l.desbravador_room_id, l]));
    await sql.end();

    const merged = [...data.quartos, ...data.indisponiveis].map(r => {
      const l = map.get(r.id);
      return { id: r.id, nome: l?.nome || r.nome, diaria: r.diaria, total: r.total, ocupacao_max: r.ocupacao_max, disponivel: r.disponivel, valor_adulto: r.valor_adulto, valor_crianca: r.valor_crianca, pacote: r.pacote, deep_link: buildDeepLink({ checkIn: ci, checkOut: co, adultos, criancas }) };
    });

    const resumo = merged.slice(0, 5).map(r => `• ${r.nome} — R$ ${r.diaria}/noite, total R$ ${r.total} (${r.disponivel ? "disponivel" : "esgotado"})`).join("\n");
    return Response.json({ ok: true, dados: merged, resumo_texto: `Para ${ci} a ${co} (${data.noites} noites, ${adultos} adultos):\n${resumo}`, fonte: "worker", consultado_em: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, erro: "Erro ao consultar disponibilidade" }, { status: 500 });
  }
}