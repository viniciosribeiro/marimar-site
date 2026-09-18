import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

interface WorkerRoom {
  id: string; nome: string; categoria: string; diaria: number;
  ocupacao_max: number; pacote: string; comodidades: string[]; fotos: string[];
  disponivel: boolean; valor_adulto: number; valor_crianca: number;
  crianca_por_noite: number[]; unidades_disponiveis: number;
  estadia_minima: number; estadia_maxima: number;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const sql = postgres(dbUrl, { max: 1 });

  console.log("🌱 Iniciando seed...\n");

  // ─── Carrega JSON real ─────────────────────────────────────
  const raw = JSON.parse(readFileSync(join("docs", "samples", "tarifas-2026-10-15.json"), "utf-8"));
  const allRooms: WorkerRoom[] = [...raw.quartos, ...raw.indisponiveis];

  // ─── 1. Pousada ────────────────────────────────────────────
  await sql`INSERT INTO pousada (nome, slug, descricao_curta, endereco, cidade, uf, lat, lng, telefone, whatsapp, email, como_chegar, horario_recepcao, cor_primaria, cor_secundaria, seo_title, seo_description)
    VALUES ('Pousada Ilha do Mel Marimar', 'pousada-ilha-do-mel-marimar',
    'O Marimar Café Bistrô Bar fica em frente ao mar. A Pousada Marimar está anexada logo aos fundos do restaurante, a poucos passos do trapiche de Encantadas.',
    'Praia de Encantadas, s/n — Ilha do Mel', 'Paranaguá', 'PR', -25.5684375, -48.3151875,
    '(41) 99501-2920', '(41) 99501-2920', 'contato@pousadamarimarilhadomel.com.br',
    'Acesso por barco saindo de Pontal do Sul (30 min, R$ 30) ou Paranaguá (1h30, R$ 25). Do trapiche de Encantadas, 10 min de caminhada até a pousada.',
    '08:00 às 22:00', '#0D9488', '#0EA5E9',
    'Pousada Ilha do Mel Marimar — Reserva Oficial', 'Pousada na Ilha do Mel. Consulte disponibilidade e preços no site oficial.')`;
  console.log("✅ pousada");

  // ─── 2. Categorias ─────────────────────────────────────────
  const cats = [
    { nome: "Standard", slug: "standard", descricao: "Quartos standard econômicos", ordem: 1 },
    { nome: "Suite", slug: "suite", descricao: "Suítes com banheiro privativo", ordem: 2 },
    { nome: "Familia", slug: "familia", descricao: "Quartos para familias", ordem: 3 },
    { nome: "Premium", slug: "premium", descricao: "Quartos premium com hidromassagem", ordem: 4 },
  ];
  for (const c of cats) {
    await sql`INSERT INTO categorias ${sql(c)}`;
  }
  console.log(`✅ categorias — ${cats.length}`);

  // ─── 3. Quartos (do JSON real) ─────────────────────────────
  for (let i = 0; i < allRooms.length; i++) {
    const r = allRooms[i];
    const slug = r.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    let catSlug = "standard";
    if (r.id === "HIDRO") catSlug = "premium";
    else if (r.id === "KING" || r.id === "QUEEN" || r.id === "KGTR") catSlug = "suite";
    else if (r.ocupacao_max >= 4) catSlug = "familia";

    const [catRow] = await sql`SELECT id FROM categorias WHERE slug = ${catSlug}`;

    await sql`
      INSERT INTO quartos (nome, slug, descricao_motor, categoria_id,
        ocupacao_max, capacidade_adultos, diaria_minima,
        desbravador_room_id, ordem, ativo)
      VALUES (${r.nome}, ${slug}, ${r.categoria}, ${catRow?.id ?? null},
        ${r.ocupacao_max}, ${Math.min(2, r.ocupacao_max)}, ${r.estadia_minima},
        ${r.id}, ${i + 1}, ${r.disponivel})
      ON CONFLICT (desbravador_room_id) DO UPDATE SET
        nome = EXCLUDED.nome, descricao_motor = EXCLUDED.descricao_motor,
        ocupacao_max = EXCLUDED.ocupacao_max, ativo = EXCLUDED.ativo
    `;
  }
  console.log(`✅ quartos — ${allRooms.length}`);

