"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { auth } from "@/lib/auth";

async function guardar() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  return postgres(process.env.DATABASE_URL!, { max: 1 });
}

function voltar(msg: string, erro = false) {
  revalidatePath("/", "layout");
  revalidatePath("/admin/blocos-home");
  redirect(`/admin/blocos-home?${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

/** Liga/desliga uma seção da home. */
export async function alternarBloco(formData: FormData) {
  const id = formData.get("id") as string;
  const sql = await guardar();
  const [b] = await sql`UPDATE blocos_home SET ativo = NOT ativo WHERE id = ${id} RETURNING tipo, ativo`;
  await sql.end();
  voltar(b?.ativo ? "Seção exibida no site" : "Seção ocultada do site");
}

/**
 * Move a seção uma posição para cima ou para baixo.
 * Troca a `ordem` com a vizinha em vez de renumerar tudo — assim duas
 * pessoas editando ao mesmo tempo não embaralham a home inteira.
 */
export async function moverBloco(formData: FormData) {
  const id = formData.get("id") as string;
  const direcao = formData.get("direcao") as string;
  const sql = await guardar();

  const blocos = await sql`SELECT id, ordem FROM blocos_home ORDER BY ordem, criado_em`;
  const i = blocos.findIndex((b: any) => b.id === id);
  const j = direcao === "cima" ? i - 1 : i + 1;

  if (i === -1 || j < 0 || j >= blocos.length) {
    await sql.end();
    voltar("A seção já está no limite", true);
  }

  const a = blocos[i] as any;
  const b = blocos[j] as any;
  // Ordens iguais (seed sem cuidado) quebrariam a troca: desempata pelo índice.
  const ordemA = a.ordem === b.ordem ? i : a.ordem;
  const ordemB = a.ordem === b.ordem ? j : b.ordem;

  await sql`UPDATE blocos_home SET ordem = ${ordemB} WHERE id = ${a.id}`;
  await sql`UPDATE blocos_home SET ordem = ${ordemA} WHERE id = ${b.id}`;
  await sql.end();
  voltar("Ordem atualizada");
}

/** Salva título, subtítulo e imagem de uma seção. */
export async function salvarBloco(formData: FormData) {
  const id = formData.get("id") as string;
  const txt = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  const img = txt("imagem_url");

  const sql = await guardar();
  await sql`
    UPDATE blocos_home SET
      titulo     = ${txt("titulo")},
      subtitulo  = ${txt("subtitulo")},
      imagem_url = ${img && img.startsWith("data:") ? null : img}
    WHERE id = ${id}
  `;
  await sql.end();
  voltar("Seção atualizada");
}
