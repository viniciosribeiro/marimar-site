import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { registrarLacuna } from "@/lib/marina";

export const dynamic = "force-dynamic";

/**
 * A Marina avisa que não soube responder.
 *
 * No chat do site isso é detectado sozinho (a resposta passa pelo nosso
 * servidor). No WhatsApp a conversa não passa por aqui — então a skill pede
 * que ela registre. A pergunta aparece no painel, em "Perguntas sem
 * resposta", com um botão para virar treino.
 *
 *   POST { "pergunta": "...", "resposta": "...", "canal": "whatsapp" }
 */
export async function POST(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const corpo = await request.json().catch(() => null);
  const pergunta = typeof corpo?.pergunta === "string" ? corpo.pergunta.trim() : "";
  if (pergunta.length < 4) {
    return Response.json({ ok: false, erro: "Informe a pergunta do hóspede." }, { status: 400 });
  }
  const canal = corpo?.canal === "site" ? "site" : "whatsapp";

  await comSql((sql) =>
    registrarLacuna(sql, {
      pergunta,
      resposta: typeof corpo?.resposta === "string" ? corpo.resposta : null,
      canal,
    }),
  );

  return Response.json({
    ok: true,
    dados: { registrada: true },
    resumo_texto: "Anotado. A administração vai ver esta pergunta no painel e ensinar a resposta.",
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
