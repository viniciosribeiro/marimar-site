import { createHash } from "crypto";
import type { Sql } from "./db-conexao";
import { chamarRpc } from "./openclaw-config";
import {
  MEMORIA_VAZIA, decidirEnvio, decidirVigia, emAdaptacao, lerSaude,
  type EnvioRegistrado, type LeituraWhatsapp, type MemoriaVigia,
} from "./whatsapp-saude";

/**
 * Blindagem do WhatsApp da Marina: a parte que conversa com o OpenClaw e
 * com o banco. As regras ficam em whatsapp-saude.ts; o porquê em
 * docs/blindagem-whatsapp.md.
 *
 * Tudo guardado em `integracoes` (chave única, sem migration):
 *   trava:<nome>   quem está rodando os prazos / o vigia agora
 *   wa_vigia       memória do vigia (estado, número, recuperações, histórico)
 *   wa_out:<id>    cada envio automático (número e chave da mensagem)
 *   wa_blq:<id>    cada envio segurado pelo disjuntor
 */

/* ── trava entre cópias do servidor ─────────────────────────────────
   Na Vercel várias cópias do site rodam ao mesmo tempo. Uma linha com
   UPDATE condicional é atômica mesmo atrás do pooler do Neon (uma trava
   de sessão do Postgres não seria). */

export async function pegarTrava(sql: Sql, nome: string, validadeSeg: number): Promise<boolean> {
  const [linha] = await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (${"trava:" + nome}, 'ocupada', now())
    ON CONFLICT (chave) DO UPDATE SET valor = 'ocupada', atualizado_em = now()
      WHERE integracoes.valor <> 'ocupada' OR integracoes.atualizado_em < now() - make_interval(secs => ${validadeSeg})
    RETURNING id`;
  return Boolean(linha);
}

export async function soltarTrava(sql: Sql, nome: string): Promise<void> {
  await sql`UPDATE integracoes SET valor = 'livre', atualizado_em = now() WHERE chave = ${"trava:" + nome}`.catch(() => {});
}

/* ── memória do vigia ───────────────────────────────────────────── */

export async function lerMemoria(sql: Sql): Promise<MemoriaVigia> {
  const [l] = await sql<{ valor: string | null }[]>`SELECT valor FROM integracoes WHERE chave = 'wa_vigia'`.catch(() => []);
  try { return l?.valor ? { ...MEMORIA_VAZIA, ...JSON.parse(l.valor) } : MEMORIA_VAZIA; } catch { return MEMORIA_VAZIA; }
}

async function gravarMemoria(sql: Sql, m: MemoriaVigia) {
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('wa_vigia', ${JSON.stringify(m)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`;
}

const modoWhatsapp = async (sql: Sql) =>
  (await sql<{ whatsapp_modo: string }[]>`SELECT whatsapp_modo FROM marina_escalonamento_config WHERE id = 1`.catch(() => []))[0]?.whatsapp_modo ?? "web";

/* ── alerta no celular de quem cuida ────────────────────────────────
   ALERTA_WHATSAPP_URL: um endereço que recebe POST de texto. Feito para o
   ntfy (https://ntfy.sh/<tópico-difícil-de-adivinhar>, app gratuito no
   celular), mas qualquer webhook de texto serve. Sem a variável, não avisa
   ninguém fora do painel. Nunca leva dado de cliente. */

export async function enviarAlerta(texto: string): Promise<boolean> {
  const url = process.env.ALERTA_WHATSAPP_URL?.trim();
  if (!url) return false;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain; charset=utf-8", Title: "Marina - WhatsApp", Tags: "warning" },
      body: texto,
      signal: AbortSignal.timeout(6000),
    });
    return r.ok;
  } catch (e) {
    console.error("[vigia] alerta não saiu:", (e as Error).message);
    return false;
  }
}

/* ── vigia ──────────────────────────────────────────────────────── */

