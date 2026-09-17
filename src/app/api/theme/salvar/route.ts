import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import postgres from "postgres";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
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
  return NextResponse.redirect(new URL("/admin/identidade-visual?ok=Tema+salvo", request.url));
}