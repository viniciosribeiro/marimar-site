import type postgres from "postgres";
import { codigoItem } from "./marina-base";

/**
 * Roteiros de orientação da Marina ("Mídias de Orientação").
 *
 * Um roteiro é uma sequência pronta de etapas — vídeo, foto opcional e um
 * texto — que a Marina manda quando a pessoa pergunta algo que bate com os
 * gatilhos dele: "como chego?", "onde pego o barco?", "onde fica o
 * restaurante?". Ela não improvisa a ordem: manda etapa por etapa, como a
 * Cecília montou no painel.
 *
 * As mídias vêm da biblioteca (tabela `midias`). Para o WhatsApp vale a
 * versão leve (`url_whatsapp`, até ~16 MB); sem ela, o vídeo vai como link.
 * Ver docs/fluxo-midia.md.
 */

type Sql = ReturnType<typeof postgres>;

/** Acima disto o WhatsApp recusa o vídeo como mídia; vai como link. */
export const WHATSAPP_MAX_BYTES = 16 * 1024 * 1024;

export type MidiaEtapa = {
  id: string; tipo: "foto" | "video"; url: string; titulo: string | null; alt: string;
  thumb_url: string | null; duracao_seg: number | null; bytes: number | null;
  /** O que mandar no WhatsApp: a versão leve, o original se couber, ou null (vai como link). */
  url_whatsapp: string | null;
};

export type Etapa = {
  id: string; ordem: number; titulo: string | null; texto: string | null; ativo: boolean;
  video: MidiaEtapa | null; foto: MidiaEtapa | null;
};

export type Roteiro = {
  id: string; titulo: string; descricao: string | null; gatilhos: string[]; ativo: boolean; ordem: number;
  atualizado_em: string; etapas: Etapa[];
};

const listaDe = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];

/** O que pode ir como mídia no WhatsApp. */
export function midiaParaWhatsapp(m: { tipo: string; url: string; url_whatsapp: string | null; bytes: number | null; formato?: string | null }): string | null {
  if (m.url_whatsapp) return m.url_whatsapp;
  if (m.tipo === "foto") return m.url;
  /* Vídeo sem versão leve: só se for MP4 e couber. WebM o WhatsApp não toca. */
  if (m.bytes !== null && m.bytes <= WHATSAPP_MAX_BYTES && /mp4|quicktime/i.test(m.formato ?? m.url)) return m.url;
  return null;
}

/**
 * Lê os roteiros com etapas e mídias. `soAtivos` para a Marina (roteiro e
 * etapa desligados não existem para ela); o painel lê tudo.
 */
