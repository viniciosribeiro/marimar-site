-- Banners em camadas: midia, veu, textura, conteudo.
--
-- A versao anterior tinha imagem + titulo + chamada + um botao. Isso cobre
-- um aviso, nao um topo de site: nao dava para escolher onde o texto fica,
-- que parte da foto sobrevive ao corte no celular, nem usar video.
--
-- Cada coluna aqui e uma decisao que o arquivo da imagem NAO consegue
-- tomar sozinho — o resto continua derivado no codigo.
ALTER TABLE banners
  -- Midia
  ADD COLUMN IF NOT EXISTS tipo_midia       text    NOT NULL DEFAULT 'imagem',
  ADD COLUMN IF NOT EXISTS video_url        text,
  ADD COLUMN IF NOT EXISTS video_pathname   text,
  -- Ponto focal, em % da imagem. E o controle mais importante para
  -- responsividade: uma foto horizontal cortada para a tela vertical do
  -- celular perde as bordas, e sem isto ela perde justamente o assunto.
  ADD COLUMN IF NOT EXISTS foco_x           integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS foco_y           integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS video_no_celular boolean NOT NULL DEFAULT false,

  -- Forma
  ADD COLUMN IF NOT EXISTS altura           text    NOT NULL DEFAULT 'alto',
  ADD COLUMN IF NOT EXISTS posicao          text    NOT NULL DEFAULT 'centro-meio',
  ADD COLUMN IF NOT EXISTS largura_texto    text    NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS centralizar_celular boolean NOT NULL DEFAULT true,

  -- Camadas sobre a midia
  ADD COLUMN IF NOT EXISTS veu              text    NOT NULL DEFAULT 'escuro-baixo',
  ADD COLUMN IF NOT EXISTS veu_forca        integer NOT NULL DEFAULT 55,
  ADD COLUMN IF NOT EXISTS textura          text    NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS textura_forca    integer NOT NULL DEFAULT 18,

  -- Conteudo
  ADD COLUMN IF NOT EXISTS rotulo           text,
  ADD COLUMN IF NOT EXISTS texto            text,
  ADD COLUMN IF NOT EXISTS cta2_texto       text,
  ADD COLUMN IF NOT EXISTS cta2_href        text,
  ADD COLUMN IF NOT EXISTS cor_texto        text    NOT NULL DEFAULT 'claro',
  ADD COLUMN IF NOT EXISTS sombra_texto     boolean NOT NULL DEFAULT true,

  -- Movimento
  ADD COLUMN IF NOT EXISTS animacao         text    NOT NULL DEFAULT 'subir',
  ADD COLUMN IF NOT EXISTS ken_burns        boolean NOT NULL DEFAULT false;