export async function lerConexao(): Promise<{ ok: true; leitura: LeituraWhatsapp | null } | { ok: false; erro: string }> {
  const r = await chamarRpc("channels.status", {}, 8000);
  return r.ok ? { ok: true, leitura: lerSaude(r.dados) } : r;
}

/** Para e liga de novo o canal do WhatsApp no OpenClaw (guarda o QR; não pede leitura nova). */
export async function destravarCanal(): Promise<{ ok: boolean; erro?: string }> {
  const parar = await chamarRpc("channels.stop", { channel: "whatsapp" }, 20_000);
  const ligar = await chamarRpc("channels.start", { channel: "whatsapp" }, 20_000);
  if (ligar.ok) return { ok: true };
  return { ok: false, erro: `${parar.ok ? "" : `parar: ${parar.erro}; `}ligar: ${ligar.erro}` };
}

/** Uma linha no histórico que o painel mostra (ação feita por uma pessoa). */
export async function anotarNoHistorico(sql: Sql, texto: string): Promise<void> {
  const m = await lerMemoria(sql);
  m.historico = [{ em: Date.now(), texto }, ...m.historico].slice(0, 20);
  await gravarMemoria(sql, m).catch(() => {});
}

export type ResultadoVigia = { rodou: boolean; estado?: string; acao?: string; alerta?: string | null };

/**
 * Uma volta do vigia. Roda pelo /api/cron/chamados (agendador), e de
 * carona no painel, no chat do site e nas rotas que a Marina consulta.
 */
export async function vigiarWhatsapp(sql: Sql, origem: string): Promise<ResultadoVigia> {
  if (!(await pegarTrava(sql, "vigia", 90))) return { rodou: false };
  try {
    const antes = await lerMemoria(sql);
    const modo = await modoWhatsapp(sql);
    const conexao = modo === "oficial" ? { ok: true as const, leitura: null } : await lerConexao();
    const leitura = conexao.ok ? conexao.leitura : null;
    /* Gateway respondeu mas sem o canal: trata como desconhecido, não como servidor fora. */
    const lida = conexao.ok && !leitura && modo !== "oficial"
      ? { estado: "desconhecido" as const, numero: null, conectadoDesde: null, ultimaEntrada: null, tentativas: null, erro: null, saude: null }
      : leitura;
    const d = decidirVigia(lida, antes, Date.now(), modo);
    if (d.acao === "destravar") {
      const r = await destravarCanal();
      d.memoria.historico[0] = { em: Date.now(), texto: r.ok ? `Destravamento automático (${origem})` : `Destravamento automático falhou: ${r.erro}` };
      console.warn("[vigia] destravamento automático:", r.ok ? "ok" : r.erro);
    }
    if (d.alerta) {
      const saiu = await enviarAlerta(d.alerta);
      d.memoria.historico = [{ em: Date.now(), texto: `Alerta${saiu ? " enviado" : " (sem ALERTA_WHATSAPP_URL)"}: ${d.alerta}` }, ...d.memoria.historico].slice(0, 20);
    }
    await gravarMemoria(sql, d.memoria);
    return { rodou: true, estado: d.memoria.estado, acao: d.acao, alerta: d.alerta };
  } finally {
    await soltarTrava(sql, "vigia");
  }
}

/* De carona: no máximo uma volta por minuto por cópia do servidor; a
   trava acima evita duas cópias ao mesmo tempo. */
let ultimaVolta = 0;
export async function talvezVigiar(sql: Sql, origem: string): Promise<void> {
  if (Date.now() - ultimaVolta < 60_000) return;
  ultimaVolta = Date.now();
  try {
    const m = await lerMemoria(sql);
    if (Date.now() - m.ultimaVez < 60_000) return;
    await vigiarWhatsapp(sql, origem);
  } catch (e) {
    console.error("[vigia]", (e as Error).message);
  }
}

/* ── disjuntor de envios ────────────────────────────────────────── */

