import type { Metadata } from "next";
import { comSql } from "@/lib/db-conexao";
import { pluralizar, resumir, tituloQuarto } from "@/lib/format";
import { IDENTIDADE } from "@/lib/conteudo-pousada";

/**
 * Endereço público do site e o que vai no <head> para buscadores e para a
 * prévia de link (WhatsApp, Facebook). Vale para os dois modelos do site
 * (Clássico e Novo): é do endereço, não do visual.
 */

/** Domínio oficial; o mesmo do sitemap e do robots. */
export const SITE_PADRAO = "https://www.pousadamarimarilhadomel.com.br";

export function urlDoSite(env: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (env?.trim() || SITE_PADRAO).replace(/\/+$/, "");
}

/**
 * O endereço canônico de uma página: sem a consulta (`/reservar?check_in=…`
 * e `/reservar` são a mesma página) e sem barra no fim. Painel e API não têm
 * canônico (`null`). Sem o caminho, `"./"`: o Next completa com o da página.
 */
export function caminhoCanonico(pathname: string | null | undefined): string | null {
  if (pathname == null || pathname === "") return "./";
  const limpo = pathname.split(/[?#]/)[0] || "/";
  if (/^\/(admin|api)(\/|$)/.test(limpo)) return null;
  return limpo.replace(/\/+$/, "") || "/";
}

type DadosSuite = { nome: string; ocupacao_max: number | null; descricao: string | null; descricao_motor: string | null };

/** Título e descrição da página de uma suíte (o texto do painel; sem ele, o do motor; sem os dois, uma frase com a capacidade). */
export function textoDaSuite(s: DadosSuite): { titulo: string; descricao: string } {
  const nome = tituloQuarto(s.nome) || "Suíte";
  const texto = (s.descricao?.trim() || s.descricao_motor?.trim() || "").replace(/\s+/g, " ");
  const pessoas = s.ocupacao_max && s.ocupacao_max > 0 ? ` para até ${pluralizar(s.ocupacao_max, "pessoa")}` : "";
  return {
    titulo: `${nome} — Pousada Marimar, Ilha do Mel`,
    descricao: texto
      ? resumir(texto, 155)
      : `${nome}${pessoas} na Pousada Marimar, em Encantadas, Ilha do Mel. Fotos, comodidades e o preço das suas datas.`,
  };
}

/**
 * Metadados da página de uma suíte: título e descrição próprios e a foto de
 * capa na prévia do link. Suíte desligada ou banco fora do ar: nada (fica o
 * padrão do site; a página cuida do 404).
 */
export async function metadadosDaSuite(slug: string): Promise<Metadata> {
  try {
    const [q] = await comSql((sql) => sql<(DadosSuite & { foto: string | null })[]>`
      SELECT q.nome, q.ocupacao_max, q.descricao, q.descricao_motor,
        (SELECT m.url FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto'
          ORDER BY m.destaque DESC, m.ordem, m.criado_em LIMIT 1) AS foto
      FROM quartos q WHERE q.slug = ${slug} AND q.ativo = true`);
    if (!q) return {};
    const { titulo, descricao } = textoDaSuite(q);
    return {
      title: titulo,
      description: descricao,
      /* Título e descrição da prévia vêm destes (o Next herda); a foto é a da suíte. */
      openGraph: {
        type: "website", locale: "pt_BR", siteName: IDENTIDADE.nome, url: `/quartos/${slug}`,
        ...(q.foto ? { images: [{ url: q.foto, alt: tituloQuarto(q.nome) }] } : {}),
      },
    };
  } catch (e) {
    console.error("[seo] suíte sem metadados:", slug, (e as Error).message);
    return {};
  }
}

/** Metadados da página de um pacote: nome, descrição e a imagem do pacote. Desligado ou banco fora do ar: nada. */
export async function metadadosDoPacote(slug: string): Promise<Metadata> {
  try {
    const [p] = await comSql((sql) => sql<{ nome: string; descricao: string | null; imagem_url: string | null }[]>`
      SELECT nome, descricao, imagem_url FROM pacotes WHERE slug = ${slug} AND ativo = true`);
    if (!p) return {};
    const texto = (p.descricao ?? "").replace(/\s+/g, " ").trim();
    return {
      title: `${p.nome} — Pousada Marimar, Ilha do Mel`,
      description: texto ? resumir(texto, 155) : `${p.nome}: pacote da Pousada Marimar, em Encantadas, Ilha do Mel.`,
      openGraph: {
        type: "website", locale: "pt_BR", siteName: IDENTIDADE.nome, url: `/pacotes/${slug}`,
        ...(p.imagem_url ? { images: [{ url: p.imagem_url, alt: p.nome }] } : {}),
      },
    };
  } catch (e) {
    console.error("[seo] pacote sem metadados:", slug, (e as Error).message);
    return {};
  }
}
