"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { auth } from "@/lib/auth";

/**
 * Liga e desliga o atendimento da Marina no site.
 *
 * E um interruptor de verdade, nao um `display:none`: desligado, a rota
 * /api/chat responde 503 antes de chegar ao gateway. E o que permite cortar
 * o consumo na hora, sem precisar de deploy.
 */
export async function alternarChat() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  let ligado = false;
  try {
    const [linha] = await sql<{ chat_ativo: boolean }[]>`
      UPDATE pousada SET chat_ativo = NOT chat_ativo RETURNING chat_ativo`;
    ligado = linha?.chat_ativo ?? false;
  } finally {
    await sql.end();
  }

  revalidatePath("/");
  revalidatePath("/admin/integracoes");
  redirect(`/admin/integracoes?ok=${encodeURIComponent(
    ligado ? "Atendimento no site ligado" : "Atendimento no site desligado",
  )}`);
}
