-- Chat de atendimento no site.
--
-- O widget conversa com a MESMA Marina do WhatsApp: o navegador fala com
-- /api/chat (publico, sem chave), e e o servidor do Next que chama o gateway
-- do OpenClaw com o token. O visitante nunca ve credencial nenhuma.
--
-- `chat_ativo` nasce FALSE de proposito: um chat publico com LLM e uma porta
-- para o credito da pousada. Ele entra no ar quando a administracao decidir,
-- nao quando o deploy subir.
ALTER TABLE pousada
  ADD COLUMN IF NOT EXISTS chat_ativo boolean NOT NULL DEFAULT false;

-- O historico mora AQUI, nao no navegador.
--
-- Nao e so persistencia: o navegador manda apenas a mensagem nova, e o
-- contexto da conversa e montado no servidor a partir desta tabela. Se o
-- historico viesse do cliente, qualquer pessoa poderia forjar uma mensagem
-- de "sistema" e reescrever as instrucoes da Marina.
--
-- `ip_hash` e hash com sal, nunca o IP cru: serve para limitar abuso sem
-- guardar dado pessoal identificavel.
CREATE TABLE IF NOT EXISTS chat_mensagens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao     text NOT NULL,
  ip_hash    text,
  papel      text NOT NULL,
  conteudo   text NOT NULL,
  criado_em  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_mensagens_sessao_idx ON chat_mensagens (sessao, criado_em);
CREATE INDEX IF NOT EXISTS chat_mensagens_limite_idx ON chat_mensagens (ip_hash, criado_em);
