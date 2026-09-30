import type { Sql } from "./db-conexao";
import { CATEGORIAS, rotuloCategoria } from "./marina-base";
import { rotuloSetor } from "./escalonamento-base";
import { lerAprendizado, emUso, vencido, type Aprendido } from "./aprendizado";
import { lerConfigEscalonamento } from "./escalonamento";

/**
 * O "Cérebro da Marina": o panorama do que ela sabe e de como está
 * evoluindo. Tudo lido na hora (regra do projeto: tempo real).
 * Tela: /admin/cerebro.
 */

export type Area = { id: string; rotulo: string; manual: number; aprendido: number; midias: number; total: number };
export type Ponto = { rotulo: string; inicio: string; sozinha: number; escaladas: number; lacunas: number; taxa: number | null };
export type Ligacao = { area: string; setor: string; peso: number };

export type Cerebro = {
  periodo: number; canal: string;
  areas: Area[];
  ligacoes: Ligacao[];
  setores: { id: string; rotulo: string; chamados: number }[];
  totais: { manual: number; aprendido: number; midias: number; roteiros: number; documentos: number };
  recentes: Aprendido[];
  frequentes: Aprendido[];
  chamados: { abertos: number; respondidos: number; atrasados: number; expirados: number; tempoMedioMin: number | null; total: number };
  temas: { rotulo: string; escaladas: number; lacunas: number }[];
  lacunasAbertas: number;
  serie: Ponto[];
  taxa: { periodo: number | null; anterior: number | null; sozinha: number; escaladas: number };
  revisar: { pendentes: number; vencidos: number; conflitos: number; naoRevisados: number };
  escalonamentoAtivo: boolean;
};

/* Fotos e vídeos contam na área em que o hóspede pergunta por eles. */
const AREA_DA_SECAO: Record<string, string> = {
  quarto: "quartos", pousada: "pousada", restaurante: "pousada", cafe: "pousada", eventos: "pousada",
  praia: "ilha", orientacao: "barcos",
};

