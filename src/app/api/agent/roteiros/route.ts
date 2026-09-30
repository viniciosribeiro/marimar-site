import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { lerRoteiros, roteiroPara, type Roteiro } from "@/lib/roteiros";

export const dynamic = "force-dynamic";

/**
 * Roteiros de orientação (Marina → Roteiros no painel).
 *
 *   GET /api/agent/roteiros                → todos os ligados
 *   GET /api/agent/roteiros?id=<uuid>      → um
 *   GET /api/agent/roteiros?busca=<frase>  → o que casa com os gatilhos (ou nenhum)
 *
 * Cada etapa traz `video.url_whatsapp`: é o que pode ir como mídia no
 * WhatsApp. Quando é null, o vídeo passou do limite e vai como link
 * (`video.url`). Os roteiros também já chegam no texto de
 * /api/agent/conhecimento; esta rota é para quando a Marina quer um só.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const p = request.nextUrl.searchParams;
  const id = p.get("id");
  const busca = p.get("busca")?.slice(0, 300);

  const todos = await comSql((sql) => lerRoteiros(sql, { soAtivos: true }));
  let dados: Roteiro[] = todos.filter((r) => r.etapas.length);
  if (id) dados = dados.filter((r) => r.id === id);
  else if (busca) {
    const r = roteiroPara(dados, busca);
    dados = r ? [r] : [];
  }

  const resumo = dados.length
    ? dados.map((r) => `🧭 *${r.titulo}* — ${r.etapas.length} ${r.etapas.length === 1 ? "etapa" : "etapas"}\n` +
        r.etapas.map((e, i) => `${i + 1}. ${e.titulo ?? `Etapa ${i + 1}`}${e.texto ? `: ${e.texto}` : ""}` +
          (e.video ? `\n   🎬 ${e.video.url_whatsapp ?? e.video.url}` : "") +
          (e.foto ? `\n   📷 ${e.foto.url_whatsapp ?? e.foto.url}` : "")).join("\n")).join("\n\n")
    : busca ? "Nenhum roteiro cadastrado para esse assunto." : "A pousada ainda não cadastrou roteiros.";

  return Response.json({
    ok: true,
    dados,
    resumo_texto: resumo,
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
