import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

/**
 * A migration 0022 (midias.origem, midias.url_origem) aplicada pelo próprio
 * site, na primeira vez em que alguma coisa precisa dessas colunas.
 *
 * Existe porque rodar `npm run db:migrate` exige a pasta do projeto num
 * computador com acesso ao banco — e em 04/11/2026 o proprietário não tinha
 * isso à mão. Como a 0022 só ACRESCENTA (coluna com valor padrão, índice e
 * uma marcação nas fotos que já eram do Desbravador), é seguro o site
 * aplicá-la sozinho: rodar duas vezes não muda nada (`IF NOT EXISTS`), e o
 * `db:migrate` feito depois passa por ela sem erro pelo mesmo motivo.
 *
 * Não é um mecanismo geral de migrations: migration que altera ou remove
 * dado continua exigindo decisão humana e `db:migrate`.
 */
const SQL_0022 = [
  `ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "origem" text NOT NULL DEFAULT 'painel'`,
  `UPDATE "midias" SET "origem" = 'desbravador'
   WHERE "origem" = 'painel' AND "tipo" = 'foto' AND "url" LIKE 'https://reservas.desbravador.com.br/reservas/images/hoteis/%'`,
  `CREATE INDEX IF NOT EXISTS "midias_origem_idx" ON "midias" ("origem")`,
  `ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "url_origem" text`,
];

/* Uma conferência por processo: depois disso a pergunta ao banco não se repete. */
let garantido = false;

export async function colunasDaMigration0022(sql: Sql): Promise<boolean> {
  const linhas = await sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'midias' AND column_name IN ('origem', 'url_origem')`;
  return linhas.length === 2;
}

/** Garante as colunas da 0022; devolve true se precisou aplicá-las agora. */
export async function garantirEsquemaMidias(sql: Sql): Promise<boolean> {
  if (garantido) return false;
  if (await colunasDaMigration0022(sql)) { garantido = true; return false; }
  for (const comando of SQL_0022) await sql.unsafe(comando);
  garantido = true;
  console.info("[midias] migration 0022 aplicada pelo site (colunas origem e url_origem).");
  return true;
}
