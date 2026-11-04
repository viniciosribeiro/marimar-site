import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { SECOES_FOTO, secaoValida } from "@/lib/fotos";
import { MAX_FOTOS_WHATSAPP, urlFotoSecaoWhatsapp } from "@/lib/foto-whatsapp";

export const dynamic = "force-dynamic";

/**
 * As fotos da pousada que NÃO são de quarto: café da manhã, restaurante,
 * praia e ilha, a pousada, eventos. `?secao=cafe` traz uma; sem parâmetro,
 * todas as seções com o total e as 6 primeiras de cada.
 *
 * Cada foto vem com `url_whatsapp`: um endereço do nosso site que serve a
 * imagem em bytes (como /api/agent/quartos faz com as suítes), para a
 * Marina anexar com a ferramenta `message` em vez de mandar um link.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const pedida = request.nextUrl.searchParams.get("secao");
  const secoes = SECOES_FOTO.filter((s) => s.chave !== "quarto" && (!pedida || s.chave === secaoValida(pedida, "quarto")));
  if (pedida && !secoes.length) {
    return Response.json({ ok: false, erro: `Seção desconhecida. Use uma de: ${SECOES_FOTO.filter((s) => s.chave !== "quarto").map((s) => s.chave).join(", ")}.` }, { status: 400 });
  }

  const linhas = await comSql((sql) => sql<{ secao: string; url: string; alt: string; titulo: string | null; descricao: string | null; ordem: number; destaque: boolean }[]>`
    SELECT secao, url, alt, titulo, descricao, ordem, destaque FROM midias
    WHERE quarto_id IS NULL AND tipo = 'foto' AND visivel_marina = true AND secao = ANY(${secoes.map((s) => s.chave)})
    ORDER BY secao, destaque DESC, ordem ASC`).catch(() => []);

  const dados = secoes.map((s) => {
    const todas = linhas.filter((l) => l.secao === s.chave);
    return {
      secao: s.chave, nome: s.nome, descricao: s.descricao, total: todas.length,
      fotos: todas.slice(0, MAX_FOTOS_WHATSAPP).map((f, indice) => ({
        alt: f.alt, titulo: f.titulo, legenda: f.descricao, url_whatsapp: urlFotoSecaoWhatsapp(s.chave, indice),
      })),
    };
  });

  const resumo = dados.map((s) => `• ${s.nome}: ${s.total ? `${s.total} foto(s)` : "sem fotos cadastradas"}`).join("\n");
  return Response.json({
    ok: true, dados,
    resumo_texto: `Fotos da pousada por seção:\n${resumo}\nPara enviar no WhatsApp, use url_whatsapp no campo media da ferramenta message (até ${MAX_FOTOS_WHATSAPP} por seção).`,
    fonte: "local", consultado_em: new Date().toISOString(),
  });
}
