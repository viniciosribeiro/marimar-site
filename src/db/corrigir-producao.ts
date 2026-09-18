/**
 * Correcao pontual dos dados de producao (Neon) — 18/09/2026.
 *
 * O seed inicial gravou placeholders que foram parar no ar:
 *   - telefone/whatsapp "(41) 99999-9999"  → real: (41) 99501-2920
 *   - textos sem acento na descricao da pousada
 *   - um passeio de teste ("Vinicios" / "VR" / R$ 350) aparecendo na home
 *
 * Idempotente: so altera linhas que ainda estao com o valor errado.
 * Rode com:  npx tsx src/db/corrigir-producao.ts
 */
import "dotenv/config";
import postgres from "postgres";

const TELEFONE_REAL = "(41) 99501-2920";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  console.log("→ Conectado. Verificando dados da pousada...\n");

  const [antes] = await sql`SELECT nome, telefone, whatsapp, email, descricao_curta, cidade FROM pousada LIMIT 1`;
  console.log("ANTES:", JSON.stringify(antes, null, 2), "\n");

  // ─── 1. Telefone e WhatsApp ────────────────────────────────
  const tel = await sql`
    UPDATE pousada
    SET telefone = ${TELEFONE_REAL}, whatsapp = ${TELEFONE_REAL}, atualizado_em = now()
    WHERE telefone LIKE '%99999%' OR whatsapp LIKE '%99999%' OR telefone IS NULL
    RETURNING id
  `;
  console.log(tel.length > 0 ? `✅ Telefone/WhatsApp → ${TELEFONE_REAL}` : "• Telefone já estava correto");

  // ─── 2. Acentuacao dos textos da pousada ───────────────────
  const acc = await sql`
    UPDATE pousada SET
      descricao_curta = replace(descricao_curta, 'pousada pe na areia', 'pousada pé na areia'),
      cidade          = replace(cidade, 'Paranagua', 'Paranaguá'),
      como_chegar     = replace(replace(como_chegar, 'Paranagua', 'Paranaguá'), 'caminhada ate a pousada', 'caminhada até a pousada'),
      horario_recepcao = replace(horario_recepcao, ' as ', ' às '),
      seo_description = replace(seo_description, 'precos', 'preços'),
      atualizado_em   = now()
    WHERE descricao_curta LIKE '%pe na areia%'
       OR cidade = 'Paranagua'
       OR como_chegar LIKE '%Paranagua%'
       OR horario_recepcao LIKE '% as %'
       OR seo_description LIKE '%precos%'
    RETURNING id
  `;
  console.log(acc.length > 0 ? "✅ Acentuação dos textos corrigida" : "• Textos já estavam acentuados");

  // ─── 3. Passeios de teste ──────────────────────────────────
  const testes = await sql`
    SELECT id, nome, descricao, preco_referencia FROM passeios
    WHERE nome ILIKE 'vinicios%' OR nome ILIKE 'teste%' OR descricao ILIKE 'vr' OR nome ILIKE 'vr'
  `;
  if (testes.length > 0) {
    console.log(`\n⚠️  ${testes.length} passeio(s) de teste encontrado(s):`);
    for (const t of testes) console.log(`   - "${t.nome}" / "${t.descricao}" / R$ ${t.preco_referencia}`);
    await sql`UPDATE passeios SET ativo = false WHERE id = ANY(${testes.map((t: any) => t.id)})`;
    console.log("✅ Desativados (ativo = false). Não são excluídos — revise no admin antes.");
  } else {
    console.log("• Nenhum passeio de teste encontrado");
  }


  // ─── 4. Dados corrigidos pelo briefing da administracao (18/09/2026) ───
  //
  // ERRO FACTUAL: o site dizia "Sua pousada pe na areia". Quem esta pe na
  // areia e o RESTAURANTE, na frente do complexo. As acomodacoes ficam
  // anexadas aos fundos e NAO devem ser apresentadas como se estivessem
  // sobre a areia.
  const DESCRICAO_CORRETA =
    "O Marimar Café Bistrô Bar fica em frente ao mar. A Pousada Marimar está anexada logo aos fundos do restaurante, a poucos passos do trapiche de Encantadas.";

  const brief = await sql`
    UPDATE pousada SET
      descricao_curta = ${DESCRICAO_CORRETA},
      endereco        = 'Praia de Encantadas, s/n — Ilha do Mel',
      cidade          = 'Paranaguá',
      uf              = 'PR',
      cep             = '83251-000',
      lat             = -25.5684375,
      lng             = -48.3151875,
      instagram       = 'https://www.instagram.com/pousada.marimar/',
      horario_recepcao = '08h às 22h',
      atualizado_em   = now()
    WHERE id = (SELECT id FROM pousada LIMIT 1)
    RETURNING id
  `;
  console.log(brief.length > 0 ? "✅ Descrição, endereço, coordenadas e Instagram atualizados" : "• Nada a atualizar");
  console.log("   ⚠️  Coordenadas antigas (-25.5117, -48.3389) estavam erradas.");
  console.log("   ✅  Agora: -25.5684375, -48.3151875 (Marimar Café Bistrô Bar)");

  // ─── 5. Politicas confirmadas ───
  const pol = await sql`
    UPDATE politicas SET
      check_in     = '14h',
      check_out    = '11h',
      pets         = 'Animais de estimação não são aceitos.',
      cancelamento = 'Reservas não reembolsáveis. Da data da reserva até uma semana antes da hospedagem: taxa de 50%. De uma semana antes até o check-in: taxa de 100%. Condições climáticas não geram automaticamente alteração ou cancelamento.'
    WHERE id = (SELECT id FROM politicas LIMIT 1)
    RETURNING id
  `;
  console.log(pol.length > 0 ? "✅ Políticas atualizadas (check-in 14h, check-out 11h, pets NÃO)" : "• Tabela politicas vazia — cadastre pelo admin");

  // ─── 6. Depoimentos ───
  // O briefing e explicito: depoimentos NAO devem ser inventados e qualquer
  // citacao precisa identificar a plataforma de origem. Os depoimentos que
  // vieram do seed nao tem essa atribuicao, entao saem do ar.
  const deps = await sql`SELECT id, autor, origem FROM depoimentos WHERE ativo = true`;
  if (deps.length > 0) {
    console.log(`\n⚠️  ${deps.length} depoimento(s) ativo(s) sem origem verificada:`);
    for (const d of deps) console.log(`   - "${d.autor}" (origem: ${d.origem || "não informada"})`);
    await sql`UPDATE depoimentos SET ativo = false`;
    console.log("✅ Desativados. O site passa a mostrar as notas agregadas reais das plataformas.");
    console.log("   Para republicar um depoimento, ele precisa identificar a plataforma de origem.");
  } else {
    console.log("• Nenhum depoimento ativo");
  }

  // ─── 7. Relatorio final ────────────────────────────────────
  const [depois] = await sql`SELECT nome, telefone, whatsapp, email, descricao_curta, cidade FROM pousada LIMIT 1`;
  const [pAtivos] = await sql`SELECT count(*)::int AS c FROM passeios WHERE ativo = true`;
  const [qAtivos] = await sql`SELECT count(*)::int AS c FROM quartos WHERE ativo = true`;
  const [midiasDestaque] = await sql`SELECT count(*)::int AS c FROM midias WHERE destaque = true AND quarto_id IS NULL`;

  console.log("\nDEPOIS:", JSON.stringify(depois, null, 2));
  console.log(`\nResumo: ${qAtivos.c} quartos ativos • ${pAtivos.c} passeios ativos`);

  if (midiasDestaque.c === 0) {
    console.log(
      "\n⚠️  Nenhuma mídia em destaque sem quarto_id.\n" +
      "   O hero da home vai cair para og_image_url ou para o gradiente.\n" +
      "   Para ter uma foto da praia no hero, cadastre em Admin → Mídias\n" +
      "   uma imagem com destaque = true e SEM quarto vinculado."
    );
  } else {
    console.log(`\n✅ ${midiasDestaque.c} mídia(s) de destaque disponível(is) para o hero`);
  }

  await sql.end();
  console.log("\nPronto.");
}

main().catch((e) => { console.error("❌ Falhou:", e.message); process.exit(1); });
