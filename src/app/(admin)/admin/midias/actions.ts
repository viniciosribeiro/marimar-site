"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql, type Sql } from "@/lib/db-conexao";
import { secaoValida } from "@/lib/fotos";
import { urlDoNossoBlob } from "@/lib/blob";
import { SECAO_ORIENTACAO } from "@/lib/biblioteca";

/**
 * Ações da biblioteca de mídia (fotos e vídeos).
 *
 * Devolvem `{ ok, mensagem }` (a tela mostra o aviso e recarrega sem perder
 * seleção nem filtros). Todas começam por `exigirSessao()`.
 */

export type Resultado = { ok: boolean; mensagem: string; ids?: string[] };

/** Tudo que mostra mídia: a galeria, a home, as suítes, a Marina. */
function refrescar() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/midias");
  revalidatePath("/admin/marina");
}

/** "secao:restaurante" | "quarto:<uuid>" | "secao:orientacao" → colunas. */
function destino(album: string): { secao: string; quartoId: string | null } {
  const [tipo, valor] = album.split(":");
  if (tipo === "quarto" && /^[0-9a-f-]{36}$/i.test(valor ?? "")) return { secao: "quarto", quartoId: valor };
  if (valor === SECAO_ORIENTACAO.chave) return { secao: SECAO_ORIENTACAO.chave, quartoId: null };
  return { secao: secaoValida(valor), quartoId: null };
}

async function proximaOrdem(sql: Sql, secao: string, quartoId: string | null, tipo: string) {
  const [r] = quartoId
    ? await sql`SELECT coalesce(max(ordem), -1) + 1 AS n FROM midias WHERE quarto_id = ${quartoId} AND tipo = ${tipo}`
    : await sql`SELECT coalesce(max(ordem), -1) + 1 AS n FROM midias WHERE secao = ${secao} AND quarto_id IS NULL AND tipo = ${tipo}`;
  return Number(r?.n ?? 0);
}

const url = (v: unknown) => (typeof v === "string" && urlDoNossoBlob(v) ? v : null);
const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export type NovaMidia = {
  album: string;
  tipo: "foto" | "video";
  url: string; pathname: string;
  alt?: string; titulo?: string; descricao?: string;
  largura?: number; altura?: number; bytes?: number; formato?: string; duracao?: number;
  thumbUrl?: string | null; thumbPathname?: string | null;
  whatsappUrl?: string | null; whatsappPathname?: string | null; whatsappBytes?: number | null;
};

/**
 * Grava a mídia que o navegador acabou de enviar ao Blob.
 *
 * Chamada pelo cliente logo após o envio (o callback do Blob não alcança
 * localhost). Só aceita arquivos do nosso Blob.
 */
export async function registrarMidia(m: NovaMidia): Promise<Resultado> {
  try { await exigirSessao(); } catch { return { ok: false, mensagem: "Sessão expirada. Entre de novo." }; }
  const principal = url(m.url);
  if (!principal) return { ok: false, mensagem: "Endereço de arquivo inválido." };
  const tipo = m.tipo === "video" ? "video" : "foto";
  const { secao, quartoId } = destino(m.album);
  const alt = texto(m.alt, 300) ?? texto(m.titulo, 300) ?? (tipo === "video" ? "Vídeo da Pousada Marimar" : "Foto da Pousada Marimar");

  try {
    const id = await comSql(async (sql) => {
      const ordem = await proximaOrdem(sql, secao, quartoId, tipo);
      /* A primeira foto de uma suíte vira a capa dela. */
      const capa = tipo === "foto" && quartoId ? ordem === 0 : false;
      const [linha] = await sql<{ id: string }[]>`
        INSERT INTO midias (url, pathname, alt, tipo, secao, quarto_id, ordem, destaque,
          titulo, descricao, largura, altura, bytes, formato, duracao_seg,
          thumb_url, thumb_pathname, url_whatsapp, pathname_whatsapp, bytes_whatsapp)
        VALUES (${principal}, ${texto(m.pathname, 500)}, ${alt}, ${tipo}, ${secao}, ${quartoId}, ${ordem}, ${capa},
          ${texto(m.titulo, 200)}, ${texto(m.descricao, 1000)}, ${numero(m.largura)}, ${numero(m.altura)},
          ${numero(m.bytes)}, ${texto(m.formato, 60)}, ${numero(m.duracao)},
          ${url(m.thumbUrl)}, ${texto(m.thumbPathname, 500)}, ${url(m.whatsappUrl)}, ${texto(m.whatsappPathname, 500)}, ${numero(m.whatsappBytes)})
        RETURNING id`;
      return linha.id;
    });
    refrescar();
    return { ok: true, mensagem: tipo === "video" ? "Vídeo enviado." : "Foto enviada.", ids: [id] };
  } catch (e) {
    return { ok: false, mensagem: `Não consegui guardar (${(e as Error).message}).` };
  }
}

/** Título, legenda, texto alternativo e se a Marina pode enviar. */
export async function editarMidia(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  const id = String(fd.get("id") ?? "");
  const alt = texto(fd.get("alt"), 300);
  if (!id) return { ok: false, mensagem: "Mídia não encontrada." };
  if (!alt) return { ok: false, mensagem: "Descreva a imagem em “Texto alternativo” — ajuda quem usa leitor de tela e o Google." };
  await comSql((sql) => sql`
    UPDATE midias SET alt = ${alt}, titulo = ${texto(fd.get("titulo"), 200)}, descricao = ${texto(fd.get("descricao"), 1000)},
      visivel_marina = ${fd.get("visivel_marina") === "on"}, atualizado_em = now()
    WHERE id = ${id}`);
  refrescar();
  return { ok: true, mensagem: "Salvo." };
}

