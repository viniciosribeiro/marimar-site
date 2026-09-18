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

export async function fetchTarifas(
  checkIn: string, checkOut: string, adultos: number, criancas: number = 0
): Promise<WorkerResponse> {
  const url = `${BASE}/tarifas?slug=${SLUG}&check_in=${checkIn}&check_out=${checkOut}&adultos=${adultos}&criancas=${criancas}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
  const data = await res.json();
  return workerResponseSchema.parse(data);
}
