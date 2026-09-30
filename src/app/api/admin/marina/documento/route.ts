import { auth } from "@/lib/auth";
import { del } from "@vercel/blob";
import { extrairTexto, lerImagem, fazerTrecho } from "@/lib/extrair-texto";
import { comSql, type Sql } from "@/lib/db-conexao";
import { urlDoNossoBlob } from "@/lib/blob";
import { categoriaValida, sugerirCategoria } from "@/lib/marina";
import { dividirEmTrechos } from "@/lib/busca-documentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Documentos que ensinam a Marina.
 *
 * O arquivo já está no Blob quando chega aqui (o navegador manda direto,
 * para não esbarrar no limite de corpo da função). Esta rota baixa, tira o
 * texto, divide em trechos para a busca e sugere a categoria.
 *
 * Mudança de 30/09/2026: quando a leitura falha, o documento FICA na lista
 * com o status "não consegui ler" e o motivo, e pode ser reprocessado. Antes
 * ele era apagado e a Cecília ficava sem saber o que tinha acontecido.
 *
 *   POST   {url, pathname, nome, tipo, bytes, assunto?, categoria?}  → envia
 *   PUT    ?id=…                                                    → reprocessa
 *   PATCH  {id, ativo?, categoria?, assunto?}                       → ajusta
 *   DELETE ?id=…                                                    → apaga (linha e arquivo)
 */

async function naoAutorizado() {
  const s = await auth();
  return s?.user ? null : Response.json({ erro: "Entre no painel de novo." }, { status: 401 });
}

async function lerArquivo(url: string, tipo: string, nome: string) {
  if (tipo.startsWith("image/")) return lerImagem(url);
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("não consegui baixar o arquivo enviado");
  return extrairTexto(await r.arrayBuffer(), tipo, nome);
}

/** Lê e grava o resultado — sucesso ou falha — na linha do documento. */
async function processar(sql: Sql, id: string) {
  const [d] = await sql<{ url: string; tipo: string; nome: string; assunto: string | null; categoria: string }[]>`
    SELECT url, tipo, nome, assunto, categoria FROM marina_documentos WHERE id = ${id}`;
  if (!d) return { ok: false as const, erro: "Documento não encontrado." };
  try {
    const { texto, aviso } = await lerArquivo(d.url, d.tipo, d.nome);
    if (!texto) throw new Error(aviso ?? "o arquivo não tem texto que eu consiga ler");
    const categoria = d.categoria !== "geral" ? d.categoria : sugerirCategoria(`${d.assunto ?? ""} ${d.nome} ${texto.slice(0, 3000)}`);
    await sql`
      UPDATE marina_documentos
      SET texto = ${texto}, trecho = ${fazerTrecho(texto)}, caracteres = ${texto.length},
          status = 'pronto', erro = NULL, categoria = ${categoria}, processado_em = now()
      WHERE id = ${id}`;
    return { ok: true as const, caracteres: texto.length, trechos: dividirEmTrechos(texto).length, aviso };
  } catch (e) {
    const erro = (e as Error).message.slice(0, 300);
    await sql`UPDATE marina_documentos SET status = 'falhou', erro = ${erro}, processado_em = now() WHERE id = ${id}`;
    return { ok: false as const, erro };
  }
}

export async function POST(req: Request) {
  const negado = await naoAutorizado();
  if (negado) return negado;

  const corpo = await req.json().catch(() => null);
  const url = typeof corpo?.url === "string" ? corpo.url : "";
  const nome = typeof corpo?.nome === "string" ? corpo.nome.slice(0, 200) : "";
  const tipo = typeof corpo?.tipo === "string" && corpo.tipo ? corpo.tipo : "desconhecido";
  const assunto = typeof corpo?.assunto === "string" && corpo.assunto.trim() ? corpo.assunto.trim().slice(0, 200) : null;
  const pathname = typeof corpo?.pathname === "string" ? corpo.pathname : null;
  const bytes = Number(corpo?.bytes) || 0;
  const categoria = corpo?.categoria ? categoriaValida(corpo.categoria) : "geral";

  if (!url || !nome) return Response.json({ erro: "Arquivo não recebido." }, { status: 400 });
  // Só arquivos do NOSSO Blob: esta rota baixa a URL. Aceitar qualquer
  // endereço permitiria usar o servidor para buscar URL externa.
  if (!urlDoNossoBlob(url)) return Response.json({ erro: "Endereço de arquivo inválido." }, { status: 400 });

  try {
    return await comSql(async (sql) => {
      const [linha] = await sql<{ id: string }[]>`
        INSERT INTO marina_documentos (nome, assunto, tipo, url, pathname, bytes, status, categoria)
        VALUES (${nome}, ${assunto}, ${tipo}, ${url}, ${pathname}, ${bytes}, 'lendo', ${categoria})
        RETURNING id`;
      const r = await processar(sql, linha.id);
      if (!r.ok) return Response.json({ erro: `Não consegui ler este arquivo: ${r.erro}.`, id: linha.id }, { status: 422 });
      return Response.json({ ok: true, id: linha.id, caracteres: r.caracteres, trechos: r.trechos, aviso: r.aviso });
    });
  } catch (e) {
    console.error("[documento] falha:", (e as Error).message);
    return Response.json({ erro: `Não consegui guardar o arquivo (${(e as Error).message}).` }, { status: 500 });
  }
}

/** Reprocessar: ler de novo o arquivo que já está guardado. */
export async function PUT(req: Request) {
  const negado = await naoAutorizado();
  if (negado) return negado;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ erro: "Documento não informado." }, { status: 400 });
  const r = await comSql(async (sql) => {
    await sql`UPDATE marina_documentos SET status = 'lendo', tentativas = tentativas + 1 WHERE id = ${id}`;
    return processar(sql, id);
  });
  return r.ok
    ? Response.json({ ok: true, caracteres: r.caracteres, trechos: r.trechos })
    : Response.json({ erro: `Ainda não consegui ler: ${r.erro}.` }, { status: 422 });
}

export async function PATCH(req: Request) {
  const negado = await naoAutorizado();
  if (negado) return negado;
  const c = await req.json().catch(() => null);
  const id = typeof c?.id === "string" ? c.id : "";
  if (!id) return Response.json({ erro: "Documento não informado." }, { status: 400 });
  await comSql(async (sql) => {
    if (typeof c.ativo === "boolean") await sql`UPDATE marina_documentos SET ativo = ${c.ativo} WHERE id = ${id}`;
    if (c.categoria) await sql`UPDATE marina_documentos SET categoria = ${categoriaValida(c.categoria)} WHERE id = ${id}`;
    if (typeof c.assunto === "string") {
      await sql`UPDATE marina_documentos SET assunto = ${c.assunto.trim().slice(0, 200) || null} WHERE id = ${id}`;
    }
  });
  return Response.json({ ok: true });
}

/** Apagar: a linha e o arquivo. */
export async function DELETE(req: Request) {
  const negado = await naoAutorizado();
  if (negado) return negado;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ erro: "Documento não informado." }, { status: 400 });

  const doc = await comSql(async (sql) => {
    const [doc] = await sql<{ url: string }[]>`SELECT url FROM marina_documentos WHERE id = ${id}`;
    await sql`DELETE FROM marina_documentos WHERE id = ${id}`;
    return doc;
  });
  if (doc?.url) { try { await del(doc.url); } catch {} }
  return Response.json({ ok: true });
}
