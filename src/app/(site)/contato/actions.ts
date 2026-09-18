"use server";

import { redirect } from "next/navigation";
import postgres from "postgres";

export async function enviarContato(formData: FormData) {
  const nome = formData.get("nome") as string;
  const telefone = formData.get("telefone") as string;
  const email = formData.get("email") as string;
  const mensagem = formData.get("mensagem") as string;

  if (!nome) redirect("/contato?erro=Nome+obrigatorio");

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  await sql`INSERT INTO leads (nome, telefone, email, mensagem, origem) VALUES (${nome}, ${telefone || null}, ${email || null}, ${mensagem || null}, 'site')`;
  await sql.end();

  redirect("/contato?ok=Mensagem+enviada");
}