import { comSql, type Sql } from "@/lib/db-conexao";
import { lerRegras, REGRAS_PADRAO, type Regras } from "@/lib/regras-hospedagem";

/**
 * Leituras de banco das páginas de suítes do site novo. Mesmas tabelas e
 * regras do Clássico: só suíte ativa (a sincronização liga o que o motor
 * vende); capa = foto marcada como capa, senão a primeira.
 */
export type SuiteResumo = {
  id: string; slug: string; nome: string; ocupacao_max: number; ordem: number | null;
  cama: string | null; metragem: number | null; desbravador_room_id: string | null;
  foto: string | null; foto_alt: string | null; total_fotos: number;
};

const colunasResumo = (sql: Sql) => sql`
  q.id, q.slug, q.nome, q.ocupacao_max, q.ordem, q.cama, q.metragem, q.desbravador_room_id,
  COALESCE(
    (SELECT m.url FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' AND m.destaque = true ORDER BY m.ordem LIMIT 1),
    (SELECT m.url FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' ORDER BY m.ordem LIMIT 1)
  ) AS foto,
  COALESCE(
    (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' AND m.destaque = true ORDER BY m.ordem LIMIT 1),
    (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' ORDER BY m.ordem LIMIT 1)
  ) AS foto_alt,
  (SELECT count(*)::int FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto') AS total_fotos`;

/** Todas as suítes ativas, na ordem do painel. `null` = banco fora do ar. */
export async function lerSuitesAtivas(): Promise<SuiteResumo[] | null> {
  try {
    return await comSql(async (sql) => [...await sql<SuiteResumo[]>`
      SELECT ${colunasResumo(sql)} FROM quartos q WHERE q.ativo = true ORDER BY q.ordem, q.nome`]);
  } catch (e) {
    console.error("[SuitesNovo] banco indisponível:", (e as Error).message);
    return null;
  }
}

export type SuiteCompleta = SuiteResumo & {
  descricao: string | null; descricao_motor: string | null; vista: string | null; cat_nome: string | null;
};
export type Foto = { url: string; alt: string };
export type Video = { id: string; url: string; titulo: string | null; descricao: string | null; thumb_url: string | null; alt: string };

/** A suíte do endereço, com fotos, vídeos, comodidades, a regra de crianças e as outras suítes. `null` = não existe ou está desligada. */
export async function lerSuite(slug: string) {
  return comSql(async (sql) => {
    const [q] = await sql<SuiteCompleta[]>`
      SELECT ${colunasResumo(sql)}, q.descricao, q.descricao_motor, q.vista, c.nome AS cat_nome
      FROM quartos q LEFT JOIN categorias c ON c.id = q.categoria_id
      WHERE q.slug = ${slug} AND q.ativo = true`;
    if (!q) return null;
    const fotos = await sql<Foto[]>`
      SELECT url, alt FROM midias WHERE quarto_id = ${q.id} AND tipo = 'foto' ORDER BY destaque DESC, ordem, criado_em`;
    const videos = await sql<Video[]>`
      SELECT id, url, titulo, descricao, thumb_url, alt FROM midias
      WHERE quarto_id = ${q.id} AND tipo = 'video' ORDER BY ordem, criado_em`.catch(() => [] as Video[]);
    const comodidades = await sql<{ id: string; nome: string }[]>`
      SELECT cm.id, cm.nome FROM comodidades cm JOIN quarto_comodidades qc ON qc.comodidade_id = cm.id
      WHERE qc.quarto_id = ${q.id} ORDER BY cm.nome`.catch(() => [] as { id: string; nome: string }[]);
    const outras = await sql<SuiteResumo[]>`
      SELECT ${colunasResumo(sql)} FROM quartos q WHERE q.ativo = true AND q.id <> ${q.id}
      ORDER BY abs(q.ocupacao_max - ${q.ocupacao_max}), q.ordem, q.nome LIMIT 3`;
    const regras: Regras = await lerRegras(sql).catch(() => REGRAS_PADRAO);
    return { q, fotos: [...fotos], videos: [...videos], comodidades: [...comodidades], outras: [...outras], regras };
  });
}
