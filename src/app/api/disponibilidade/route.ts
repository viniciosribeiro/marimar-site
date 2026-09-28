import { NextRequest } from "next/server";
import { fetchTarifas, validarConsulta } from "@/lib/worker";
import { buildDeepLink } from "@/lib/deeplink";
import postgres from "postgres";

export const dynamic = "force-dynamic";

type QuartoLocal = {
  id: string; nome: string; slug: string; cama: string | null; metragem: number | null;
  desbravador_room_id: string; diaria_minima: number | null;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const v = validarConsulta({
    checkIn: q.get("check_in"), checkOut: q.get("check_out"),
    adultos: q.get("adultos"), criancas: q.get("criancas"),
  });
  if (!v.ok) {
    return Response.json({ ok: false, erro: v.erro }, { status: 400 });
  }
  const { checkIn, checkOut, adultos, criancas } = v.consulta;

  try {
    const workerData = await fetchTarifas(checkIn, checkOut, adultos, criancas);

    // Merge com dados locais
    const todos = [...workerData.quartos, ...workerData.indisponiveis];
    const allIds = todos.map(r => r.id);
    let locais: QuartoLocal[] = [];
    if (allIds.length > 0) {
      const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
      try {
        locais = await sql<QuartoLocal[]>`SELECT id, nome, slug, cama, metragem, desbravador_room_id, diaria_minima FROM quartos WHERE desbravador_room_id = ANY(${allIds})`;
      } finally {
        await sql.end();
      }
    }

    const localMap = new Map(locais.map((l) => [l.desbravador_room_id, l]));
    // O link de reserva depende so da consulta, nao do quarto.
    const deepLink = buildDeepLink({ checkIn, checkOut, adultos, criancas });

    const merged = todos.map(r => {
      const local = localMap.get(r.id);
      const diariaMinima = local?.diaria_minima ?? r.estadia_minima;
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
        diaria_minima: diariaMinima,
        atende_diaria_minima: workerData.noites >= diariaMinima,
        pacote: r.pacote,
        comodidades: r.comodidades || [],
        fotos: r.fotos || [],
        cama: local?.cama ?? null,
        metragem: local?.metragem ?? null,
        deep_link: deepLink,
      };
    });

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
