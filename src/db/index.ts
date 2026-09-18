import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * prepare: false — obrigatorio aqui, por dois motivos:
 *
 * 1. DATABASE_URL aponta para o POOLER do Neon (host com "-pooler"), que e
 *    PgBouncer em modo transaction. Prepared statements nao sobrevivem a
 *    troca de conexao do pooler.
 *
 * 2. Com plano em cache, qualquer migration que mude o formato de uma tabela
 *    quebra as conexoes ja abertas com "cached plan must not change result
 *    type" — foi o que aconteceu em 18/09/2026 logo apos adicionar a coluna
 *    `pousada.tema`: o dev server ficou em erro ate reiniciar.
 *
 * Todas as chamadas postgres() do projeto seguem o mesmo padrao.
 */
const client = postgres(process.env.DATABASE_URL!, { max: 10, prepare: false });
export const db = drizzle(client, { schema });
export * from "./schema";