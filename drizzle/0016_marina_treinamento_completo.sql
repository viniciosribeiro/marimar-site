-- Treinamento da Marina, versao completa (30/09/2026).
--
-- So ACRESCENTA: nenhuma coluna existente muda de nome ou de tipo, nenhuma
-- linha e apagada. O que ja foi ensinado continua valendo do jeito que esta,
-- e o codigo antigo (se alguem voltar o deploy) continua funcionando sobre
-- estas tabelas.

-- ── Conhecimento: categoria, variacoes, verificacao e lixeira ──────────────
-- `tipo` passa a aceitar tambem 'pergunta' (P&R com variacoes) e 'escalar'
-- (quando passar para uma pessoa). Continua text, sem enum, de proposito:
-- tipo novo nao pode exigir migration.
ALTER TABLE "marina_conhecimento" ADD COLUMN IF NOT EXISTS "categoria"      text NOT NULL DEFAULT 'geral';--> statement-breakpoint
ALTER TABLE "marina_conhecimento" ADD COLUMN IF NOT EXISTS "variacoes"      jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
-- Ultimo teste automatico do item: 'ok' | 'falhou' | null (nunca testado).
ALTER TABLE "marina_conhecimento" ADD COLUMN IF NOT EXISTS "verificacao"    text;--> statement-breakpoint
ALTER TABLE "marina_conhecimento" ADD COLUMN IF NOT EXISTS "verificado_em"  timestamp;--> statement-breakpoint
ALTER TABLE "marina_conhecimento" ADD COLUMN IF NOT EXISTS "verificacao_resposta" text;--> statement-breakpoint
-- Excluir manda para a lixeira; so a lixeira apaga de vez.
ALTER TABLE "marina_conhecimento" ADD COLUMN IF NOT EXISTS "excluido_em"    timestamp;--> statement-breakpoint
ALTER TABLE "marina_conhecimento" ADD COLUMN IF NOT EXISTS "atualizado_por" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_conhecimento_categoria_idx"
  ON "marina_conhecimento" ("categoria", "ativo");--> statement-breakpoint

-- ── Historico: toda mudanca guarda o antes e o depois ─────────────────────
-- E o que permite "voltar para a versao de ontem" sem ninguem lembrar o
-- texto exato. `antes`/`depois` sao a linha inteira em jsonb.
CREATE TABLE IF NOT EXISTS "marina_historico" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conhecimento_id" uuid NOT NULL,
  "acao"            text NOT NULL,
  "antes"           jsonb,
  "depois"          jsonb,
  "autor"           text,
  "criado_em"       timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_historico_item_idx"
  ON "marina_historico" ("conhecimento_id", "criado_em");--> statement-breakpoint

-- ── Leituras: quando cada canal leu o treinamento pela ultima vez ─────────
-- O treinamento nao e "empurrado" para a Marina: ela le a cada conversa.
-- Esta tabela e o que deixa o painel dizer, item por item, se a versao
-- atual ja foi lida pelo WhatsApp e pelo site — ou se ainda esta esperando.
CREATE TABLE IF NOT EXISTS "marina_leituras" (
  "canal"    text PRIMARY KEY,
  "lido_em"  timestamp NOT NULL DEFAULT now(),
  "itens"    integer NOT NULL DEFAULT 0,
  "caracteres" integer NOT NULL DEFAULT 0
);--> statement-breakpoint

-- ── Lacunas: perguntas que ela nao soube responder ────────────────────────
CREATE TABLE IF NOT EXISTS "marina_lacunas" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pergunta"        text NOT NULL,
  "resposta"        text,
  "canal"           text NOT NULL DEFAULT 'site',
  "sessao"          text,
  -- 'aberta' | 'resolvida' | 'ignorada'
  "status"          text NOT NULL DEFAULT 'aberta',
  "conhecimento_id" uuid,
  "criado_em"       timestamp NOT NULL DEFAULT now(),
  "resolvido_em"    timestamp
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_lacunas_status_idx"
  ON "marina_lacunas" ("status", "criado_em");--> statement-breakpoint

-- ── Configuracao: quando e como passar para uma pessoa ────────────────────
ALTER TABLE "marina_config" ADD COLUMN IF NOT EXISTS "escalonamento" text;--> statement-breakpoint

-- ── Documentos: categoria, falha visivel e reprocessamento ────────────────
ALTER TABLE "marina_documentos" ADD COLUMN IF NOT EXISTS "categoria"     text NOT NULL DEFAULT 'geral';--> statement-breakpoint
ALTER TABLE "marina_documentos" ADD COLUMN IF NOT EXISTS "processado_em" timestamp;--> statement-breakpoint
ALTER TABLE "marina_documentos" ADD COLUMN IF NOT EXISTS "tentativas"    integer NOT NULL DEFAULT 1;--> statement-breakpoint
UPDATE "marina_documentos" SET "processado_em" = "criado_em" WHERE "processado_em" IS NULL AND "status" = 'pronto';--> statement-breakpoint

-- ── Conversas: marcar respostas usadas como lacuna ────────────────────────
ALTER TABLE "chat_mensagens" ADD COLUMN IF NOT EXISTS "sem_resposta" boolean NOT NULL DEFAULT false;
