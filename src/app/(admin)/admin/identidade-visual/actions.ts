"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";

export async function salvarTema(formData: FormData) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`
    UPDATE pousada SET
      cor_primaria = ${formData.get("cor_primaria") as string},
      cor_secundaria = ${formData.get("cor_secundaria") as string},
      fonte_titulo = ${formData.get("fonte_titulo") as string},
      fonte_corpo = ${formData.get("fonte_corpo") as string},
      logo_url = ${formData.get("logo_url") as string || null},
      favicon_url = ${formData.get("favicon_url") as string || null},
      seo_title = ${formData.get("seo_title") as string || null},
      seo_description = ${formData.get("seo_description") as string || null}
    WHERE id = (SELECT id FROM pousada LIMIT 1)
  `;
  await sql.end();
  revalidatePath("/");
  revalidatePath("/admin/identidade-visual");
  redirect("/admin/identidade-visual?ok=Tema+aplicado+ao+site");
}