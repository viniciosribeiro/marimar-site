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

  // ─── 4. Relatorio final ────────────────────────────────────
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
