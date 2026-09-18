"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { auth } from "@/lib/auth";

/**
 * Salva o tema do site.
 *
 * O que mudou em 18/09/2026: as abas "Banner" e "Avancado" do editor tinham
 * controles que NAO salvavam nada — viviam em useState e nunca chegavam aqui,
 * porque nao havia coluna onde gravar. Agora vao para `pousada.tema` (jsonb),
 * que aceita opcao nova sem exigir migration.
 */
export async function salvarTema(formData: FormData) {
  const sessao = await auth();
  if (!sessao?.user) redirect("/admin/login");

  const txt = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  // Rejeita data: URL. O editor antigo gravava a imagem inteira em base64
  // dentro da coluna, e o layout do site faz SELECT * em toda pagina —
  // ou seja, a logo trafegava inteira a cada request.
  const imagem = (k: string) => {
    const v = txt(k);
    if (!v) return null;
    if (v.startsWith("data:")) return null;
    return v;
  };

  const tema = {
    fonteManuscrita: txt("fonteManuscrita") ?? "Caveat",
    raio: txt("raio") ?? "12",
    sombra: txt("sombra") ?? "sm",
    animacoes: formData.get("animacoes") === "on",
    banner: {
      ativo: formData.get("banner_ativo") === "on",
      texto: txt("banner_texto"),
      subtexto: txt("banner_subtexto"),
      animado: formData.get("banner_animado") === "on",
    },
  };

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  try {
    await sql`
      UPDATE pousada SET
        cor_primaria    = ${txt("cor_primaria") ?? "#0D9488"},
        cor_secundaria  = ${txt("cor_secundaria") ?? "#0EA5E9"},
        fonte_titulo    = ${txt("fonte_titulo")},
        fonte_corpo     = ${txt("fonte_corpo")},
        logo_url        = ${imagem("logo_url")},
        favicon_url     = ${imagem("favicon_url")},
        og_image_url    = ${imagem("og_image_url")},
        seo_title       = ${txt("seo_title")},
        seo_description = ${txt("seo_description")},
        tema            = ${sql.json(tema)},
        atualizado_em   = now()
      WHERE id = (SELECT id FROM pousada LIMIT 1)
    `;
  } catch (e) {
    await sql.end();
    const msg = (e as Error).message.includes("tema")
      ? "A coluna 'tema' ainda nao existe. Rode: npm run db:migrate"
      : (e as Error).message.slice(0, 120);
    redirect(`/admin/identidade-visual?erro=${encodeURIComponent(msg)}`);
  }
  await sql.end();

  // O tema alimenta o layout raiz, entao todo o site precisa revalidar
  revalidatePath("/", "layout");
  redirect("/admin/identidade-visual?ok=" + encodeURIComponent("Tema aplicado ao site"));
}