/**
 * Capa com um clique. Numa suíte, é a foto que abre a galeria dela e
 * aparece na lista; numa seção, a foto principal (em "A pousada", a do topo
 * quando não há banner). Uma só por álbum.
 */
export async function definirCapa(id: string): Promise<Resultado> {
  await exigirSessao();
  const r = await comSql(async (sql) => {
    const [m] = await sql<{ quarto_id: string | null; secao: string; tipo: string; destaque: boolean }[]>`
      SELECT quarto_id, secao, tipo, destaque FROM midias WHERE id = ${id}`;
    if (!m) return { ok: false, mensagem: "Mídia não encontrada." };
    if (m.tipo !== "foto") return { ok: false, mensagem: "A capa precisa ser uma foto." };
    if (m.quarto_id) await sql`UPDATE midias SET destaque = false WHERE quarto_id = ${m.quarto_id}`;
    else await sql`UPDATE midias SET destaque = false WHERE quarto_id IS NULL AND secao = ${m.secao}`;
    if (!m.destaque) await sql`UPDATE midias SET destaque = true WHERE id = ${id}`;
    return { ok: true, mensagem: m.destaque ? "Capa removida." : "Definida como capa." };
  });
  refrescar();
  return r;
}

/** Nova ordem de um álbum, como ficou depois de arrastar. */
export async function reordenar(ids: string[]): Promise<Resultado> {
  await exigirSessao();
  const lista = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
  await comSql(async (sql) => {
    for (let i = 0; i < lista.length; i++) await sql`UPDATE midias SET ordem = ${i} WHERE id = ${lista[i]}`;
  });
  refrescar();
  return { ok: true, mensagem: "Ordem salva." };
}

/** Mover várias de uma vez para outro álbum (seção ou suíte). */
export async function moverLote(ids: string[], album: string): Promise<Resultado> {
  await exigirSessao();
  const { secao, quartoId } = destino(album);
  const lista = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
  await comSql(async (sql) => {
    for (const id of lista) {
      const [m] = await sql<{ tipo: string }[]>`SELECT tipo FROM midias WHERE id = ${id}`;
      if (!m) continue;
      const ordem = await proximaOrdem(sql, secao, quartoId, m.tipo);
      /* Capa não viaja: a capa de uma suíte não vira foto do topo do site. */
      await sql`UPDATE midias SET secao = ${secao}, quarto_id = ${quartoId}, ordem = ${ordem}, destaque = false, atualizado_em = now() WHERE id = ${id}`;
    }
  });
  refrescar();
  return { ok: true, mensagem: lista.length === 1 ? "Movida." : `${lista.length} movidas.` };
}

/**
 * Excluir várias. Os arquivos (principal, miniatura, versão do WhatsApp)
 * saem do armazenamento só se nenhuma outra mídia usar o mesmo endereço.
 */
export async function excluirLote(ids: string[]): Promise<Resultado> {
  await exigirSessao();
  const lista = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
  const apagar = await comSql(async (sql) => {
    const arquivos: string[] = [];
    for (const id of lista) {
      const [m] = await sql<{ url: string; thumb_url: string | null; url_whatsapp: string | null }[]>`
        DELETE FROM midias WHERE id = ${id} RETURNING url, thumb_url, url_whatsapp`;
      if (!m) continue;
      for (const u of [m.url, m.thumb_url, m.url_whatsapp]) {
        if (!u || !urlDoNossoBlob(u)) continue;
        const [outra] = await sql`SELECT 1 FROM midias WHERE url = ${u} OR thumb_url = ${u} OR url_whatsapp = ${u} LIMIT 1`;
        if (!outra) arquivos.push(u);
      }
    }
    return arquivos;
  });
  if (apagar.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import("@vercel/blob");
      await del(apagar);
    } catch (e) {
      console.error("[midias] arquivos não removidos do storage:", (e as Error).message);
    }
  }
  refrescar();
  return { ok: true, mensagem: lista.length === 1 ? "Excluída." : `${lista.length} excluídas.` };
}

/** Foto por endereço (ex.: uma foto do motor de reservas). */
export async function adicionarPorUrl(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  const endereco = String(fd.get("url") ?? "").trim();
  const alt = texto(fd.get("alt"), 300);
  if (!/^https:\/\//.test(endereco)) return { ok: false, mensagem: "Informe um endereço começando com https://" };
  if (!alt) return { ok: false, mensagem: "Descreva a foto." };
  const { secao, quartoId } = destino(String(fd.get("album") ?? "secao:pousada"));
  await comSql(async (sql) => {
    const ordem = await proximaOrdem(sql, secao, quartoId, "foto");
    await sql`INSERT INTO midias (url, alt, secao, quarto_id, ordem) VALUES (${endereco}, ${alt}, ${secao}, ${quartoId}, ${ordem})`;
  });
  refrescar();
  return { ok: true, mensagem: "Foto adicionada." };
}
