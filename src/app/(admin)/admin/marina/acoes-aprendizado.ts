"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";
import { categoriaValida } from "@/lib/marina-base";
import { registrarHistorico } from "@/lib/marina";
import { anonimizar } from "@/lib/escalonamento-base";

/**
 * Fila de revisão do aprendizado (Marina → Aprendizado).
 *
 * Nada aqui mexe no conhecimento cadastrado à mão, com uma exceção pedida:
 * "Tornar oficial" CRIA um item novo em marina_conhecimento (com histórico),
 * e o aprendido passa a apontar para ele.
 */

export type Resultado = { ok: boolean; mensagem: string };

const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
const autorDe = (s: Awaited<ReturnType<typeof exigirSessao>>) => (s.user?.name || s.user?.email || "painel") as string;
const atualizar = () => { revalidatePath("/admin/marina"); revalidatePath("/admin/cerebro"); };

export async function aprovarAprendido(id: string): Promise<Resultado> {
  const s = await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Item não encontrado." };
  await comSql((sql) => sql`
    UPDATE marina_aprendizado SET status = 'ativo', revisado = true, conflito_id = null, confianca = greatest(confianca, 0.9),
      revisado_por = ${autorDe(s)}, revisado_em = now(), atualizado_em = now()
    WHERE id = ${id} AND status IN ('pendente', 'ativo', 'rejeitado')`);
  atualizar();
  return { ok: true, mensagem: "Aprovado. A Marina já usa esta resposta, no site e no WhatsApp." };
}

export async function rejeitarAprendido(id: string): Promise<Resultado> {
  const s = await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Item não encontrado." };
  await comSql((sql) => sql`
    UPDATE marina_aprendizado SET status = 'rejeitado', revisado = true, revisado_por = ${autorDe(s)}, revisado_em = now(), atualizado_em = now()
    WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: "Rejeitado. A Marina não usa; perguntas iguais voltam a ir para a equipe." };
}

export async function excluirAprendido(id: string): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Item não encontrado." };
  await comSql((sql) => sql`DELETE FROM marina_aprendizado WHERE id = ${id} AND status <> 'oficial'`);
  atualizar();
  return { ok: true, mensagem: "Excluído." };
}

export async function editarAprendido(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const id = uuid(fd.get("id"));
  const pergunta = anonimizar(String(fd.get("pergunta") ?? "")).slice(0, 600);
  const resposta = anonimizar(String(fd.get("resposta") ?? "")).slice(0, 3000);
  if (!id || pergunta.length < 4 || resposta.length < 2) return { ok: false, mensagem: "Preencha a pergunta e a resposta." };
  const variacoes = [...new Set(String(fd.get("variacoes") ?? "").split(/\r?\n/).map((l) => anonimizar(l.trim())).filter(Boolean))].slice(0, 30);
  const validade = String(fd.get("valido_ate") ?? "");
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(validade) ? validade : null;
  const aprovar = fd.get("aprovar") === "on";
  await comSql((sql) => sql`
    UPDATE marina_aprendizado SET pergunta = ${pergunta}, resposta = ${resposta}, variacoes = ${sql.json(variacoes)},
      categoria = ${categoriaValida(fd.get("categoria"))}, valido_ate = ${valido},
      status = CASE WHEN ${aprovar} THEN 'ativo' ELSE status END,
      conflito_id = CASE WHEN ${aprovar} THEN null ELSE conflito_id END,
      revisado = revisado OR ${aprovar}, revisado_por = ${autorDe(s)}, revisado_em = now(), atualizado_em = now()
    WHERE id = ${id} AND status <> 'oficial'`);
  atualizar();
  return { ok: true, mensagem: aprovar ? "Salvo e aprovado. A Marina já usa." : "Salvo." };
}

/**
 * Vira conhecimento oficial: cria uma "Pergunta e resposta" em
 * Conhecimento, com as variações, e tira o aprendido de circulação (o
 * oficial vale mais e não vence).
 */
export async function oficializarAprendido(id: string): Promise<Resultado> {
  const s = await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Item não encontrado." };
  const autor = autorDe(s);
  const r = await comSql(async (sql) => {
    const [a] = await sql<{ pergunta: string; resposta: string; variacoes: unknown; categoria: string; status: string }[]>`
      SELECT pergunta, resposta, variacoes, categoria, status FROM marina_aprendizado WHERE id = ${id}`;
    if (!a) return { ok: false, mensagem: "Item não encontrado." };
    if (a.status === "oficial") return { ok: false, mensagem: "Este item já é oficial." };
    const variacoes = Array.isArray(a.variacoes) ? a.variacoes : [];
    const [novo] = await sql<{ id: string }[]>`
      INSERT INTO marina_conhecimento (tipo, categoria, titulo, conteudo, variacoes, ativo, atualizado_por)
      VALUES ('pergunta', ${categoriaValida(a.categoria)}, ${a.pergunta}, ${a.resposta}, ${sql.json(variacoes)}, true, ${autor})
      RETURNING id`;
    await registrarHistorico(sql, novo.id, "criou", null,
      { tipo: "pergunta", categoria: a.categoria, titulo: a.pergunta, conteudo: a.resposta, variacoes, ativo: true, origem: "aprendizado" }, autor);
    await sql`UPDATE marina_aprendizado SET status = 'oficial', conhecimento_id = ${novo.id}, revisado = true,
      revisado_por = ${autor}, revisado_em = now(), atualizado_em = now() WHERE id = ${id}`;
    return { ok: true, mensagem: "Agora é conhecimento oficial (em Conhecimento → Perguntas e respostas)." };
  });
  atualizar();
  return r;
}
