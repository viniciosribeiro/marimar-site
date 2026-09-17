"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import postgres from "postgres";

export async function trocarSenha(formData: FormData) {
  const senha = formData.get("senha") as string;
  const confirmacao = formData.get("confirmacao") as string;
  const userId = formData.get("userId") as string;

  console.log("[trocar-senha] Action chamada. userId:", userId, "senha length:", senha?.length);

  if (!senha || senha.length < 12) {
    console.log("[trocar-senha] Senha muito curta");
    redirect("/admin/trocar-senha?erro=Minimo+12+caracteres");
  }
  if (senha !== confirmacao) {
    console.log("[trocar-senha] Senhas não conferem");
    redirect("/admin/trocar-senha?erro=Senhas+nao+conferem");
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const hash = await bcrypt.hash(senha, 12);
  console.log("[trocar-senha] Hash gerado, atualizando usuario", userId);

  const result = await sql`UPDATE usuarios SET senha_hash = ${hash}, must_reset = false WHERE id = ${userId}`;
  console.log("[trocar-senha] UPDATE result count:", result.count);

  await sql.end();

  console.log("[trocar-senha] Redirecionando para /admin");
  redirect("/admin");
}