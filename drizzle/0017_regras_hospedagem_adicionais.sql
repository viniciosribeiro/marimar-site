-- Regras de hospedagem e adicionais (30/09/2026).
--
-- Ate aqui a regra de crianca era texto livre em dois lugares (politicas e
-- treinamento da Marina) e o site nao lia nenhum dos dois: a busca mandava
-- as criancas ao motor Desbravador, que cobra por faixa etaria que nem
-- esta configurada la. Resultado: o site mostrava um preco, a Marina dizia
-- outro. Agora a regra e um DADO, numa linha so, lida pelos dois.
--
-- So acrescenta. Com `idade_colo_max` nulo o comportamento e o antigo.
CREATE TABLE IF NOT EXISTS "regras_hospedagem" (
  "id"                       integer PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
  -- Ate que idade (inclusive) a crianca e "de colo". Nulo = regra desligada.
  "idade_colo_max"           integer,
  -- Crianca acima da idade de colo conta como adulto na consulta e no preco.
  "crianca_paga_como_adulto" boolean NOT NULL DEFAULT true,
  -- Bebe de colo: 'gratis' | 'por_noite' | 'por_estadia'
  "bebe_cobranca"            text NOT NULL DEFAULT 'gratis',
  "bebe_valor"               numeric(10,2),
  "observacao"               text,
  "atualizado_por"           text,
  "atualizado_em"            timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Adicionais que o hospede pode pedir (berco, cama extra, cafe no quarto,
-- decoracao, late checkout...). Um cadastro so, pensado para ser usado por
-- outros modulos depois (pacotes, pagina da suite).
CREATE TABLE IF NOT EXISTS "adicionais" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome"           text NOT NULL,
  "descricao"      text,
  -- Nulo = "sob consulta": nunca inventar preco.
  "preco"          numeric(10,2),
  -- 'por_estadia' | 'por_noite' | 'por_pessoa_noite' | 'por_unidade'
  "cobranca"       text NOT NULL DEFAULT 'por_estadia',
  -- 'quarto' | 'bebe' | 'alimentacao' | 'experiencia' | 'transporte' | 'outros'
  "categoria"      text NOT NULL DEFAULT 'quarto',
  "precisa_pedir"  boolean NOT NULL DEFAULT true,
  "visivel_site"   boolean NOT NULL DEFAULT true,
  "visivel_marina" boolean NOT NULL DEFAULT true,
  "ativo"          boolean NOT NULL DEFAULT true,
  "ordem"          integer NOT NULL DEFAULT 0,
  "atualizado_por" text,
  "criado_em"      timestamp NOT NULL DEFAULT now(),
  "atualizado_em"  timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adicionais_ativo_idx" ON "adicionais" ("ativo", "ordem");