export async function lerCerebro(sql: Sql, opcoes: { dias: number; canal: "todos" | "site" | "whatsapp" }): Promise<Cerebro> {
  const { dias, canal } = opcoes;
  const desde = new Date(Date.now() - dias * 86400000);
  const antes = new Date(Date.now() - 2 * dias * 86400000);
  const noCanal = (c: string | null) => canal === "todos" || c === canal;
  const vazio = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);

  const manuais = await vazio(sql<{ categoria: string; n: number }[]>`
    SELECT coalesce(categoria, 'geral') AS categoria, count(*)::int AS n FROM marina_conhecimento
    WHERE ativo = true AND excluido_em IS NULL GROUP BY 1`);
  const docs = await vazio(sql<{ categoria: string; n: number }[]>`
    SELECT coalesce(categoria, 'geral') AS categoria, count(*)::int AS n FROM marina_documentos
    WHERE ativo = true AND status = 'pronto' GROUP BY 1`);
  const midias = await vazio(sql<{ secao: string; n: number }[]>`
    SELECT CASE WHEN quarto_id IS NOT NULL THEN 'quarto' ELSE secao END AS secao, count(*)::int AS n FROM midias GROUP BY 1`);
  const [rot] = await vazio(sql<{ n: number }[]>`SELECT count(*)::int AS n FROM marina_roteiros WHERE ativo = true`);
  const aprendizado = await lerAprendizado(sql);
  const vivos = aprendizado.filter((a) => emUso(a));

  const areas: Area[] = CATEGORIAS.map((c) => {
    const manual = (manuais.find((m) => m.categoria === c.id)?.n ?? 0) + (docs.find((d) => d.categoria === c.id)?.n ?? 0);
    const aprendido = vivos.filter((a) => a.categoria === c.id).length;
    const mid = midias.filter((m) => (AREA_DA_SECAO[m.secao] ?? "geral") === c.id).reduce((s, m) => s + m.n, 0)
      + (c.id === "barcos" ? rot?.n ?? 0 : 0);
    return { id: c.id, rotulo: c.rotulo, manual, aprendido, midias: mid, total: manual + aprendido + mid };
  });

  /* Chamados do período, no canal escolhido. */
  const cfg = await lerConfigEscalonamento(sql);
  const chamados = (await vazio(sql<{ status: string; canal: string; setor: string; categoria: string; criado_em: Date; notificado_em: Date | null; respondido_em: Date | null }[]>`
    SELECT status, canal, setor, categoria, criado_em, notificado_em, respondido_em FROM marina_chamados WHERE criado_em >= ${desde}`))
    .filter((c) => noCanal(c.canal));
  const agora = Date.now();
  const tempos = chamados.filter((c) => c.respondido_em).map((c) => (c.respondido_em!.getTime() - (c.notificado_em ?? c.criado_em).getTime()) / 60000);
  const abertos = chamados.filter((c) => c.status === "aguardando");

  const ligacoesMapa = new Map<string, number>();
  const setoresMapa = new Map<string, number>();
  for (const c of chamados) {
    ligacoesMapa.set(`${c.categoria}|${c.setor}`, (ligacoesMapa.get(`${c.categoria}|${c.setor}`) ?? 0) + 1);
    setoresMapa.set(c.setor, (setoresMapa.get(c.setor) ?? 0) + 1);
  }
  /* Setores da equipe cadastrada aparecem no mapa mesmo sem chamado ainda. */
  for (const c of await vazio(sql<{ setores: unknown }[]>`SELECT setores FROM equipe_contatos WHERE ativo = true`)) {
    for (const s of Array.isArray(c.setores) ? (c.setores as string[]) : []) if (!setoresMapa.has(s)) setoresMapa.set(s, 0);
  }

  /* Eventos: a série de "resolveu sozinha". */
  const eventos = (await vazio(sql<{ tipo: string; canal: string | null; categoria: string | null; criado_em: Date }[]>`
    SELECT tipo, canal, categoria, criado_em FROM marina_eventos WHERE criado_em >= ${antes} AND tipo IN ('aprendido_usado', 'escalada', 'lacuna')`))
    .filter((e) => noCanal(e.canal));
  const passo = dias <= 31 ? 1 : 7;
  const serie: Ponto[] = [];
  const inicio = new Date(desde); inicio.setHours(0, 0, 0, 0);
  for (let t = inicio.getTime(); t <= agora; t += passo * 86400000) {
    const fim = t + passo * 86400000;
    const doBalde = eventos.filter((e) => e.criado_em.getTime() >= t && e.criado_em.getTime() < fim);
    const sozinha = doBalde.filter((e) => e.tipo === "aprendido_usado").length;
    const escaladas = doBalde.filter((e) => e.tipo === "escalada").length;
    const lacunas = doBalde.filter((e) => e.tipo === "lacuna").length;
    const soma = sozinha + escaladas + lacunas;
    const d = new Date(t);
    serie.push({ rotulo: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, inicio: d.toISOString(), sozinha, escaladas, lacunas, taxa: soma ? sozinha / soma : null });
  }
  const conta = (lista: typeof eventos) => {
    const s = lista.filter((e) => e.tipo === "aprendido_usado").length;
    const n = lista.length;
    return { taxa: n ? s / n : null, sozinha: s, escaladas: n - s };
  };
  const doPeriodo = conta(eventos.filter((e) => e.criado_em >= desde));
  const doAnterior = conta(eventos.filter((e) => e.criado_em < desde));

  /* Temas que mais precisam da equipe: escaladas e lacunas por assunto. */
  const temasMapa = new Map<string, { escaladas: number; lacunas: number }>();
  for (const e of eventos.filter((x) => x.criado_em >= desde && x.tipo !== "aprendido_usado")) {
    const k = e.categoria ?? "geral";
    const t = temasMapa.get(k) ?? { escaladas: 0, lacunas: 0 };
    if (e.tipo === "escalada") t.escaladas++; else t.lacunas++;
    temasMapa.set(k, t);
  }
  const [lac] = await vazio(sql<{ n: number }[]>`SELECT count(*)::int AS n FROM marina_lacunas WHERE status = 'aberta'`);

  return {
    periodo: dias, canal,
    areas,
    ligacoes: [...ligacoesMapa].map(([k, peso]) => { const [area, setor] = k.split("|"); return { area, setor, peso }; }),
    setores: [...setoresMapa].map(([id, n]) => ({ id, rotulo: rotuloSetor(id), chamados: n })).sort((a, b) => b.chamados - a.chamados),
    totais: {
      manual: manuais.reduce((s, m) => s + m.n, 0), documentos: docs.reduce((s, d) => s + d.n, 0),
      aprendido: vivos.length, midias: midias.reduce((s, m) => s + m.n, 0), roteiros: rot?.n ?? 0,
    },
    recentes: aprendizado.filter((a) => a.status !== "rejeitado").slice(0, 6),
    frequentes: [...vivos].sort((a, b) => b.usos - a.usos || b.variacoes.length - a.variacoes.length).slice(0, 6),
    chamados: {
      total: chamados.length, abertos: abertos.length,
      respondidos: chamados.filter((c) => c.status === "entregue" || c.status === "respondido").length,
      atrasados: abertos.filter((c) => agora - (c.notificado_em ?? c.criado_em).getTime() > cfg.proximo_min * 60000).length,
      expirados: chamados.filter((c) => c.status === "expirado").length,
      tempoMedioMin: tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null,
    },
    temas: [...temasMapa].map(([k, v]) => ({ rotulo: rotuloCategoria(k), ...v })).sort((a, b) => b.escaladas + b.lacunas - a.escaladas - a.lacunas).slice(0, 6),
    lacunasAbertas: lac?.n ?? 0,
    serie,
    taxa: { periodo: doPeriodo.taxa, anterior: doAnterior.taxa, sozinha: doPeriodo.sozinha, escaladas: doPeriodo.escaladas },
    revisar: {
      pendentes: aprendizado.filter((a) => a.status === "pendente").length,
      vencidos: aprendizado.filter((a) => a.status === "ativo" && vencido(a)).length,
      conflitos: aprendizado.filter((a) => a.status !== "rejeitado" && a.status !== "oficial" && !!a.conflito_id).length,
      naoRevisados: aprendizado.filter((a) => a.status === "ativo" && !a.revisado).length,
    },
    escalonamentoAtivo: cfg.ativo,
  };
}
