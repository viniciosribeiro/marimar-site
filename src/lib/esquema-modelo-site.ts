import type { Sql } from "@/lib/db-conexao";

/**
 * A migration 0023 (pousada.modelo_site) aplicada pelo próprio site, na
 * primeira vez em que alguém troca o modelo em Site → Modelo do site.
 *
 * Mesmo motivo da 0022 (esquema-midias.ts): o proprietário não roda
 * `npm run db:migrate`. A 0023 só ACRESCENTA uma coluna vazia; ler o site
 * antes dela existir dá o modelo Clássico (a coluna ausente = Clássico).
 */
let garantido = false;

export async function garantirColunaModeloSite(sql: Sql): Promise<void> {
  if (garantido) return;
  await sql.unsafe(`ALTER TABLE "pousada" ADD COLUMN IF NOT EXISTS "modelo_site" jsonb`);
  garantido = true;
}
