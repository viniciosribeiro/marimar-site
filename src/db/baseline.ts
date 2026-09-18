/**
 * Marca migrations já refletidas no banco como aplicadas, sem executá-las.
 *
 * POR QUE ISTO EXISTE
 * O banco foi criado com `drizzle-kit push`, que aplica o schema direto e NÃO
 * registra nada em `drizzle.__drizzle_migrations`. Quando o projeto passou a
 * usar `db:migrate`, o migrator viu zero migrations registradas e tentou rodar
 * a 0000 do zero — falhando em `CREATE TYPE "escopo_comodidade"`, que já existe.
 *
 * Este script registra a 0000 como aplicada (depois de CONFERIR que o schema
 * realmente está lá) e deixa as seguintes para o `db:migrate` normal.
 *
 * Seguro: não cria, não altera e não apaga nenhuma tabela. Só escreve na
 * tabela de controle do drizzle. Rodar duas vezes não faz nada na segunda.
 *
 *   npm run db:baseline
 */
import { urlDoBanco, sair, explicarErro } from "./env";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Entrada = { idx: number; when: number; tag: string };

/**
 * Mesmo hash que o drizzle usa: sha256 do conteúdo bruto do arquivo .sql.
 *
 * Detalhe importante: o migrator do drizzle NÃO compara hash para decidir o
 * que rodar — ele lê o `created_at` mais recente da tabela de controle e
 * aplica toda migration cujo `when` (do journal) seja maior. O hash é
 * gravado por consistência; quem decide é o timestamp. Por isso o baseline
 * precisa registrar a 0000 com o `when` dela, e não com a hora de agora:
 * gravar "agora" faria o drizzle pular a 0001 e a 0002.
 */
function hashDaMigration(tag: string): string {
  const sql = readFileSync(join("drizzle", `${tag}.sql`), "utf-8");
  return createHash("sha256").update(sql).digest("hex");
}

// Guardado fora de main() para o catch conseguir fechar a conexao antes de
// sair. Encerrar o processo com a conexao aberta derruba o Node no Windows
// com: Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) em async.c
let clienteAberto: { end: () => Promise<void> } | null = null;

async function main() {
  const sql = postgres(urlDoBanco(), { max: 1 });
  clienteAberto = sql;
  console.log("→ Conectando...\n");

  const journal = JSON.parse(readFileSync(join("drizzle", "meta", "_journal.json"), "utf-8"));
  const entradas: Entrada[] = journal.entries;

  // O schema realmente existe? Não faz sentido dar baseline num banco vazio.
  const [t] = await sql`
    SELECT count(*)::int AS c FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('pousada','quartos','midias','usuarios')
  `;
  if ((t as any).c < 4) {
    console.error("❌ O schema base não está no banco (faltam tabelas principais).");
    console.error("   Este banco precisa de `npm run db:migrate` de verdade, não de baseline.\n");
    await sair(sql, 1);
  }
  console.log("✅ Schema base confirmado no banco\n");

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const registradas = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const jaTem = new Set(registradas.map((r: any) => r.hash as string));

  // Só a 0000 recebe baseline: ela é o schema que o push já aplicou.
  // As demais (0001, 0002...) devem rodar de verdade pelo db:migrate.
  const base = entradas.find((e) => e.idx === 0);
  if (!base) {
    console.error("❌ Não encontrei a migration 0000 no journal.");
    await sair(sql, 1);
  }

  const h = hashDaMigration(base!.tag);
  if (jaTem.has(h)) {
    console.log(`• ${base!.tag} já estava registrada — nada a fazer`);
  } else {
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${h}, ${base!.when})`;
    console.log(`✅ ${base!.tag} registrada como aplicada (sem executar)`);
  }

  const pendentes = entradas.filter((e) => e.idx > 0 && !jaTem.has(hashDaMigration(e.tag)));
  console.log(
    pendentes.length > 0
      ? `\n${pendentes.length} migration(s) pendente(s): ${pendentes.map((e) => e.tag).join(", ")}`
      : "\nNenhuma migration pendente."
  );
  console.log("\nAgora rode:  npm run db:migrate\n");

  await sair(sql, 0);
}

main().catch(async (e) => {
  console.error("\n❌ Falhou:", explicarErro(e));
  if (clienteAberto) { try { await clienteAberto.end(); } catch { /* ignora */ } }
  process.exit(1);
});
