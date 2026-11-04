import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { indiceFotoValido, lerBytesDaFoto, respostaDaFoto } from "@/lib/foto-whatsapp";
import { secaoValida, SECOES_FOTO } from "@/lib/fotos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Uma foto de seção (café da manhã, restaurante, praia, pousada, eventos)
 * como bytes de imagem para o WhatsApp — o par da rota /api/midia-quarto.
 * Antes de 04/11/2026 a Marina só tinha como enviar foto de quarto, e dizia
 * "não tenho imagens" do café mesmo com as fotos cadastradas no painel.
 * Só fotos visíveis à Marina, na ordem do painel; nunca uma URL arbitrária.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ secao: string; indice: string }> }) {
  const { secao: bruta, indice } = await params;
  const pos = indiceFotoValido(indice);
  const secao = secaoValida(bruta, "quarto");
  if (secao === "quarto" || !SECOES_FOTO.some((s) => s.chave === secao) || pos === null) {
    return Response.json({ erro: "Foto inválida" }, { status: 400 });
  }

  let fotos: { url: string }[];
  try {
    fotos = await comSql((sql) => sql<{ url: string }[]>`
      SELECT url FROM midias
      WHERE secao = ${secao} AND quarto_id IS NULL AND tipo = 'foto' AND visivel_marina = true
      ORDER BY destaque DESC, ordem ASC LIMIT 6`);
  } catch (e) {
    console.error("[foto-secao] consulta falhou:", (e as Error).message);
    return Response.json({ erro: "Não foi possível ler as fotos" }, { status: 503 });
  }

  const fonte = fotos[pos]?.url;
  if (!fonte) return Response.json({ erro: "Foto não encontrada" }, { status: 404 });
  const foto = await lerBytesDaFoto(fonte);
  if (!foto) {
    return Response.json({ erro: "Foto temporariamente indisponível." }, { status: 502, headers: { "cache-control": "no-store" } });
  }
  return respostaDaFoto(foto, `marimar-${secao}-${pos + 1}`);
}
