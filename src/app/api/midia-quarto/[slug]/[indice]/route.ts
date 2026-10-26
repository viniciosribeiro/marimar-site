import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import {
  indiceFotoValido, slugFotoValido, origemFotoPermitida,
  tipoFotoPermitido, urlOtimizadaFoto, MAX_BYTES_FOTO,
} from "@/lib/foto-whatsapp";

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

  const caminhos = [fonte];
  if (new URL(fonte).hostname === "reservas.desbravador.com.br") {
    caminhos.push(urlOtimizadaFoto(fonte));
  }

  for (const [n, url] of caminhos.entries()) {
    try {
      const resposta = await fetch(url, {
        headers: { Accept: "image/jpeg,image/png,image/webp" },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
        cache: "no-store",
      });
      if (!resposta.ok || !resposta.body) continue;
      const tipo = tipoFotoPermitido(resposta.headers.get("content-type"));
      if (!tipo) continue;
      const tamanho = Number(resposta.headers.get("content-length") || "0");
      if (tamanho > MAX_BYTES_FOTO) continue;

      const leitor = resposta.body.getReader();
      const pedacos: Uint8Array[] = [];
      let total = 0, grande = false;
      try {
        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_BYTES_FOTO) { grande = true; break; }
          pedacos.push(value);
        }
      } finally {
        if (grande) await leitor.cancel().catch(() => {});
      }
      if (grande || total < 16) continue;

      const buffer = Buffer.concat(pedacos.map((p) => Buffer.from(p)), total);
      // Validar assinatura real para nao transmitir HTML rotulado como imagem.
      const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const png = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const webp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
      if ((tipo === "image/jpeg" && !jpeg) || (tipo === "image/png" && !png) || (tipo === "image/webp" && !webp)) continue;

      return new Response(buffer, {
        headers: {
          "content-type": tipo,
          "content-length": String(total),
          "content-disposition": `inline; filename="marimar-${slug}-${pos + 1}.${tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg"}"`,
          "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
          "x-content-type-options": "nosniff",
          "x-marimar-foto-fonte": n ? "cache-site" : "origem",
        },
      });
    } catch (e) {
      console.warn("[foto-whatsapp] fonte indisponivel:", slug, pos, n, (e as Error).message);
    }
  }
  return Response.json({ erro: "Foto temporariamente indisponivel. Abra a pagina oficial do quarto." }, {
    status: 502, headers: { "cache-control": "no-store" },
  });
}
