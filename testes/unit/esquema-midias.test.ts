import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { colunasDaMigration0022, garantirEsquemaMidias } from "../../src/lib/esquema-midias";

/* Precisa de um banco LOCAL com as migrations até a 0021 ou mais. Sem
   DATABASE_URL local, o teste é pulado (o `npm test` normal não tem banco). */
const url = process.env.DATABASE_URL ?? "";
const local = /localhost|127\.0\.0\.1/.test(url);

test("migration 0022 aplicada pelo site: cria as colunas, marca as fotos do motor e nao repete", { skip: !local && "sem DATABASE_URL local" }, async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`DELETE FROM midias WHERE alt = 'foto antiga do motor (teste 0022)'`;
    await sql`ALTER TABLE midias DROP COLUMN IF EXISTS url_origem`;
    await sql`ALTER TABLE midias DROP COLUMN IF EXISTS origem`;
    assert.equal(await colunasDaMigration0022(sql), false);
    /* Uma foto que a rotina antiga (02/11) trouxe do Desbravador, sem marca. */
    await sql`INSERT INTO midias (url, alt, tipo, secao, ordem)
      VALUES ('https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_TESTE_1.jpg', 'foto antiga do motor (teste 0022)', 'foto', 'quarto', 99)`;

    assert.equal(await garantirEsquemaMidias(sql), true, "primeira vez: aplica");
    assert.equal(await colunasDaMigration0022(sql), true);
    const [m] = await sql<{ origem: string; url_origem: string | null }[]>`
      SELECT origem, url_origem FROM midias WHERE alt = 'foto antiga do motor (teste 0022)'`;
    assert.equal(m.origem, "desbravador", "foto antiga do motor ganha a marca certa");
    assert.equal(m.url_origem, null);
    const [{ n }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM midias WHERE origem = 'painel'`;
    assert.ok(n >= 0);

    assert.equal(await garantirEsquemaMidias(sql), false, "segunda vez: nada a fazer");
    await sql`DELETE FROM midias WHERE alt = 'foto antiga do motor (teste 0022)'`;
  } finally {
    await sql.end();
  }
});
