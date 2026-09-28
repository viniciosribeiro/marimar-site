-- Fotos com secao propria, e FAQs visiveis para a Marina.
--
-- 1. `midias.secao`. Ate aqui a unica classificacao de uma foto era "tem
--    quarto ou nao". Tudo que nao era quarto caia junto na galeria como
--    "A pousada" — restaurante, cafe da manha, praia, fachada — e o site
--    adivinhava a foto do restaurante pelo texto alternativo
--    (alt ILIKE '%Bistro%'). Agora cada foto diz a que secao pertence.
--    O preenchimento abaixo usa as MESMAS pistas que o site ja usava, para
--    nada mudar de lugar no dia do deploy; o resto a administracao
--    reclassifica na tela de Fotos.
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "secao" text NOT NULL DEFAULT 'pousada';
--> statement-breakpoint
ALTER TABLE "midias" ADD COLUMN IF NOT EXISTS "pathname" text;
--> statement-breakpoint
UPDATE "midias" SET "secao" = 'quarto' WHERE "quarto_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "midias" SET "secao" = 'restaurante'
WHERE "quarto_id" IS NULL AND "secao" = 'pousada'
  AND ("alt" ILIKE '%bistr%' OR "alt" ILIKE '%restaurante%' OR "alt" ILIKE '%prato%' OR "alt" ILIKE '%drink%');
--> statement-breakpoint
UPDATE "midias" SET "secao" = 'cafe'
WHERE "quarto_id" IS NULL AND "secao" = 'pousada' AND "alt" ILIKE '%caf_ da manh_%';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "midias_secao_idx" ON "midias" ("secao", "ordem");
--> statement-breakpoint
-- 2. FAQs.
--    a) As 10 perguntas de EXEMPLO do `db:seed` tem informacao falsa ("aceita
--       pets ate 15 kg", "cartao em 12x, Pix com 5% de desconto", check-out
--       12h, cancelamento gratis ate 7 dias) e 7 delas estavam visiveis para
--       a Marina — contradizendo /api/agent/pousada. Saem do ar. So casam
--       pelo texto EXATO do seed: nada que a pousada tenha escrito ou
--       editado e tocado. Para reativar: Admin → Perguntas frequentes.
UPDATE "faq" SET "ativo" = false, "visivel_agente" = false
WHERE "resposta" IN (
  'Acesso por barco: Pontal do Sul (30 min, R$ 30) ou Paranagua (1h30, R$ 25). Do trapiche, 10 min de caminhada.',
  'Check-in a partir das 14h. Check-out ate as 12h.',
  'Sim! Temos quartos familia. Criancas ate 5 anos gratis.',
  'Sim, Wi-Fi gratuito em todas as areas.',
  'Sim, animais ate 15 kg sob consulta. Taxa de R$ 50/dia.',
  'Gratuito ate 7 dias antes. Entre 7 e 3 dias: 50%. Menos de 3 dias: 100%.',
  'Sim! Cartao em ate 12x, PIX com 5% de desconto.',
  'Protetor solar, repelente, calcado confortavel, mochila leve e dinheiro em especie.',
  'Nao ha carros na ilha. Estacionamento em Pontal do Sul (~R$ 30/dia).',
  'Sim! Cafe da manha incluso em todas as diarias.'
);
--> statement-breakpoint
--    b) A tela de FAQ nunca teve a opcao "a Marina usa", e a action gravava
--       desligado para toda pergunta criada pelo painel. Todo `false` numa
--       FAQ ativa e acidental.
UPDATE "faq" SET "visivel_agente" = true WHERE "ativo" = true;
--> statement-breakpoint
ALTER TABLE "faq" ALTER COLUMN "visivel_agente" SET DEFAULT true;
--> statement-breakpoint
-- 3. Regras para criancas, em texto. A skill da Marina promete responder
--    sobre criancas pela rota /pousada, e nao havia onde a pousada
--    escrever isso (faixas_crianca e jsonb sem tela).
ALTER TABLE "politicas" ADD COLUMN IF NOT EXISTS "criancas_texto" text;
--> statement-breakpoint
-- 4. "A pousada tem" plantado pelo seed: piscina, pet friendly, berco,
--    estacionamento, passeios guiados, recepcao 24h — nenhum confirmado, e
--    estacionamento e pets CONTRADIZEM o bloco "a pousada NAO tem" da mesma
--    rota da Marina. Ate esta versao nao existia tela para marcar isso, entao
--    todo vinculo existente veio do seed.
DELETE FROM "pousada_comodidades" WHERE "comodidade_id" IN (
  SELECT "id" FROM "comodidades"
  WHERE "slug" IN ('piscina', 'pet-friendly', 'berco', 'estacionamento', 'passeios-guiados', 'recepcao-24h')
);
--> statement-breakpoint
-- 5. Politicas ainda com o texto de EXEMPLO do seed ("aceita pets ate 15 kg",
--    check-out 12h, cancelamento gratis): passam aos valores do briefing da
--    administracao (18/09/2026) — os mesmos do `npm run db:corrigir`. Casa
--    pelo texto exato: politica editada pela pousada nao e tocada.
UPDATE "politicas" SET
  "check_in" = '14:00',
  "check_out" = '11:00',
  "pet" = false,
  "pet_texto" = 'Animais de estimação não são aceitos.',
  "cancelamento" = 'Reservas não reembolsáveis. Da data da reserva até uma semana antes da hospedagem: taxa de 50%. De uma semana antes até o check-in: taxa de 100%. Condições climáticas não geram automaticamente alteração ou cancelamento.',
  "regras_gerais" = 'Proibido fumar nas suítes. Barulho permitido somente até 22h. Café da manhã servido das 08h às 10h, incluso na diária. Check-in normalmente aceito até as 17h, por causa da travessia da ABALINE; chegada mais tarde somente com aviso antecipado. Não há sistema all inclusive.',
  "formas_pagamento" = '[]'::jsonb,
  "atualizado_em" = now()
WHERE "pet_texto" = 'Animais de pequeno porte (ate 15 kg) sob consulta. Taxa de R$ 50/dia.';
