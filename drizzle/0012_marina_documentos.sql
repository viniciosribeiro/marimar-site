-- Documentos que a Cecilia envia para ensinar a Marina.
--
-- O arquivo fica no Vercel Blob; aqui guardamos o TEXTO extraido, que e o
-- que a Marina consegue ler. Guardar so o link nao serviria: ela nao abre
-- PDF, e mandar o arquivo inteiro em toda conversa seria caro e inutil.
--
-- `trecho` e o que entra no contexto de toda conversa (curto, de proposito);
-- `texto` completo fica na rota /api/agent/documentos, para ela buscar
-- quando a pergunta pedir. Enfiar um PDF de 40 paginas na mensagem de
-- sistema de toda conversa multiplicaria o custo por visitante.
CREATE TABLE IF NOT EXISTS "marina_documentos" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome"       text NOT NULL,
  "assunto"    text,
  "tipo"       text NOT NULL,
  "url"        text NOT NULL,
  "pathname"   text,
  "bytes"      integer NOT NULL DEFAULT 0,
  "texto"      text,
  "trecho"     text,
  "caracteres" integer NOT NULL DEFAULT 0,
  -- 'lendo' | 'pronto' | 'falhou'
  "status"     text NOT NULL DEFAULT 'lendo',
  "erro"       text,
  "ativo"      boolean NOT NULL DEFAULT true,
  "criado_em"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "marina_documentos_ativo_idx"
  ON "marina_documentos" ("ativo", "criado_em");
