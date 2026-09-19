-- Itens dentro de um bloco da home.
--
-- Os cartoes de "Um complexo, duas partes" e de "O que esta incluso" eram
-- constantes no codigo (DIFERENCIAIS, em src/lib/conteudo-pousada.ts). Dava
-- para editar o TITULO da secao pelo admin, mas nao os cartoes dentro dela —
-- que e justamente o conteudo que a pousada quer mexer.
--
-- Uma tabela so serve aos dois blocos porque a forma e a mesma: icone ou
-- foto, titulo, texto, link. O que muda e como o bloco desenha.
--
-- Sem nenhuma linha para um bloco, valem as constantes. Quem nunca abrir a
-- tela nao perde o conteudo que ja estava no ar.
CREATE TABLE IF NOT EXISTS blocos_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id        uuid NOT NULL REFERENCES blocos_home(id) ON DELETE CASCADE,
  icone           text,
  cor             text NOT NULL DEFAULT 'marca',
  titulo          text NOT NULL,
  texto           text,
  imagem_url      text,
  -- Guardado para apagar o arquivo no Blob junto com o item.
  imagem_pathname text,
  href            text,
  cta_texto       text,
  ordem           integer NOT NULL DEFAULT 0,
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blocos_itens_bloco_idx ON blocos_itens (bloco_id, ordem);
