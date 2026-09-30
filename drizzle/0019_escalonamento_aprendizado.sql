-- Escalonamento para a equipe e aprendizado contínuo da Marina (30/09/2026).
--
-- Só ACRESCENTA: cinco tabelas novas e uma coluna opcional em
-- chat_mensagens. Nenhuma linha existente muda e nenhum dado é apagado.
-- Fluxo completo: docs/fluxo-escalonamento.md.

-- ── equipe responsável: para quem a Marina pergunta ────────────────────
CREATE TABLE IF NOT EXISTS "equipe_contatos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  -- Só dígitos, com DDI (ex.: 5541999990000).
  "numero" text NOT NULL,
  -- Setores que a pessoa atende: ["reservas","financeiro",...]. "geral" = qualquer assunto.
  "setores" jsonb DEFAULT '["geral"]'::jsonb NOT NULL,
  -- Dias (0 = domingo) e horário, no fuso de São Paulo.
  "dias" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL,
  "hora_inicio" text DEFAULT '08:00' NOT NULL,
  "hora_fim" text DEFAULT '20:00' NOT NULL,
  "ordem" integer DEFAULT 0 NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "ultimo_teste_em" timestamp,
  "ultimo_teste_ok" boolean,
  "ultimo_teste_erro" text,
  "criado_em" timestamp DEFAULT now() NOT NULL,
  "atualizado_em" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ── configuração do escalonamento e do aprendizado (uma linha só) ──────
CREATE TABLE IF NOT EXISTS "marina_escalonamento_config" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "ativo" boolean DEFAULT false NOT NULL,
  -- Minutos contados a partir do aviso à equipe.
  "lembrete_min" integer DEFAULT 20 NOT NULL,
  "proximo_min" integer DEFAULT 45 NOT NULL,
  -- Minutos contados a partir da pergunta do cliente.
  "aviso_cliente_min" integer DEFAULT 30 NOT NULL,
  "desistir_min" integer DEFAULT 240 NOT NULL,
  -- "web" (WhatsApp ligado ao OpenClaw pelo aparelho, sem janela de 24h)
  -- ou "oficial" (API oficial da Meta: fora de 24h só com template).
  "whatsapp_modo" text DEFAULT 'web' NOT NULL,
  "template_cliente" text,
  "template_equipe" text,
  "template_idioma" text DEFAULT 'pt_BR' NOT NULL,
  -- "aprovacao" (padrão, só usa depois de aprovado) ou "automatico".
  "aprendizado_modo" text DEFAULT 'aprovacao' NOT NULL,
  "validade_dias" integer DEFAULT 30 NOT NULL,
  "atualizado_por" text,
  "atualizado_em" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "marina_escalonamento_config_um" CHECK ("id" = 1)
);--> statement-breakpoint

-- ── chamados: uma pergunta que foi para a equipe ───────────────────────
CREATE TABLE IF NOT EXISTS "marina_chamados" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Código curto que viaja na mensagem à equipe (ex.: K7Q2).
  "codigo" text NOT NULL,
  -- aguardando | respondido | entregue | expirado | cancelado
  "status" text DEFAULT 'aguardando' NOT NULL,
  -- whatsapp | site
  "canal" text NOT NULL,
  -- Para onde devolver: número do cliente (WhatsApp) ou sessão do chat do
  -- site. Apagado assim que o chamado fecha — não fica guardado.
  "destino" text,
  "pergunta" text NOT NULL,
  "contexto" text,
  "setor" text DEFAULT 'geral' NOT NULL,
  "categoria" text DEFAULT 'geral' NOT NULL,
  "contato_id" uuid REFERENCES "equipe_contatos"("id") ON DELETE SET NULL,
  -- [{contato_id, nome, em, ok, erro}] — cada pessoa avisada, em ordem.
  "tentativas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notificado_em" timestamp,
  "lembrete_em" timestamp,
  "cliente_avisado_em" timestamp,
  "resposta_equipe" text,
  "respondido_por" text,
  "respondido_em" timestamp,
  "resposta_final" text,
  "entregue_em" timestamp,
  "entrega_erro" text,
  "ultima_msg_cliente_em" timestamp DEFAULT now() NOT NULL,
  "aprendizado_id" uuid,
  "criado_em" timestamp DEFAULT now() NOT NULL,
  "atualizado_em" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_chamados_status_idx" ON "marina_chamados" ("status", "criado_em");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_chamados_codigo_idx" ON "marina_chamados" ("codigo");--> statement-breakpoint

-- ── base de aprendizado: o que a equipe respondeu vira conhecimento ────
CREATE TABLE IF NOT EXISTS "marina_aprendizado" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pergunta" text NOT NULL,
  -- Outras formas da mesma pergunta (agrupadas por significado).
  "variacoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "resposta" text NOT NULL,
  "categoria" text DEFAULT 'geral' NOT NULL,
  -- pendente | ativo | rejeitado | oficial
  "status" text DEFAULT 'pendente' NOT NULL,
  "revisado" boolean DEFAULT false NOT NULL,
  -- 0 a 1.
  "confianca" real DEFAULT 0.6 NOT NULL,
  -- chamado | painel
  "origem" text DEFAULT 'chamado' NOT NULL,
  "origem_canal" text,
  "chamado_id" uuid,
  "respondido_por" text,
  "usos" integer DEFAULT 0 NOT NULL,
  "ultimo_uso_em" timestamp,
  "valido_ate" date,
  -- Item manual parecido: o aprendido fica parado até alguém revisar.
  "conflito_id" uuid,
  -- Quando vira conhecimento oficial (marina_conhecimento).
  "conhecimento_id" uuid,
  "revisado_por" text,
  "revisado_em" timestamp,
  "criado_em" timestamp DEFAULT now() NOT NULL,
  "atualizado_em" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_aprendizado_status_idx" ON "marina_aprendizado" ("status");--> statement-breakpoint

-- ── eventos: para medir se ela está resolvendo sozinha ─────────────────
CREATE TABLE IF NOT EXISTS "marina_eventos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- aprendido_usado | escalada | lacuna | respondido
  "tipo" text NOT NULL,
  "canal" text,
  "categoria" text,
  "referencia" uuid,
  "valor" real,
  "criado_em" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marina_eventos_tipo_idx" ON "marina_eventos" ("tipo", "criado_em");--> statement-breakpoint

-- ── chat do site: a resposta da equipe chega depois, marcada ───────────
ALTER TABLE "chat_mensagens" ADD COLUMN IF NOT EXISTS "chamado_id" uuid;
