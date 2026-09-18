import {
  pgTable, varchar, text, boolean, timestamp, integer,
  doublePrecision, jsonb, uuid, primaryKey, index, pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────
export const papelEnum = pgEnum("papel", ["master", "editor"]);
export const escopoComodidadeEnum = pgEnum("escopo_comodidade", ["pousada", "quarto"]);
export const tipoMidiaEnum = pgEnum("tipo_midia", ["foto", "video"]);
export const origemLeadEnum = pgEnum("origem_lead", ["site", "whatsapp", "agente"]);
export const tipoBlocoEnum = pgEnum("tipo_bloco", [
  "hero", "sobre", "quartos", "galeria", "pacotes",
  "passeios", "depoimentos", "mapa", "cta", "faq",
  // Adicionados no redesign de 18/09/2026 (migration 0002)
  "complexo", "diferenciais", "restaurante", "avaliacoes",
]);

// ─── Pousada ─────────────────────────────────────────────────────
export const pousada = pgTable("pousada", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  descricao_curta: text("descricao_curta"),
  descricao_longa: text("descricao_longa"),
  cnpj: varchar("cnpj", { length: 18 }),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 9 }),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  telefone: varchar("telefone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  email: varchar("email", { length: 255 }),
  instagram: varchar("instagram", { length: 255 }),
  facebook: varchar("facebook", { length: 255 }),
  como_chegar: text("como_chegar"),
  horario_recepcao: varchar("horario_recepcao", { length: 50 }),
  logo_url: text("logo_url"),
  favicon_url: text("favicon_url"),
  cor_primaria: varchar("cor_primaria", { length: 7 }).default("#0D9488"),
  cor_secundaria: varchar("cor_secundaria", { length: 7 }).default("#0EA5E9"),
  fonte_titulo: varchar("fonte_titulo", { length: 100 }),
  fonte_corpo: varchar("fonte_corpo", { length: 100 }),
  seo_title: text("seo_title"),
  seo_description: text("seo_description"),
  og_image_url: text("og_image_url"),
  /**
   * Configuracoes do editor visual que nao merecem coluna propria:
   * { raio, sombra, animacoes, banner: { ativo, texto, subtexto, animado } }
   *
   * Existe para que uma opcao nova no editor NAO exija uma migration. Antes
   * disso, as abas "Banner" e "Avancado" tinham controles que nao tinham
   * onde ser gravados — e por isso simplesmente nao salvavam nada.
   */
  tema: jsonb("tema").$type<Record<string, any>>().default({}),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

// ─── Usuários ────────────────────────────────────────────────────
export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  nome: varchar("nome", { length: 255 }).notNull(),
  senha_hash: varchar("senha_hash", { length: 255 }).notNull(),
  papel: papelEnum("papel").default("editor").notNull(),
  must_reset: boolean("must_reset").default(true).notNull(),
  ultimo_login: timestamp("ultimo_login"),
  tentativas_falhas: integer("tentativas_falhas").default(0).notNull(),
  bloqueado_ate: timestamp("bloqueado_ate"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Categorias (locais, não do motor) ──────────────────────────
export const categorias = pgTable("categorias", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  descricao: text("descricao"),
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Quartos (vínculo com motor via desbravador_room_id) ───────
export const quartos = pgTable("quartos", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoria_id: uuid("categoria_id").references(() => categorias.id, { onDelete: "set null" }),
  nome: varchar("nome", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  descricao: text("descricao"),                                // texto local (admin)
  descricao_motor: text("descricao_motor"),                    // texto longo que vem do Worker (campo "categoria")
  cama: varchar("cama", { length: 255 }),
  metragem: integer("metragem"),
  vista: varchar("vista", { length: 255 }),
  capacidade_adultos: integer("capacidade_adultos").default(2).notNull(),
  capacidade_criancas: integer("capacidade_criancas").default(0).notNull(),
  ocupacao_max: integer("ocupacao_max").default(2).notNull(),
  diaria_minima: integer("diaria_minima").default(1).notNull(),
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  desbravador_room_id: varchar("desbravador_room_id", { length: 20 }).unique(), // ex: "MRFAM"
  destaque: boolean("destaque").default(false).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

// ─── Mídias ─────────────────────────────────────────────────────
export const midias = pgTable("midias", {
  id: uuid("id").defaultRandom().primaryKey(),
  quarto_id: uuid("quarto_id").references(() => quartos.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  key_r2: text("key_r2"),                                       // chave no R2 (se upload local)
  alt: text("alt").notNull(),
  tipo: tipoMidiaEnum("tipo").default("foto").notNull(),
  largura: integer("largura"),
  altura: integer("altura"),
  ordem: integer("ordem").default(0).notNull(),
  destaque: boolean("destaque").default(false).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Comodidades ────────────────────────────────────────────────
export const comodidades = pgTable("comodidades", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  icone: varchar("icone", { length: 100 }).default("check"),
  escopo: escopoComodidadeEnum("escopo").default("quarto").notNull(),
  nome_motor: varchar("nome_motor", { length: 255 }),          // nome que vem do Worker (ex: "Ar", "Wifi")
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Junções ────────────────────────────────────────────────────
export const quartoComodidades = pgTable("quarto_comodidades", {
  quarto_id: uuid("quarto_id").references(() => quartos.id, { onDelete: "cascade" }).notNull(),
  comodidade_id: uuid("comodidade_id").references(() => comodidades.id, { onDelete: "cascade" }).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.quarto_id, t.comodidade_id] }) }));

export const pousadaComodidades = pgTable("pousada_comodidades", {
  id: uuid("id").defaultRandom().primaryKey(),
  comodidade_id: uuid("comodidade_id").references(() => comodidades.id, { onDelete: "cascade" }).notNull().unique(),
});

// ─── Pacotes ────────────────────────────────────────────────────
export const pacotes = pgTable("pacotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  descricao: text("descricao"),
  inclusos: jsonb("inclusos").$type<string[]>().default(sql`'[]'::jsonb`),
  vigencia_inicio: timestamp("vigencia_inicio"),
  vigencia_fim: timestamp("vigencia_fim"),
  diaria_minima: integer("diaria_minima").default(1).notNull(),
  imagem_url: text("imagem_url"),
  ativo: boolean("ativo").default(true).notNull(),
  ordem: integer("ordem").default(0).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Políticas ──────────────────────────────────────────────────
export const politicas = pgTable("politicas", {
  id: uuid("id").defaultRandom().primaryKey(),
  diaria_minima_padrao: integer("diaria_minima_padrao").default(1).notNull(),
  faixas_crianca: jsonb("faixas_crianca").$type<{
    idade_min: number; idade_max: number; regra: "gratis" | "percentual" | "valor"; valor: number;
  }[]>().default(sql`'[]'::jsonb`),
  check_in: varchar("check_in", { length: 10 }).default("14:00"),
  check_out: varchar("check_out", { length: 10 }).default("12:00"),
  cancelamento: text("cancelamento"),
  pet: boolean("pet").default(false),
  pet_texto: text("pet_texto"),
  formas_pagamento: jsonb("formas_pagamento").$type<string[]>().default(sql`'[]'::jsonb`),
  regras_gerais: text("regras_gerais"),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

// ─── FAQ ────────────────────────────────────────────────────────
export const faq = pgTable("faq", {
  id: uuid("id").defaultRandom().primaryKey(),
  pergunta: text("pergunta").notNull(),
  resposta: text("resposta").notNull(),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  visivel_agente: boolean("visivel_agente").default(false).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Blocos da Home ─────────────────────────────────────────────
export const blocosHome = pgTable("blocos_home", {
  id: uuid("id").defaultRandom().primaryKey(),
  tipo: tipoBlocoEnum("tipo").notNull(),
  titulo: varchar("titulo", { length: 255 }),
  subtitulo: text("subtitulo"),
  conteudo: jsonb("conteudo"),
  imagem_url: text("imagem_url"),
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Passeios ───────────────────────────────────────────────────
export const passeios = pgTable("passeios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  duracao: varchar("duracao", { length: 50 }),
  preco_referencia: doublePrecision("preco_referencia"),
  imagem_url: text("imagem_url"),
  ordem: integer("ordem").default(0).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Depoimentos ────────────────────────────────────────────────
export const depoimentos = pgTable("depoimentos", {
  id: uuid("id").defaultRandom().primaryKey(),
  autor: varchar("autor", { length: 255 }).notNull(),
  origem: varchar("origem", { length: 100 }),
  nota: integer("nota").default(5).notNull(),
  texto: text("texto").notNull(),
  data: timestamp("data").defaultNow(),
  ativo: boolean("ativo").default(true).notNull(),
  ordem: integer("ordem").default(0).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Leads ──────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  check_in: timestamp("check_in"),
  check_out: timestamp("check_out"),
  adultos: integer("adultos").default(1),
  criancas: integer("criancas").default(0),
  mensagem: text("mensagem"),
  origem: origemLeadEnum("origem").default("site").notNull(),
  lido: boolean("lido").default(false).notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});

// ─── Integracoes ────────────────────────────────────────────────
export const integracoes = pgTable("integracoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  chave: varchar("chave", { length: 100 }).notNull().unique(),
  valor: text("valor"),
  atualizado_em: timestamp("atualizado_em").defaultNow().notNull(),
});

// ─── Cache de Tarifas ───────────────────────────────────────────
export const cacheTarifas = pgTable("cache_tarifas", {
  id: uuid("id").defaultRandom().primaryKey(),
  chave: varchar("chave", { length: 255 }).notNull().unique(),
  payload: jsonb("payload").notNull(),                         // WorkerResponse completo
  expira_em: timestamp("expira_em").notNull(),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
}, (t) => ({
  idxChave: index("idx_cache_tarifas_chave").on(t.chave),
  idxExpira: index("idx_cache_tarifas_expira").on(t.expira_em),
}));

// ─── Audit Log ──────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  usuario_id: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  acao: varchar("acao", { length: 100 }).notNull(),
  entidade: varchar("entidade", { length: 100 }).notNull(),
  entidade_id: varchar("entidade_id", { length: 100 }),
  diff: jsonb("diff"),
  ip: varchar("ip", { length: 45 }),
  criado_em: timestamp("criado_em").defaultNow().notNull(),
});