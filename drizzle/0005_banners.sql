-- Banners do topo da home.
--
-- Antes existia UMA foto de topo, escolhida por uma regra implicita no
-- modulo Fotos: a midia com `destaque = true` e sem quarto vinculado. Quem
-- procurava "banner" no admin nao achava nada, porque nao havia nada com
-- esse nome — e trocar a foto do topo exigia saber a regra.
--
-- Agora sao registros proprios, com titulo, chamada e janela de exibicao.
-- A janela existe porque a pousada anuncia por temporada: um banner de
-- feriado deve sair do ar sozinho, sem depender de alguem lembrar.
CREATE TABLE IF NOT EXISTS banners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text,
  subtitulo       text,
  imagem_url      text NOT NULL,
  -- Guardado para conseguir apagar o arquivo no Blob junto com o registro.
  -- Sem isto, remover um banner deixaria a imagem orfa pagando
  -- armazenamento para sempre.
  imagem_pathname text,
  alt             text,
  cta_texto       text,
  cta_href        text,
  ordem           integer NOT NULL DEFAULT 0,
  ativo           boolean NOT NULL DEFAULT true,
  -- Janela opcional. NULL nos dois = sempre no ar.
  inicia_em       timestamp,
  termina_em      timestamp,
  criado_em       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banners_ordem_idx ON banners (ordem, criado_em);
