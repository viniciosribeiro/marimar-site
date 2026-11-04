import { comSql } from "@/lib/db-conexao";
import { lerConteudo, padroes, type Conteudo } from "@/lib/conteudo-editavel";

/** O conteúdo editável (Admin → Ilha, chegada e eventos); sem banco, o padrão do código. */
export async function conteudoDoPainel(): Promise<Conteudo> {
  return comSql(lerConteudo).catch(() => padroes());
}

/**
 * A melhor foto de uma seção da biblioteca (Fotos e vídeos), para o topo das
 * páginas de conteúdo: a capa do álbum, senão a mais larga. `alt` vira o
 * texto alternativo; sem foto, nulo (a página fica só com o texto).
 */
export async function fotoDaSecao(secoes: string[], preferirAerea = false): Promise<{ url: string; alt: string } | null> {
  try {
    const [f] = await comSql((sql) => sql<{ url: string; alt: string | null }[]>`
      SELECT url, alt FROM midias
      WHERE quarto_id IS NULL AND tipo = 'foto' AND secao = ANY(${secoes})
      ORDER BY ${preferirAerea ? sql`(alt ILIKE '%aérea%' OR url ILIKE '%dji%') DESC,` : sql``}
        array_position(${secoes}::text[], secao), destaque DESC, largura DESC NULLS LAST, ordem, criado_em
      LIMIT 1`);
    return f ? { url: f.url, alt: f.alt || "" } : null;
  } catch {
    return null;
  }
}
