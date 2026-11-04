import type { Consulta, WorkerQuarto } from "@/lib/worker";
import { escassez, pluralizar } from "@/lib/format";
import type { NomeIcone } from "@/components/site/Icone";

/**
 * O preço de UMA suíte para as datas da pessoa, a partir da resposta do
 * motor — a mesma conta do /reservar (diária do motor; total = total_geral
 * do motor + bebês de colo cobrados à parte pela regra da pousada).
 *
 * Arquivo puro (sem banco, sem React): testado em testes/unit/suite-novo.test.ts.
 */
export type EstadoPreco =
  | {
      tipo: "ok"; diaria: number; total: number; noites: number; valorBebes: number;
      escassez: string | null; estadiaMinima: number | null; pacote: string | null;
    }
  | { tipo: "nao_comporta"; capacidade: number | null }
  | { tipo: "esgotada" }
  | { tipo: "sem_tarifa" }
  | { tipo: "fora_do_motor" }
  | { tipo: "erro" };

export function estadoDoPreco(
  r: WorkerQuarto | null,
  ctx: { noites: number; hospedesNoMotor: number; valorBebes: number | null; falhou?: boolean },
): EstadoPreco {
  if (ctx.falhou) return { tipo: "erro" };
  if (!r) return { tipo: "fora_do_motor" };
  const naoCabe = r.cabe_hospedes === false
    || (r.ocupacao_max > 0 && ctx.hospedesNoMotor > r.ocupacao_max)
    || /comport/i.test(r.motivo_indisponivel ?? "");
  if (!r.disponivel && naoCabe) return { tipo: "nao_comporta", capacidade: r.ocupacao_max > 0 ? r.ocupacao_max : null };
  /* O motor manda diária 0 quando não há tarifa publicada (04/11/2026): nunca "R$ 0". */
  if (!(Number(r.diaria) > 0)) return { tipo: "sem_tarifa" };
  if (!r.disponivel) return { tipo: "esgotada" };
  const bebes = ctx.valorBebes ?? 0;
  return {
    tipo: "ok",
    diaria: r.diaria,
    noites: ctx.noites,
    total: (r.total_geral ?? r.total) + bebes,
    valorBebes: bebes,
    escassez: escassez(r.unidades_disponiveis),
    estadiaMinima: r.estadia_minima > ctx.noites ? r.estadia_minima : null,
    pacote: r.pacote?.trim() || null,
  };
}

/** "Até 4 pessoas, cama de casal, 18 m²" — o que dá para saber sem abrir a suíte. */
export function linhaCapacidade(q: { ocupacao_max: number; cama?: string | null; metragem?: number | string | null }): string {
  const partes = [`Até ${pluralizar(q.ocupacao_max, "pessoa")}`];
  if (q.cama?.trim()) partes.push(q.cama.trim().toLowerCase());
  const m = Number(q.metragem);
  if (Number.isFinite(m) && m > 0) partes.push(`${m.toLocaleString("pt-BR")} m²`);
  return partes.join(", ");
}

/** Ícone de uma comodidade pelo nome (cadastro do painel ou do motor); sem par, um visto. */
const ICONES_COMODIDADE: [RegExp, NomeIcone][] = [
  [/wi-?fi|internet/i, "wifi"],
  [/ar[- ]?condicionado|climatiza|\bsplit\b|^ar$/i, "ar"],
  [/\btv\b|televis|smart ?tv/i, "tv"],
  [/chuveiro|ducha|banheir|banho|toalha|secador/i, "chuveiro"],
  [/cama|travesseiro|enxoval|len[cç]o/i, "cama"],
  [/caf[eé]|cafeteira|chaleira/i, "cafe"],
  [/varanda|sacada|vista|janela/i, "ondas"],
  [/cofre|seguran/i, "escudo"],
  [/fam[ií]lia|crian[cç]a|ber[cç]o/i, "familia"],
  [/telefone/i, "telefone"],
  [/despertador|rel[oó]gio/i, "relogio"],
];
export function iconeDaComodidade(nome: string): NomeIcone {
  for (const [re, icone] of ICONES_COMODIDADE) if (re.test(nome)) return icone;
  return "check";
}

/** Filtro "Para quantas pessoas?" da lista: número válido entre 1 e a maior suíte; senão, todas. */
export function lerPessoas(valor: string | undefined, maior: number): number {
  const n = Number.parseInt(valor ?? "", 10);
  return Number.isInteger(n) && n >= 1 && n <= Math.max(1, maior) ? n : 0;
}

/** "2 adultos, 1 criança" — o que a pessoa informou. */
export function hospedes(c: Pick<Consulta, "adultos" | "criancas" | "bebes">): string {
  const partes = [pluralizar(c.adultos, "adulto")];
  if (c.criancas) partes.push(pluralizar(c.criancas, "criança"));
  if (c.bebes) partes.push(pluralizar(c.bebes, "bebê"));
  return partes.join(", ");
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "9 a 12 de dezembro"; "28 de dezembro de 2026 a 2 de janeiro de 2027" (ano só quando muda ou não é o atual). */
export function periodo(ci: string, co: string, anoAtual = new Date().getFullYear()): string {
  const [a1, m1, d1] = ci.split("-").map(Number);
  const [a2, m2, d2] = co.split("-").map(Number);
  const ano = (a: number) => (a !== anoAtual || a1 !== a2 ? ` de ${a}` : "");
  if (a1 === a2 && m1 === m2) return `${d1} a ${d2} de ${MESES[m2 - 1]}${ano(a2)}`;
  return `${d1} de ${MESES[m1 - 1]}${a1 !== a2 ? ` de ${a1}` : ""} a ${d2} de ${MESES[m2 - 1]}${ano(a2)}`;
}

/** A busca no endereço (`check_in=…&check_out=…&adultos=…&criancas=…[&bebes=…]`), igual em toda página do Novo. */
export function paramsDaConsulta(c: Pick<Consulta, "checkIn" | "checkOut" | "adultos" | "criancas" | "bebes">, comBebes: boolean): string {
  const p = new URLSearchParams({ check_in: c.checkIn, check_out: c.checkOut, adultos: String(c.adultos), criancas: String(c.criancas) });
  if (comBebes) p.set("bebes", String(c.bebes));
  return p.toString();
}
