"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { del } from "@vercel/blob";
import { auth } from "@/lib/auth";

async function conectar() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  return postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
}

function voltar(msg: string, erro = false) {
  revalidatePath("/");
  revalidatePath("/admin/banners");
  redirect(`/admin/banners?${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/**
 * `datetime-local` manda "2026-12-24T18:00" — sem fuso.
 *
 * Interpretamos como horario de quem administra a pousada, que e o unico
 * que faz sentido para ela: "tira do ar dia 24 as 18h" e 18h em Encantadas.
 * Guardar como `timestamp` sem fuso mantem a leitura igual na volta.
 */
const quando = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  return v ? v.replace("T", " ") : null;
};

export async function salvarBanner(fd: FormData) {
  const id = txt(fd, "id");
  const imagem = txt(fd, "imagem_url");
  if (!imagem) voltar("Envie a imagem do banner", true);

  const inicia = quando(fd, "inicia_em");
  const termina = quando(fd, "termina_em");
  if (inicia && termina && termina <= inicia) {
    voltar("A data final precisa ser depois da inicial", true);
  }

  const dados = {
    titulo: txt(fd, "titulo"),
    subtitulo: txt(fd, "subtitulo"),
    imagem_url: imagem,
    imagem_pathname: txt(fd, "imagem_pathname"),
    alt: txt(fd, "alt"),
    cta_texto: txt(fd, "cta_texto"),
    cta_href: txt(fd, "cta_href"),
    ordem: Number(txt(fd, "ordem") ?? 0) || 0,
    ativo: fd.get("ativo") === "on",
  };

  const sql = await conectar();
  try {
    if (id) {
      await sql`
        UPDATE banners SET
          titulo = ${dados.titulo}, subtitulo = ${dados.subtitulo},
          imagem_url = ${dados.imagem_url}, imagem_pathname = ${dados.imagem_pathname},
          alt = ${dados.alt}, cta_texto = ${dados.cta_texto}, cta_href = ${dados.cta_href},
          ordem = ${dados.ordem}, ativo = ${dados.ativo},
          inicia_em = ${inicia}::timestamp, termina_em = ${termina}::timestamp
        WHERE id = ${id}::uuid`;
    } else {
      await sql`
        INSERT INTO banners
          (titulo, subtitulo, imagem_url, imagem_pathname, alt, cta_texto, cta_href, ordem, ativo, inicia_em, termina_em)
        VALUES
          (${dados.titulo}, ${dados.subtitulo}, ${dados.imagem_url}, ${dados.imagem_pathname},
           ${dados.alt}, ${dados.cta_texto}, ${dados.cta_href}, ${dados.ordem}, ${dados.ativo},
           ${inicia}::timestamp, ${termina}::timestamp)`;
    }
  } finally {
    await sql.end();
  }
  voltar(id ? "Banner atualizado" : "Banner criado");
}

export async function alternarBanner(fd: FormData) {
  const id = txt(fd, "id");
  if (!id) voltar("Banner não encontrado", true);
  const sql = await conectar();
  try {
    await sql`UPDATE banners SET ativo = NOT ativo WHERE id = ${id}::uuid`;
  } finally {
    await sql.end();
  }
  voltar("Situação alterada");
}

/** Sobe ou desce na ordem trocando `ordem` com o vizinho. */
export async function moverBanner(fd: FormData) {
  const id = txt(fd, "id");
  const direcao = txt(fd, "direcao");
  if (!id || !direcao) voltar("Movimento inválido", true);

  const sql = await conectar();
  try {
    const lista = await sql<{ id: string }[]>`
      SELECT id FROM banners ORDER BY ordem, criado_em`;
    const i = lista.findIndex((b) => b.id === id);
    const j = direcao === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) voltar("Já está na ponta");

    // Reescreve a ordem inteira: mais simples de raciocinar do que trocar
    // dois numeros, e conserta de quebra qualquer empate herdado.
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    for (let k = 0; k < nova.length; k++) {
      await sql`UPDATE banners SET ordem = ${k} WHERE id = ${nova[k].id}::uuid`;
    }
  } finally {
    await sql.end();
  }
  voltar("Ordem atualizada");
}

export async function excluirBanner(fd: FormData) {
  const id = txt(fd, "id");
  if (!id) voltar("Banner não encontrado", true);

  const sql = await conectar();
  let pathname: string | null = null;
  try {
    const [b] = await sql<{ imagem_pathname: string | null }[]>`
      SELECT imagem_pathname FROM banners WHERE id = ${id}::uuid`;
    pathname = b?.imagem_pathname ?? null;
    await sql`DELETE FROM banners WHERE id = ${id}::uuid`;
  } finally {
    await sql.end();
  }

  // O arquivo sai depois do registro, e a falha dele nao derruba a exclusao:
  // banner fantasma no site e pior do que imagem orfa no storage.
  if (pathname) {
    try {
      await del(pathname);
    } catch (e) {
      console.error("[banners] registro excluido, arquivo ficou no Blob:", (e as Error).message);
    }
  }
  voltar("Banner excluído");
}
