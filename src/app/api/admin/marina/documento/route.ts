import { auth } from "@/lib/auth";
import postgres from "postgres";
import { del } from "@vercel/blob";
import { extrairTexto, lerImagem, fazerTrecho } from "@/lib/extrair-texto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Recebe um documento enviado pelo painel e tira o texto dele.
 *
 * O arquivo já está no Blob quando chega aqui — o navegador manda direto
 * para lá, para não esbarrar no limite de corpo da função. Esta rota baixa,
 * converte e grava o texto.
 *
 * Quando a leitura falha, o arquivo é APAGADO do Blob. Guardar um PDF que
 * ninguém consegue ler é pagar armazenamento por nada e, pior, deixar na
 * tela da Cecília um item que parece ensinado e não ensina.
 */
export async function POST(req: Request) {
  const sessao = await auth();
  if (!sessao?.user) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  const url = typeof corpo?.url === "string" ? corpo.url : "";
  const nome = typeof corpo?.nome === "string" ? corpo.nome.slice(0, 200) : "";
  const tipo = typeof corpo?.tipo === "string" ? corpo.tipo : "";
  const assunto = typeof corpo?.assunto === "string" && corpo.assunto.trim()
    ? corpo.assunto.trim().slice(0, 200) : null;
  const pathname = typeof corpo?.pathname === "string" ? corpo.pathname : null;
  const bytes = Number(corpo?.bytes) || 0;

  if (!url || !nome) return Response.json({ erro: "Arquivo não recebido." }, { status: 400 });

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });

  try {
    let texto = "";
    let aviso: string | undefined;

    if (tipo.startsWith("image/")) {
      ({ texto, aviso } = await lerImagem(url));
    } else {
      const r = await fetch(url);
      if (!r.ok) throw new Error("não consegui baixar o arquivo enviado");
      ({ texto, aviso } = await extrairTexto(await r.arrayBuffer(), tipo, nome));
    }

    if (!texto) {
      // Nada aproveitável: limpa o Blob para não pagar por lixo.
      if (pathname) { try { await del(url); } catch {} }
      await sql.end();
      return Response.json(
        { erro: aviso ?? "Não consegui ler este arquivo." },
        { status: 422 },
      );
    }

    const [linha] = await sql<{ id: string }[]>`
      INSERT INTO marina_documentos
        (nome, assunto, tipo, url, pathname, bytes, texto, trecho, caracteres, status)
      VALUES
        (${nome}, ${assunto}, ${tipo || "desconhecido"}, ${url}, ${pathname}, ${bytes},
         ${texto}, ${fazerTrecho(texto)}, ${texto.length}, 'pronto')
      RETURNING id`;

    await sql.end();
    return Response.json({ ok: true, id: linha.id, caracteres: texto.length });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[documento] falha:", msg);
    if (pathname) { try { await del(url); } catch {} }
    try { await sql.end(); } catch {}
    return Response.json({ erro: `Não consegui ler este arquivo (${msg}).` }, { status: 500 });
  }
}

/** Remover um documento: apaga a linha e o arquivo. */
export async function DELETE(req: Request) {
  const sessao = await auth();
  if (!sessao?.user) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ erro: "Documento não informado." }, { status: 400 });

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const [doc] = await sql<{ url: string }[]>`
    SELECT url FROM marina_documentos WHERE id = ${id}`;
  await sql`DELETE FROM marina_documentos WHERE id = ${id}`;
  await sql.end();

  if (doc?.url) { try { await del(doc.url); } catch {} }
  return Response.json({ ok: true });
}
