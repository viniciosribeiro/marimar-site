"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { auth } from "@/lib/auth";

async function conectar() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  return postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
}

function voltar(msg: string, aba = "voz", erro = false) {
  revalidatePath("/admin/marina");
  redirect(`/admin/marina?aba=${aba}&${erro ? "erro" : "ok"}=${encodeURIComponent(msg)}`);
}

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/** Inteiro preso entre limites — um slider adulterado não vira valor absurdo. */
const faixa = (fd: FormData, k: string, min: number, max: number, padrao: number) => {
  const n = Number(fd.get(k));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.round(n)));
};

export async function salvarVoz(fd: FormData) {
  const sql = await conectar();
  const dados = {
    voz_id: txt(fd, "voz_id"),
    voz_modelo: txt(fd, "voz_modelo") ?? "eleven_multilingual_v2",
    voz_estabilidade: faixa(fd, "voz_estabilidade", 0, 100, 50),
    voz_semelhanca: faixa(fd, "voz_semelhanca", 0, 100, 75),
    voz_velocidade: faixa(fd, "voz_velocidade", 70, 120, 100),
  };

  const [existe] = await sql<{ id: string }[]>`SELECT id FROM marina_config LIMIT 1`;
  if (existe) {
    await sql`UPDATE marina_config SET ${sql(dados)}, atualizado_em = now() WHERE id = ${existe.id}`;
  } else {
    await sql`INSERT INTO marina_config ${sql(dados)}`;
  }
  await sql.end();
  voltar("Voz salva", "voz");
}

export async function salvarTom(fd: FormData) {
  const sql = await conectar();
  const tom = txt(fd, "tom");

  const [existe] = await sql<{ id: string }[]>`SELECT id FROM marina_config LIMIT 1`;
  if (existe) {
    await sql`UPDATE marina_config SET tom = ${tom}, atualizado_em = now() WHERE id = ${existe.id}`;
  } else {
    await sql`INSERT INTO marina_config ${sql({ tom })}`;
  }
  await sql.end();
  voltar("Jeito de falar salvo", "tom");
}

export async function salvarEnsinamento(fd: FormData) {
  const id = txt(fd, "id");
  const tipo = txt(fd, "tipo") === "limite" ? "limite" : "fato";
  const titulo = txt(fd, "titulo");
  const conteudo = txt(fd, "conteudo");
  const aba = tipo === "limite" ? "limites" : "conhecimento";

  if (!titulo || !conteudo) voltar("Preencha o assunto e o que ela deve saber", aba, true);

  const sql = await conectar();
  if (id) {
    await sql`
      UPDATE marina_conhecimento
      SET titulo = ${titulo}, conteudo = ${conteudo}, atualizado_em = now()
      WHERE id = ${id}`;
  } else {
    await sql`
      INSERT INTO marina_conhecimento (tipo, titulo, conteudo)
      VALUES (${tipo}, ${titulo}, ${conteudo})`;
  }
  await sql.end();
  voltar(id ? "Alterado" : "Ensinado", aba);
}

export async function alternarEnsinamento(fd: FormData) {
  const id = txt(fd, "id");
  const aba = txt(fd, "aba") ?? "conhecimento";
  if (!id) voltar("Item não encontrado", aba, true);

  const sql = await conectar();
  await sql`UPDATE marina_conhecimento SET ativo = NOT ativo, atualizado_em = now() WHERE id = ${id}`;
  await sql.end();
  voltar("Atualizado", aba);
}

/* Apagar de vez não existe aqui de propósito: desligar guarda o que já foi
   ensinado e permite voltar atrás sem ter que lembrar o texto exato. Quem
   opera erra, e um painel que perdoa erro é um painel que se usa. */
export async function removerEnsinamento(fd: FormData) {
  const id = txt(fd, "id");
  const aba = txt(fd, "aba") ?? "conhecimento";
  if (!id) voltar("Item não encontrado", aba, true);

  const sql = await conectar();
  await sql`DELETE FROM marina_conhecimento WHERE id = ${id}`;
  await sql.end();
  voltar("Removido", aba);
}

/**
 * Corrigir uma resposta.
 *
 * A correção não fica só marcada no histórico: vira um ensinamento novo. É
 * o que transforma a revisão em treino de verdade — marcar erro sem ensinar
 * o certo só produz uma lista de reclamações.
 */
export async function corrigirResposta(fd: FormData) {
  const id = txt(fd, "id");
  const correcao = txt(fd, "correcao");
  const assunto = txt(fd, "assunto");
  if (!id || !correcao) voltar("Escreva o que ela deveria ter dito", "conversas", true);

  const sql = await conectar();
  await sql`
    UPDATE chat_mensagens SET marcada = true, correcao = ${correcao} WHERE id = ${id}`;
  await sql`
    INSERT INTO marina_conhecimento (tipo, titulo, conteudo)
    VALUES ('fato', ${assunto ?? "Correção de atendimento"}, ${correcao})`;
  await sql.end();
  voltar("Corrigido e ensinado", "conversas");
}
