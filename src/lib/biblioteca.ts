import type postgres from "postgres";
import { SECOES_FOTO, nomeSecao } from "./fotos";

/**
 * Biblioteca de mídia: a leitura que o painel usa.
 *
 * Uma tabela só (`midias`) para fotos e vídeos de todo o site — suítes,
 * seções da galeria, roteiros da Marina. O que muda é o "álbum": a seção
 * (ou a suíte) a que a mídia pertence. Ver docs/fluxo-midia.md.
 */

type Sql = ReturnType<typeof postgres>;

/** Seção só da Marina: roteiros de orientação. Não aparece na galeria do site. */
export const SECAO_ORIENTACAO = { chave: "orientacao", nome: "Orientação (Marina)", descricao: "Vídeos e fotos dos roteiros de como chegar" };

export type Album = { chave: string; nome: string; descricao: string; total: number; capa: string | null; quartoAtivo?: boolean };

export type Uso = { onde: string; tipo: "site" | "marina" | "interno"; href?: string };

export type MidiaBiblioteca = {
  id: string; url: string; tipo: "foto" | "video"; alt: string; titulo: string | null; descricao: string | null;
  secao: string; quarto_id: string | null; destaque: boolean; ordem: number;
  thumb_url: string | null; duracao_seg: number | null; bytes: number | null; formato: string | null;
  largura: number | null; altura: number | null;
  url_whatsapp: string | null; bytes_whatsapp: number | null; visivel_marina: boolean;
  criado_em: string; usos: Uso[];
};

/** Chave do álbum: "secao:pousada", "quarto:<id>", "secao:orientacao". */
export const albumDe = (m: { secao: string; quarto_id: string | null }) =>
  m.quarto_id ? `quarto:${m.quarto_id}` : `secao:${m.secao}`;

