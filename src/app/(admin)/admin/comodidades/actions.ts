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

/**
 * "A pousada oferece": e o que a Marina le em /api/agent/pousada ("A POUSADA
 * TEM") e o que o site lista. Ate 28/09/2026 nao havia tela para isso — a
 * lista vinha so do seed, e o que a administracao cadastrava nunca chegava.
 */
async function marcarNaPousada(db: ReturnType<typeof postgres>, id: string, tem: boolean) {
  if (tem) {
    await db`INSERT INTO pousada_comodidades (comodidade_id) VALUES (${id}) ON CONFLICT (comodidade_id) DO NOTHING`;
  } else {
    await db`DELETE FROM pousada_comodidades WHERE comodidade_id = ${id}`;
  }
}

export async function criarComodidade(formData: FormData) {
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const icone = formData.get("icone") as string;
  const escopo = formData.get("escopo") as string;
  const ordem = parseInt(formData.get("ordem") as string) || 0;

  if (!nome || !slug) redirect("/admin/comodidades?erro=Nome+e+slug+obrigatorios");

  const db = await sql();
  const [nova] = await db`INSERT INTO comodidades (nome, slug, icone, escopo, ordem) VALUES (${nome}, ${slug}, ${icone || "check"}, ${escopo || "quarto"}, ${ordem}) RETURNING id`;
  await marcarNaPousada(db, nova.id, formData.get("pousada_tem") === "on");
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

  const db = await sql();
  await db`UPDATE comodidades SET nome=${nome}, slug=${slug}, icone=${icone || "check"}, escopo=${escopo || "quarto"}, ordem=${ordem}, ativo=${ativo} WHERE id=${id}`;
  await marcarNaPousada(db, id, formData.get("pousada_tem") === "on");
  await db.end();

  revalidatePath("/admin/comodidades");
  redirect("/admin/comodidades?ok=Comodidade+atualizada");
}

export async function excluirComodidade(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/comodidades?erro=ID+invalido");
  const db = await sql();
  await db`DELETE FROM comodidades WHERE id=${id}`;
  await db.end();
  revalidatePath("/admin/comodidades");
  redirect("/admin/comodidades?ok=Comodidade+excluida");
}