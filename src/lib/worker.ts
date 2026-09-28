import { z } from "zod";

/**
 * Schemas do Worker PousadaHub (scraping do motor Desbravador).
 * Contrato completo de campos: docs/contrato-api.md
 *
 * ATENCAO: o Zod por padrao DESCARTA chaves nao declaradas. Ate 18/09/2026 este
 * schema declarava so um subconjunto, entao campos que o Worker ja mandava —
 * estadia_minima, unidades_disponiveis, politica de crianca, disponibilidade
 * por noite — eram silenciosamente jogados fora antes de chegar na UI.
 * Campos novos entram como .optional() para que um Worker mais antigo (ou um
 * payload degradado) nao quebre a pagina inteira no parse.
 */

const workerQuartoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  categoria: z.string(),

  // Valores
  diaria: z.number(),
  total: z.number(),
  total_criancas: z.number().optional(),
  total_geral: z.number().optional(),
  valor_adulto: z.number(),
  valor_crianca: z.number(),
  valor_crianca_max: z.number().optional(),
  crianca_valor_variavel: z.boolean().optional(),
  crianca_por_noite: z.array(z.number()).optional(),

  // Ocupacao
  ocupacao_max: z.number(),
  ocupacao_min: z.number().optional(),
  cabe_hospedes: z.boolean().optional(),

  // Estadia
  noites: z.number().optional(),
  estadia_minima: z.number(),
  estadia_maxima: z.number().optional(),

  // Estoque
  disponivel: z.boolean(),
  unidades_disponiveis: z.number(),
  disponibilidade_por_noite: z.record(z.string(), z.number()).optional(),
  noites_com_estoque: z.number().optional(),
  noites_solicitadas: z.number().optional(),
  motivo_indisponivel: z.string().optional(),

  // Conteudo
  pacote: z.string(),
  comodidades: z.array(z.string()),
  fotos: z.array(z.string()),
});

const workerResponseSchema = z.object({
  hotel: z.string(),
  check_in: z.string(),
  check_out: z.string(),
  adultos: z.number(),
  criancas: z.number(),
  noites: z.number(),
  quartos: z.array(workerQuartoSchema),
  indisponiveis: z.array(workerQuartoSchema),
  total_disponiveis: z.number(),
  unidades_totais_disponiveis: z.number().optional(),
  politica_crianca: z.unknown().optional(),
  aviso_crianca: z.string().optional(),
});

export type WorkerResponse = z.infer<typeof workerResponseSchema>;
export type WorkerQuarto = z.infer<typeof workerQuartoSchema>;

const BASE = process.env.WORKER_BASE_URL || "https://pousadahub.viniciosribeiro.workers.dev";
const SLUG = process.env.WORKER_SLUG || "pousada-ilha-do-mel-marimar";
const TIMEOUT = parseInt(process.env.WORKER_TIMEOUT_MS || "12000");

/**
 * URL da consulta de tarifas. Unica fonte: antes a tela de quartos do admin
 * montava a sua propria, com host e slug fixos, e ignorava WORKER_BASE_URL.
 * Os parametros vao codificados — datas vem da querystring do visitante.
 */
export function urlTarifas(
  checkIn: string, checkOut: string, adultos: number, criancas: number = 0
): string {
  const qs = new URLSearchParams({
    slug: SLUG,
    check_in: checkIn,
    check_out: checkOut,
    adultos: String(adultos),
    criancas: String(criancas),
  });
  return `${BASE}/tarifas?${qs.toString()}`;
}

export async function fetchTarifas(
  checkIn: string, checkOut: string, adultos: number, criancas: number = 0
): Promise<WorkerResponse> {
  const res = await fetch(urlTarifas(checkIn, checkOut, adultos, criancas), { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
  const data = await res.json();
  return workerResponseSchema.parse(data);
}

export type Consulta = { checkIn: string; checkOut: string; adultos: number; criancas: number };

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(s: string): boolean {
  if (!DATA_ISO.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function inteiro(valor: string | null | undefined, padrao: number, min: number, max: number): number {
  const n = parseInt(valor ?? "", 10);
  if (Number.isNaN(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

/**
 * Valida os parametros de uma consulta antes de ir ao motor.
 *
 * Antes cada rota fazia `parseInt(...)` solto: `adultos=abc` virava NaN e ia
 * parar na URL do Worker, e check-out antes do check-in gastava uma consulta
 * ao motor so para voltar erro. Hospedes sao limitados a uma faixa sensata
 * em vez de rejeitados — um "adultos=0" vindo de link antigo vira 1.
 */
export function validarConsulta(p: {
  checkIn?: string | null; checkOut?: string | null;
  adultos?: string | null; criancas?: string | null;
}): { ok: true; consulta: Consulta } | { ok: false; motivo: "datas" | "ordem"; erro: string } {
  const checkIn = p.checkIn ?? "";
  const checkOut = p.checkOut ?? "";
  if (!dataValida(checkIn) || !dataValida(checkOut)) {
    return { ok: false, motivo: "datas", erro: "Datas invalidas. Use o formato AAAA-MM-DD." };
  }
  if (checkOut <= checkIn) {
    return { ok: false, motivo: "ordem", erro: "A data de saida precisa ser depois da data de entrada." };
  }
  return {
    ok: true,
    consulta: {
      checkIn,
      checkOut,
      adultos: inteiro(p.adultos, 2, 1, 20),
      criancas: inteiro(p.criancas, 0, 0, 20),
    },
  };
}
