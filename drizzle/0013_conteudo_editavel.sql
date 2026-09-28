-- Conteudo institucional editavel pelo painel.
--
-- Travessia, atracoes da ilha e eventos viviam em `conteudo-pousada.ts`, um
-- arquivo de codigo. A Cecilia nao consegue abrir o GitHub para corrigir o
-- preco do barco — e preco de barco e dado de TERCEIRO, que muda, e que a
-- Marina cita com a data da consulta. Um dado que envelhece preso em codigo
-- e um dado que vai ficar errado.
--
-- Uma linha por assunto, com os campos em jsonb. O jsonb aqui nao e
-- preguica: cada assunto tem forma propria (a travessia tem terminais e
-- precos, a ilha tem atracoes, eventos tem tipos e espacos), e uma tabela
-- por forma seriam tres tabelas para tres telas de um painel pequeno.
--
-- As constantes do codigo continuam valendo como PADRAO: `lerConteudo()`
-- completa o que faltar. E o mesmo desenho de `lerTema()` e `lerBanner()` —
-- campo novo no codigo nao exige migration nem cadastro para funcionar.
CREATE TABLE IF NOT EXISTS "conteudo_editavel" (
  "chave"         text PRIMARY KEY,
  "dados"         jsonb NOT NULL DEFAULT '{}'::jsonb,
  "atualizado_em" timestamp NOT NULL DEFAULT now()
);
