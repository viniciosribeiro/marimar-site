CREATE TABLE IF NOT EXISTS "cardapio_categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"descricao" text,
	"icone" varchar(16),
	"horario" varchar(60),
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cardapio_categorias_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cardapio_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria_id" uuid NOT NULL,
	"nome" varchar(180) NOT NULL,
	"descricao" text,
	"preco" numeric(10, 2),
	"preco_promocional" numeric(10, 2),
	"porcao" varchar(80),
	"foto_url" text,
	"marcadores" jsonb DEFAULT '[]'::jsonb,
	"destaque" boolean DEFAULT false NOT NULL,
	"disponivel" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cardapio_itens" ADD CONSTRAINT "cardapio_itens_categoria_id_fk"
   FOREIGN KEY ("categoria_id") REFERENCES "public"."cardapio_categorias"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cardapio_itens_categoria" ON "cardapio_itens" USING btree ("categoria_id");
