import type { Sql } from "./db-conexao";

/**
 * Tabela da sessão de voz do treinamento (`marina_voz_sessao`), aplicada
 * pelo PRÓPRIO site na primeira vez que o modo voz é usado — mesmo caminho
 * da migration 0022 (`esquema-midias.ts`): o proprietário não precisa abrir
 * a pasta do projeto nem rodar `db:migrate`.
 *
 * Só CRIA (nunca altera nem apaga), então rodar duas vezes não muda nada
 * (`IF NOT EXISTS`) e um `db:migrate` feito depois passa por ela sem erro.
 *
 * Guarda a conversa falada (para a pessoa reler sem o chat), o que foi
 * ensinado/alterado na sessão e quanto de voz custou (caracteres falados e
 * segundos ouvidos) — a base do teto de gasto do mês. NÃO guarda áudio.
 */
const SQL_VOZ = [
  `CREATE TABLE IF NOT EXISTS "marina_voz_sessao" (
     "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     "autor"          text,
     "transcricao"    jsonb NOT NULL DEFAULT '[]'::jsonb,
     "acoes"          jsonb NOT NULL DEFAULT '[]'::jsonb,
     "tts_caracteres" integer NOT NULL DEFAULT 0,
     "stt_segundos"   integer NOT NULL DEFAULT 0,
     "criado_em"      timestamp NOT NULL DEFAULT now(),
     "atualizado_em"  timestamp NOT NULL DEFAULT now(),
     "encerrado_em"   timestamp
   )`,
  `CREATE INDEX IF NOT EXISTS "marina_voz_sessao_criado_idx" ON "marina_voz_sessao" ("criado_em")`,
  /* 18/11 (parte 9): o desfazer/refazer das ações por voz. Cada linha é uma
     ação com a foto de antes e de depois de cada registro que ela mexeu. */
  `CREATE TABLE IF NOT EXISTS "marina_voz_desfazer" (
     "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     "sessao"    uuid,
     "autor"     text NOT NULL,
     "nome"      text NOT NULL,
     "resumo"    text NOT NULL,
     "mudancas"  jsonb NOT NULL DEFAULT '[]'::jsonb,
     "estado"    text NOT NULL DEFAULT 'feita',
     "criado_em" timestamp NOT NULL DEFAULT now(),
     "mudado_em" timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS "marina_voz_desfazer_autor_idx" ON "marina_voz_desfazer" ("autor", "estado", "criado_em")`,
];

let garantido = false;

export async function garantirEsquemaVoz(sql: Sql): Promise<void> {
  if (garantido) return;
  /* As DUAS tabelas: em produção a da sessão já existia antes do desfazer. */
  const [t] = await sql<{ existe: boolean }[]>`
    SELECT to_regclass('public.marina_voz_sessao') IS NOT NULL
       AND to_regclass('public.marina_voz_desfazer') IS NOT NULL AS existe`;
  if (t?.existe) { garantido = true; return; }
  for (const comando of SQL_VOZ) await sql.unsafe(comando);
  garantido = true;
  console.info("[voz-treino] tabelas do modo voz criadas/conferidas pelo site.");
}
