-- A Pousada Marimar e a protagonista; o restaurante e dela (28/09/2026).
--
-- So troca o que ainda esta com o texto PADRAO antigo. Se alguem ja editou
-- o titulo ou a descricao pelo painel, a escolha dela vale mais que a nossa.
--
-- O titulo vira NULL (e nao o texto novo) para o site usar o padrao do
-- codigo, em src/components/site/BlocosHome.tsx: assim uma proxima mudanca
-- de texto nao precisa de outra migration.
UPDATE "blocos_home" SET "titulo" = NULL
WHERE "tipo" = 'complexo' AND "titulo" = 'Um complexo, duas partes';
--> statement-breakpoint
UPDATE "pousada"
SET "descricao_curta" = 'A Pousada Marimar fica em Encantadas, a poucos passos do trapiche, e tem restaurante próprio pé na areia: o Marimar Café Bistrô Bar, de frente para o mar.'
WHERE "descricao_curta" = 'O Marimar Café Bistrô Bar fica em frente ao mar. A Pousada Marimar está anexada logo aos fundos do restaurante, a poucos passos do trapiche de Encantadas.';
