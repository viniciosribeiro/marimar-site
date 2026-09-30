-- Confirmação do aprendizado pelo WhatsApp e "Sem resposta" ligado aos chamados (30/09/2026).
--
-- Só ACRESCENTA colunas opcionais (vazias). Nenhuma linha existente muda e
-- nenhum dado é apagado. Fluxo: docs/fluxo-escalonamento.md, "Confirmação
-- do aprendizado".

-- Depois que a equipe responde pelo WhatsApp, a Marina pergunta se pode
-- guardar a resposta. Etapa: 'pergunta' (esperando sim/não/alteração) ou
-- 'final' (mostrou a versão alterada e espera confirmar). null = nada pendente.
ALTER TABLE "marina_chamados" ADD COLUMN IF NOT EXISTS "confirmacao_etapa" text;
--> statement-breakpoint
ALTER TABLE "marina_chamados" ADD COLUMN IF NOT EXISTS "confirmacao_texto" text;
--> statement-breakpoint
ALTER TABLE "marina_chamados" ADD COLUMN IF NOT EXISTS "confirmacao_contato_id" uuid;
--> statement-breakpoint
ALTER TABLE "marina_chamados" ADD COLUMN IF NOT EXISTS "confirmacao_em" timestamp;
--> statement-breakpoint

-- A pergunta sem resposta sabe se virou chamado (e qual) ou por que não virou.
ALTER TABLE "marina_lacunas" ADD COLUMN IF NOT EXISTS "chamado_id" uuid;
--> statement-breakpoint
ALTER TABLE "marina_lacunas" ADD COLUMN IF NOT EXISTS "aviso_erro" text;
