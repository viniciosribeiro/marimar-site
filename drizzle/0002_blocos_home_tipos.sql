-- Novos tipos de secao da home, criados no redesign de 18/09/2026.
-- IF NOT EXISTS para a migration poder rodar mais de uma vez sem erro.
ALTER TYPE "tipo_bloco" ADD VALUE IF NOT EXISTS 'complexo';--> statement-breakpoint
ALTER TYPE "tipo_bloco" ADD VALUE IF NOT EXISTS 'diferenciais';--> statement-breakpoint
ALTER TYPE "tipo_bloco" ADD VALUE IF NOT EXISTS 'restaurante';--> statement-breakpoint
ALTER TYPE "tipo_bloco" ADD VALUE IF NOT EXISTS 'avaliacoes';
