-- 18/10/2026 — decisão do Vinicios: em nenhum lugar do site "pé na areia";
-- tudo "à beira-mar". O código já foi trocado; esta migration troca o que
-- está GRAVADO no banco (seções da home, cartões, banners, SEO, FAQ,
-- políticas, cardápio, treinamento e aprendizado da Marina etc.).
--
-- Passa por todas as colunas de texto (text, varchar, json, jsonb e listas
-- de texto) das tabelas de conteúdo. Ficam de fora só os REGISTROS, que não
-- aparecem no site: usuários, contatos recebidos, conversas, histórico,
-- chamados, eventos, cache e chaves de integração.
-- Onde a tabela tem "atualizado_em", ele vai para agora: a Marina e o
-- painel percebem que o conteúdo mudou.
DO $$
DECLARE
  r record;
  troca constant text :=
    'regexp_replace(replace(replace(replace(replace(replace(@,'
    || '''PÉ NA AREIA'',''À BEIRA-MAR''),'
    || '''Pé na Areia'',''À Beira-Mar''),'
    || '''Pé na areia'',''À beira-mar''),'
    || '''Pe na areia'',''À beira-mar''),'
    || '''Pé-na-areia'',''À beira-mar''),'
    || '''[pP][eéEÉ][ -][nN][aA][ -][aA][rR][eE][iI][aA]'',''à beira-mar'',''g'')';
  padrao constant text := '[pP][eéEÉ][ -][nN][aA][ -][aA][rR][eE][iI][aA]';
  novo text;
  onde text;
  carimbo text;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.is_generated = 'NEVER'
      AND (c.data_type IN ('text', 'character varying', 'json', 'jsonb')
           OR (c.data_type = 'ARRAY' AND c.udt_name IN ('_text', '_varchar')))
      AND c.table_name NOT IN (
        'usuarios', 'leads', 'integracoes', 'cache_tarifas', 'audit_log',
        'chat_voz', 'chat_mensagens', 'marina_historico', 'marina_leituras',
        'marina_lacunas', 'equipe_contatos', 'marina_escalonamento_config',
        'marina_chamados', 'marina_eventos')
  LOOP
    IF r.data_type IN ('text', 'character varying') THEN
      novo := replace(troca, '@', format('%I', r.column_name));
      onde := format('%I ~ %L', r.column_name, padrao);
    ELSIF r.data_type IN ('json', 'jsonb') THEN
      novo := '(' || replace(troca, '@', format('%I::text', r.column_name)) || ')::' || r.data_type;
      onde := format('%I::text ~ %L', r.column_name, padrao);
    ELSE
      novo := format('ARRAY(SELECT %s FROM unnest(%I) WITH ORDINALITY AS u(x, n) ORDER BY n)',
                     replace(troca, '@', 'x'), r.column_name);
      onde := format('array_to_string(%I, '' '') ~ %L', r.column_name, padrao);
    END IF;

    carimbo := '';
    IF r.column_name <> 'atualizado_em' AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.table_name
        AND column_name = 'atualizado_em'
        AND data_type LIKE 'timestamp%'
    ) THEN
      carimbo := ', atualizado_em = now()';
    END IF;

    EXECUTE format('UPDATE %I SET %I = %s%s WHERE %s',
                   r.table_name, r.column_name, novo, carimbo, onde);
  END LOOP;
END $$;
