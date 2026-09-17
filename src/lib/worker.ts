import { z } from "zod";

const workerQuartoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  categoria: z.string(),
  diaria: z.number(),
  total: z.number(),
  valor_adulto: z.number(),
  valor_crianca: z.number(),
  ocupacao_max: z.number(),
  pacote: z.string(),
  comodidades: z.array(z.string()),
  fotos: z.array(z.string()),
  disponivel: z.boolean(),
  crianca_por_noite: z.array(z.number()).optional(),
  unidades_disponiveis: z.number(),
  estadia_minima: z.number(),
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
});

export type WorkerResponse = z.infer<typeof workerResponseSchema>;
export type WorkerQuarto = z.infer<typeof workerQuartoSchema>;

const BASE = process.env.WORKER_BASE_URL || "https://pousadahub.viniciosribeiro.workers.dev";
const SLUG = process.env.WORKER_SLUG || "pousada-ilha-do-mel-marimar";

export async function fetchTarifas(
  checkIn: string, checkOut: string, adultos: number, criancas: number = 0
): Promise<WorkerResponse> {
  const url = `${BASE}/tarifas?slug=${SLUG}&check_in=${checkIn}&check_out=${checkOut}&adultos=${adultos}&criancas=${criancas}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
  const data = await res.json();
  return workerResponseSchema.parse(data);
}