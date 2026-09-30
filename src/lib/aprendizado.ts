import type { Sql } from "./db-conexao";
import { codigoItem, sugerirCategoria, rotuloCategoria } from "./marina-base";
import {
  similaridade, LIMIAR_MESMA_PERGUNTA, anonimizar, perguntaParaBase, pedeValidade, normalizarTexto, type ConfigEscalonamento,
} from "./escalonamento-base";

/**
 * Base de aprendizado da Marina.
 *
 * O que a equipe responde num chamado vira conhecimento APRENDIDO — separado
 * do conhecimento cadastrado à mão (`marina_conhecimento`), que nunca é
 * alterado por aqui. Perguntas com o mesmo significado viram um grupo só
 * (a pergunta principal + variações). Nada que identifique o cliente entra.
 * Fluxo e regras: docs/fluxo-escalonamento.md.
 */

export type Aprendido = {
  id: string; pergunta: string; variacoes: string[]; resposta: string; categoria: string;
  status: "pendente" | "ativo" | "rejeitado" | "oficial"; revisado: boolean; confianca: number;
  origem: string; origem_canal: string | null; chamado_id: string | null; respondido_por: string | null;
  usos: number; ultimo_uso_em: string | null; valido_ate: string | null; conflito_id: string | null;
  conhecimento_id: string | null; revisado_por: string | null; revisado_em: string | null;
  criado_em: string; atualizado_em: string;
};

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
const dia = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);

function linha(l: Record<string, unknown>): Aprendido {
  return {
    ...(l as unknown as Aprendido),
    variacoes: lista(l.variacoes),
    confianca: Number(l.confianca),
    usos: Number(l.usos),
    ultimo_uso_em: iso(l.ultimo_uso_em), valido_ate: dia(l.valido_ate), revisado_em: iso(l.revisado_em),
    criado_em: iso(l.criado_em)!, atualizado_em: iso(l.atualizado_em)!,
  };
}

/** Todos, para o painel. Antes da migration 0019: lista vazia. */
export async function lerAprendizado(sql: Sql): Promise<Aprendido[]> {
  try {
    return (await sql`SELECT * FROM marina_aprendizado ORDER BY criado_em DESC LIMIT 1000`).map(linha);
  } catch {
    return [];
  }
}

export const vencido = (a: Pick<Aprendido, "valido_ate">, hoje = new Date()) =>
  !!a.valido_ate && a.valido_ate < hoje.toISOString().slice(0, 10);

/** O que a Marina usa: ativo, sem conflito com o manual, dentro da validade. */
export const emUso = (a: Aprendido, hoje = new Date()) => a.status === "ativo" && !a.conflito_id && !vencido(a, hoje);

export async function lerAprendidosEmUso(sql: Sql): Promise<Aprendido[]> {
  return (await lerAprendizado(sql)).filter((a) => emUso(a));
}

/** Um evento para o painel medir se ela está resolvendo sozinha. Nunca derruba quem chamou. */
export async function registrarEvento(sql: Sql, tipo: "aprendido_usado" | "escalada" | "lacuna" | "respondido", e: { canal?: string | null; categoria?: string | null; referencia?: string | null; valor?: number | null } = {}) {
  await sql`INSERT INTO marina_eventos (tipo, canal, categoria, referencia, valor)
    VALUES (${tipo}, ${e.canal ?? null}, ${e.categoria ?? null}, ${e.referencia ?? null}, ${e.valor ?? null})`.catch(() => {});
}

/** O item manual mais parecido (perguntas e fatos), se passar do limiar. */
async function manualParecido(sql: Sql, pergunta: string): Promise<{ id: string; titulo: string } | null> {
  const manuais = await sql<{ id: string; titulo: string; variacoes: unknown }[]>`
    SELECT id, titulo, variacoes FROM marina_conhecimento
    WHERE ativo = true AND excluido_em IS NULL AND tipo IN ('pergunta', 'fato')`.catch(() => []);
  let melhor: { id: string; titulo: string; nota: number } | null = null;
  for (const m of manuais) {
    const nota = Math.max(similaridade(pergunta, m.titulo), ...lista(m.variacoes).map((v) => similaridade(pergunta, v)));
    if (nota >= LIMIAR_MESMA_PERGUNTA && (!melhor || nota > melhor.nota)) melhor = { id: m.id, titulo: m.titulo, nota };
  }
  return melhor;
}

/** O grupo aprendido com o mesmo significado (fora os rejeitados). */
export function grupoParecido(itens: Aprendido[], pergunta: string): { item: Aprendido; nota: number } | null {
  let melhor: { item: Aprendido; nota: number } | null = null;
  for (const a of itens) {
    if (a.status === "rejeitado") continue;
    const nota = Math.max(similaridade(pergunta, a.pergunta), ...a.variacoes.map((v) => similaridade(pergunta, v)));
    if (nota >= LIMIAR_MESMA_PERGUNTA && (!melhor || nota > melhor.nota)) melhor = { item: a, nota };
  }
  return melhor;
}

/**
 * A equipe respondeu um chamado: vira aprendizado.
 *
 * - Pergunta parecida já aprendida: junta no mesmo grupo (vira variação).
 *   Mesma resposta de novo → confiança sobe. Resposta diferente → a nova
 *   entra, a confiança cai e o item volta para revisão.
 * - Parecida com um item MANUAL: guarda, mas parado (`conflito_id`) — o
 *   manual continua valendo e alguém decide na fila de revisão.
 * - Modo "automático": já vale para a Marina. Modo "aprovação": espera.
 */