export async function lerRoteiros(sql: Sql, opcoes: { soAtivos?: boolean } = {}): Promise<Roteiro[]> {
  let roteiros: (Omit<Roteiro, "etapas" | "gatilhos"> & { gatilhos: unknown })[];
  try {
    roteiros = opcoes.soAtivos
      ? await sql`SELECT id, titulo, descricao, gatilhos, ativo, ordem, atualizado_em FROM marina_roteiros WHERE ativo = true ORDER BY ordem, criado_em`
      : await sql`SELECT id, titulo, descricao, gatilhos, ativo, ordem, atualizado_em FROM marina_roteiros ORDER BY ordem, criado_em`;
  } catch {
    return []; // antes da migration 0018
  }
  if (!roteiros.length) return [];

  const ids = roteiros.map((r) => r.id);
  const etapas = await sql<{
    id: string; roteiro_id: string; ordem: number; titulo: string | null; texto: string | null; ativo: boolean;
    video_id: string | null; foto_id: string | null;
  }[]>`SELECT id, roteiro_id, ordem, titulo, texto, ativo, video_id, foto_id
       FROM marina_roteiro_etapas WHERE roteiro_id IN ${sql(ids)} ORDER BY ordem, criado_em`;

  const midiaIds = [...new Set(etapas.flatMap((e) => [e.video_id, e.foto_id]).filter((x): x is string => !!x))];
  const midias = midiaIds.length
    ? await sql<{ id: string; tipo: string; url: string; titulo: string | null; alt: string; thumb_url: string | null;
        duracao_seg: number | null; bytes: number | null; url_whatsapp: string | null; formato: string | null }[]>`
        SELECT id, tipo, url, titulo, alt, thumb_url, duracao_seg, bytes, url_whatsapp, formato FROM midias WHERE id IN ${sql(midiaIds)}`
    : [];
  const porId = new Map(midias.map((m) => {
    const bytes = m.bytes === null ? null : Number(m.bytes);
    return [m.id, {
      id: m.id, tipo: m.tipo === "video" ? "video" : "foto", url: m.url, titulo: m.titulo, alt: m.alt,
      thumb_url: m.thumb_url, duracao_seg: m.duracao_seg === null ? null : Number(m.duracao_seg), bytes,
      url_whatsapp: midiaParaWhatsapp({ ...m, bytes }),
    } satisfies MidiaEtapa];
  }));

  return roteiros.map((r) => ({
    ...r,
    gatilhos: listaDe(r.gatilhos),
    atualizado_em: new Date(r.atualizado_em).toISOString(),
    etapas: etapas
      .filter((e) => e.roteiro_id === r.id && (!opcoes.soAtivos || e.ativo))
      .map((e) => ({
        id: e.id, ordem: e.ordem, titulo: e.titulo, texto: e.texto, ativo: e.ativo,
        video: e.video_id ? porId.get(e.video_id) ?? null : null,
        foto: e.foto_id ? porId.get(e.foto_id) ?? null : null,
      })),
  }));
}

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Qual roteiro responde a esta frase. Conta quantos gatilhos aparecem nela
 * (sem acento, sem caixa); empate fica com o de menor ordem. Sem nenhum
 * gatilho presente, nenhum roteiro — melhor a Marina responder normalmente
 * do que mandar um vídeo que não tem nada a ver.
 */
export function roteiroPara(roteiros: Roteiro[], frase: string): Roteiro | null {
  const f = semAcento(frase);
  let melhor: { r: Roteiro; pontos: number } | null = null;
  for (const r of roteiros) {
    const pontos = r.gatilhos.filter((g) => g && f.includes(semAcento(g))).length;
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { r, pontos };
  }
  return melhor?.r ?? null;
}

/**
 * O pedaço do treinamento que fala dos roteiros. Vai com as URLs: assim a
 * Marina não precisa de outra chamada para mandar — e o que ela manda é
 * exatamente o que está no painel. `codigos` é o mesmo da área de teste.
 */
export function roteirosEmTexto(roteiros: Roteiro[], opcoes: { codigos?: boolean; canal?: "whatsapp" | "site" } = {}): string {
  const ativos = roteiros.filter((r) => r.ativo && r.etapas.length);
  if (!ativos.length) return "";
  const canal = opcoes.canal ?? "whatsapp";
  const blocos = ativos.map((r) => {
    const cod = opcoes.codigos ? `[${codigoItem(r.id)}] ` : "";
    const etapas = r.etapas.map((e, i) => {
      const partes = [`  ${i + 1}. ${e.titulo ?? `Etapa ${i + 1}`}${e.texto ? ` — ${e.texto}` : ""}`];
      if (e.video) {
        const url = canal === "whatsapp" ? e.video.url_whatsapp : e.video.url;
        partes.push(url ? `     vídeo: ${url}` : `     vídeo (grande demais para mandar como mídia; mande como link): ${e.video.url}`);
      }
      if (e.foto) partes.push(`     foto: ${canal === "whatsapp" ? e.foto.url_whatsapp ?? e.foto.url : e.foto.url}`);
      return partes.join("\n");
    });
    return `• ${cod}${r.titulo}${r.descricao ? ` (${r.descricao})` : ""}\n  Quando usar: ${r.gatilhos.join("; ") || "quando pedirem este assunto"}\n${etapas.join("\n")}`;
  });
  return [
    "ROTEIROS DE ORIENTAÇÃO COM VÍDEO (cadastrados pela pousada):",
    "Quando a pergunta bater com um roteiro, mande as etapas NA ORDEM, uma por",
    "mensagem: primeiro o texto da etapa, junto o vídeo e a foto dela. Não pule",
    "etapa, não mude a ordem, não invente mídia. Se a pessoa só quer o",
    "resumo, mande o texto das etapas e ofereça os vídeos.",
    ...blocos,
  ].join("\n");
}
