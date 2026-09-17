"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";

const sql = () => postgres(process.env.DATABASE_URL!, { max: 1 });

export async function criarQuarto(formData: FormData) {
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const categoriaId = formData.get("categoria_id") as string;
  const desbravadorRoomId = formData.get("desbravador_room_id") as string;
  const ocupacaoMax = parseInt(formData.get("ocupacao_max") as string) || 2;
  const ordem = parseInt(formData.get("ordem") as string) || 0;
  const descricao = formData.get("descricao") as string;
  const ativo = formData.get("ativo") === "on";

  if (!nome || !slug) redirect("/admin/quartos?erro=Nome+e+slug+obrigatorios");

  const db = sql();
  const existing = desbravadorRoomId ? await db`SELECT id FROM quartos WHERE desbravador_room_id = ${desbravadorRoomId}` : [];
  if (existing.length > 0) redirect("/admin/quartos?erro=Este+Motor+ID+ja+esta+vinculado+a+outro+quarto");

  await db`
    INSERT INTO quartos (nome, slug, categoria_id, desbravador_room_id, ocupacao_max, ordem, descricao, ativo)
    VALUES (${nome}, ${slug}, ${categoriaId || null}, ${desbravadorRoomId || null}, ${ocupacaoMax}, ${ordem}, ${descricao}, ${ativo})
  `;
  await db.end();

  revalidatePath("/admin/quartos");
  redirect("/admin/quartos?ok=Quarto+criado");
}

export async function editarQuarto(formData: FormData) {
  const id = formData.get("id") as string;
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const categoriaId = formData.get("categoria_id") as string;
  const desbravadorRoomId = formData.get("desbravador_room_id") as string;
  const ocupacaoMax = parseInt(formData.get("ocupacao_max") as string) || 2;
  const ordem = parseInt(formData.get("ordem") as string) || 0;
  const descricao = formData.get("descricao") as string;
  const ativo = formData.get("ativo") === "on";

  if (!id || !nome || !slug) redirect("/admin/quartos?erro=Nome+e+slug+obrigatorios");

  const db = sql();
  if (desbravadorRoomId) {
    const dup = await db`SELECT id FROM quartos WHERE desbravador_room_id = ${desbravadorRoomId} AND id != ${id}`;
    if (dup.length > 0) redirect("/admin/quartos?erro=Este+Motor+ID+ja+esta+vinculado");
  }

  await db`
    UPDATE quartos SET nome=${nome}, slug=${slug}, categoria_id=${categoriaId || null},
      desbravador_room_id=${desbravadorRoomId || null}, ocupacao_max=${ocupacaoMax},
      ordem=${ordem}, descricao=${descricao}, ativo=${ativo}
    WHERE id=${id}
  `;
  await db.end();

  revalidatePath("/admin/quartos");
  redirect("/admin/quartos?ok=Quarto+atualizado");
}

export async function excluirQuarto(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/quartos?erro=ID+invalido");
  const db = sql();
  await db`DELETE FROM quartos WHERE id=${id}`;
  await db.end();
  revalidatePath("/admin/quartos");
  redirect("/admin/quartos?ok=Quarto+excluido");
}

export async function alternarAtivoQuarto(formData: FormData) {
  const id = formData.get("id") as string;
  const db = sql();
  await db`UPDATE quartos SET ativo = NOT ativo WHERE id=${id}`;
  await db.end();
  revalidatePath("/admin/quartos");
  redirect("/admin/quartos");
}