import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { fetchTarifas, validarConsulta } from "@/lib/worker";
import { buildDeepLink } from "@/lib/deeplink";
import { brl, dataBR, datasExemplo, pluralizar } from "@/lib/format";
import { comSql } from "@/lib/db-conexao";
import { lerRegras, calcularOcupacao, textoCriancas } from "@/lib/regras-hospedagem";

export const dynamic = "force-dynamic";

/**
 * Disponibilidade e preço para a Marina.
 *
 * A regra de crianças da pousada é aplicada AQUI, antes de ir ao motor — a
 * mesma conta do site (`calcularOcupacao`). A Marina só informa adultos,
 * crianças (que não são de colo) e bebês; a rota faz o resto. Assim ela não
 * precisa lembrar da regra para acertar o preço.
 *
 * O total é `total_geral` (com crianças): até 30/09/2026 o resumo usava
 * `total`, que no motor é só a parte dos adultos.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const q = request.nextUrl.searchParams;
  /* Sem datas, consulta uma estadia de exemplo (daqui a uma semana). As
     datas usadas vão sempre escritas no resumo, para a Marina não
     apresentar o preço de exemplo como se fosse o da data do hóspede. */
  const exemplo = datasExemplo();
  const v = validarConsulta({
    checkIn: q.get("check_in") || exemplo.checkIn,
    checkOut: q.get("check_out") || exemplo.checkOut,
    adultos: q.get("adultos"),
    criancas: q.get("criancas"),
    bebes: q.get("bebes"),
  });
  if (!v.ok) return Response.json({ ok: false, erro: v.erro }, { status: 400 });
  const { checkIn: ci, checkOut: co } = v.consulta;

  try {
    const regras = await comSql(lerRegras);
    const noites = Math.round((Date.parse(co) - Date.parse(ci)) / 86_400_000);
    const oc = calcularOcupacao({ ...v.consulta, noites }, regras);
    const data = await fetchTarifas(ci, co, oc.adultosMotor, oc.criancasMotor);
    const todos = [...data.quartos, ...data.indisponiveis];
    const ids = todos.map((r) => r.id);
    const locais = ids.length
      ? await comSql((sql) => sql<{ desbravador_room_id: string; nome: string }[]>`
          SELECT desbravador_room_id, nome FROM quartos WHERE desbravador_room_id = ANY(${ids})`)
      : [];
    const map = new Map(locais.map((l) => [l.desbravador_room_id, l]));
    const deepLink = buildDeepLink({ checkIn: ci, checkOut: co, adultos: oc.adultosMotor, criancas: oc.criancasMotor });

    const merged = todos.map((r) => {
      const l = map.get(r.id);
      const totalMotor = r.total_geral ?? r.total;
      return {
        id: r.id, nome: l?.nome || r.nome, diaria: r.diaria,
        total: totalMotor + (oc.valorBebes ?? 0),
        total_motor: totalMotor, valor_bebes: oc.valorBebes,
        ocupacao_max: r.ocupacao_max, disponivel: r.disponivel,
        valor_adulto: r.valor_adulto, valor_crianca: r.valor_crianca, pacote: r.pacote, deep_link: deepLink,
      };
    });

    const resumo = merged.slice(0, 5)
      .map((r) => `• ${r.nome} — ${brl(r.diaria)}/noite, total ${brl(r.total)} (${r.disponivel ? "disponível" : "esgotado"})`)
      .join("\n");
    const quem = [
      pluralizar(oc.adultos, "adulto"),
      oc.criancas > 0 ? pluralizar(oc.criancas, "criança") : "",
      oc.bebes > 0 ? `${pluralizar(oc.bebes, "bebê")} de colo` : "",
    ].filter(Boolean).join(", ");
    const regra = oc.regraAplicada
      ? `\nRegra da pousada aplicada: ${oc.explicacao ?? textoCriancas(regras)} Não peça idade das crianças.`
      : oc.criancas > 0
        ? `\nAtenção: ${(data.aviso_crianca ?? "o valor de criança depende da idade").replace(/\.\s*$/, "")}. Confirme com a pousada antes de fechar o valor.`
        : "";

    return Response.json({
      ok: true,
      dados: merged,
      ocupacao: oc,
      resumo_texto: `Para ${dataBR(ci)} a ${dataBR(co)} (${pluralizar(data.noites, "noite")}, ${quem}):\n${resumo}${regra}`,
      fonte: "worker",
      consultado_em: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[agent/disponibilidade] Erro:", e);
    return Response.json({ ok: false, erro: "Erro ao consultar disponibilidade" }, { status: 500 });
  }
}
