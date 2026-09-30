"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql, type Sql } from "@/lib/db-conexao";
import { lerConteudo, type Atracao } from "@/lib/conteudo-editavel";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** "Gruta das Encantadas" → "gruta-das-encantadas". É a âncora em /ilha-do-mel#… */
function criarSlug(nome: string, usados: Set<string>) {
  const base = nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "atracao";
  let slug = base;
  for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * As atrações moram na linha `ilha` de `conteudo_editavel`, junto com os
 * textos da ilha. Grava a lista inteira preservando o resto da linha, para
 * não apagar o que a tela "Ilha, chegada e eventos" salvou.
 */
async function gravarAtracoes(sql: Sql, atracoes: Atracao[]) {
  const [linha] = await sql<{ dados: Record<string, unknown> }[]>`
    SELECT dados FROM conteudo_editavel WHERE chave = 'ilha'`;
  const dados = { ...(linha?.dados ?? {}), ATRACOES: atracoes };
  await sql`
    INSERT INTO conteudo_editavel (chave, dados, atualizado_em)
    VALUES ('ilha', ${sql.json(dados as never)}, now())
    ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`;
}

function voltar(msg: string, erro = false): never {
  if (!erro) {
    for (const p of ["/", "/ilha-do-mel", "/admin/atracoes"]) revalidatePath(p);
  }
  redirect(`/admin/atracoes?${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

/** Cria (sem `slug`) ou edita (com `slug`) uma atração. */
export async function salvarAtracao(f: FormData) {
  await exigirSessao();
  const slug = txt(f, "slug");
  const campos = {
    nome: txt(f, "nome"),
    resumo: txt(f, "resumo"),
    texto: txt(f, "texto"),
    distanciaTexto: txt(f, "distanciaTexto"),
    destaque: f.get("destaque") === "on",
  };
  if (!campos.nome || !campos.resumo || !campos.texto) {
    const volta = slug ? `&editar=${encodeURIComponent(slug)}` : "&novo=1";
    redirect(`/admin/atracoes?erro=${encodeURIComponent("Preencha nome, resumo e texto.")}${volta}`);
  }

  const achou = await comSql(async (sql) => {
    const lista = (await lerConteudo(sql)).ATRACOES;
    let nova: Atracao[];
    if (slug) {
      if (!lista.some((a) => a.slug === slug)) return false;
      nova = lista.map((a) => (a.slug === slug ? { ...a, ...campos, slug } : a));
    } else {
      nova = [...lista, { slug: criarSlug(campos.nome, new Set(lista.map((a) => a.slug))), ...campos }];
    }
    await gravarAtracoes(sql, nova);
    return true;
  });
  if (!achou) voltar("Essa atração não existe mais. Recarregue a página.", true);
  voltar(slug ? "Atração salva. Já vale no site e para a Marina." : "Atração criada. Já vale no site e para a Marina.");
}

export async function excluirAtracao(f: FormData) {
  await exigirSessao();
  const slug = txt(f, "id");
  await comSql(async (sql) => {
    const lista = (await lerConteudo(sql)).ATRACOES;
    await gravarAtracoes(sql, lista.filter((a) => a.slug !== slug));
  });
  voltar("Atração excluída.");
}

/** Sobe ou desce uma posição. A ordem vale no site e na resposta da Marina. */
export async function moverAtracao(f: FormData) {
  await exigirSessao();
  const slug = txt(f, "id");
  const passo = txt(f, "direcao") === "subir" ? -1 : 1;
  await comSql(async (sql) => {
    const lista = [...(await lerConteudo(sql)).ATRACOES];
    const i = lista.findIndex((a) => a.slug === slug);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await gravarAtracoes(sql, lista);
  });
  voltar("Ordem atualizada.");
}
