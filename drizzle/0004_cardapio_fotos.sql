CREATE TABLE IF NOT EXISTS "cardapio_fotos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"alt" text,
	"largura" integer,
	"altura" integer,
	"bytes" integer,
	"capa" boolean DEFAULT false NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cardapio_fotos" ADD CONSTRAINT "cardapio_fotos_item_id_fk"
   FOREIGN KEY ("item_id") REFERENCES "public"."cardapio_itens"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cardapio_fotos_item" ON "cardapio_fotos" USING btree ("item_id");
