-- Biblioteca de mídia (fotos e vídeos) e roteiros de orientação da Marina
-- (30/09/2026).
--
-- So ACRESCENTA. Nenhuma linha existente muda: toda foto que ja existe
-- continua tipo 'foto', na mesma secao, com a mesma ordem e capa. As
-- colunas novas nascem vazias e as telas antigas continuam funcionando.

-- ── midias: o que um video (e uma foto bem cuidada) precisa ─────────────
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "titulo"            text;--> statement-breakpoint
-- Legenda visivel (o `alt` continua sendo o texto para leitor de tela).
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "descricao"         text;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "thumb_url"         text;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "thumb_pathname"    text;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "duracao_seg"       real;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "bytes"             bigint;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "formato"           text;--> statement-breakpoint
-- Versao para o WhatsApp: MP4 H.264/AAC de ate 16 MB. Nula quando o
-- arquivo principal ja cabe, ou quando o aparelho nao gerou H.264.
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "url_whatsapp"      text;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "pathname_whatsapp" text;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "bytes_whatsapp"    bigint;--> statement-breakpoint
-- A Marina pode enviar esta midia.
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "visivel_marina"    boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "atualizado_em"     timestamp NOT NULL DEFAULT now();--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "midias_tipo_idx" ON "midias" ("tipo", "secao", "ordem");--> statement-breakpoint

-- ── roteiros de orientacao ────────────────────────────────────────────
-- "Como chegar na pousada", "Trapiche de Pontal do Sul"... Cada roteiro e
-- uma sequencia de etapas (video, foto opcional, texto) que a Marina envia
-- em ordem quando a conversa bate com um dos gatilhos.
CREATE TABLE IF NOT EXISTS "marina_roteiros" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "titulo"        text NOT NULL,
  "descricao"     text,
  -- Palavras e frases que disparam o roteiro: ["estacionamento", "onde deixo o carro"]
  "gatilhos"      jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ativo"         boolean NOT NULL DEFAULT true,
  "ordem"         integer NOT NULL DEFAULT 0,
  "atualizado_por" text,
  "criado_em"     timestamp NOT NULL DEFAULT now(),
  "atualizado_em" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marina_roteiro_etapas" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "roteiro_id" uuid NOT NULL REFERENCES "marina_roteiros"("id") ON DELETE CASCADE,
  "ordem"      integer NOT NULL DEFAULT 0,
  "titulo"     text NOT NULL,
  "texto"      text,
  -- A midia mora na biblioteca (tabela midias). Apagar a midia nao apaga a etapa.
  "video_id"   uuid REFERENCES "midias"("id") ON DELETE SET NULL,
  "foto_id"    uuid REFERENCES "midias"("id") ON DELETE SET NULL,
  "ativo"      boolean NOT NULL DEFAULT true,
  "criado_em"  timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_roteiro_etapas_idx" ON "marina_roteiro_etapas" ("roteiro_id", "ordem");
