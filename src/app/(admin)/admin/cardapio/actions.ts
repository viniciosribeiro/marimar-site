"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { auth } from "@/lib/auth";
import { gerarSlug } from "@/lib/cardapio";

async function conectar() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  return postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
}

function voltar(msg: string, erro = false) {
  revalidatePath("/cardapio");
  revalidatePath("/admin/cardapio");
  redirect(`/admin/cardapio?${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/** Dinheiro: aceita "45,90" e "45.90"; devolve null quando vazio. */
const dinheiro = (fd: FormData, k: string): string | null => {
  const v = txt(fd, k);
  if (!v) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
};

/* ═════════ CATEGORIAS ═════════ */

export async function salvarCategoria(fd: FormData) {
  const id = txt(fd, "id");
  const nome = txt(fd, "nome");
  if (!nome) voltar("Informe o nome da seção", true);

  const sql = await conectar();
  try {
    if (id) {
      await sql`
        UPDATE cardapio_categorias SET
          nome = ${nome}, descricao = ${txt(fd, "descricao")},
          icone = ${txt(fd, "icone")}, horario = ${txt(fd, "horario")}
        WHERE id = ${id}
      `;
    } else {
      // Slug único: se colidir, vai "bebidas-2", "bebidas-3"...
      const base = gerarSlug(nome!);
      const usados = await sql`SELECT slug FROM cardapio_categorias WHERE slug LIKE ${base + "%"}`;
      const existentes = new Set(usados.map((r: any) => r.slug));
      let slug = base, n = 2;
      while (existentes.has(slug)) slug = `${base}-${n++}`;

      const [{ max }] = await sql`SELECT COALESCE(MAX(ordem), -1) AS max FROM cardapio_categorias`;
      await sql`
        INSERT INTO cardapio_categorias (nome, slug, descricao, icone, horario, ordem)
        VALUES (${nome}, ${slug}, ${txt(fd, "descricao")}, ${txt(fd, "icone")}, ${txt(fd, "horario")}, ${Number(max) + 1})
      `;
    }
  } finally { await sql.end(); }
  voltar(id ? "Seção atualizada" : "Seção criada");
}

export async function alternarCategoria(fd: FormData) {
  const sql = await conectar();
  const [c] = await sql`UPDATE cardapio_categorias SET ativo = NOT ativo WHERE id = ${fd.get("id") as string} RETURNING ativo`;
  await sql.end();
  voltar(c?.ativo ? "Seção publicada" : "Seção oculta do cardápio");
}

export async function excluirCategoria(fd: FormData) {
  const sql = await conectar();
  // ON DELETE CASCADE leva os itens junto — por isso a tela confirma antes
  const [c] = await sql`DELETE FROM cardapio_categorias WHERE id = ${fd.get("id") as string} RETURNING nome`;
  await sql.end();
  voltar(`Seção "${c?.nome}" e seus itens foram excluídos`);
}

export async function moverCategoria(fd: FormData) {
  const id = fd.get("id") as string;
  const direcao = fd.get("direcao") as string;
  const sql = await conectar();
  const lista = await sql`SELECT id, ordem FROM cardapio_categorias ORDER BY ordem, nome`;
  const i = lista.findIndex((c: any) => c.id === id);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= lista.length) { await sql.end(); voltar("Já está no limite", true); }
  const a = lista[i] as any, b = lista[j] as any;
  const oa = a.ordem === b.ordem ? i : a.ordem;
  const ob = a.ordem === b.ordem ? j : b.ordem;
  await sql`UPDATE cardapio_categorias SET ordem = ${ob} WHERE id = ${a.id}`;
  await sql`UPDATE cardapio_categorias SET ordem = ${oa} WHERE id = ${b.id}`;
  await sql.end();
  voltar("Ordem atualizada");
}

/* ═════════ ITENS ═════════ */

export async function salvarItem(fd: FormData) {
  const id = txt(fd, "id");
  const nome = txt(fd, "nome");
  const categoria = txt(fd, "categoria_id");
  if (!nome) voltar("Informe o nome do item", true);
  if (!categoria) voltar("Escolha a seção do cardápio", true);

  const marcadores = fd.getAll("marcadores").filter((m): m is string => typeof m === "string");
  const foto = txt(fd, "foto_url");
  // Imagem em base64 inchava a linha e era carregada em toda visita
  const fotoLimpa = foto && foto.startsWith("data:") ? null : foto;

  const sql = await conectar();
  try {
    if (id) {
      await sql`
        UPDATE cardapio_itens SET
          categoria_id = ${categoria}, nome = ${nome}, descricao = ${txt(fd, "descricao")},
          preco = ${dinheiro(fd, "preco")}, preco_promocional = ${dinheiro(fd, "preco_promocional")},
          porcao = ${txt(fd, "porcao")}, foto_url = ${fotoLimpa},
          marcadores = ${sql.json(marcadores)},
          destaque = ${fd.get("destaque") === "on"},
          atualizado_em = now()
        WHERE id = ${id}
      `;
    } else {
      const [{ max }] = await sql`SELECT COALESCE(MAX(ordem), -1) AS max FROM cardapio_itens WHERE categoria_id = ${categoria}`;
      await sql`
        INSERT INTO cardapio_itens
          (categoria_id, nome, descricao, preco, preco_promocional, porcao, foto_url, marcadores, destaque, ordem)
        VALUES
          (${categoria}, ${nome}, ${txt(fd, "descricao")}, ${dinheiro(fd, "preco")},
           ${dinheiro(fd, "preco_promocional")}, ${txt(fd, "porcao")}, ${fotoLimpa},
           ${sql.json(marcadores)}, ${fd.get("destaque") === "on"}, ${Number(max) + 1})
      `;
    }
  } finally { await sql.end(); }
  voltar(id ? "Item atualizado" : "Item adicionado");
}

/** Acabou hoje — o item continua no cardápio, marcado como indisponível. */
export async function alternarDisponivel(fd: FormData) {
  const sql = await conectar();
  const [i] = await sql`UPDATE cardapio_itens SET disponivel = NOT disponivel, atualizado_em = now()
                        WHERE id = ${fd.get("id") as string} RETURNING nome, disponivel`;
  await sql.end();
  voltar(i?.disponivel ? `"${i.nome}" disponível de novo` : `"${i?.nome}" marcado como indisponível hoje`);
}

export async function excluirItem(fd: FormData) {
  const sql = await conectar();
  const [i] = await sql`DELETE FROM cardapio_itens WHERE id = ${fd.get("id") as string} RETURNING nome`;
  await sql.end();
  voltar(`"${i?.nome}" excluído`);
}
