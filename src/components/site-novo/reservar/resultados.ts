import type { Consulta, WorkerResponse } from "@/lib/worker";
import type { Ocupacao } from "@/lib/regras-hospedagem";
import { buildDeepLink } from "@/lib/deeplink";
import { brl, dataBR, escassez, tituloQuarto } from "@/lib/format";

/**
 * Os resultados da busca no site novo, montados com as MESMAS regras do
 * /reservar do Clássico (src/app/(site)/reservar/page.tsx):
 *  - nome pelo cadastro local (tituloQuarto), senão o do motor;
 *  - capa = primeira foto do painel (capa antes), senão a do motor;
 *  - total = total_geral (ou total) do motor + bebês de colo à parte;
 *  - link de reserva com a ocupação que vai ao motor e o roomCode da suíte;
 *  - escassez só com estoque real; estadia mínima quando o motor exige mais noites.
 * Puro (sem banco): testado em testes/unit/reservar-novo.test.ts.
 */
export type QuartoLocal = {
  id: string; slug: string; nome: string; ativo: boolean; cat_nome: string | null;
  descricao: string | null; descricao_motor: string | null; cama: string | null;
  metragem: number | null; vista: string | null; desbravador_room_id: string;
};
export type FotoLocal = { quarto_id: string; url: string; alt: string | null };

export type Resultado = {
  codigo: string; nome: string; categoria: string | null; ocupacao: number; disponivel: boolean;
  diaria: number; totalFinal: number; valorBebes: number; temTarifa: boolean;
  fotoCapa: string | null; fotos: { url: string; alt: string }[]; comodidades: string[];
  cama: string | null; metragem: number | null; vista: string | null;
  descricao: string | null; descricaoMotor: string | null;
  escassez: string | null; avisoEstadia: number | null; motivo: string | null;
  linkReserva: string; whatsappUrl: string | null;
  /** Página da suíte no site com as mesmas datas — só para suíte ativa (nunca um 404). */
  paginaSuite: string | null;
};

export function montarResultados(dados: WorkerResponse, ctx: {
  consulta: Consulta; noites: number; oc: Ocupacao;
  locais: QuartoLocal[]; fotos: FotoLocal[]; comodidades: { quarto_id: string; nome: string }[];
  whatsapp: string; query: string;
}): Resultado[] {
  const { consulta: c, noites, oc } = ctx;
  const porCodigo = new Map(ctx.locais.map((l) => [l.desbravador_room_id, l]));
  const fotosDe = new Map<string, FotoLocal[]>();
  for (const f of ctx.fotos) fotosDe.set(f.quarto_id, [...(fotosDe.get(f.quarto_id) ?? []), f]);
  const comodidadesDe = new Map<string, string[]>();
  for (const i of ctx.comodidades) comodidadesDe.set(i.quarto_id, [...(comodidadesDe.get(i.quarto_id) ?? []), i.nome]);
  const bebes = oc.valorBebes ?? 0;

  return [...dados.quartos, ...dados.indisponiveis].map((r) => {
    const l = porCodigo.get(r.id);
    const nome = tituloQuarto(l?.nome || r.nome);
    const proprias = l ? fotosDe.get(l.id) ?? [] : [];
    const fotos = proprias.length
      ? proprias.map((f) => ({ url: String(f.url), alt: f.alt || nome }))
      : (r.fotos ?? []).filter((u) => !!u).map((url) => ({ url, alt: nome }));
    const totalFinal = (r.total_geral ?? r.total) + bebes;
    const whatsappUrl = ctx.whatsapp
      ? `https://wa.me/${ctx.whatsapp}?text=${encodeURIComponent(`Olá! Gostaria de reservar:\n\n*Quarto:* ${nome}\n*Check-in:* ${dataBR(c.checkIn)}\n*Check-out:* ${dataBR(c.checkOut)}\n*Noites:* ${noites}\n*Adultos:* ${c.adultos}${c.criancas > 0 ? `\n*Crianças:* ${c.criancas}` : ""}${oc.bebes > 0 ? `\n*Bebês de colo:* ${oc.bebes}` : ""}\n*Valor total:* ${brl(totalFinal)}\n\nPodem verificar a disponibilidade?`)}`
      : null;
    return {
      codigo: r.id,
      nome,
      categoria: l?.cat_nome ?? null,
      ocupacao: Number(r.ocupacao_max) || 0,
      disponivel: Boolean(r.disponivel),
      diaria: Number(r.diaria) || 0,
      totalFinal,
      valorBebes: bebes,
      temTarifa: Number(r.diaria) > 0,
      fotoCapa: proprias[0]?.url ?? r.fotos?.[0] ?? null,
      fotos,
      comodidades: l ? comodidadesDe.get(l.id) ?? [] : [],
      cama: l?.cama ?? null, metragem: l?.metragem ?? null, vista: l?.vista ?? null,
      descricao: l?.descricao ?? null,
      descricaoMotor: l?.descricao_motor || r.categoria || null,
      escassez: r.disponivel ? escassez(r.unidades_disponiveis) : null,
      avisoEstadia: r.estadia_minima > noites ? r.estadia_minima : null,
      motivo: r.motivo_indisponivel ?? null,
      linkReserva: buildDeepLink({ checkIn: c.checkIn, checkOut: c.checkOut, adultos: oc.adultosMotor, criancas: oc.criancasMotor, quartoId: r.id }),
      whatsappUrl,
      paginaSuite: l?.ativo && l.slug ? `/quartos/${l.slug}?${ctx.query}` : null,
    };
  });
}

/** "Menor preço": disponíveis com tarifa primeiro, da menor diária para a maior; o resto na ordem do motor. */
export function ordenar(lista: Resultado[], ordem: "pousada" | "preco"): Resultado[] {
  if (ordem !== "preco") return lista;
  const comPreco = lista.filter((r) => r.temTarifa).sort((a, b) => a.diaria - b.diaria);
  return [...comPreco, ...lista.filter((r) => !r.temTarifa)];
}

/** O texto da indisponibilidade, com a primeira letra maiúscula (como no Clássico). */
export const textoMotivo = (motivo: string | null) =>
  motivo ? motivo.charAt(0).toUpperCase() + motivo.slice(1) : "Esgotado no período";
