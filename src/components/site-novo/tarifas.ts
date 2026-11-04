import { cache } from "react";
import { fetchTarifas, type WorkerQuarto, type WorkerResponse } from "@/lib/worker";
import { datasExemplo } from "@/lib/format";

/**
 * Preço de referência do site novo: UMA consulta ao motor por visita e por
 * número de adultos (o `cache` do React vale para a requisição inteira),
 * dividida por todos os cartões de suíte da página.
 *
 * Datas fixas e ditas no texto da página: daqui a uma semana, 2 noites.
 * É referência, não oferta: o preço das datas da pessoa vem da busca ou da
 * página da suíte, com a mesma conta do /reservar.
 */
export const REFERENCIA = { diasAFrente: 7, noites: 2 } as const;

export const tarifasDeReferencia = cache(async (adultos: number): Promise<WorkerResponse | null> => {
  const ex = datasExemplo(REFERENCIA.diasAFrente, REFERENCIA.noites);
  try {
    return await fetchTarifas(ex.checkIn, ex.checkOut, adultos, 0, { timeoutMs: 8000 });
  } catch {
    return null;
  }
});

/** A suíte na resposta do motor (disponível ou não), pelo código do Desbravador. */
export function acharNoMotor(dados: WorkerResponse | null, codigo: string | null | undefined): WorkerQuarto | null {
  if (!dados || !codigo) return null;
  return [...dados.quartos, ...dados.indisponiveis].find((r) => r.id === codigo) ?? null;
}

/** Diária que dá para mostrar: o motor manda 0 quando não há tarifa publicada. */
export const temDiaria = (q: WorkerQuarto | null | undefined): q is WorkerQuarto => !!q && Number(q.diaria) > 0;
