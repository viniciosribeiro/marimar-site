-- Registro de sinteses de voz do chat do site.
--
-- Existe por uma razao so: a ElevenLabs cobra por caractere, e o chat e
-- publico. Sem contar quem pediu audio, um unico visitante em loop vira uma
-- fatura. Cada linha e um pedido atendido; o teto por hora se mede daqui.
--
-- Nao guarda o audio nem o texto: so quem pediu (IP com sal) e quanto custou
-- em caracteres, que e o suficiente para limitar e para auditar o gasto.
CREATE TABLE IF NOT EXISTS "chat_voz" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessao"      text NOT NULL,
  "ip_hash"     text,
  "caracteres"  integer NOT NULL DEFAULT 0,
  "criado_em"   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "chat_voz_ip_criado_idx" ON "chat_voz" ("ip_hash", "criado_em");
