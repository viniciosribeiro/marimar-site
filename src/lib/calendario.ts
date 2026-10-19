/**
 * Datas do calendário de estadia (src/components/site/SeletorDatas.tsx).
 * Tudo em texto AAAA-MM-DD, o mesmo formato que a busca manda para
 * /reservar — sem fuso horário no meio: o dia 28/12 é 28/12 em qualquer
 * aparelho. Sem banco e sem rede. Testes: testes/unit/calendario.test.ts.
 */

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_SEMANA_LONGOS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export type Mes = { ano: number; mes: number }; // mes: 0 = janeiro

const dois = (n: number) => String(n).padStart(2, "0");

/** AAAA-MM-DD de um dia (aceita dia/mês fora da faixa: 32/12 vira 01/01). */
export function dataIso(ano: number, mes: number, dia: number): string {
  const t = new Date(Date.UTC(ano, mes, dia));
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}`;
}

export function partesIso(s: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = s.split("-").map(Number);
  return { ano, mes: mes - 1, dia };
}

/** Data real no formato AAAA-MM-DD (31/02 não passa). */
export function isoValido(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = partesIso(s);
  return dataIso(p.ano, p.mes, p.dia) === s;
}

/** Hoje no aparelho de quem está vendo. */
export function hojeIso(agora = new Date()): string {
  return dataIso(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

const utc = (s: string) => { const p = partesIso(s); return Date.UTC(p.ano, p.mes, p.dia); };

export const noitesEntre = (entrada: string, saida: string) => Math.round((utc(saida) - utc(entrada)) / 86_400_000);
export const somarDias = (s: string, n: number) => { const p = partesIso(s); return dataIso(p.ano, p.mes, p.dia + n); };
export const diaSemana = (s: string) => new Date(utc(s)).getUTCDay();

export const mesDe = (s: string): Mes => { const p = partesIso(s); return { ano: p.ano, mes: p.mes }; };
export const somarMeses = (m: Mes, n: number): Mes => { const t = new Date(Date.UTC(m.ano, m.mes + n, 1)); return { ano: t.getUTCFullYear(), mes: t.getUTCMonth() }; };
export const mesmoMes = (a: Mes, b: Mes) => a.ano === b.ano && a.mes === b.mes;
export const mesAntes = (a: Mes, b: Mes) => a.ano < b.ano || (a.ano === b.ano && a.mes < b.mes);
export const chaveMes = (m: Mes) => `${m.ano}-${dois(m.mes + 1)}`;

/** Dias do mês para a grade: `null` nas casas vazias antes do dia 1 (a semana começa no domingo). */
export function gradeDoMes(m: Mes): (string | null)[] {
  const vazios = new Date(Date.UTC(m.ano, m.mes, 1)).getUTCDay();
  const total = new Date(Date.UTC(m.ano, m.mes + 1, 0)).getUTCDate();
  return [...Array<null>(vazios).fill(null), ...Array.from({ length: total }, (_, i) => dataIso(m.ano, m.mes, i + 1))];
}

/* ── texto ───────────────────────────────────────────────────────── */

/** "28 dez" */
export const dataCurta = (s: string) => { const p = partesIso(s); return `${p.dia} ${MESES_CURTOS[p.mes]}`; };
/** "28/12/2026" */
export const dataBarra = (s: string) => { const p = partesIso(s); return `${dois(p.dia)}/${dois(p.mes + 1)}/${p.ano}`; };
/** "28 de dezembro de 2026, segunda-feira" (leitor de tela) */
export const dataPorExtenso = (s: string) => { const p = partesIso(s); return `${p.dia} de ${MESES[p.mes]} de ${p.ano}, ${DIAS_SEMANA_LONGOS[diaSemana(s)]}`; };
export const tituloMes = (m: Mes) => `${MESES[m.mes][0].toUpperCase()}${MESES[m.mes].slice(1)} ${m.ano}`;
export const noitesTexto = (n: number) => `${n} ${n === 1 ? "noite" : "noites"}`;

/* ── feriados nacionais (ponto no calendário: semana de alta procura) ── */

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return dataIso(ano, mes - 1, dia);
}

/** Feriados nacionais e as datas móveis que lotam a ilha (Carnaval, Sexta-feira Santa, Corpus Christi). */
export function feriadosDoAno(ano: number): Record<string, string> {
  const p = pascoa(ano);
  return {
    [dataIso(ano, 0, 1)]: "Ano-Novo",
    [somarDias(p, -48)]: "Carnaval",
    [somarDias(p, -47)]: "Carnaval",
    [somarDias(p, -2)]: "Sexta-feira Santa",
    [dataIso(ano, 3, 21)]: "Tiradentes",
    [dataIso(ano, 4, 1)]: "Dia do Trabalho",
    [somarDias(p, 60)]: "Corpus Christi",
    [dataIso(ano, 8, 7)]: "Independência",
    [dataIso(ano, 9, 12)]: "Nossa Senhora Aparecida",
    [dataIso(ano, 10, 2)]: "Finados",
    [dataIso(ano, 10, 15)]: "Proclamação da República",
    [dataIso(ano, 10, 20)]: "Consciência Negra",
    [dataIso(ano, 11, 25)]: "Natal",
  };
}
