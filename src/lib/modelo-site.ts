import { cache } from "react";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { lerPousada } from "@/lib/pousada";
import { todasProntas } from "@/lib/site-novo/paginas";

/**
 * Site → Modelo do site: Clássico (o site de 2026 até a troca) ou Novo (o
 * redesenho "Chegando pelo mar", docs/plano-site-novo.md).
 *
 * Decisões do Vinicios em 04/11/2026:
 *  - a chave troca o site INTEIRO de uma vez, e o Novo só pode ir para todos
 *    quando todas as páginas estiverem prontas (src/lib/site-novo/paginas.ts);
 *  - enquanto isso, só quem entra no painel vê o Novo (prévia), com uma
 *    barrinha para comparar com o Clássico.
 *
 * Por que um cookie assinado e não a sessão do painel: em produção o painel
 * fica em admin.pousadamarimarilhadomel.com.br e o site em www. — o cookie
 * de sessão de um não chega ao outro. A tela do painel gera um link curto
 * (15 min, assinado com AUTH_SECRET) para o www.; ao abrir, o aparelho ganha
 * o cookie de prévia (30 dias). Sem AUTH_SECRET não há prévia (falha fechada).
 */

export type ModeloSite = "classico" | "novo";

export type ConfigModelo = {
  modelo: ModeloSite;
  /** O céu do topo acompanha a hora na ilha (só no Novo). */
  ceuPorHora: boolean;
  alteradoEm: string | null;
  alteradoPor: string | null;
};

export const CONFIG_PADRAO: ConfigModelo = { modelo: "classico", ceuPorHora: true, alteradoEm: null, alteradoPor: null };

/**
 * A coluna `pousada.modelo_site` (migration 0023). Ausente, vazia ou
 * estranha = Clássico. E o Novo só vale para todos com as páginas prontas:
 * se uma página voltar para "em construção", o site volta sozinho ao Clássico
 * em vez de mostrar dois visuais misturados.
 */
export function lerConfigModelo(p: Record<string, unknown> | null | undefined, completo = todasProntas()): ConfigModelo {
  const c = p?.modelo_site as Record<string, unknown> | null | undefined;
  if (!c || typeof c !== "object") return CONFIG_PADRAO;
  return {
    modelo: c.modelo === "novo" && completo ? "novo" : "classico",
    ceuPorHora: c.ceu_por_hora !== false,
    alteradoEm: typeof c.alterado_em === "string" ? c.alterado_em : null,
    alteradoPor: typeof c.alterado_por === "string" ? c.alterado_por : null,
  };
}

/* ── prévia: link curto e cookie assinados ──────────────────────────── */

export const COOKIE_PREVIA = "marimar_previa";
export const COOKIE_VER = "marimar_ver";
export const DURACAO_PREVIA_MS = 30 * 24 * 3600 * 1000;
export const DURACAO_LINK_MS = 15 * 60 * 1000;
type Finalidade = "entrar" | "previa";
const LIMITE: Record<Finalidade, number> = { entrar: DURACAO_LINK_MS, previa: DURACAO_PREVIA_MS };

function segredoPadrao(): string | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length >= 16 ? s : null;
}

const assinatura = (base: string, segredo: string) => createHmac("sha256", segredo).update(base).digest("base64url");

/** `v1.<finalidade>.<expira-em-ms>.<hmac>`; nulo sem AUTH_SECRET. */
export function assinarPrevia(finalidade: Finalidade, expiraEm: number, segredo = segredoPadrao()): string | null {
  if (!segredo) return null;
  const base = `v1.${finalidade}.${Math.floor(expiraEm)}`;
  return `${base}.${assinatura(base, segredo)}`;
}

export function conferirPrevia(
  valor: string | null | undefined, finalidade: Finalidade, agora = Date.now(), segredo = segredoPadrao(),
): boolean {
  if (!valor || !segredo) return false;
  const partes = valor.split(".");
  if (partes.length !== 4) return false;
  const [versao, fim, exp, sig] = partes;
  if (versao !== "v1" || fim !== finalidade) return false;
  const expira = Number(exp);
  /* Vencido, ou com validade maior do que a que o site emite: recusa. */
  if (!Number.isFinite(expira) || expira <= agora || expira > agora + LIMITE[finalidade] + 60_000) return false;
  const esperado = Buffer.from(assinatura(`${versao}.${fim}.${exp}`, segredo));
  const recebido = Buffer.from(sig);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/* ── a decisão de cada visita ────────────────────────────────────────── */

export type Visita = {
  /** O que ESTA visita vê. */
  modelo: ModeloSite;
  /** O que os visitantes em geral veem. */
  publico: ModeloSite;
  /** Este aparelho tem a prévia (abriu o link do painel). */
  previa: boolean;
  config: ConfigModelo;
};

/**
 * Uma vez por requisição (o `cache` do React), compartilhada entre o layout
 * raiz, o layout do site e a página — os três decidem igual.
 */
export const modeloDaVisita = cache(async (): Promise<Visita> => {
  const config = lerConfigModelo(await lerPousada());
  const publico = config.modelo;
  let previa = false;
  let ver: string | undefined;
  try {
    const jar = await cookies();
    previa = conferirPrevia(jar.get(COOKIE_PREVIA)?.value, "previa");
    ver = jar.get(COOKIE_VER)?.value;
  } catch {
    /* Fora de uma requisição (build): sem prévia. */
  }
  if (!previa) return { modelo: publico, publico, previa: false, config };
  /* Com prévia, o padrão é ver o Novo; a barrinha troca para o Clássico. */
  return { modelo: ver === "classico" ? "classico" : "novo", publico, previa: true, config };
});

/**
 * Para onde a barrinha da prévia volta: só uma página do próprio site.
 * Conferido pela origem FINAL, não pelo texto: o navegador apaga tabulação e
 * quebra de linha e trata "\\" como "/", então "/\t/outro.com" ou "/\\outro.com"
 * passariam por um teste de "começa com uma barra só" e levariam a outro site.
 */
export function voltarSeguro(pedido: string, base: string): URL {
  try {
    const destino = new URL(pedido, base);
    if (pedido && destino.origin === new URL(base).origin && !destino.pathname.startsWith("/api/")) {
      return new URL(destino.pathname + destino.search, base);
    }
  } catch {
    /* endereço inválido: volta ao início */
  }
  return new URL("/", base);
}

/** Endereço público do site a partir do host do painel (admin.x → www.x). */
export function hostPublico(hostPainel: string): string {
  return hostPainel.startsWith("admin.") ? `www.${hostPainel.slice("admin.".length)}` : hostPainel;
}
