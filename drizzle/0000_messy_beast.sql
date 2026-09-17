CREATE TYPE "public"."escopo_comodidade" AS ENUM('pousada', 'quarto');--> statement-breakpoint
CREATE TYPE "public"."origem_lead" AS ENUM('site', 'whatsapp', 'agente');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('master', 'editor');--> statement-breakpoint
CREATE TYPE "public"."tipo_bloco" AS ENUM('hero', 'sobre', 'quartos', 'galeria', 'pacotes', 'passeios', 'depoimentos', 'mapa', 'cta', 'faq');--> statement-breakpoint
CREATE TYPE "public"."tipo_midia" AS ENUM('foto', 'video');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"acao" varchar(100) NOT NULL,
	"entidade" varchar(100) NOT NULL,
	"entidade_id" varchar(100),
	"diff" jsonb,
	"ip" varchar(45),
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocos_home" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_bloco" NOT NULL,
	"titulo" varchar(255),
	"subtitulo" text,
	"conteudo" jsonb,
	"imagem_url" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cache_tarifas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"expira_em" timestamp NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cache_tarifas_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"descricao" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comodidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"icone" varchar(100) DEFAULT 'check',
	"escopo" "escopo_comodidade" DEFAULT 'quarto' NOT NULL,
	"nome_motor" varchar(255),
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comodidades_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "depoimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"autor" varchar(255) NOT NULL,
	"origem" varchar(100),
	"nota" integer DEFAULT 5 NOT NULL,
	"texto" text NOT NULL,
	"data" timestamp DEFAULT now(),
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pergunta" text NOT NULL,
	"resposta" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"visivel_agente" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" varchar(100) NOT NULL,
	"valor" text,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integracoes_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"telefone" varchar(20),
	"email" varchar(255),
	"check_in" timestamp,
	"check_out" timestamp,
	"adultos" integer DEFAULT 1,
	"criancas" integer DEFAULT 0,
	"mensagem" text,
	"origem" "origem_lead" DEFAULT 'site' NOT NULL,
	"lido" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "midias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quarto_id" uuid,
	"url" text NOT NULL,
	"key_r2" text,
	"alt" text NOT NULL,
	"tipo" "tipo_midia" DEFAULT 'foto' NOT NULL,
	"largura" integer,
	"altura" integer,
	"ordem" integer DEFAULT 0 NOT NULL,
	"destaque" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pacotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"descricao" text,
	"inclusos" jsonb DEFAULT '[]'::jsonb,
	"vigencia_inicio" timestamp,
	"vigencia_fim" timestamp,
	"diaria_minima" integer DEFAULT 1 NOT NULL,
	"imagem_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pacotes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "passeios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"descricao" text,
	"duracao" varchar(50),
	"preco_referencia" double precision,
	"imagem_url" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diaria_minima_padrao" integer DEFAULT 1 NOT NULL,
	"faixas_crianca" jsonb DEFAULT '[]'::jsonb,
	"check_in" varchar(10) DEFAULT '14:00',
	"check_out" varchar(10) DEFAULT '12:00',
	"cancelamento" text,
	"pet" boolean DEFAULT false,
	"pet_texto" text,
	"formas_pagamento" jsonb DEFAULT '[]'::jsonb,
	"regras_gerais" text,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pousada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"descricao_curta" text,
	"descricao_longa" text,
	"cnpj" varchar(18),
	"endereco" text,
	"cidade" varchar(100),
	"uf" varchar(2),
	"cep" varchar(9),
	"lat" double precision,
	"lng" double precision,
	"telefone" varchar(20),
	"whatsapp" varchar(20),
	"email" varchar(255),
	"instagram" varchar(255),
	"facebook" varchar(255),
	"como_chegar" text,
	"horario_recepcao" varchar(50),
	"logo_url" text,
	"favicon_url" text,
	"cor_primaria" varchar(7) DEFAULT '#0D9488',
	"cor_secundaria" varchar(7) DEFAULT '#0EA5E9',
	"fonte_titulo" varchar(100),
	"fonte_corpo" varchar(100),
	"seo_title" text,
	"seo_description" text,
	"og_image_url" text,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pousada_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pousada_comodidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comodidade_id" uuid NOT NULL,
	CONSTRAINT "pousada_comodidades_comodidade_id_unique" UNIQUE("comodidade_id")
);
--> statement-breakpoint
CREATE TABLE "quarto_comodidades" (
	"quarto_id" uuid NOT NULL,
	"comodidade_id" uuid NOT NULL,
	CONSTRAINT "quarto_comodidades_quarto_id_comodidade_id_pk" PRIMARY KEY("quarto_id","comodidade_id")
);
--> statement-breakpoint
CREATE TABLE "quartos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria_id" uuid,
	"nome" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"descricao" text,
	"descricao_motor" text,
	"cama" varchar(255),
	"metragem" integer,
	"vista" varchar(255),
	"capacidade_adultos" integer DEFAULT 2 NOT NULL,
	"capacidade_criancas" integer DEFAULT 0 NOT NULL,
	"ocupacao_max" integer DEFAULT 2 NOT NULL,
	"diaria_minima" integer DEFAULT 1 NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"desbravador_room_id" varchar(20),
	"destaque" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quartos_slug_unique" UNIQUE("slug"),
	CONSTRAINT "quartos_desbravador_room_id_unique" UNIQUE("desbravador_room_id")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"nome" varchar(255) NOT NULL,
	"senha_hash" varchar(255) NOT NULL,
	"papel" "papel" DEFAULT 'editor' NOT NULL,
	"must_reset" boolean DEFAULT true NOT NULL,
	"ultimo_login" timestamp,
	"tentativas_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "midias" ADD CONSTRAINT "midias_quarto_id_quartos_id_fk" FOREIGN KEY ("quarto_id") REFERENCES "public"."quartos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pousada_comodidades" ADD CONSTRAINT "pousada_comodidades_comodidade_id_comodidades_id_fk" FOREIGN KEY ("comodidade_id") REFERENCES "public"."comodidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarto_comodidades" ADD CONSTRAINT "quarto_comodidades_quarto_id_quartos_id_fk" FOREIGN KEY ("quarto_id") REFERENCES "public"."quartos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarto_comodidades" ADD CONSTRAINT "quarto_comodidades_comodidade_id_comodidades_id_fk" FOREIGN KEY ("comodidade_id") REFERENCES "public"."comodidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quartos" ADD CONSTRAINT "quartos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cache_tarifas_chave" ON "cache_tarifas" USING btree ("chave");--> statement-breakpoint
CREATE INDEX "idx_cache_tarifas_expira" ON "cache_tarifas" USING btree ("expira_em");