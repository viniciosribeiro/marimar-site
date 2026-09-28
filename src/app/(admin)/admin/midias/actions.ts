"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql, type Sql } from "@/lib/db-conexao";
import { secaoValida } from "@/lib/fotos";
import { urlDoNossoBlob } from "@/lib/blob";

/**
 * Fotos do site: pousada, suítes, restaurante, café, praia e eventos.
 *
 * Substitui a tela antiga, que só aceitava colar uma URL e digitar o ID
 * interno do quarto à mão — sem envio de arquivo, sem miniatura, sem ordem,
 * sem capa e sem dizer a que parte do site a foto pertencia.
 */

/** Tudo que mostra foto: a galeria, a home, as suítes, o restaurante. */
function refrescar() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/midias");
}

/** Volta para a mesma aba (seção + suíte) em que a pessoa estava. */
function voltar(fd: FormData, msg: string, erro = false) {
  refrescar();
  const q = new URLSearchParams();
  const secao = fd.get("voltar_secao");
  const quarto = fd.get("voltar_quarto");
  if (typeof secao === "string" && secao) q.set("secao", secao);
  if (typeof quarto === "string" && quarto) q.set("quarto", quarto);
  q.set(erro ? "erro" : "ok", msg);
  redirect(`/admin/midias?${q.toString()}`);
}

/** Próxima posição dentro do grupo (a mesma seção, ou a mesma suíte). */
async function proximaOrdem(sql: Sql, secao: string, quartoId: string | null) {
  const [r] = quartoId
    ? await sql`SELECT coalesce(max(ordem), -1) + 1 AS n FROM midias WHERE quarto_id = ${quartoId}`
    : await sql`SELECT coalesce(max(ordem), -1) + 1 AS n FROM midias WHERE secao = ${secao} AND quarto_id IS NULL`;
  return Number(r?.n ?? 0);
}

/**
 * Grava a foto que o navegador acabou de enviar ao Blob.
 *
 * Chamada pelo cliente logo após o envio, como no cardápio: o callback do
 * Blob não alcança localhost, e a foto sumiria em desenvolvimento.
 */