export async function aprenderDeChamado(
  sql: Sql,
  c: { id: string; pergunta: string; canal: string; categoria: string },
  resposta: string,
  respondidoPor: string,
  cfg: Pick<ConfigEscalonamento, "aprendizado_modo" | "validade_dias">,
): Promise<{ id: string; novo: boolean; status: string } | null> {
  const pergunta = perguntaParaBase(c.pergunta).slice(0, 600);
  const texto = anonimizar(resposta).slice(0, 3000);
  if (pergunta.length < 4 || texto.length < 2) return null;
  try {
    const itens = await lerAprendizado(sql);
    const conflito = await manualParecido(sql, pergunta);
    const validade = pedeValidade(`${pergunta} ${texto}`) && cfg.validade_dias > 0
      ? new Date(Date.now() + cfg.validade_dias * 86400000).toISOString().slice(0, 10) : null;
    const automatico = cfg.aprendizado_modo === "automatico";
    const grupo = grupoParecido(itens, pergunta);

    if (grupo && grupo.item.status !== "oficial") {
      const a = grupo.item;
      const variacoes = [...a.variacoes];
      if (normalizarTexto(pergunta) !== normalizarTexto(a.pergunta) && !variacoes.some((v) => normalizarTexto(v) === normalizarTexto(pergunta))) {
        variacoes.push(pergunta);
      }
      const confirma = similaridade(texto, a.resposta) >= 0.5;
      const confianca = confirma ? Math.min(0.95, a.confianca + 0.1) : 0.5;
      /* Resposta nova e diferente: não substitui às cegas o que já estava em
         uso — no modo aprovação volta para a fila; no automático passa a
         valer a mais recente, marcada como não revisada. */
      const status = a.status === "ativo" && (confirma || automatico) ? "ativo" : automatico && !conflito ? "ativo" : "pendente";
      await sql`
        UPDATE marina_aprendizado SET variacoes = ${sql.json(variacoes.slice(0, 30))},
          resposta = ${confirma ? a.resposta : texto}, confianca = ${confianca}, status = ${status},
          revisado = ${confirma ? a.revisado : false}, conflito_id = ${conflito?.id ?? a.conflito_id},
          respondido_por = ${respondidoPor}, valido_ate = ${validade ?? a.valido_ate}, atualizado_em = now()
        WHERE id = ${a.id}`;
      return { id: a.id, novo: false, status };
    }
    if (grupo?.item.status === "oficial") return { id: grupo.item.id, novo: false, status: "oficial" };

    const status = automatico && !conflito ? "ativo" : "pendente";
    const [novo] = await sql<{ id: string }[]>`
      INSERT INTO marina_aprendizado (pergunta, resposta, categoria, status, confianca, origem, origem_canal,
        chamado_id, respondido_por, valido_ate, conflito_id)
      VALUES (${pergunta}, ${texto}, ${c.categoria !== "geral" ? c.categoria : sugerirCategoria(pergunta)}, ${status}, 0.6,
        'chamado', ${c.canal}, ${c.id}, ${respondidoPor}, ${validade}, ${conflito?.id ?? null})
      RETURNING id`;
    return { id: novo.id, novo: true, status };
  } catch (e) {
    console.error("[aprendizado] não registrou:", (e as Error).message);
    return null;
  }
}

/**
 * A Marina respondeu algo que ela APRENDEU: conta o uso.
 *
 * No site isto é detectado sozinho (a pergunta passa pelo nosso servidor);
 * no WhatsApp a skill chama `POST /api/agent/aprendizado/uso`.
 */
export async function registrarUso(sql: Sql, pergunta: string, canal: string): Promise<Aprendido | null> {
  const itens = (await lerAprendizado(sql)).filter((a) => emUso(a));
  const g = grupoParecido(itens, anonimizar(pergunta));
  if (!g) return null;
  await sql`UPDATE marina_aprendizado SET usos = usos + 1, ultimo_uso_em = now() WHERE id = ${g.item.id}`.catch(() => {});
  await registrarEvento(sql, "aprendido_usado", { canal, categoria: g.item.categoria, referencia: g.item.id });
  return g.item;
}

/**
 * O pedaço do treinamento com o que ela aprendeu. Entra DEPOIS do que foi
 * cadastrado à mão, e diz com todas as letras que vale menos.
 */
export function aprendidosEmTexto(itens: Aprendido[], opcoes: { codigos?: boolean } = {}): string {
  const usar = itens.filter((a) => emUso(a));
  if (!usar.length) return "";
  const cod = (a: Aprendido) => (opcoes.codigos ? `[${codigoItem(a.id)}] ` : "");
  return [
    "APRENDIDO COM A EQUIPE (respostas que a equipe da pousada deu a hóspedes — use com as suas palavras):",
    "Vale MENOS que tudo o que está acima: se algo aqui contradisser o que foi cadastrado, siga o cadastrado.",
    "Continue obedecendo o jeito de falar e o que você nunca diz. Preço e vaga continuam vindo só do sistema de reservas.",
    ...usar.map((a) => {
      const outras = a.variacoes.length ? `\n  Também perguntam: ${a.variacoes.slice(0, 6).map((v) => `"${v}"`).join("; ")}` : "";
      const ate = a.valido_ate ? ` (vale até ${a.valido_ate.split("-").reverse().join("/")})` : "";
      return `• ${cod(a)}[${rotuloCategoria(a.categoria)}] P: ${a.pergunta}${outras}\n  R: ${a.resposta}${ate}`;
    }),
  ].join("\n");
}
