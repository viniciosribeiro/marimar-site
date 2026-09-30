"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";
import { normalizarNumero, setorValido } from "@/lib/escalonamento-base";
import {
  testarContato, responderChamado, entregarAoCliente, lerChamado, lerConfigEscalonamento, processarPrazos,
} from "@/lib/escalonamento";

/**
 * Ações da Equipe responsável e dos chamados. Mesmo contrato do painel:
 * `{ ok, mensagem }` e `exigirSessao()` na primeira linha.
 */

export type Resultado = { ok: boolean; mensagem: string };

const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
const txt = (fd: FormData, k: string, max = 200) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};
const hora = (v: string | null, padrao: string) => (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : padrao);
const autorDe = (s: Awaited<ReturnType<typeof exigirSessao>>) => (s.user?.name || s.user?.email || "painel") as string;
const atualizar = () => { revalidatePath("/admin/equipe"); revalidatePath("/admin/cerebro"); revalidatePath("/admin/marina"); };

/* ── contatos ───────────────────────────────────────────────────── */

export async function salvarContato(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  const id = uuid(fd.get("id"));
  const nome = txt(fd, "nome", 80);
  const numero = normalizarNumero(String(fd.get("numero") ?? ""));
  if (!nome) return { ok: false, mensagem: "Escreva o nome da pessoa." };
  if (!numero) return { ok: false, mensagem: "Número inválido. Use DDD e número, ex.: (41) 99999-1234." };
  const setores = [...new Set(fd.getAll("setores").map(String).map(setorValido))];
  const dias = [...new Set(fd.getAll("dias").map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  if (!dias.length) return { ok: false, mensagem: "Marque ao menos um dia de atendimento." };
  const inicio = hora(txt(fd, "hora_inicio", 5), "08:00");
  const fim = hora(txt(fd, "hora_fim", 5), "20:00");
  const ativo = fd.get("ativo") !== "off";

  const r = await comSql(async (sql) => {
    const [igual] = await sql`SELECT id FROM equipe_contatos WHERE numero = ${numero} AND id <> ${id ?? "00000000-0000-0000-0000-000000000000"}`;
    if (igual) return { ok: false, mensagem: "Este número já está cadastrado." };
    if (id) {
      await sql`UPDATE equipe_contatos SET nome = ${nome}, numero = ${numero}, setores = ${sql.json(setores.length ? setores : ["geral"])},
        dias = ${sql.json(dias)}, hora_inicio = ${inicio}, hora_fim = ${fim}, ativo = ${ativo}, atualizado_em = now() WHERE id = ${id}`;
    } else {
      const [{ n }] = await sql<{ n: number }[]>`SELECT coalesce(max(ordem), -1) + 1 AS n FROM equipe_contatos`;
      await sql`INSERT INTO equipe_contatos (nome, numero, setores, dias, hora_inicio, hora_fim, ordem, ativo)
        VALUES (${nome}, ${numero}, ${sql.json(setores.length ? setores : ["geral"])}, ${sql.json(dias)}, ${inicio}, ${fim}, ${Number(n)}, ${ativo})`;
    }
    return { ok: true, mensagem: id ? "Contato salvo." : "Contato cadastrado. Use “Testar envio” para conferir o número." };
  });
  if (r.ok) atualizar();
  return r;
}

export async function alternarContato(id: string, ativo: boolean): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Contato não encontrado." };
  await comSql((sql) => sql`UPDATE equipe_contatos SET ativo = ${ativo}, atualizado_em = now() WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: ativo ? "Contato ligado: volta a receber chamados." : "Contato desligado: não recebe chamados." };
}

export async function excluirContato(id: string): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Contato não encontrado." };
  await comSql((sql) => sql`DELETE FROM equipe_contatos WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: "Contato excluído. Chamados antigos continuam no histórico." };
}

export async function ordenarContatos(ids: string[]): Promise<Resultado> {
  await exigirSessao();
  const lista = ids.map(uuid).filter((x): x is string => !!x).slice(0, 100);
  await comSql(async (sql) => {
    for (let i = 0; i < lista.length; i++) await sql`UPDATE equipe_contatos SET ordem = ${i} WHERE id = ${lista[i]}`;
  });
  atualizar();
  return { ok: true, mensagem: "Prioridade salva." };
}

export async function testarEnvio(id: string): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Contato não encontrado." };
  const r = await comSql((sql) => testarContato(sql, id));
  atualizar();
  const caminho = r.via === "agente" ? "pela Marina" : r.via === "ferramenta" ? "ferramenta de mensagens do OpenClaw" : r.via ?? "?";
  return r.ok
    ? { ok: true, mensagem: `✓ O WhatsApp confirmou a entrega${r.id ? ` (mensagem ${r.id})` : ""}, pelo caminho: ${caminho}. Deve chegar em segundos. Se mesmo assim não aparecer no celular, confira o número (com o 9) — veja o manual, “Testar envio não chegou”.` }
    : { ok: false, mensagem: `Não chegou: ${r.erro}` };
}

/* ── configuração ───────────────────────────────────────────────── */

const minutos = (fd: FormData, k: string, min: number, max: number) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
};

