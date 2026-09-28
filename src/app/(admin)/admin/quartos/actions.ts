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

function camposExtras(f: FormData) {
  const txt = (k: string, max: number) => {
    const v = String(f.get(k) ?? "").trim();
    return v ? v.slice(0, max) : null;
  };
  const m = parseInt(String(f.get("metragem") ?? ""), 10);
  return { cama: txt("cama", 255), metragem: Number.isFinite(m) && m > 0 ? m : null, vista: txt("vista", 255) };
}

/**
 * Comodidades marcadas no formulário → quarto_comodidades.
 *
 * É o que a Marina lê em /api/agent/quartos para responder "tem ar?". Até
 * 28/09/2026 não havia tela para isto; a lista vinha só do seed.
 */
async function gravarComodidades(db: ReturnType<typeof postgres>, quartoId: string, f: FormData) {
  const ids = f.getAll("comodidades").map(String).filter(Boolean);
  await db`DELETE FROM quarto_comodidades WHERE quarto_id = ${quartoId}`;
  for (const cid of ids) {
    await db`INSERT INTO quarto_comodidades (quarto_id, comodidade_id) VALUES (${quartoId}, ${cid}) ON CONFLICT DO NOTHING`;
  }
}

/** Suítes aparecem na home, na lista e na página de cada uma. */
function refrescar() {
  revalidatePath("/admin/quartos");
  revalidatePath("/quartos", "layout");
  revalidatePath("/");
}

export async function criarQuarto(formData: FormData) {
  const nome = formData.get("nome") as string;
  const slug = formData.get("slug") as string;
  const categoriaId = formData.get("categoria_id") as string;
  const desbravadorRoomId = formData.get("desbravador_room_id") as string;
  const ocupacaoMax = parseInt(formData.get("ocupacao_max") as string) || 2;
  const ordem = parseInt(formData.get("ordem") as string) || 0;
  const descricao = formData.get("descricao") as string;
  const ativo = formData.get("ativo") === "on";
  const extras = camposExtras(formData);

  if (!nome || !slug) redirect("/admin/quartos?erro=Nome+e+slug+obrigatorios");

  const db = await sql();
  const existing = desbravadorRoomId ? await db`SELECT id FROM quartos WHERE desbravador_room_id = ${desbravadorRoomId}` : [];
  if (existing.length > 0) {
    await db.end();
    redirect("/admin/quartos?erro=Este+Motor+ID+ja+esta+vinculado+a+outro+quarto");
  }

  const [novo] = await db`
    INSERT INTO quartos (nome, slug, categoria_id, desbravador_room_id, ocupacao_max, ordem, descricao, ativo, cama, metragem, vista)
    VALUES (${nome}, ${slug}, ${categoriaId || null}, ${desbravadorRoomId || null}, ${ocupacaoMax}, ${ordem}, ${descricao}, ${ativo},
            ${extras.cama}, ${extras.metragem}, ${extras.vista})
    RETURNING id
  `;
  await gravarComodidades(db, novo.id, formData);
  await db.end();

  refrescar();
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
  const extras = camposExtras(formData);

  if (!id || !nome || !slug) redirect("/admin/quartos?erro=Nome+e+slug+obrigatorios");

  const db = await sql();
  if (desbravadorRoomId) {
    const dup = await db`SELECT id FROM quartos WHERE desbravador_room_id = ${desbravadorRoomId} AND id != ${id}`;
    if (dup.length > 0) {
      await db.end();
      redirect("/admin/quartos?erro=Este+Motor+ID+ja+esta+vinculado");
    }
  }

  await db`
    UPDATE quartos SET nome=${nome}, slug=${slug}, categoria_id=${categoriaId || null},
      desbravador_room_id=${desbravadorRoomId || null}, ocupacao_max=${ocupacaoMax},
      ordem=${ordem}, descricao=${descricao}, ativo=${ativo},
      cama=${extras.cama}, metragem=${extras.metragem}, vista=${extras.vista}, atualizado_em=now()
    WHERE id=${id}
  `;
  await gravarComodidades(db, id, formData);
  await db.end();

  refrescar();
  redirect("/admin/quartos?ok=Quarto+atualizado");
}

export async function excluirQuarto(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/quartos?erro=ID+invalido");
  const db = await sql();
  await db`DELETE FROM quartos WHERE id=${id}`;
  await db.end();
  revalidatePath("/admin/quartos");
  redirect("/admin/quartos?ok=Quarto+excluido");
}

export async function alternarAtivoQuarto(formData: FormData) {
  const id = formData.get("id") as string;
  const db = await sql();
  await db`UPDATE quartos SET ativo = NOT ativo WHERE id=${id}`;
  await db.end();
  revalidatePath("/admin/quartos");
  redirect("/admin/quartos");
}