import type { Sql } from "./db-conexao";

/**
 * Desfazer e refazer o que a Marina mudou no painel (modo voz).
 *
 * Toda ação, ANTES de mexer numa linha, chama `ctx.tocar(tabela, chave,
 * valor)` — aqui guardamos a linha inteira como estava ("antes"). Linha nova
 * avisa com `ctx.criou(...)` ("antes" = não existia). Depois da ação, o
 * executor fotografa de novo ("depois") e grava o par em
 * `marina_voz_desfazer`.
 *
 *   desfazer = pôr cada linha como estava ANTES (linha criada → sai);
 *   refazer  = pôr cada linha como ficou DEPOIS.
 *
 * Nunca por cima de mudança alheia: se a linha mudou depois (pela tela ou
 * por outra pessoa), o desfazer recusa e diz para usar a tela. Só tabelas da
 * lista fechada abaixo (nome de tabela nunca vem da fala).
 */

export const TABELAS_DESFAZER = {
  marina_conhecimento: "id", marina_lacunas: "id", marina_config: "id", regras_hospedagem: "id",
  pousada: "id", adicionais: "id", politicas: "id", faq: "id", depoimentos: "id", pacotes: "id",
  cardapio_itens: "id", cardapio_categorias: "id", banners: "id", conteudo_editavel: "chave",
  equipe_contatos: "id", quartos: "id", categorias: "id", comodidades: "id", passeios: "id",
  blocos_home: "id", blocos_itens: "id", midias: "id", marina_escalonamento_config: "id",
} as const;
export type TabelaDesfazer = keyof typeof TABELAS_DESFAZER;

/** Tabelas em que "apagar" é mandar para a lixeira (o histórico aponta para elas). */
const LIXEIRA: Partial<Record<TabelaDesfazer, string>> = { marina_conhecimento: "excluido_em" };

type Linha = Record<string, unknown>;
export type Mudanca = { tabela: TabelaDesfazer; chave: string; valor: string | number; antes: Linha | null; depois: Linha | null };

export type ContextoAcao = {
  /** Chame ANTES de alterar a linha. */
  tocar(tabela: TabelaDesfazer, valor: string | number): Promise<void>;
  /** Chame DEPOIS de inserir a linha nova. */
  criou(tabela: TabelaDesfazer, valor: string | number): void;
};

export async function fotografar(sql: Sql, tabela: TabelaDesfazer, valor: string | number): Promise<Linha | null> {
  const chave = TABELAS_DESFAZER[tabela];
  const [l] = await sql<{ l: Linha }[]>`
    SELECT to_jsonb(t) AS l FROM ${sql(tabela)} t WHERE ${sql(chave)}::text = ${String(valor)}`;
  return l?.l ?? null;
}

/** Contexto que a ação usa; no fim, `mudancas()` traz antes/depois de tudo que ela tocou. */
export function novoContexto(sql: Sql): ContextoAcao & { mudancas(): Promise<Mudanca[]> } {
  const tocadas = new Map<string, { tabela: TabelaDesfazer; valor: string | number; antes: Linha | null }>();
  const id = (t: string, v: string | number) => `${t}\u0000${v}`;
  return {
    async tocar(tabela, valor) {
      if (tocadas.has(id(tabela, valor))) return; // vale a primeira foto
      tocadas.set(id(tabela, valor), { tabela, valor, antes: await fotografar(sql, tabela, valor) });
    },
    criou(tabela, valor) {
      if (!tocadas.has(id(tabela, valor))) tocadas.set(id(tabela, valor), { tabela, valor, antes: null });
    },
    async mudancas() {
      const lista: Mudanca[] = [];
      for (const t of tocadas.values()) {
        const depois = await fotografar(sql, t.tabela, t.valor);
        if (JSON.stringify(depois) === JSON.stringify(t.antes)) continue; // nada mudou de fato
        lista.push({ tabela: t.tabela, chave: TABELAS_DESFAZER[t.tabela], valor: t.valor, antes: t.antes, depois });
      }
      return lista;
    },
  };
}

