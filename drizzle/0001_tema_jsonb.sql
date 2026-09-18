-- Configuracoes do editor visual que nao merecem coluna propria.
-- Idempotente de proposito: escrita a mao (drizzle-kit nao roda na VM Linux
-- desta sessao — o esbuild do node_modules e binario de Windows).
ALTER TABLE "pousada" ADD COLUMN IF NOT EXISTS "tema" jsonb DEFAULT '{}'::jsonb;
