"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { exigirSessao } from "@/lib/admin-sessao";

// Toda action exige sessao antes de abrir conexao (ver lib/admin-sessao.ts).
const sql = async () => {
  await exigirSessao();
  return postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
};

export async function criarCategoria(formData: FormData) {
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const descricao = formData.get("descricao") as string;
  const ordem = parseInt(formData.get("ordem") as string) || 0;

  if (!nome || !slug) redirect("/admin/categorias?erro=Nome+e+slug+obrigatorios");

  const db = await sql();
  await db`INSERT INTO categorias (nome, slug, descricao, ordem) VALUES (${nome}, ${slug}, ${descricao}, ${ordem})`;
  await db.end();

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias?ok=Categoria+criada");
}

export async function editarCategoria(formData: FormData) {
  const id = formData.get("id") as string;
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const descricao = formData.get("descricao") as string;
  const ordem = parseInt(formData.get("ordem") as string) || 0;
  const ativo = formData.get("ativo") === "on";

  if (!id || !nome || !slug) redirect("/admin/categorias?erro=Nome+e+slug+obrigatorios");

  const db = await sql();
  await db`UPDATE categorias SET nome=${nome}, slug=${slug}, descricao=${descricao}, ordem=${ordem}, ativo=${ativo} WHERE id=${id}`;
  await db.end();

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias?ok=Categoria+atualizada");
}

export async function excluirCategoria(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/categorias?erro=ID+invalido");

  const db = await sql();
  await db`DELETE FROM categorias WHERE id=${id}`;
  await db.end();

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias?ok=Categoria+excluida");
}