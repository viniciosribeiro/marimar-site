-- 04/11/2026 — sincronização de fotos com o Desbravador (docs/fluxo-fotos-desbravador.md).
-- Marca de onde cada mídia veio: 'painel' (enviada pela pousada) ou 'desbravador'
-- (trazida do motor pela sincronização). Só as do motor podem ser removidas
-- automaticamente quando somem de lá; as do painel nunca são tocadas.
-- Só ADICIONA uma coluna; nada do que existe muda de valor ou de lugar.
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "origem" text NOT NULL DEFAULT 'painel';--> statement-breakpoint
-- Fotos que a rotina de 02/11 já trouxe do motor (apontam para o servidor do
-- Desbravador e só podem ter vindo dela) ganham a marca certa.
UPDATE "midias" SET "origem" = 'desbravador'
WHERE "origem" = 'painel' AND "tipo" = 'foto' AND "url" LIKE 'https://reservas.desbravador.com.br/reservas/images/hoteis/%';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "midias_origem_idx" ON "midias" ("origem");
--> statement-breakpoint
-- URL original no Desbravador quando a foto foi espelhada no nosso storage
-- (a `url` passa a ser a cópia). É por ela que a sincronização reconhece a foto.
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "url_origem" text;
