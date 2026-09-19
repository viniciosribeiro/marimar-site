"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { del } from "@vercel/blob";
import { auth } from "@/lib/auth";

async function conectar() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  return postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
}

function voltar(msg: string, erro = false) {
  revalidatePath("/");
  revalidatePath("/admin/banners");
  redirect(`/admin/banners?${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/**
 * `datetime-local` manda "2026-12-24T18:00" — sem fuso.
 *
 * Interpretamos como horario de quem administra a pousada, que e o unico
 * que faz sentido para ela: "tira do ar dia 24 as 18h" e 18h em Encantadas.
 * Guardar como `timestamp` sem fuso mantem a leitura igual na volta.
 */
const quando = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  return v ? v.replace("T", " ") : null;
};

export async function salvarBanner(fd: FormData) {
  const id = txt(fd, "id");
  const imagem = txt(fd, "imagem_url");
  if (!imagem) voltar("Envie a imagem do banner", true);

  const inicia = quando(fd, "inicia_em");
  const termina = quando(fd, "termina_em");
  if (inicia && termina && termina <= inicia) {
    voltar("A data final precisa ser depois da inicial", true);
  }

  /* Enums vem do cliente: validamos contra a lista antes de gravar.
     Nao por desconfianca do formulario, mas porque um valor invalido aqui
     viraria um banner que simplesmente nao renderiza — e o erro so
     apareceria no site, longe de quem salvou. */
  const opcao = <T extends string>(k: string, validos: readonly T[], padrao: T): T => {
    const v = txt(fd, k);
    return validos.includes(v as T) ? (v as T) : padrao;
  };
  const numero = (k: string, min: number, max: number, padrao: number) => {
    const n = Number(txt(fd, k));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : padrao;
  };
  const liga = (k: string) => fd.get(k) === "1" || fd.get(k) === "on";

  const dados = {
    titulo: txt(fd, "titulo"),
    subtitulo: txt(fd, "subtitulo"),
    imagem_url: imagem,
    imagem_pathname: txt(fd, "imagem_pathname"),
    alt: txt(fd, "alt"),
    cta_texto: txt(fd, "cta_texto"),
    cta_href: txt(fd, "cta_href"),
    ordem: Number(txt(fd, "ordem") ?? 0) || 0,
    ativo: liga("ativo"),

    tipo_midia: opcao("tipo_midia", ["imagem", "video"] as const, "imagem"),
    video_url: txt(fd, "video_url"),
    video_pathname: txt(fd, "video_pathname"),
    foco_x: numero("foco_x", 0, 100, 50),
    foco_y: numero("foco_y", 0, 100, 50),
    video_no_celular: liga("video_no_celular"),

    altura: opcao("altura", ["compacto", "medio", "alto", "tela"] as const, "alto"),
    posicao: opcao("posicao", [
      "esquerda-topo", "centro-topo", "direita-topo",
      "esquerda-meio", "centro-meio", "direita-meio",
      "esquerda-base", "centro-base", "direita-base",
    ] as const, "centro-meio"),
    largura_texto: opcao("largura_texto", ["estreita", "media", "larga"] as const, "media"),
    centralizar_celular: liga("centralizar_celular"),

    veu: opcao("veu", ["nenhum", "escuro", "escuro-baixo", "claro-esquerda", "vinheta"] as const, "escuro-baixo"),
    veu_forca: numero("veu_forca", 0, 100, 55),
    textura: opcao("textura", ["nenhuma", "grao", "pontos", "linhas"] as const, "nenhuma"),
    textura_forca: numero("textura_forca", 0, 100, 18),

    rotulo: txt(fd, "rotulo"),
    texto: txt(fd, "texto"),
    cta2_texto: txt(fd, "cta2_texto"),
    cta2_href: txt(fd, "cta2_href"),
    cor_texto: opcao("cor_texto", ["claro", "escuro"] as const, "claro"),
    sombra_texto: liga("sombra_texto"),

    animacao: opcao("animacao", ["nenhuma", "fade", "subir", "zoom"] as const, "subir"),
    ken_burns: liga("ken_burns"),
  };

  const sql = await conectar();
  try {
    if (id) {
      /* `sql(objeto)` monta a lista de colunas a partir das chaves — sao
         trinta campos, e escrever cada um a mao duas vezes (update e
         insert) e um convite a esquecer um e so descobrir no site. */
      await sql`
        UPDATE banners SET ${sql(dados)},
          inicia_em = ${inicia}::timestamp, termina_em = ${termina}::timestamp
        WHERE id = ${id}::uuid`;
    } else {
      await sql`
        INSERT INTO banners ${sql({
          ...dados,
          inicia_em: inicia as any,
          termina_em: termina as any,
        })}`;
    }
  } finally {
    await sql.end();
  }
  voltar(id ? "Banner atualizado" : "Banner criado");
}

export async function alternarBanner(fd: FormData) {
  const id = txt(fd, "id");
  if (!id) voltar("Banner não encontrado", true);
  const sql = await conectar();
  try {
    await sql`UPDATE banners SET ativo = NOT ativo WHERE id = ${id}::uuid`;
  } finally {
    await sql.end();
  }
  voltar("Situação alterada");
}

/** Sobe ou desce na ordem trocando `ordem` com o vizinho. */
export async function moverBanner(fd: FormData) {
  const id = txt(fd, "id");
  const direcao = txt(fd, "direcao");
  if (!id || !direcao) voltar("Movimento inválido", true);

  const sql = await conectar();
  try {
    const lista = await sql<{ id: string }[]>`
      SELECT id FROM banners ORDER BY ordem, criado_em`;
    const i = lista.findIndex((b) => b.id === id);
    const j = direcao === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) voltar("Já está na ponta");

    // Reescreve a ordem inteira: mais simples de raciocinar do que trocar
    // dois numeros, e conserta de quebra qualquer empate herdado.
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    for (let k = 0; k < nova.length; k++) {
      await sql`UPDATE banners SET ordem = ${k} WHERE id = ${nova[k].id}::uuid`;
    }
  } finally {
    await sql.end();
  }
  voltar("Ordem atualizada");
}

export async function excluirBanner(fd: FormData) {
  const id = txt(fd, "id");
  if (!id) voltar("Banner não encontrado", true);

  const sql = await conectar();
  let pathname: string | null = null;
  try {
    const [b] = await sql<{ imagem_pathname: string | null }[]>`
      SELECT imagem_pathname FROM banners WHERE id = ${id}::uuid`;
    pathname = b?.imagem_pathname ?? null;
    await sql`DELETE FROM banners WHERE id = ${id}::uuid`;
  } finally {
    await sql.end();
  }

  // O arquivo sai depois do registro, e a falha dele nao derruba a exclusao:
  // banner fantasma no site e pior do que imagem orfa no storage.
  if (pathname) {
    try {
      await del(pathname);
    } catch (e) {
      console.error("[banners] registro excluido, arquivo ficou no Blob:", (e as Error).message);
    }
  }
  voltar("Banner excluído");
}