/** Põe a linha no estado dado (null = não existir). Só tabelas da lista. */
async function restaurar(sql: Sql, m: Mudanca, alvo: Linha | null): Promise<void> {
  if (!(m.tabela in TABELAS_DESFAZER)) throw new Error("tabela fora da lista");
  const t = m.tabela, chave = TABELAS_DESFAZER[t];
  const aspas = (s: string) => `"${s.replace(/"/g, '""')}"`;
  if (alvo === null) {
    const lixeira = LIXEIRA[t];
    if (lixeira) await sql.unsafe(`UPDATE ${aspas(t)} SET ${aspas(lixeira)} = now() WHERE ${aspas(chave)}::text = $1`, [String(m.valor)]);
    else await sql.unsafe(`DELETE FROM ${aspas(t)} WHERE ${aspas(chave)}::text = $1`, [String(m.valor)]);
    return;
  }
  const colunas = Object.keys(alvo);
  const set = colunas.filter((c) => c !== chave).map((c) => `${aspas(c)} = EXCLUDED.${aspas(c)}`).join(", ");
  await sql.unsafe(
    /* $1 vai como TEXTO e vira jsonb aqui: passado direto como jsonb, o driver
       codifica de novo e o banco recebe uma string em vez do objeto. */
    `INSERT INTO ${aspas(t)} SELECT * FROM jsonb_populate_record(NULL::${aspas(t)}, $1::text::jsonb)
     ON CONFLICT (${aspas(chave)}) DO ${set ? `UPDATE SET ${set}` : "NOTHING"}`,
    [JSON.stringify(alvo)],
  );
}

/* ── a pilha (por pessoa) ────────────────────────────────────────── */

export type EstadoPilha = { desfazer: string | null; refazer: string | null };

/** Registra uma ação feita e esvazia o "refazer" de quem fez (como em todo editor). */
export async function registrarFeita(sql: Sql, autor: string, sessao: string | null, nome: string, resumo: string, mudancas: Mudanca[]): Promise<void> {
  if (!mudancas.length) return;
  await sql`UPDATE marina_voz_desfazer SET estado = 'descartada', mudado_em = now() WHERE autor = ${autor} AND estado = 'desfeita'`;
  await sql`
    INSERT INTO marina_voz_desfazer (sessao, autor, nome, resumo, mudancas)
    VALUES (${sessao}, ${autor}, ${nome}, ${resumo.slice(0, 300)}, ${sql.json(mudancas as never)})`;
}

export async function estadoPilha(sql: Sql, autor: string): Promise<EstadoPilha> {
  const [d] = await sql<{ resumo: string }[]>`
    SELECT resumo FROM marina_voz_desfazer WHERE autor = ${autor} AND estado = 'feita'
      AND criado_em > now() - interval '7 days' ORDER BY criado_em DESC LIMIT 1`;
  const [r] = await sql<{ resumo: string }[]>`
    SELECT resumo FROM marina_voz_desfazer WHERE autor = ${autor} AND estado = 'desfeita'
    ORDER BY mudado_em DESC LIMIT 1`;
  return { desfazer: d?.resumo ?? null, refazer: r?.resumo ?? null };
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Desfaz (ou refaz) a última ação desta pessoa. Tudo numa transação: ou volta
 * tudo, ou nada. Recusa se alguma linha mudou depois por outro caminho.
 */
export async function desfazerOuRefazer(sql: Sql, autor: string, sentido: "desfazer" | "refazer"): Promise<{ ok: boolean; mensagem: string; caminhosDe: string[] }> {
  const [reg] = sentido === "desfazer"
    ? await sql<{ id: string; nome: string; resumo: string; mudancas: Mudanca[] }[]>`
        SELECT id, nome, resumo, mudancas FROM marina_voz_desfazer WHERE autor = ${autor} AND estado = 'feita'
          AND criado_em > now() - interval '7 days' ORDER BY criado_em DESC LIMIT 1`
    : await sql<{ id: string; nome: string; resumo: string; mudancas: Mudanca[] }[]>`
        SELECT id, nome, resumo, mudancas FROM marina_voz_desfazer WHERE autor = ${autor} AND estado = 'desfeita'
        ORDER BY mudado_em DESC LIMIT 1`;
  if (!reg) return { ok: false, mensagem: sentido === "desfazer" ? "Não há nada para desfazer." : "Não há nada para refazer.", caminhosDe: [] };

  const lista = Array.isArray(reg.mudancas) ? reg.mudancas : [];
  /* Conferência: cada linha tem de estar como a ação deixou (ou como estava, ao refazer). */
  for (const m of lista) {
    const agora = await fotografar(sql, m.tabela, m.valor);
    const esperado = sentido === "desfazer" ? m.depois : m.antes;
    if (!igual(agora, esperado)) {
      return { ok: false, mensagem: `Não dá para ${sentido} "${reg.resumo}": isso foi mudado depois (pela tela ou por outra pessoa). Ajuste pela tela.`, caminhosDe: [] };
    }
  }
  await sql.begin(async (tx) => {
    for (const m of [...lista].reverse()) await restaurar(tx as unknown as Sql, m, sentido === "desfazer" ? m.antes : m.depois);
    await tx`UPDATE marina_voz_desfazer SET estado = ${sentido === "desfazer" ? "desfeita" : "feita"}, mudado_em = now() WHERE id = ${reg.id}`;
  });
  return {
    ok: true,
    mensagem: sentido === "desfazer" ? `Desfeito: ${reg.resumo}` : `Refeito: ${reg.resumo}`,
    caminhosDe: [reg.nome],
  };
}
