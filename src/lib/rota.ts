import type { Sql } from "./db-conexao";
import { mesclarRota, type RotaConfig } from "./rota-base";

/**
 * Configuração da rota até a pousada, guardada em `conteudo_editavel`
 * (chave "rota") — a mesma tabela de chave/valor da travessia e da ilha,
 * sem migration. O que não estiver salvo vem de ROTA_PADRAO.
 * Painel: /admin/rota. Fluxo: docs/fluxo-rota.md.
 */
export async function lerRota(sql: Sql): Promise<RotaConfig> {
  try {
    const [l] = await sql<{ dados: unknown }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'rota'`;
    return mesclarRota(l?.dados);
  } catch {
    return mesclarRota(null);
  }
}

export async function salvarRotaNoBanco(sql: Sql, c: RotaConfig) {
  await sql`
    INSERT INTO conteudo_editavel (chave, dados, atualizado_em) VALUES ('rota', ${sql.json(c as never)}, now())
    ON CONFLICT (chave) DO UPDATE SET dados = excluded.dados, atualizado_em = now()`;
}
