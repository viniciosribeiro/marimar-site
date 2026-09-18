"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";

const sql = () => postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

export async function criarComodidade(formData: FormData) {
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const icone = formData.get("icone") as string;
  const escopo = formData.get("escopo") as string;
  const ordem = parseInt(formData.get("ordem") as string) || 0;

  if (!nome || !slug) redirect("/admin/comodidades?erro=Nome+e+slug+obrigatorios");

  const db = sql();
  await db`INSERT INTO comodidades (nome, slug, icone, escopo, ordem) VALUES (${nome}, ${slug}, ${icone || "check"}, ${escopo || "quarto"}, ${ordem})`;
  await db.end();

  revalidatePath("/admin/comodidades");
  redirect("/admin/comodidades?ok=Comodidade+criada");
}

export async function editarComodidade(formData: FormData) {
  const id = formData.get("id") as string;
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const icone = formData.get("icone") as string;
  const escopo = formData.get("escopo") as string;
  const ordem = parseInt(formData.get("ordem") as string) || 0;
  const ativo = formData.get("ativo") === "on";

  if (!id || !nome || !slug) redirect("/admin/comodidades?erro=Nome+e+slug+obrigatorios");

  const db = sql();
  await db`UPDATE comodidades SET nome=${nome}, slug=${slug}, icone=${icone || "check"}, escopo=${escopo || "quarto"}, ordem=${ordem}, ativo=${ativo} WHERE id=${id}`;
  await db.end();

  revalidatePath("/admin/comodidades");
  redirect("/admin/comodidades?ok=Comodidade+atualizada");
}

export async function excluirComodidade(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/comodidades?erro=ID+invalido");
  const db = sql();
  await db`DELETE FROM comodidades WHERE id=${id}`;
  await db.end();
  revalidatePath("/admin/comodidades");
  redirect("/admin/comodidades?ok=Comodidade+excluida");
}