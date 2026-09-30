import type postgres from "postgres";
import { REGRAS_PADRAO, type Regras, type Adicional, type CobrancaBebe, type CobrancaAdicional } from "./regras-hospedagem-base";

export * from "./regras-hospedagem-base";

type Sql = ReturnType<typeof postgres>;

/**
 * Leitura das regras de hospedagem e dos adicionais (migration 0017).
 * Nunca derruba quem chamou: sem a tabela, valem os padrões — e o padrão é
 * "regra desligada", ou seja, o comportamento que o site tinha antes.
 */
export async function lerRegras(sql: Sql): Promise<Regras> {
  try {
    const [l] = await sql<{
      idade_colo_max: number | null; crianca_paga_como_adulto: boolean;
      bebe_cobranca: string; bebe_valor: string | null; observacao: string | null;
    }[]>`SELECT idade_colo_max, crianca_paga_como_adulto, bebe_cobranca, bebe_valor, observacao
         FROM regras_hospedagem WHERE id = 1`;
    if (!l) return REGRAS_PADRAO;
    return {
      idadeColoMax: l.idade_colo_max,
      criancaPagaComoAdulto: l.crianca_paga_como_adulto,
      bebeCobranca: (["gratis", "por_noite", "por_estadia"].includes(l.bebe_cobranca) ? l.bebe_cobranca : "gratis") as CobrancaBebe,
      bebeValor: l.bebe_valor === null ? null : Number(l.bebe_valor),
      observacao: l.observacao,
    };
  } catch {
    return REGRAS_PADRAO;
  }
}

export async function lerAdicionais(sql: Sql, soAtivos = true): Promise<Adicional[]> {
  try {
    const linhas = await sql<{
      id: string; nome: string; descricao: string | null; preco: string | null; cobranca: string;
      categoria: string; precisa_pedir: boolean; visivel_site: boolean; visivel_marina: boolean; ativo: boolean;
    }[]>`SELECT id, nome, descricao, preco, cobranca, categoria, precisa_pedir, visivel_site, visivel_marina, ativo
         FROM adicionais ${soAtivos ? sql`WHERE ativo = true` : sql``}
         ORDER BY ordem ASC, criado_em ASC`;
    return linhas.map((l) => ({
      id: l.id, nome: l.nome, descricao: l.descricao,
      preco: l.preco === null ? null : Number(l.preco),
      cobranca: l.cobranca as CobrancaAdicional, categoria: l.categoria,
      precisaPedir: l.precisa_pedir, visivelSite: l.visivel_site, visivelMarina: l.visivel_marina, ativo: l.ativo,
    }));
  } catch {
    return [];
  }
}
