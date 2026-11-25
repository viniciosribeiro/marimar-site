import type { Sql } from "./db-conexao";
import { SITE_OFICIAL, ehVideoNosso } from "./endereco-oficial";
import { MAX_FOTOS_WHATSAPP, urlFotoWhatsapp, urlFotoSecaoWhatsapp } from "./foto-whatsapp";
import { SECOES_FOTO } from "./fotos";

/**
 * As fotos, os vídeos e as páginas que a Marina pode mostrar, já escritos no
 * pedido que o site manda a ela (chat do site, área de teste do painel e
 * WhatsApp oficial).
 *
 * Por que existe: até 25/11 ela dependia de consultar `/api/agent/quartos`
 * por conta própria a cada pedido de foto. Quando a consulta atrasava ou ela
 * decidia não fazer, respondia "não consigo exibir as fotos aqui" e mandava um
 * link. Com a lista na mão, mostrar foto deixa de depender de uma consulta — e
 * os endereços já vêm certos (os do domínio oficial).
 *
 * É lido do banco a cada mensagem (regra do projeto: tudo em tempo real). Os
 * endereços das fotos são os mesmos das rotas `/api/agent/quartos` e
 * `/api/agent/fotos` — posição N da suíte ou da seção, na mesma ordem.
 */

export type CatalogoMidia = {
  suites: { nome: string; slug: string; ocupacao: number | null; fotos: number; videos: { titulo: string; url: string }[] }[];
  secoes: { chave: string; nome: string; fotos: number }[];
};

const lista = (n: number, url: (i: number) => string) =>
  Array.from({ length: Math.min(n, MAX_FOTOS_WHATSAPP) }, (_, i) => url(i)).join(" ");

/** O catálogo em texto, para a mensagem de sistema. Puro (tem teste). */
export function catalogoEmTexto(c: CatalogoMidia, site: string = SITE_OFICIAL): string {
  if (!c.suites.length && !c.secoes.some((s) => s.fotos)) return "";
  const linhas: string[] = [
    "FOTOS E VÍDEOS DISPONÍVEIS AGORA (lista lida do painel neste instante). Copie o",
    "endereço exatamente como está aqui, inteiro, sem trocar nada:",
  ];
  if (c.suites.length) {
    linhas.push("", "SUÍTES");
    for (const s of c.suites) {
      linhas.push(`• ${s.nome}${s.ocupacao ? ` (até ${s.ocupacao} pessoas)` : ""}`);
      linhas.push(`  página: ${site}/quartos/${s.slug}`);
      linhas.push(s.fotos
        ? `  fotos (${Math.min(s.fotos, MAX_FOTOS_WHATSAPP)}): ${lista(s.fotos, (i) => urlFotoWhatsapp(s.slug, i))}`
        : "  fotos: nenhuma cadastrada");
      for (const v of s.videos) linhas.push(`  vídeo "${v.titulo}": ${v.url}`);
    }
  }
  linhas.push("", "OUTRAS FOTOS DA POUSADA");
  for (const s of c.secoes) {
    linhas.push(s.fotos
      ? `• ${s.nome} (${Math.min(s.fotos, MAX_FOTOS_WHATSAPP)}): ${lista(s.fotos, (i) => urlFotoSecaoWhatsapp(s.chave, i))}`
      : `• ${s.nome}: nenhuma foto cadastrada`);
  }
  return linhas.join("\n");
}

/** Lê o catálogo do banco. Qualquer falha devolve vazio: o chat não pode cair por causa da lista. */
export async function lerCatalogoMidia(sql: Sql): Promise<CatalogoMidia> {
  const vazio: CatalogoMidia = { suites: [], secoes: [] };
  try {
    const [quartos, fotos, videos, secoes] = await Promise.all([
      sql<{ id: string; slug: string; nome: string; ocupacao_max: number | null }[]>`
        SELECT id, slug, nome, ocupacao_max FROM quartos WHERE ativo = true ORDER BY ordem`,
      sql<{ quarto_id: string; n: number }[]>`
        SELECT quarto_id, COUNT(*)::int AS n FROM midias
        WHERE quarto_id IS NOT NULL AND tipo = 'foto' AND visivel_marina = true GROUP BY quarto_id`,
      sql<{ quarto_id: string; url: string; titulo: string | null; alt: string | null }[]>`
        SELECT quarto_id, url, titulo, alt FROM midias
        WHERE quarto_id IS NOT NULL AND tipo = 'video' AND visivel_marina = true ORDER BY ordem ASC, criado_em ASC`,
      sql<{ secao: string; n: number }[]>`
        SELECT secao, COUNT(*)::int AS n FROM midias
        WHERE quarto_id IS NULL AND tipo = 'foto' AND visivel_marina = true GROUP BY secao`,
    ]);
    const fotosDe = new Map(fotos.map((f) => [f.quarto_id, f.n]));
    const totalDa = new Map(secoes.map((s) => [s.secao, s.n]));
    return {
      suites: quartos.filter((q) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(q.slug)).map((q) => ({
        nome: q.nome, slug: q.slug, ocupacao: q.ocupacao_max, fotos: fotosDe.get(q.id) ?? 0,
        videos: videos.filter((v) => v.quarto_id === q.id && ehVideoNosso(v.url))
          .map((v) => ({ titulo: (v.titulo || v.alt || "Vídeo da suíte").replace(/["\n]/g, " ").slice(0, 60), url: v.url })),
      })),
      secoes: SECOES_FOTO.filter((s) => s.chave !== "quarto").map((s) => ({ chave: s.chave, nome: s.nome, fotos: totalDa.get(s.chave) ?? 0 })),
    };
  } catch (e) {
    console.error("[catalogo-midia] não li:", (e as Error).message);
    return vazio;
  }
}

/** Pronto para colar na mensagem de sistema ("" se não houver nada). */
export async function montarCatalogoMidia(sql: Sql): Promise<string> {
  return catalogoEmTexto(await lerCatalogoMidia(sql));
}
