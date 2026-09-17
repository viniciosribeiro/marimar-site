import { NextRequest } from "next/server";
import { fetchTarifas } from "@/lib/worker";
import { buildDeepLink } from "@/lib/deeplink";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const checkIn = q.get("check_in");
  const checkOut = q.get("check_out");
  const adultos = parseInt(q.get("adultos") || "2");
  const criancas = parseInt(q.get("criancas") || "0");

  if (!checkIn || !checkOut) {
    return Response.json({ ok: false, erro: "check_in e check_out obrigatorios" }, { status: 400 });
  }

  try {
    const workerData = await fetchTarifas(checkIn, checkOut, adultos, criancas);

    // Merge com dados locais
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const allIds = [...workerData.quartos, ...workerData.indisponiveis].map(r => r.id);
    const locais = allIds.length > 0
      ? await sql`SELECT id, nome, slug, descricao, cama, metragem, desbravador_room_id, diaria_minima FROM quartos WHERE desbravador_room_id = ANY(${allIds})`
      : [];

    const localMap = new Map(locais.map((l: any) => [l.desbravador_room_id, l]));

    const merged = [...workerData.quartos, ...workerData.indisponiveis].map(r => {
      const local = localMap.get(r.id);
      return {
        id: local?.id ?? r.id,
        desbravador_room_id: r.id,
        nome: local?.nome ?? r.nome,
        categoria: r.categoria,
        slug: local?.slug ?? r.nome.toLowerCase().replace(/\s+/g, "-"),
        status: r.disponivel ? "disponivel" : "indisponivel",
        noites: workerData.noites,
        diaria: r.diaria,
        total: r.total,
        valor_adulto: r.valor_adulto,
        valor_crianca: r.valor_crianca,
        moeda: "BRL",
        ocupacao_max: r.ocupacao_max,
        diaria_minima: local?.diaria_minima ?? r.estadia_minima,
        atende_diaria_minima: workerData.noites >= (local?.diaria_minima ?? r.estadia_minima),
        pacote: r.pacote,
        comodidades: r.comodidades || [],
        fotos: r.fotos || [],
        cama: local?.cama ?? null,
        metragem: local?.metragem ?? null,
        deep_link: buildDeepLink({ checkIn, checkOut, adultos, criancas }),
      };
    });

    await sql.end();

    return Response.json({
      ok: true,
      hotel: workerData.hotel,
      check_in: checkIn,
      check_out: checkOut,
      noites: workerData.noites,
      quartos: merged,
      total_disponiveis: workerData.total_disponiveis,
    });
  } catch (err) {
    console.error("[disponibilidade] Erro:", err);
    return Response.json({ ok: false, erro: "Erro ao consultar disponibilidade" }, { status: 500 });
  }
}