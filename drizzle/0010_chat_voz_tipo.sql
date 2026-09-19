-- A tabela chat_voz passou a contar duas coisas diferentes: a sintese de
-- voz (texto -> audio, cobrada por caractere) e a transcricao (audio ->
-- texto, cobrada por minuto). Sem separar, o teto por hora misturaria dois
-- custos com unidades diferentes e a auditoria de gasto nao diria nada.
ALTER TABLE "chat_voz" ADD COLUMN IF NOT EXISTS "tipo" text NOT NULL DEFAULT 'tts';
ALTER TABLE "chat_voz" ADD COLUMN IF NOT EXISTS "segundos" integer NOT NULL DEFAULT 0;