/** Salva só os campos presentes no formulário (a aba Aprendizado manda só o modo). */
export async function salvarConfigEscalonamento(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const r = await comSql(async (sql) => {
    const atual = await lerConfigEscalonamento(sql);
    const novo = { ...atual };
    if (fd.has("ativo")) novo.ativo = fd.get("ativo") === "on";
    for (const [k, min, max] of [["lembrete_min", 5, 1440], ["proximo_min", 5, 2880], ["aviso_cliente_min", 5, 2880], ["desistir_min", 15, 10080], ["validade_dias", 0, 365]] as const) {
      if (fd.has(k)) { const v = minutos(fd, k, min, max); if (v !== null) novo[k] = v; }
    }
    if (fd.has("whatsapp_modo")) novo.whatsapp_modo = fd.get("whatsapp_modo") === "oficial" ? "oficial" : "web";
    if (fd.has("template_cliente")) novo.template_cliente = txt(fd, "template_cliente", 100);
    if (fd.has("template_equipe")) novo.template_equipe = txt(fd, "template_equipe", 100);
    if (fd.has("template_idioma")) novo.template_idioma = txt(fd, "template_idioma", 10) ?? "pt_BR";
    if (fd.has("aprendizado_modo")) novo.aprendizado_modo = fd.get("aprendizado_modo") === "automatico" ? "automatico" : "aprovacao";
    if (novo.lembrete_min >= novo.proximo_min) return { ok: false, mensagem: "O lembrete precisa vir antes de passar para o próximo da fila." };
    if (novo.proximo_min >= novo.desistir_min) return { ok: false, mensagem: "O tempo para desistir precisa ser maior que o de passar para o próximo." };
    await sql`
      INSERT INTO marina_escalonamento_config (id, ativo, lembrete_min, proximo_min, aviso_cliente_min, desistir_min, whatsapp_modo,
        template_cliente, template_equipe, template_idioma, aprendizado_modo, validade_dias, atualizado_por, atualizado_em)
      VALUES (1, ${novo.ativo}, ${novo.lembrete_min}, ${novo.proximo_min}, ${novo.aviso_cliente_min}, ${novo.desistir_min}, ${novo.whatsapp_modo},
        ${novo.template_cliente}, ${novo.template_equipe}, ${novo.template_idioma}, ${novo.aprendizado_modo}, ${novo.validade_dias}, ${autorDe(s)}, now())
      ON CONFLICT (id) DO UPDATE SET ativo = excluded.ativo, lembrete_min = excluded.lembrete_min, proximo_min = excluded.proximo_min,
        aviso_cliente_min = excluded.aviso_cliente_min, desistir_min = excluded.desistir_min, whatsapp_modo = excluded.whatsapp_modo,
        template_cliente = excluded.template_cliente, template_equipe = excluded.template_equipe, template_idioma = excluded.template_idioma,
        aprendizado_modo = excluded.aprendizado_modo, validade_dias = excluded.validade_dias, atualizado_por = excluded.atualizado_por, atualizado_em = now()`;
    return { ok: true, mensagem: "Configuração salva. Vale na hora, no site e no WhatsApp." };
  });
  if (r.ok) atualizar();
  return r;
}

/* ── chamados ───────────────────────────────────────────────────── */

/** Responder pelo painel — para quando a resposta não veio pelo WhatsApp. */
export async function responderPeloPainel(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const id = uuid(fd.get("id"));
  const texto = txt(fd, "texto", 3000);
  if (!id || !texto) return { ok: false, mensagem: "Escreva a resposta." };
  const r = await comSql(async (sql) => {
    const c = await lerChamado(sql, id);
    if (!c) return { tipo: "nenhum_aberto" as const, mensagem: "Chamado não encontrado." };
    return responderChamado(sql, { autor: autorDe(s), texto, codigo: c.codigo });
  });
  atualizar();
  if (r.tipo === "respondido") return { ok: r.entregue, mensagem: r.mensagem };
  return { ok: false, mensagem: r.tipo === "nao_equipe" ? "Não autorizado." : r.mensagem };
}

export async function reenviarAoCliente(id: string): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Chamado não encontrado." };
  const r = await comSql(async (sql) => {
    const c = await lerChamado(sql, id);
    if (!c?.resposta_final) return { ok: false, mensagem: "Este chamado ainda não tem resposta." };
    const envio = await entregarAoCliente(sql, c, c.resposta_final, await lerConfigEscalonamento(sql));
    if (!envio.ok) {
      await sql`UPDATE marina_chamados SET entrega_erro = ${envio.erro}, atualizado_em = now() WHERE id = ${id}`;
      return { ok: false, mensagem: `Ainda não foi: ${envio.erro}` };
    }
    await sql`UPDATE marina_chamados SET status = 'entregue', entregue_em = now(), entrega_erro = null, destino = null, atualizado_em = now() WHERE id = ${id}`;
    return { ok: true, mensagem: "Entregue ao cliente." };
  });
  atualizar();
  return r;
}

export async function cancelarChamado(id: string): Promise<Resultado> {
  await exigirSessao();
  if (!uuid(id)) return { ok: false, mensagem: "Chamado não encontrado." };
  await comSql((sql) => sql`UPDATE marina_chamados SET status = 'cancelado', destino = null, atualizado_em = now() WHERE id = ${id} AND status IN ('aguardando', 'respondido')`);
  atualizar();
  return { ok: true, mensagem: "Chamado cancelado. O cliente não recebe mais nada sobre ele." };
}

export async function rodarPrazosAgora(): Promise<Resultado> {
  await exigirSessao();
  const n = await comSql((sql) => processarPrazos(sql));
  atualizar();
  const total = n.lembretes + n.repasses + n.avisos + n.expirados;
  return { ok: true, mensagem: total ? `Feito: ${n.lembretes} lembrete(s), ${n.repasses} repasse(s), ${n.avisos} aviso(s) ao cliente, ${n.expirados} expirado(s).` : "Nada vencido agora." };
}
