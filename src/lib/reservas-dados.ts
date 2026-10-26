import "server-only";
import { comSql } from "@/lib/db-conexao";

/** Contrato preparado para futura integracao APENAS LEITURA ao PMS/ROL.
 * O motor publico de tarifas NAO fornece reservas confirmadas nem nomes.
 * Nunca converter indisponibilidade, lead ou estimativa em reserva.
 */
export type SituacaoReserva = "confirmada" | "hospedado" | "pendente" | "cancelada" | "concluida";
export type ReservaReal = {
  id: string;
  codigo: string;
  quartoId: string | null;
  quarto: string;
  titular: string;
  checkIn: string;
  checkOut: string;
  situacao: SituacaoReserva;
  canal: string | null;
  valorTotal: number | null;
  valorPago: number | null;
  moeda: "BRL";
  adultos: number | null;
  criancas: number | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
};
export type QuartoMapa = { id: string; nome: string; slug: string; capacidade: number };
export type EstadoFonte = "aguardando_integracao" | "conectado";

export type DadosMapaReservas = {
  fonte: EstadoFonte;
  sistema: string;
  quartos: QuartoMapa[] | null;
  reservas: ReservaReal[];
  erroCatalogo: boolean;
  consultadoEm: string;
};

export async function carregarMapaReservas(): Promise<DadosMapaReservas> {
  // Somente catalogo interno de quartos. O banco local nao tem tabela
  // com reservas PMS; disponibilidade e leads nao identificam titulares.
  let quartos: QuartoMapa[] | null = null;
  try {
    quartos = await comSql((sql) => sql<QuartoMapa[]>`
      SELECT id::text AS id, nome, slug, ocupacao_max AS capacidade
      FROM quartos WHERE ativo = true ORDER BY ordem, nome
    `);
  } catch (e) {
    console.error("[reservas] nao foi possivel ler catalogo:", (e as Error).message);
  }
  return {
    fonte: "aguardando_integracao",
    sistema: "Desbravador ROL / Channel Manager (consulta autorizada pendente)",
    quartos,
    reservas: [], // Nao existe fonte validada de reservas confirmadas.
    erroCatalogo: quartos === null,
    consultadoEm: new Date().toISOString(),
  };
}
