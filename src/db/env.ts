/**
 * Carregamento de ambiente para os scripts de banco.
 *
 * `import "dotenv/config"` carrega `.env` — e este projeto guarda tudo em
 * `.env.local`. Sem isto, DATABASE_URL fica undefined, o postgres.js tenta
 * localhost e o erro que aparece nao diz nada util (no Windows chega a
 * derrubar o processo com uma assercao do libuv).
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";

for (const arquivo of [".env.local", ".env"]) {
  if (existsSync(arquivo)) config({ path: arquivo, override: false, quiet: true });
}

export function urlDoBanco(): string {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error("\n❌ DATABASE_URL não encontrada.");
    console.error("   Esperado em .env.local na raiz do projeto.");
    console.error("   Se estiver na Vercel, traga com: npx vercel env pull .env.local\n");
    process.exit(1);
  }
  return url;
}

/** Fecha a conexao antes de sair: evita o crash do libuv no Windows. */
export async function sair(sql: { end: () => Promise<void> }, codigo = 0): Promise<never> {
  try { await sql.end(); } catch { /* ja fechada */ }
  process.exit(codigo);
}

/** Erro legivel — PostgresError util fica em `.detail`/`.hint`, nao em `.message`. */
export function explicarErro(e: any): string {
  const partes = [
    e?.message,
    e?.detail && `detalhe: ${e.detail}`,
    e?.hint && `dica: ${e.hint}`,
    e?.code && `código: ${e.code}`,
    e?.cause?.message && `causa: ${e.cause.message}`,
  ].filter(Boolean);
  return partes.length ? partes.join(" | ") : String(e);
}
