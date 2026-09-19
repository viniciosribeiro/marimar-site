-- Treinamento da Marina pelo painel.
--
-- A ideia por tras destas tabelas: tudo que a Cecilia ensina vive no NOSSO
-- banco e e servido pelas rotas /api/agent/*. Assim vale para os dois canais
-- ao mesmo tempo, sem ninguem abrir a Hostinger e sem reinstalar habilidade.
--
-- O que continua fora daqui: preco e disponibilidade, que sao do motor e
-- nunca de cadastro.

-- Ajustes de voz. Linha unica.
CREATE TABLE IF NOT EXISTS "marina_config" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "voz_id"           text,
  "voz_modelo"       text NOT NULL DEFAULT 'eleven_multilingual_v2',
  -- Guardados como inteiro de 0 a 100 para o controle deslizante do painel
  -- nao lidar com decimal. A conversao para 0..1 acontece num lugar so.
  "voz_estabilidade" integer NOT NULL DEFAULT 50,
  "voz_semelhanca"   integer NOT NULL DEFAULT 75,
  "voz_velocidade"   integer NOT NULL DEFAULT 100,
  "tom"              text,
  "atualizado_em"    timestamp NOT NULL DEFAULT now()
);

-- Tudo que a Cecilia ensina, numa tabela so.
--
-- Um tipo em vez de tres tabelas de proposito: para quem opera, "coisas que
-- eu ensinei para a Marina" e um conceito unico. Tres telas parecidas com
-- nomes tecnicos diferentes e onde um painel comeca a ser evitado.
CREATE TABLE IF NOT EXISTS "marina_conhecimento" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'fato' (ela pode dizer) ou 'limite' (ela nunca diz)
  "tipo"          text NOT NULL DEFAULT 'fato',
  "titulo"        text NOT NULL,
  "conteudo"      text NOT NULL,
  "ativo"         boolean NOT NULL DEFAULT true,
  "ordem"         integer NOT NULL DEFAULT 0,
  "criado_em"     timestamp NOT NULL DEFAULT now(),
  "atualizado_em" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "marina_conhecimento_tipo_idx"
  ON "marina_conhecimento" ("tipo", "ativo", "ordem");

-- Revisao de conversas: a Cecilia marca o que saiu errado e escreve o que a
-- Marina deveria ter dito. A correcao vira conhecimento — e por isso que a
-- revisao tem valor, e nao so por ser um historico bonito de ler.
ALTER TABLE "chat_mensagens" ADD COLUMN IF NOT EXISTS "marcada"  boolean NOT NULL DEFAULT false;
ALTER TABLE "chat_mensagens" ADD COLUMN IF NOT EXISTS "correcao" text;