  // ─── 4. Comodidades ────────────────────────────────────────
  const comodidadesData = [
    { nome: "Ar-condicionado", slug: "ar-condicionado", icone: "wind", escopo: "quarto", nome_motor: "Ar" },
    { nome: "Wi-Fi", slug: "wifi", icone: "wifi", escopo: "pousada", nome_motor: "Wifi" },
    { nome: "TV", slug: "tv", icone: "tv", escopo: "quarto", nome_motor: "TV" },
    { nome: "Smart TV", slug: "smart-tv", icone: "tv", escopo: "quarto", nome_motor: "Smart TV" },
    { nome: "Frigobar", slug: "frigobar", icone: "refrigerator", escopo: "quarto", nome_motor: "Frigobar" },
    { nome: "Restaurante", slug: "restaurante", icone: "utensils", escopo: "pousada", nome_motor: "Restaurante" },
    { nome: "Internet", slug: "internet", icone: "globe", escopo: "pousada", nome_motor: "Internet" },
    { nome: "Wi-Fi Free", slug: "wifi-free", icone: "wifi", escopo: "pousada", nome_motor: "Wifi Free" },
    { nome: "Banheira", slug: "banheira", icone: "bath", escopo: "quarto", nome_motor: "Banheira" },
    { nome: "Secador", slug: "secador", icone: "wind", escopo: "quarto", nome_motor: "Secador" },
    { nome: "Cafe da manha", slug: "cafe-da-manha", icone: "coffee", escopo: "pousada" },
    { nome: "Piscina", slug: "piscina", icone: "waves", escopo: "pousada" },
    { nome: "Pet friendly", slug: "pet-friendly", icone: "paw-print", escopo: "pousada" },
    { nome: "Berco gratuito", slug: "berco", icone: "baby", escopo: "pousada" },
    { nome: "Estacionamento", slug: "estacionamento", icone: "car", escopo: "pousada" },
    { nome: "Passeios guiados", slug: "passeios-guiados", icone: "map", escopo: "pousada" },
    { nome: "Recepcao 24h", slug: "recepcao-24h", icone: "clock", escopo: "pousada" },
    { nome: "Jardim", slug: "jardim", icone: "tree-pine", escopo: "pousada" },
    { nome: "Rede", slug: "rede", icone: "hammock", escopo: "quarto" },
    { nome: "Vista para o mar", slug: "vista-mar", icone: "binoculars", escopo: "quarto" },
  ];
  for (const c of comodidadesData) {
    await sql`INSERT INTO comodidades ${sql(c)} ON CONFLICT (slug) DO NOTHING`;
  }
  console.log(`✅ comodidades — ${comodidadesData.length}`);

  // ─── 5. Quarto-Comodidades ─────────────────────────────────
  let qcCount = 0;
  for (const r of allRooms) {
    for (const nomeMotor of r.comodidades) {
      const [c] = await sql`SELECT id FROM comodidades WHERE nome_motor = ${nomeMotor}`;
      if (!c) continue;
      const [q] = await sql`SELECT id FROM quartos WHERE desbravador_room_id = ${r.id}`;
      if (!q) continue;
      await sql`INSERT INTO quarto_comodidades (quarto_id, comodidade_id) VALUES (${q.id}, ${c.id}) ON CONFLICT DO NOTHING`;
      qcCount++;
    }
  }
  console.log(`✅ quarto_comodidades — ${qcCount}`);

  // ─── 6. Pousada-Comodidades ────────────────────────────────
  for (const slug of ["wifi", "restaurante", "internet", "cafe-da-manha", "piscina", "pet-friendly", "berco", "estacionamento", "passeios-guiados", "recepcao-24h", "jardim"]) {
    const [c] = await sql`SELECT id FROM comodidades WHERE slug = ${slug}`;
    if (c) await sql`INSERT INTO pousada_comodidades (comodidade_id) VALUES (${c.id}) ON CONFLICT DO NOTHING`;
  }
  console.log("✅ pousada_comodidades");

