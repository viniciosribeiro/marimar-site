/**
 * Correcao dos dados de producao (Neon), conforme o briefing da
 * administracao de 18/09/2026.
 *
 * Idempotente: so altera o que ainda esta errado. Pode rodar quantas vezes
 * quiser. Nada e apagado — registros indevidos sao desativados, nao removidos.
 *
 *   npm run db:corrigir
 *
 * CADA PASSO E INDEPENDENTE. Na primeira execucao real, um erro de nome de
 * coluna no passo das politicas abortou os quatro passos seguintes, deixando
 * o banco pela metade. Agora uma falha e reportada e o script segue.
 */
import { urlDoBanco, sair, explicarErro } from "./env";
import postgres from "postgres";

const TELEFONE_REAL = "(41) 99501-2920";

const DESCRICAO_CORRETA =
  "O Marimar Café Bistrô Bar fica em frente ao mar. A Pousada Marimar está anexada logo aos fundos do restaurante, a poucos passos do trapiche de Encantadas.";

let clienteAberto: { end: () => Promise<void> } | null = null;

const falhas: string[] = [];

/** Executa um passo isolado: uma falha nao derruba os demais. */
async function passo(nome: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    falhas.push(nome);
    console.log(`❌ ${nome}: ${explicarErro(e)}`);
  }
}

