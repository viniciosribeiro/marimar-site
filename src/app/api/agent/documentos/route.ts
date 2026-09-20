import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

/**
 * Os documentos que a administração te enviou.
 *
 * Sem `?id=`, devolve a LISTA com um trecho de cada um. Com `?id=`, o texto
 * completo daquele documento.
 *
 * Os dois modos existem por causa de custo: o texto inteiro de todos os
 * documentos em toda conversa multiplicaria a conta por visitante. Você vê
 * a lista, escolhe o que interessa para a pergunta, e só então abre.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const id = request.nextUrl.searchParams.get("id");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  try {
    if (id) {
      const [doc] = await sql<{ nome: string; assunto: string | null; texto: string }[]>`
        SELECT nome, assunto, texto FROM marina_documentos
        WHERE id = ${id} AND ativo = true AND status = 'pronto'`;
      await sql.end();

      if (!doc) {
        return Response.json({ ok: false, erro: "Documento não encontrado." }, { status: 404 });
      }
      return Response.json({
        ok: true,
        dados: doc,
        resumo_texto: `${doc.assunto ?? doc.nome}\n\n${doc.texto}`,
        fonte: "local",
        consultado_em: new Date().toISOString(),
      });
    }

    const lista = await sql<{ id: string; nome: string; assunto: string | null; trecho: string; caracteres: number }[]>`
      SELECT id, nome, assunto, trecho, caracteres FROM marina_documentos
      WHERE ativo = true AND status = 'pronto'
      ORDER BY criado_em DESC`;
    await sql.end();

    const linhas = lista.length
      ? [
          "DOCUMENTOS QUE A POUSADA TE ENVIOU.",
          "Abaixo, o começo de cada um. Para ler inteiro:",
          "GET /api/agent/documentos?id=<id>",
          "",
          ...lista.map((d) =>
            `[${d.id}] ${d.assunto ?? d.nome} (${d.caracteres} caracteres)\n  ${d.trecho}`,
          ),
        ]
      : ["A pousada ainda não enviou nenhum documento."];

    return Response.json({
      ok: true,
      dados: { documentos: lista },
      resumo_texto: linhas.join("\n"),
      fonte: "local",
      consultado_em: new Date().toISOString(),
    });
  } catch {
    await sql.end().catch(() => {});
    return Response.json({ ok: true, dados: { documentos: [] },
      resumo_texto: "Nenhum documento disponível.", fonte: "local",
      consultado_em: new Date().toISOString() });
  }
}