  // ─── 7. Políticas ──────────────────────────────────────────
  await sql`INSERT INTO politicas (diaria_minima_padrao, faixas_crianca, check_in, check_out, cancelamento, pet, pet_texto, formas_pagamento, regras_gerais) VALUES (1,
    ${JSON.stringify([{ idade_min: 0, idade_max: 5, regra: "gratis", valor: 0 }, { idade_min: 6, idade_max: 11, regra: "percentual", valor: 50 }, { idade_min: 12, idade_max: 17, regra: "valor", valor: 120 }])}::jsonb,
    '14:00', '12:00',
    'Cancelamento gratuito ate 7 dias antes. Entre 7 e 3 dias: 50%. Menos de 3 dias: 100%.',
    true, 'Animais de pequeno porte (ate 15 kg) sob consulta. Taxa de R$ 50/dia.',
    ${JSON.stringify(["PIX (5% desconto)", "Cartao de credito (ate 12x)", "Cartao de debito"])}::jsonb,
    'Reserva confirmada com 50% do valor. Proibido fumar areas internas (multa R$ 500).')`;
  console.log("✅ politicas");

  // ─── 8. FAQ ────────────────────────────────────────────────
  const faqs = [
    { p: "Como chegar na Ilha do Mel?", r: "Acesso por barco: Pontal do Sul (30 min, R$ 30) ou Paranagua (1h30, R$ 25). Do trapiche, 10 min de caminhada.", va: true },
    { p: "Qual o horario de check-in e check-out?", r: "Check-in a partir das 14h. Check-out ate as 12h.", va: true },
    { p: "Aceitam criancas?", r: "Sim! Temos quartos familia. Criancas ate 5 anos gratis.", va: true },
    { p: "Tem Wi-Fi?", r: "Sim, Wi-Fi gratuito em todas as areas.", va: true },
    { p: "Aceitam pets?", r: "Sim, animais ate 15 kg sob consulta. Taxa de R$ 50/dia.", va: true },
    { p: "Qual a politica de cancelamento?", r: "Gratuito ate 7 dias antes. Entre 7 e 3 dias: 50%. Menos de 3 dias: 100%.", va: false },
    { p: "Aceitam pagamento parcelado?", r: "Sim! Cartao em ate 12x, PIX com 5% de desconto.", va: true },
    { p: "O que devo levar?", r: "Protetor solar, repelente, calcado confortavel, mochila leve e dinheiro em especie.", va: false },
    { p: "Tem estacionamento?", r: "Nao ha carros na ilha. Estacionamento em Pontal do Sul (~R$ 30/dia).", va: false },
    { p: "O cafe da manha esta incluso?", r: "Sim! Cafe da manha incluso em todas as diarias.", va: true },
  ];
  for (let i = 0; i < faqs.length; i++) {
    await sql`INSERT INTO faq (pergunta, resposta, ordem, ativo, visivel_agente) VALUES (${faqs[i].p}, ${faqs[i].r}, ${i + 1}, true, ${faqs[i].va})`;
  }
  console.log(`✅ faq — ${faqs.length}`);

  // ─── 9. Blocos da Home ─────────────────────────────────────
  const blocos = [
    { tipo: "hero", titulo: "Pousada Marimar", subtitulo: null, ordem: 1 },
    { tipo: "sobre", titulo: "Bem-vindo a Marimar", subtitulo: "Conheca nossa historia.", ordem: 2 },
    { tipo: "quartos", titulo: "Nossos Quartos", subtitulo: "Do standard ao premium.", ordem: 3 },
    { tipo: "galeria", titulo: "Galeria", subtitulo: "Nossos espacos.", ordem: 4 },
    { tipo: "pacotes", titulo: "Pacotes", subtitulo: "Ofertas especiais.", ordem: 5 },
    { tipo: "passeios", titulo: "Passeios", subtitulo: "Trilhas e experiências.", ordem: 6 },
    { tipo: "depoimentos", titulo: "Depoimentos", subtitulo: "O que dizem nossos hospedes.", ordem: 7 },
    { tipo: "mapa", titulo: "Como Chegar", subtitulo: "Localizacao e acesso.", ordem: 8 },
    { tipo: "cta", titulo: "Reserve sua Estadia", subtitulo: "Consulte disponibilidade.", ordem: 9 },
    { tipo: "faq", titulo: "Perguntas Frequentes", subtitulo: "Duvidas comuns.", ordem: 10 },
  ];
  for (const b of blocos) {
    await sql`INSERT INTO blocos_home ${sql(b)}`;
  }
  console.log(`✅ blocos_home — ${blocos.length}`);

  console.log("\n🌴 Seed concluido!");
  await sql.end();
}

main().catch((err) => { console.error("Seed falhou:", err); process.exit(1); });