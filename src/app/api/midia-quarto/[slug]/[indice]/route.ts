import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { indiceFotoValido, slugFotoValido, origemFotoPermitida, lerBytesDaFoto, respostaDaFoto } from "@/lib/foto-whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A foto oficial do quarto, como bytes de imagem para o WhatsApp/Baileys.
 *
 * O Desbravador pode devolver 403 para a Hostinger. A funcao executa na
 * Vercel (gru1) e, em caso de falha, tenta a imagem otimizada/cacheada do
 * proprio site. Nao e um proxy de URL: slug+indice consultam exclusivamente
 * fotos aprovadas em midias, com hosts externos estritamente permitidos.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; indice: string }> },
) {
  const { slug, indice } = await params;
  const pos = indiceFotoValido(indice);
  if (!slugFotoValido(slug) || pos === null) {
    return Response.json({ erro: "Foto invalida" }, { status: 400 });
  }

  let fotos: { url: string }[];
  try {
    fotos = await comSql(async (sql) => {
      const fotoVisivel = await sql<{ url: string }[]>`
        SELECT m.url FROM midias m JOIN quartos q ON q.id = m.quarto_id
        WHERE q.slug = ${slug} AND q.ativo = true AND m.tipo = 'foto' AND m.visivel_marina = true
        ORDER BY m.destaque DESC, m.ordem ASC LIMIT 6
      `.catch(() => null);
      if (fotoVisivel !== null) return fotoVisivel;
      // Compatibilidade com banco anterior a migration de visivel_marina.
      return sql<{ url: string }[]>`
        SELECT m.url FROM midias m JOIN quartos q ON q.id = m.quarto_id
        WHERE q.slug = ${slug} AND q.ativo = true AND m.tipo = 'foto'
        ORDER BY m.destaque DESC, m.ordem ASC LIMIT 6
      `;
    });
  } catch (e) {
    console.error("[foto-whatsapp] consulta de midia falhou:", (e as Error).message);
    return Response.json({ erro: "Nao foi possivel ler as fotos" }, { status: 503 });
  }

  const fonte = fotos[pos]?.url;
  if (!fonte) return Response.json({ erro: "Foto nao encontrada" }, { status: 404 });
  if (!origemFotoPermitida(fonte)) {
    console.warn("[foto-whatsapp] origem de foto nao permitida:", slug, pos);
    return Response.json({ erro: "Origem de foto nao habilitada" }, { status: 422 });
  }
  const foto = await lerBytesDaFoto(fonte);
  if (!foto) {
    return Response.json({ erro: "Foto temporariamente indisponivel. Abra a pagina oficial do quarto." }, {
      status: 502, headers: { "cache-control": "no-store" },
    });
  }
  return respostaDaFoto(foto, `marimar-${slug}-${pos + 1}`);
}
