import postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;

/**
 * Abre uma conexao, executa e fecha — inclusive quando a consulta falha.
 *
 * O padrao do projeto e `postgres(...)` + `await sql.end()` no fim. Quando a
 * consulta lancava erro, o `end()` nunca rodava e a conexao ficava aberta
 * ate a funcao serverless morrer, gastando o limite de conexoes do Neon.
 */
export async function comSql<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  try {
    return await fn(sql);
  } finally {
    await sql.end().catch(() => {});
  }
}
