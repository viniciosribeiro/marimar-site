"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { auth, signOut } from "@/lib/auth";

/**
 * Troca a senha de QUEM ESTA LOGADO.
 *
 * Ate 28/09/2026 o id do usuario vinha de um <input type="hidden"> do
 * formulario. Server Action e endpoint POST publico: bastava mandar outro id
 * para trocar a senha de qualquer conta, inclusive sem estar logado. O id
 * agora sai da sessao e de nenhum outro lugar.
 *
 * Depois de trocar, a sessao e encerrada. O JWT guarda `mustReset` do momento
 * do login; mantendo a sessao, o painel via `mustReset = true` e mandava de
 * volta para esta tela, em loop, ate a pessoa sair e entrar de novo.
 */
export async function trocarSenha(formData: FormData) {
  const sessao = await auth();
  const userId = sessao?.user?.id;
  if (!userId) redirect("/admin/login");

  const senha = formData.get("senha") as string;
  const confirmacao = formData.get("confirmacao") as string;

  if (!senha || senha.length < 12) {
    redirect("/admin/trocar-senha?erro=Minimo+12+caracteres");
  }
  if (senha !== confirmacao) {
    redirect("/admin/trocar-senha?erro=Senhas+nao+conferem");
  }

  const hash = await bcrypt.hash(senha, 12);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  try {
    await sql`UPDATE usuarios SET senha_hash = ${hash}, must_reset = false WHERE id = ${userId}`;
  } finally {
    await sql.end();
  }

  await signOut({ redirectTo: "/admin/login" });
}