export async function lerBiblioteca(sql: Sql) {
  /* Colunas da 0018 com fallback: a tela abre antes da migration também. */
  let linhas: Omit<MidiaBiblioteca, "usos">[] = [];
  try {
    linhas = await sql<Omit<MidiaBiblioteca, "usos">[]>`
      SELECT id, url, tipo, alt, titulo, descricao, secao, quarto_id, destaque, ordem,
             thumb_url, duracao_seg, bytes, formato, largura, altura,
             url_whatsapp, bytes_whatsapp, visivel_marina, criado_em
      FROM midias ORDER BY ordem ASC, criado_em ASC`;
  } catch {
    linhas = (await sql<Omit<MidiaBiblioteca, "usos">[]>`
      SELECT id, url, tipo, alt, secao, quarto_id, destaque, ordem, largura, altura, criado_em
      FROM midias ORDER BY ordem ASC, criado_em ASC`).map((l) => ({
        ...l, titulo: null, descricao: null, thumb_url: null, duracao_seg: null, bytes: null, formato: null,
        url_whatsapp: null, bytes_whatsapp: null, visivel_marina: true,
      }));
  }

  const quartos = await sql<{ id: string; nome: string; ativo: boolean; ordem: number }[]>`
    SELECT id, nome, ativo, ordem FROM quartos ORDER BY ativo DESC, ordem, nome`;

  /* Onde cada mídia aparece. Uma consulta por fonte, não por mídia. */
  const etapas = await sql<{ video_id: string | null; foto_id: string | null; roteiro: string; ordem: number; ativo: boolean }[]>`
    SELECT e.video_id, e.foto_id, r.titulo AS roteiro, e.ordem, r.ativo
    FROM marina_roteiro_etapas e JOIN marina_roteiros r ON r.id = e.roteiro_id`.catch(() => []);
  const porUrl = new Map<string, Uso[]>();
  const anotar = (url: string | null, uso: Uso) => { if (url) porUrl.set(url, [...(porUrl.get(url) ?? []), uso]); };
  const b = await sql<{ imagem_url: string; video_url: string | null; titulo: string | null }[]>`SELECT imagem_url, video_url, titulo FROM banners`.catch(() => []);
  for (const x of b) { anotar(x.imagem_url, { onde: `Banner do topo${x.titulo ? `: ${x.titulo}` : ""}`, tipo: "site", href: "/admin/banners" }); anotar(x.video_url, { onde: "Banner do topo (vídeo)", tipo: "site", href: "/admin/banners" }); }
  const bi = await sql<{ imagem_url: string | null }[]>`SELECT imagem_url FROM blocos_itens`.catch(() => []);
  for (const x of bi) anotar(x.imagem_url, { onde: "Cartão da página inicial", tipo: "site", href: "/admin/cartoes" });
  const bh = await sql<{ imagem_url: string | null; tipo: string }[]>`SELECT imagem_url, tipo::text AS tipo FROM blocos_home`.catch(() => []);
  for (const x of bh) anotar(x.imagem_url, { onde: `Bloco da home (${x.tipo})`, tipo: "site", href: "/admin/blocos-home" });
  const po = await sql<{ og_image_url: string | null; logo_url: string | null }[]>`SELECT og_image_url, logo_url FROM pousada`.catch(() => []);
  for (const x of po) { anotar(x.og_image_url, { onde: "Imagem de compartilhamento", tipo: "site", href: "/admin/identidade-visual" }); anotar(x.logo_url, { onde: "Logo", tipo: "site", href: "/admin/identidade-visual" }); }

  const nomeQuarto = new Map(quartos.map((q) => [q.id, q]));
  const midias: MidiaBiblioteca[] = linhas.map((m) => {
    const usos: Uso[] = [];
    if (m.quarto_id) {
      const q = nomeQuarto.get(m.quarto_id);
      const nome = q?.nome ?? "suíte removida";
      usos.push({ onde: `${m.tipo === "video" ? "Vídeos" : "Galeria"} da suíte ${nome}${q && !q.ativo ? " (suíte escondida)" : ""}`, tipo: "site", href: `/admin/midias?album=quarto:${m.quarto_id}` });
      if (m.destaque && m.tipo === "foto") usos.push({ onde: `Capa da suíte ${nome}`, tipo: "site" });
      if (m.visivel_marina) usos.push({ onde: `Marina envia quando pedem ${m.tipo === "video" ? "vídeo" : "foto"} da suíte`, tipo: "marina" });
    } else if (m.secao === SECAO_ORIENTACAO.chave) {
      /* anotado pelas etapas abaixo */
    } else if (m.tipo === "foto") {
      usos.push({ onde: `Galeria do site — ${nomeSecao(m.secao)}`, tipo: "site" });
      if (m.destaque) usos.push({ onde: m.secao === "pousada" ? "Foto do topo do site (quando não há banner)" : `Foto principal de ${nomeSecao(m.secao)}`, tipo: "site" });
    }
    for (const e of etapas) {
      if (e.video_id === m.id || e.foto_id === m.id) {
        usos.push({ onde: `Roteiro “${e.roteiro}”, etapa ${e.ordem + 1}${e.ativo ? "" : " (roteiro desligado)"}`, tipo: "marina", href: "/admin/marina?aba=roteiros" });
      }
    }
    for (const u of porUrl.get(m.url) ?? []) usos.push(u);
    return { ...m, duracao_seg: m.duracao_seg === null ? null : Number(m.duracao_seg), bytes: m.bytes === null ? null : Number(m.bytes), bytes_whatsapp: m.bytes_whatsapp === null ? null : Number(m.bytes_whatsapp), criado_em: new Date(m.criado_em).toISOString(), usos };
  });

  const albuns: Album[] = [
    ...SECOES_FOTO.filter((s) => s.chave !== "quarto").map((s) => ({ chave: `secao:${s.chave}`, nome: s.nome, descricao: s.descricao })),
    ...quartos.map((q) => ({ chave: `quarto:${q.id}`, nome: q.nome, descricao: q.ativo ? "Suíte" : "Suíte escondida do site", quartoAtivo: q.ativo })),
    { chave: `secao:${SECAO_ORIENTACAO.chave}`, nome: SECAO_ORIENTACAO.nome, descricao: SECAO_ORIENTACAO.descricao },
  ].map((a) => {
    const itens = midias.filter((m) => albumDe(m) === a.chave);
    const capa = itens.find((m) => m.destaque && m.tipo === "foto") ?? itens.find((m) => m.tipo === "foto") ?? itens[0];
    return { ...a, total: itens.length, capa: capa ? (capa.tipo === "video" ? capa.thumb_url : capa.url) : null };
  });

  return { midias, albuns, quartos };
}
