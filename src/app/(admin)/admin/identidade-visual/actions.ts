"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { auth } from "@/lib/auth";
import { TEMA_PADRAO, type Tema } from "@/lib/tema";

/**
 * Publica o tema do site.
 *
 * O editor manda o tema inteiro como JSON num campo só, em vez de dezenas de
 * campos soltos. Isso é o que permite exportar, importar e restaurar — e faz
 * uma opção nova no editor não exigir alteração aqui nem migration.
 *
 * As cores e as fontes também vão para as colunas próprias (`cor_primaria`
 * etc.) porque outras telas e consultas já leem de lá.
 */
export async function salvarTema(formData: FormData) {
  const sessao = await auth();
  if (!sessao?.user) redirect("/admin/login");

  const txt = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  // Imagem em base64 inchava a linha e era carregada em toda página do site
  const imagem = (k: string) => {
    const v = txt(k);
    return v && v.startsWith("data:") ? null : v;
  };

  let tema: Tema;
  try {
    const bruto = JSON.parse((formData.get("tema") as string) || "{}");
    // Mescla com o padrão: um tema importado de outra propriedade pode vir
    // sem um campo que o editor passou a oferecer depois.
    tema = { ...TEMA_PADRAO, ...bruto, banner: { ...TEMA_PADRAO.banner, ...(bruto.banner ?? {}) } };
  } catch {
    redirect(`/admin/identidade-visual?erro=${encodeURIComponent("Tema em formato inválido")}`);
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  try {
    await sql`
      UPDATE pousada SET
        cor_primaria    = ${tema!.marca},
        cor_secundaria  = ${tema!.acento},
        fonte_titulo    = ${tema!.fonteTitulo},
        fonte_corpo     = ${tema!.fonteCorpo},
        logo_url        = ${imagem("logo_url")},
        favicon_url     = ${imagem("favicon_url")},
        og_image_url    = ${imagem("og_image_url")},
        seo_title       = ${txt("seo_title")},
        seo_description = ${txt("seo_description")},
        tema            = ${sql.json(tema! as any)},
        atualizado_em   = now()
      WHERE id = (SELECT id FROM pousada LIMIT 1)
    `;
  } catch (e) {
    await sql.end();
    const msg = String((e as Error).message).includes("tema")
      ? "A coluna 'tema' ainda não existe. Rode: npm run db:migrate"
      : (e as Error).message.slice(0, 140);
    redirect(`/admin/identidade-visual?erro=${encodeURIComponent(msg)}`);
  }
  await sql.end();

  // O tema alimenta o layout raiz: todo o site precisa revalidar
  revalidatePath("/", "layout");
  redirect("/admin/identidade-visual?ok=" + encodeURIComponent("Tema publicado no site"));
}
