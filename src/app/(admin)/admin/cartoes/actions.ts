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
  revalidatePath("/admin/cartoes");
  redirect(`/admin/cartoes?${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

export async function salvarCartao(fd: FormData) {
  const id = txt(fd, "id");
  const blocoId = txt(fd, "bloco_id");
  const titulo = txt(fd, "titulo");
  if (!blocoId) voltar("Escolha a seção", true);
  if (!titulo) voltar("Informe o título do cartão", true);

  const dados = {
    bloco_id: blocoId,
    icone: txt(fd, "icone"),
    cor: txt(fd, "cor") ?? "marca",
    titulo,
    texto: txt(fd, "texto"),
    imagem_url: txt(fd, "imagem_url"),
    imagem_pathname: txt(fd, "imagem_pathname"),
    href: txt(fd, "href"),
    cta_texto: txt(fd, "cta_texto"),
    ativo: fd.get("ativo") === "on" || fd.get("ativo") === "1",
  };

  const sql = await conectar();
  try {
    if (id) {
      await sql`UPDATE blocos_itens SET ${sql(dados)} WHERE id = ${id}::uuid`;
    } else {
      /* Ordem = fim da fila da SEÇÃO, não da tabela inteira. Um cartão novo
         em "O que está incluso" não pode nascer atrás dos cartões de outro
         bloco — eles nem aparecem juntos. */
      const [{ proxima }] = await sql<{ proxima: number }[]>`
        SELECT COALESCE(MAX(ordem) + 1, 0) AS proxima
        FROM blocos_itens WHERE bloco_id = ${blocoId}::uuid`;
      await sql`INSERT INTO blocos_itens ${sql({ ...dados, bloco_id: blocoId, ordem: proxima })}`;
    }
  } finally {
    await sql.end();
  }
  voltar(id ? "Cartão atualizado" : "Cartão criado");
}

export async function alternarCartao(fd: FormData) {
  const id = txt(fd, "id");
  if (!id) voltar("Cartão não encontrado", true);
  const sql = await conectar();
  try {
    await sql`UPDATE blocos_itens SET ativo = NOT ativo WHERE id = ${id}::uuid`;
  } finally {
    await sql.end();
  }
  voltar("Situação alterada");
}

export async function moverCartao(fd: FormData) {
  const id = txt(fd, "id");
  const direcao = txt(fd, "direcao");
  if (!id || !direcao) voltar("Movimento inválido", true);

  const sql = await conectar();
  try {
    // A reordenação acontece DENTRO da seção do cartão, não na tabela toda.
    const [alvo] = await sql<{ bloco_id: string }[]>`
      SELECT bloco_id FROM blocos_itens WHERE id = ${id}::uuid`;
    if (!alvo) voltar("Cartão não encontrado", true);

    const lista = await sql<{ id: string }[]>`
      SELECT id FROM blocos_itens WHERE bloco_id = ${alvo.bloco_id}::uuid
      ORDER BY ordem, criado_em`;
    const i = lista.findIndex((x) => x.id === id);
    const j = direcao === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) voltar("Já está na ponta");

    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    for (let k = 0; k < nova.length; k++) {
      await sql`UPDATE blocos_itens SET ordem = ${k} WHERE id = ${nova[k].id}::uuid`;
    }
  } finally {
    await sql.end();
  }
  voltar("Ordem atualizada");
}

export async function excluirCartao(fd: FormData) {
  const id = txt(fd, "id");
  if (!id) voltar("Cartão não encontrado", true);

  const sql = await conectar();
  let pathname: string | null = null;
  try {
    const [c] = await sql<{ imagem_pathname: string | null }[]>`
      SELECT imagem_pathname FROM blocos_itens WHERE id = ${id}::uuid`;
    pathname = c?.imagem_pathname ?? null;
    await sql`DELETE FROM blocos_itens WHERE id = ${id}::uuid`;
  } finally {
    await sql.end();
  }

  // O arquivo sai depois do registro, e a falha dele não derruba a exclusão:
  // cartão fantasma no site é pior do que imagem órfã no storage.
  if (pathname) {
    try {
      await del(pathname);
    } catch (e) {
      console.error("[cartoes] registro excluido, arquivo ficou no Blob:", (e as Error).message);
    }
  }
  voltar("Cartão excluído");
}
