import type { Sql } from "./db-conexao";

/**
 * Utilidades das ações por voz (servidor). Ficam à parte para os dois
 * registros — o do treinamento (`marina-voz-acoes.ts`) e o do resto do
 * painel (`marina-voz-acoes-painel.ts`) — usarem as mesmas regras de
 * limpeza e de busca.
 */

export type Dados = Record<string, unknown>;

/** Texto aparado e cortado; vazio → null. */
export const texto = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Lista de textos sem vazios nem repetidos (máx. 20). Aceita também "a; b; c" ou uma linha por item. */
export const listaDeTexto = (v: unknown): string[] => {
  const bruto = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n|;/) : [];
  return [...new Set(bruto.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, 300)))].slice(0, 20);
};

export const soDigitos = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/[^\d]/g, "") : "");

/** "35", "35,50", "R$ 35,50", "1.200,00" → número com 2 casas. Vazio/ inválido → null. */
export const dinheiro = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  const limpo = String(v).replace(/[^\d,.]/g, "");
  if (!/\d/.test(limpo)) return null; // "cinquenta", "grátis": sem número, não vira R$ 0
  const n = Number(limpo.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

/** "true", "sim", "ligado" → true; "false", "não", "desligado" → false; resto → null. */
export const simNao = (v: unknown): boolean | null => {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (["true", "sim", "s", "ligado", "ligar", "ativo", "aceita", "pode"].includes(t)) return true;
  if (["false", "nao", "não", "n", "desligado", "desligar", "inativo", "nao aceita", "não aceita"].includes(t)) return false;
  return null;
};

/** "Suíte Queen!" → "suite-queen". */
export function slugDe(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "item";
}

/** Data "2026-12-20" ou "20/12/2026" → "2026-12-20"; inválida → null. */
export function dataISO(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** "14h", "14:00", "14 horas", "2 da tarde" não — só formatos de relógio. → "14:00". */
export function horario(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const m = /^(\d{1,2})(?:\s*(?:h|:|horas?)\s*(\d{2})?)?\s*(?:h|horas?)?$/i.exec(String(v).trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Acha UMA linha por parte do nome. Tabela e coluna vêm SÓ do código (nunca
 * da fala), por isso a lista fechada. Ambíguo → pede o nome exato.
 */
const TABELAS = {
  faq: "pergunta",
  pacotes: "nome",
  banners: "titulo",
  cardapio_itens: "nome",
  cardapio_categorias: "nome",
  depoimentos: "autor",
} as const;
export type TabelaBusca = keyof typeof TABELAS;

export async function acharUm<T extends { id: string }>(
  sql: Sql, tabela: TabelaBusca, alvo: string, oQue: string,
): Promise<{ ok: true; linha: T } | { ok: false; erro: string }> {
  const coluna = TABELAS[tabela];
  const exato = alvo.trim().slice(0, 160);
  const termo = `%${exato}%`;
  const linhas = await sql<T[]>`
    SELECT * FROM ${sql(tabela)}
    WHERE ${sql(coluna)} ILIKE ${termo}
    ORDER BY (lower(${sql(coluna)}) = lower(${exato})) DESC
    LIMIT 4`;
  if (linhas.length === 0) return { ok: false, erro: `Não achei ${oQue} parecido com "${exato}".` };
  const nomeDe = (l: T) => String((l as Record<string, unknown>)[coluna] ?? "");
  if (linhas.length > 1 && nomeDe(linhas[0]).toLowerCase() !== exato.toLowerCase()) {
    return { ok: false, erro: `Achei mais de um ${oQue} parecido com "${exato}" (${linhas.slice(0, 3).map(nomeDe).join("; ")}). Diga o nome exato.` };
  }
  return { ok: true, linha: linhas[0] };
}
