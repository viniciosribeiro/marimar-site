"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";

/**
 * Ações dos roteiros de orientação (Marina → Roteiros).
 *
 * Mesmo contrato das outras ações do módulo: `{ ok, mensagem }`, e
 * `exigirSessao()` na primeira linha. Apagar um roteiro apaga as etapas
 * (cascade), nunca as mídias — elas continuam na biblioteca.
 */

export type Resultado = { ok: boolean; mensagem: string; id?: string };

const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
const txt = (fd: FormData, k: string, max: number) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};
const atualizar = () => { revalidatePath("/admin/marina"); revalidatePath("/admin/midias"); };
const autorDe = (s: Awaited<ReturnType<typeof exigirSessao>>) => (s.user?.name || s.user?.email || "painel") as string;

/** Gatilhos: um por linha ou separados por vírgula; repetidos saem. */
function gatilhosDe(fd: FormData): string[] {
  const bruto = (fd.get("gatilhos") as string | null) ?? "";
  const vistos = new Set<string>();
  return bruto.split(/[\n,;]+/).map((g) => g.trim()).filter((g) => {
    const k = g.toLowerCase();
    if (!g || g.length > 80 || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, 30);
}

export async function salvarRoteiro(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const id = uuid(fd.get("id"));
  const titulo = txt(fd, "titulo", 160);
  if (!titulo) return { ok: false, mensagem: "Dê um nome ao roteiro (ex.: Como chegar à pousada)." };
  const gatilhos = gatilhosDe(fd);
  if (!gatilhos.length) return { ok: false, mensagem: "Escreva ao menos uma palavra-chave — é por ela que a Marina sabe quando usar o roteiro." };
  const descricao = txt(fd, "descricao", 500);
  const ativo = fd.get("ativo") !== "off";
  const autor = autorDe(s);

  const novoId = await comSql(async (sql) => {
    if (id) {
      await sql`UPDATE marina_roteiros SET titulo = ${titulo}, descricao = ${descricao}, gatilhos = ${sql.json(gatilhos)},
        ativo = ${ativo}, atualizado_por = ${autor}, atualizado_em = now() WHERE id = ${id}`;
      return id;
    }
    const [{ n }] = await sql<{ n: number }[]>`SELECT coalesce(max(ordem), -1) + 1 AS n FROM marina_roteiros`;
    const [r] = await sql<{ id: string }[]>`
      INSERT INTO marina_roteiros (titulo, descricao, gatilhos, ativo, ordem, atualizado_por)
      VALUES (${titulo}, ${descricao}, ${sql.json(gatilhos)}, ${ativo}, ${Number(n)}, ${autor}) RETURNING id`;
    return r.id;
  });
  atualizar();
  return { ok: true, mensagem: id ? "Roteiro salvo." : "Roteiro criado. Agora adicione as etapas.", id: novoId };
}

export async function alternarRoteiro(id: string, ativo: boolean): Promise<Resultado> {
  const s = await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Roteiro não encontrado." };
  await comSql((sql) => sql`UPDATE marina_roteiros SET ativo = ${ativo}, atualizado_por = ${autorDe(s)}, atualizado_em = now() WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: ativo ? "Roteiro ligado: a Marina passa a usar." : "Roteiro desligado: a Marina deixa de usar." };
}

export async function excluirRoteiro(id: string): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Roteiro não encontrado." };
  await comSql((sql) => sql`DELETE FROM marina_roteiros WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: "Roteiro excluído. As mídias continuam na biblioteca." };
}

export async function ordenarRoteiros(ids: string[]): Promise<Resultado> {
  await exigirSessao();
  const lista = ids.map(uuid).filter((x): x is string => !!x).slice(0, 200);
  await comSql(async (sql) => {
    for (let i = 0; i < lista.length; i++) await sql`UPDATE marina_roteiros SET ordem = ${i} WHERE id = ${lista[i]}`;
  });
  atualizar();
  return { ok: true, mensagem: "Ordem salva." };
}

/* ── etapas ─────────────────────────────────────────────────────── */

export async function salvarEtapa(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const id = uuid(fd.get("id"));
  const roteiroId = uuid(fd.get("roteiro_id"));
  if (!roteiroId) return { ok: false, mensagem: "Roteiro não encontrado." };
  const titulo = txt(fd, "titulo", 160);
  const texto = txt(fd, "texto", 2000);
  const videoId = uuid(fd.get("video_id"));
  const fotoId = uuid(fd.get("foto_id"));
  if (!texto && !videoId && !fotoId) return { ok: false, mensagem: "A etapa precisa de um vídeo, uma foto ou um texto." };
  const ativo = fd.get("ativo") !== "off";

  const r = await comSql(async (sql) => {
    /* A mídia escolhida precisa ser do tipo certo: um id de foto no campo de
       vídeo faria a Marina anunciar vídeo e mandar foto. */
    if (videoId) {
      const [m] = await sql`SELECT 1 FROM midias WHERE id = ${videoId} AND tipo = 'video'`;
      if (!m) return { ok: false, mensagem: "O vídeo escolhido não existe mais na biblioteca." };
    }
    if (fotoId) {
      const [m] = await sql`SELECT 1 FROM midias WHERE id = ${fotoId} AND tipo = 'foto'`;
      if (!m) return { ok: false, mensagem: "A foto escolhida não existe mais na biblioteca." };
    }
    if (id) {
      await sql`UPDATE marina_roteiro_etapas SET titulo = ${titulo}, texto = ${texto}, video_id = ${videoId}, foto_id = ${fotoId}, ativo = ${ativo}
        WHERE id = ${id} AND roteiro_id = ${roteiroId}`;
    } else {
      const [{ n }] = await sql<{ n: number }[]>`SELECT coalesce(max(ordem), -1) + 1 AS n FROM marina_roteiro_etapas WHERE roteiro_id = ${roteiroId}`;
      await sql`INSERT INTO marina_roteiro_etapas (roteiro_id, ordem, titulo, texto, video_id, foto_id, ativo)
        VALUES (${roteiroId}, ${Number(n)}, ${titulo}, ${texto}, ${videoId}, ${fotoId}, ${ativo})`;
    }
    await sql`UPDATE marina_roteiros SET atualizado_por = ${autorDe(s)}, atualizado_em = now() WHERE id = ${roteiroId}`;
    return { ok: true, mensagem: id ? "Etapa salva." : "Etapa adicionada." };
  });
  if (r.ok) atualizar();
  return r;
}

export async function alternarEtapa(id: string, ativo: boolean): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Etapa não encontrada." };
  await comSql((sql) => sql`UPDATE marina_roteiro_etapas SET ativo = ${ativo} WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: ativo ? "Etapa ligada." : "Etapa desligada: a Marina pula esta etapa." };
}

export async function excluirEtapa(id: string): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Etapa não encontrada." };
  await comSql((sql) => sql`DELETE FROM marina_roteiro_etapas WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: "Etapa excluída." };
}

export async function ordenarEtapas(ids: string[]): Promise<Resultado> {
  await exigirSessao();
  const lista = ids.map(uuid).filter((x): x is string => !!x).slice(0, 200);
  await comSql(async (sql) => {
    for (let i = 0; i < lista.length; i++) await sql`UPDATE marina_roteiro_etapas SET ordem = ${i} WHERE id = ${lista[i]}`;
  });
  atualizar();
  return { ok: true, mensagem: "Ordem das etapas salva." };
}