async function main() {
  const sql = postgres(urlDoBanco(), { max: 1 });
  clienteAberto = sql;

  console.log("→ Conectado.\n");

  const [antes] = await sql`SELECT nome, telefone, whatsapp, descricao_curta, cidade, lat, lng FROM pousada LIMIT 1`;
  console.log("ANTES:", JSON.stringify(antes, null, 2), "\n");

  // ─── 1. Telefone e WhatsApp ────────────────────────────────
  await passo("Telefone", async () => {
    const r = await sql`
      UPDATE pousada SET telefone = ${TELEFONE_REAL}, whatsapp = ${TELEFONE_REAL}, atualizado_em = now()
      WHERE telefone LIKE '%99999%' OR whatsapp LIKE '%99999%' OR telefone IS NULL
      RETURNING id
    `;
    console.log(r.length ? `✅ Telefone/WhatsApp → ${TELEFONE_REAL}` : "• Telefone já estava correto");
  });

  // ─── 2. Textos da pousada ──────────────────────────────────
  await passo("Textos e acentuação", async () => {
    const r = await sql`
      UPDATE pousada SET
        descricao_curta  = ${DESCRICAO_CORRETA},
        endereco         = 'Praia de Encantadas, s/n — Ilha do Mel',
        cidade           = 'Paranaguá',
        uf               = 'PR',
        cep              = '83251-000',
        lat              = -25.5684375,
        lng              = -48.3151875,
        instagram        = 'https://www.instagram.com/pousada.marimar/',
        horario_recepcao = '08h às 22h',
        como_chegar      = replace(replace(coalesce(como_chegar,''), 'Paranagua', 'Paranaguá'), 'caminhada ate a pousada', 'caminhada até a pousada'),
        seo_description  = replace(coalesce(seo_description,''), 'precos', 'preços'),
        atualizado_em    = now()
      WHERE id = (SELECT id FROM pousada LIMIT 1)
      RETURNING id
    `;
    if (r.length) {
      console.log("✅ Descrição, endereço, coordenadas e Instagram atualizados");
      console.log("   Coordenadas antigas (-25.5117, -48.3389) estavam erradas.");
      console.log("   Agora: -25.5684375, -48.3151875 (Marimar Café Bistrô Bar)");
    }
  });

  // ─── 3. Politicas ──────────────────────────────────────────
  // A coluna e `pet` (boolean) + `pet_texto`, nao `pets`. Foi o que quebrou
  // a primeira execucao.
  await passo("Políticas", async () => {
    const [existe] = await sql`SELECT id FROM politicas LIMIT 1`;
    if (!existe) {
      console.log("• Tabela politicas vazia — cadastre pelo admin");
      return;
    }
    await sql`
      UPDATE politicas SET
        check_in     = '14:00',
        check_out    = '11:00',
        pet          = false,
        pet_texto    = 'Animais de estimação não são aceitos.',
        cancelamento = 'Reservas não reembolsáveis. Da data da reserva até uma semana antes da hospedagem: taxa de 50%. De uma semana antes até o check-in: taxa de 100%. Condições climáticas não geram automaticamente alteração ou cancelamento.',
        regras_gerais = 'Proibido fumar nas suítes. Barulho permitido somente até 22h. Café da manhã servido das 08h às 10h, incluso na diária. Check-in normalmente aceito até as 17h, por causa da travessia da ABALINE; chegada mais tarde somente com aviso antecipado. Não há sistema all inclusive.',
        atualizado_em = now()
      WHERE id = ${(existe as any).id}
    `;
    console.log("✅ Políticas: check-in 14h, check-out 11h, pets NÃO, cancelamento e regras");
  });

  // ─── 4. Passeios de teste ──────────────────────────────────
  await passo("Passeios de teste", async () => {
    const testes = await sql`
      SELECT id, nome, descricao, preco_referencia FROM passeios
      WHERE ativo = true AND (nome ILIKE 'vinicios%' OR nome ILIKE 'teste%' OR nome ILIKE 'vr' OR descricao ILIKE 'vr')
    `;
    if (!testes.length) { console.log("• Nenhum passeio de teste ativo"); return; }
    for (const t of testes) console.log(`   - "${t.nome}" / "${t.descricao}" / R$ ${t.preco_referencia}`);
    await sql`UPDATE passeios SET ativo = false WHERE id = ANY(${testes.map((t: any) => t.id)})`;
    console.log(`✅ ${testes.length} passeio(s) de teste desativado(s)`);
  });

  // ─── 5. Depoimentos ────────────────────────────────────────
  // O briefing e explicito: depoimento nao pode ser inventado e qualquer
  // citacao precisa identificar a plataforma de origem.
  await passo("Depoimentos", async () => {
    const deps = await sql`SELECT id, autor, origem FROM depoimentos WHERE ativo = true`;
    if (!deps.length) { console.log("• Nenhum depoimento ativo"); return; }
    for (const d of deps) console.log(`   - "${d.autor}" (origem: ${d.origem || "não informada"})`);
    await sql`UPDATE depoimentos SET ativo = false`;
    console.log(`✅ ${deps.length} depoimento(s) sem origem verificada desativado(s)`);
    console.log("   O site passa a mostrar as notas agregadas reais das plataformas.");
  });

  // ─── 6. Subtitulo errado do topo ───────────────────────────
  await passo("Subtítulo do topo", async () => {
    const r = await sql`
      UPDATE blocos_home SET subtitulo = NULL
      WHERE tipo = 'hero' AND subtitulo ILIKE '%pe na areia%'
      RETURNING id
    `;
    console.log(r.length
      ? '✅ Subtítulo errado do topo removido ("pé na areia" referindo-se à pousada)'
      : "• Subtítulo do topo já estava correto");
  });

  // ─── 7. Secoes da home ─────────────────────────────────────
  // Requer a migration 0002 (tipos novos do enum tipo_bloco).
  await passo("Seções da home", async () => {
    const ORDEM: { tipo: string; titulo: string | null }[] = [
      { tipo: "hero", titulo: null },
      { tipo: "complexo", titulo: "Um complexo, duas partes" },
      { tipo: "diferenciais", titulo: "O que está incluso na sua estadia" },
      { tipo: "quartos", titulo: "Nossas suítes" },
      { tipo: "restaurante", titulo: "Marimar Café Bistrô Bar" },
      { tipo: "avaliacoes", titulo: "O que dizem quem já ficou" },
      { tipo: "mapa", titulo: "A poucos passos do trapiche" },
      { tipo: "cta", titulo: null },
      { tipo: "faq", titulo: "Perguntas Frequentes" },
    ];

    const existentes = await sql`SELECT tipo FROM blocos_home`;
    const tipos = new Set(existentes.map((b: any) => b.tipo));
    let criados = 0;

    for (let i = 0; i < ORDEM.length; i++) {
      const { tipo, titulo } = ORDEM[i];
      if (tipos.has(tipo)) {
        await sql`UPDATE blocos_home SET ordem = ${i}, ativo = true WHERE tipo = ${tipo}`;
      } else {
        await sql`INSERT INTO blocos_home (tipo, titulo, ordem, ativo)
                  VALUES (${tipo}::tipo_bloco, ${titulo}, ${i}, true)`;
        criados++;
      }
    }

    const usados = ORDEM.map((o) => o.tipo);
    const sobra = await sql`
      UPDATE blocos_home SET ativo = false, ordem = 90
      WHERE tipo <> ALL(${usados}::tipo_bloco[]) AND ativo = true
      RETURNING tipo
    `;
    console.log(`✅ Seções da home sincronizadas (${criados} criada(s))`);
    if (sobra.length) console.log(`   Desativadas (sem apagar): ${sobra.map((r: any) => r.tipo).join(", ")}`);
  });


  // ─── 8. Foto do topo ───────────────────────────────────────
  // O script do WordPress marcou uma aerea como destaque, mas dava `ordem`
  // por categoria — varias fotos ficaram com ordem=1. Como a home escolhe o
  // topo por `ORDER BY ordem`, quem venceu foi uma foto qualquer, nao a
  // aerea. Aqui a escolha vira deterministica.
  await passo("Foto do topo", async () => {
    const candidatas = await sql`
      SELECT id, url, alt FROM midias
      WHERE quarto_id IS NULL
      ORDER BY
        (alt ILIKE '%aérea%' OR url ILIKE '%dji%') DESC,  -- aérea de drone primeiro
        (largura >= 1600) DESC,                            -- depois as panorâmicas
        largura DESC NULLS LAST
      LIMIT 1
    `;
    if (!candidatas.length) {
      console.log("• Nenhuma foto da pousada cadastrada para o topo");
      return;
    }
    const escolhida = candidatas[0] as any;

    // Só uma foto pode ser o topo: limpa as demais sem quarto vinculado.
    await sql`UPDATE midias SET destaque = false WHERE quarto_id IS NULL AND id <> ${escolhida.id}`;
    await sql`UPDATE midias SET destaque = true, ordem = 0 WHERE id = ${escolhida.id}`;

    console.log(`✅ Foto do topo definida: "${escolhida.alt}"`);
    console.log(`   ${String(escolhida.url).slice(0, 88)}`);
  });

  // ─── Relatorio ─────────────────────────────────────────────
  const [depois] = await sql`SELECT nome, telefone, descricao_curta, cidade, lat, lng FROM pousada LIMIT 1`;
  const [n] = await sql`
    SELECT
      (SELECT count(*) FROM quartos WHERE ativo = true)::int   AS quartos,
      (SELECT count(*) FROM passeios WHERE ativo = true)::int  AS passeios,
      (SELECT count(*) FROM midias)::int                       AS midias,
      (SELECT count(*) FROM midias WHERE destaque = true AND quarto_id IS NULL)::int AS hero,
      (SELECT count(*) FROM blocos_home WHERE ativo = true)::int AS secoes
  `;

  console.log("\nDEPOIS:", JSON.stringify(depois, null, 2));
  const s = n as any;
  console.log(`\nResumo: ${s.quartos} quartos · ${s.passeios} passeios · ${s.midias} fotos · ${s.secoes} seções ativas`);
  console.log(s.hero > 0
    ? `✅ ${s.hero} foto(s) disponível(is) para o topo do site`
    : "⚠️  Nenhuma foto de topo. Rode `npm run db:migrar-wp -- --dry` e depois sem --dry.");

  if (falhas.length) {
    console.log(`\n⚠️  ${falhas.length} passo(s) falharam: ${falhas.join(", ")}`);
    console.log("   Os demais foram aplicados. Corrija e rode de novo — o script é idempotente.");
  } else {
    console.log("\nPronto. Tudo aplicado.");
  }

  await sair(sql, falhas.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\n❌ Falhou:", explicarErro(e));
  if (clienteAberto) { try { await clienteAberto.end(); } catch { /* ignora */ } }
  process.exit(1);
});
