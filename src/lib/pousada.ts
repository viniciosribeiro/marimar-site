import { cache } from "react";
import postgres from "postgres";

/**
 * A linha da tabela `pousada`, uma vez por requisicao.
 *
 * Cada pagina do site pedia esta mesma linha tres vezes — generateMetadata,
 * layout raiz e layout do site —, cada uma abrindo uma conexao nova com o
 * Neon (o custo de conexao+TLS e maior que o da consulta). O `cache` do React
 * guarda o resultado so durante a renderizacao de UMA requisicao: nada fica
 * velho entre visitas, e o que o admin salva aparece na visita seguinte.
 *
 * `to_jsonb` evita nomear colunas: funciona antes e depois de qualquer
 * migration que acrescente campo na tabela. Falha vira null — quem chama
 * decide o fallback, porque o site nao pode cair por causa do banco.
 */
export const lerPousada = cache(async (): Promise<Record<string, any> | null> => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
  try {
    const [row] = await sql`SELECT to_jsonb(p) AS dados FROM pousada p LIMIT 1`;
    return (row?.dados as Record<string, any>) ?? null;
  } catch (e) {
    console.error("[pousada] banco indisponivel:", (e as Error).message);
    return null;
  } finally {
    await sql.end().catch(() => {});
  }
});