export async function registrarMidia(dados: {
  url: string; pathname: string; alt: string; secao: string; quartoId: string | null;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    await exigirSessao();
  } catch {
    return { ok: false, erro: "Sessão expirada. Entre de novo." };
  }
  if (!urlDoNossoBlob(dados.url)) return { ok: false, erro: "Endereço de arquivo inválido." };

  const quartoId = dados.quartoId || null;
  const secao = quartoId ? "quarto" : secaoValida(dados.secao);
  try {
    await comSql(async (sql) => {
      const ordem = await proximaOrdem(sql, secao, quartoId);
      // A primeira foto de uma suíte vira a capa dela: a suíte aparece com
      // imagem na lista sem exigir mais um clique.
      const capa = quartoId ? ordem === 0 : false;
      await sql`
        INSERT INTO midias (url, pathname, alt, secao, quarto_id, ordem, destaque)
        VALUES (${dados.url}, ${dados.pathname}, ${dados.alt.slice(0, 300) || "Foto da Pousada Marimar"},
                ${secao}, ${quartoId}, ${ordem}, ${capa})`;
    });
    refrescar();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Foto por endereço (ex.: uma foto do motor de reservas). */
export async function adicionarPorUrl(fd: FormData) {
  await exigirSessao();
  const url = String(fd.get("url") ?? "").trim();
  const alt = String(fd.get("alt") ?? "").trim();
  const quartoId = String(fd.get("quarto_id") ?? "") || null;
  const secao = quartoId ? "quarto" : secaoValida(fd.get("secao"));
  if (!/^https:\/\//.test(url)) voltar(fd, "Informe um endereço começando com https://", true);
  if (!alt) voltar(fd, "Descreva a foto (ajuda quem usa leitor de tela e o Google).", true);
  await comSql(async (sql) => {
    const ordem = await proximaOrdem(sql, secao, quartoId);
    await sql`INSERT INTO midias (url, alt, secao, quarto_id, ordem) VALUES (${url}, ${alt}, ${secao}, ${quartoId}, ${ordem})`;
  });
  voltar(fd, "Foto adicionada");
}

export async function salvarDescricao(fd: FormData) {
  await exigirSessao();
  const alt = String(fd.get("alt") ?? "").trim().slice(0, 300);
  if (!alt) voltar(fd, "A descrição não pode ficar vazia.", true);
  await comSql((sql) => sql`UPDATE midias SET alt = ${alt} WHERE id = ${String(fd.get("id"))}`);
  voltar(fd, "Descrição salva");
}

/**
 * Muda a foto de lugar: outra seção, ou outra suíte.
 *
 * O destino vem como "secao:restaurante" ou "quarto:<id>". Era o que faltava
 * para desfazer a mistura da galeria: as fotos importadas do site antigo
 * entraram todas como "A pousada".
 */
export async function reclassificar(fd: FormData) {
  await exigirSessao();
  const id = String(fd.get("id"));
  const [tipo, valor] = String(fd.get("destino") ?? "").split(":");
  const quartoId = tipo === "quarto" && valor ? valor : null;
  const secao = quartoId ? "quarto" : secaoValida(valor);
  await comSql(async (sql) => {
    const ordem = await proximaOrdem(sql, secao, quartoId);
    // Destaque não viaja: capa de uma suíte não vira foto do topo do site.
    await sql`UPDATE midias SET secao = ${secao}, quarto_id = ${quartoId}, ordem = ${ordem}, destaque = false WHERE id = ${id}`;
  });
  voltar(fd, "Foto movida");
}

/**
 * Destaque.
 *
 * Numa suíte, é a CAPA (uma só por suíte). Em "A pousada", é a foto do TOPO
 * do site quando não há banner cadastrado — também uma só.
 */
export async function alternarDestaque(fd: FormData) {
  await exigirSessao();
  const id = String(fd.get("id"));
  await comSql(async (sql) => {
    const [f] = await sql<{ destaque: boolean; quarto_id: string | null; secao: string }[]>`
      SELECT destaque, quarto_id, secao FROM midias WHERE id = ${id}`;
    if (!f) return;
    if (!f.destaque) {
      if (f.quarto_id) await sql`UPDATE midias SET destaque = false WHERE quarto_id = ${f.quarto_id}`;
      else await sql`UPDATE midias SET destaque = false WHERE quarto_id IS NULL AND secao = ${f.secao}`;
    }
    await sql`UPDATE midias SET destaque = ${!f.destaque} WHERE id = ${id}`;
  });
  voltar(fd, "Destaque atualizado");
}

export async function moverOrdem(fd: FormData) {
  await exigirSessao();
  const id = String(fd.get("id"));
  const direcao = String(fd.get("direcao"));
  await comSql(async (sql) => {
    const [f] = await sql<{ quarto_id: string | null; secao: string }[]>`SELECT quarto_id, secao FROM midias WHERE id = ${id}`;
    if (!f) return;
    const lista = f.quarto_id
      ? await sql<{ id: string }[]>`SELECT id FROM midias WHERE quarto_id = ${f.quarto_id} ORDER BY ordem, criado_em`
      : await sql<{ id: string }[]>`SELECT id FROM midias WHERE quarto_id IS NULL AND secao = ${f.secao} ORDER BY ordem, criado_em`;
    const i = lista.findIndex((x) => x.id === id);
    const j = direcao === "antes" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    // Renumera o grupo inteiro: ordens repetidas (comuns nas fotos
    // importadas) faziam a troca de duas posições não mudar nada.
    for (let k = 0; k < lista.length; k++) {
      await sql`UPDATE midias SET ordem = ${k} WHERE id = ${lista[k].id}`;
    }
  });
  voltar(fd, "Ordem atualizada");
}

/**
 * Exclui a foto. O arquivo sai do Blob só se nenhuma outra linha usar a
 * mesma URL — a mesma foto pode estar na galeria e numa suíte.
 */
export async function excluir(fd: FormData) {
  await exigirSessao();
  const id = String(fd.get("id"));
  const apagar = await comSql(async (sql) => {
    const [f] = await sql<{ url: string; pathname: string | null }[]>`DELETE FROM midias WHERE id = ${id} RETURNING url, pathname`;
    if (!f || !urlDoNossoBlob(f.url)) return null;
    const [outra] = await sql`SELECT 1 FROM midias WHERE url = ${f.url} LIMIT 1`;
    return outra ? null : f.url;
  });
  if (apagar && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import("@vercel/blob");
      await del(apagar);
    } catch (e) {
      console.error("[midias] arquivo não removido do storage:", (e as Error).message);
    }
  }
  voltar(fd, "Foto excluída");
}