const chaveDe = (numero: string, texto: string) => createHash("sha1").update(`${numero}|${texto.trim()}`).digest("hex").slice(0, 20);

async function historicoEnvios(sql: Sql): Promise<EnvioRegistrado[]> {
  const linhas = await sql<{ valor: string; atualizado_em: Date }[]>`
    SELECT valor, atualizado_em FROM integracoes WHERE chave LIKE 'wa_out:%' AND atualizado_em > now() - interval '60 minutes'`;
  return linhas.flatMap((l) => {
    try { const v = JSON.parse(l.valor); return [{ numero: String(v.n), chave: String(v.k), em: new Date(l.atualizado_em).getTime() }]; } catch { return []; }
  });
}

/**
 * Antes de cada envio automático pelo número da Marina. Devolve quanto
 * esperar, ou o motivo de não mandar. Registra a tentativa — inclusive a
 * segurada, para o painel mostrar.
 */
export async function passarDisjuntor(sql: Sql, numero: string, texto: string): Promise<{ ok: true; esperarMs: number } | { ok: false; motivo: string }> {
  const so = numero.replace(/\D/g, "");
  const chave = chaveDe(so, texto);
  let memoria = await lerMemoria(sql);
  /* Sem saber o próprio número (vigia ainda não rodou), pergunta agora: é
     a proteção contra a Marina mandar para si mesma. */
  if (!memoria.numero || Date.now() - memoria.ultimaVez > 30 * 60_000) {
    await vigiarWhatsapp(sql, "envio").catch(() => null);
    memoria = await lerMemoria(sql);
  }
  const agora = Date.now();
  const d = decidirEnvio(await historicoEnvios(sql), so, chave, agora, memoria.numero, emAdaptacao(memoria.numeroDesde, agora));
  const id = `${agora}:${Math.random().toString(36).slice(2, 8)}`;
  if (!d.ok) {
    await sql`INSERT INTO integracoes (chave, valor) VALUES (${"wa_blq:" + id}, ${JSON.stringify({ n: so, m: d.motivo })})`.catch(() => {});
    return d;
  }
  await sql`INSERT INTO integracoes (chave, valor) VALUES (${"wa_out:" + id}, ${JSON.stringify({ n: so, k: chave })})`;
  if (Math.random() < 0.05) {
    await sql`DELETE FROM integracoes WHERE (chave LIKE 'wa_out:%' OR chave LIKE 'wa_blq:%') AND atualizado_em < now() - interval '3 days'`.catch(() => {});
  }
  return d;
}

/** Números para o painel: envios e segurados nas últimas 24 h. */
export async function resumoProtecoes(sql: Sql): Promise<{ envios24h: number; segurados24h: number; ultimosSegurados: { em: number; motivo: string }[] }> {
  const [c] = await sql<{ envios: number; segurados: number }[]>`
    SELECT count(*) FILTER (WHERE chave LIKE 'wa_out:%')::int AS envios, count(*) FILTER (WHERE chave LIKE 'wa_blq:%')::int AS segurados
    FROM integracoes WHERE (chave LIKE 'wa_out:%' OR chave LIKE 'wa_blq:%') AND atualizado_em > now() - interval '24 hours'`.catch(() => [{ envios: 0, segurados: 0 }]);
  const linhas = await sql<{ valor: string; atualizado_em: Date }[]>`
    SELECT valor, atualizado_em FROM integracoes WHERE chave LIKE 'wa_blq:%' AND atualizado_em > now() - interval '24 hours'
    ORDER BY atualizado_em DESC LIMIT 5`.catch(() => []);
  return {
    envios24h: c?.envios ?? 0, segurados24h: c?.segurados ?? 0,
    ultimosSegurados: linhas.flatMap((l) => { try { return [{ em: new Date(l.atualizado_em).getTime(), motivo: String(JSON.parse(l.valor).m) }]; } catch { return []; } }),
  };
}
