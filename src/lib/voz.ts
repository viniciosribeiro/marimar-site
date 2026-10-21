import type { Sql } from "./db-conexao";
import { lerConfig } from "./marina";
import { cifrar, decifrar, finalDaChave } from "./segredo";
import { corrigirConfig, lerConfigOpenClaw } from "./openclaw-config";
import {
  PROVEDOR, PROVEDORES_VOZ, doProvedor, oProvedor, diferencas, normalizarOpcoes, openaiAceitaInstrucoes, openaiAceitaVelocidade, patchDaVoz, pcmParaWav, textoGoogle, vozDoWhatsapp,
  type OpcoesVoz, type Provedor, type VozEfetiva,
} from "./voz-base";

/**
 * A voz da Marina do lado do site: opções gravadas, chaves e o áudio em si.
 * Os pedidos aos provedores levam os MESMOS campos que o OpenClaw manda no
 * WhatsApp (ver voz-base.ts) — é isso que faz o site e o WhatsApp falarem
 * igual. Endereços trocáveis só para os testes (VOZ_URL_*).
 */

const base = (p: Provedor) => {
  const padrao = { elevenlabs: "https://api.elevenlabs.io", openai: "https://api.openai.com", google: "https://generativelanguage.googleapis.com" }[p];
  const teste = { elevenlabs: process.env.VOZ_URL_ELEVENLABS, openai: process.env.VOZ_URL_OPENAI, google: process.env.VOZ_URL_GOOGLE }[p];
  return (teste?.trim() || padrao).replace(/\/+$/, "");
};

/* ── opções ──────────────────────────────────────────────────────── */

export async function lerOpcoesVoz(sql: Sql): Promise<OpcoesVoz> {
  const config = await lerConfig(sql);
  const [l] = await sql<{ valor: string | null }[]>`SELECT valor FROM integracoes WHERE chave = 'voz_marina'`.catch(() => []);
  let bruto: unknown = {};
  try { bruto = l?.valor ? JSON.parse(l.valor) : {}; } catch { /* volta ao padrão */ }
  return normalizarOpcoes(config, bruto);
}

/** ElevenLabs nas colunas de sempre de `marina_config`; provedor, OpenAI e Google em `integracoes` (sem migration). */
export async function gravarOpcoesVoz(sql: Sql, o: OpcoesVoz): Promise<void> {
  const e = o.elevenlabs;
  const dados = { voz_id: e.voz, voz_modelo: e.modelo, voz_estabilidade: e.estabilidade, voz_semelhanca: e.semelhanca, voz_velocidade: e.velocidade };
  const [existe] = await sql<{ id: string }[]>`SELECT id FROM marina_config LIMIT 1`;
  if (existe) await sql`UPDATE marina_config SET ${sql(dados)}, atualizado_em = now() WHERE id = ${existe.id}`;
  else await sql`INSERT INTO marina_config ${sql(dados)}`;
  const resto = JSON.stringify({ provedor: o.provedor, openai: o.openai, google: o.google });
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('voz_marina', ${resto}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`;
}

/* ── chaves ──────────────────────────────────────────────────────── */

export type OrigemChave = "vercel" | "painel" | null;
export type EstadoChave = { origem: OrigemChave; final: string | null };

/** A da Vercel vale primeiro (como sempre); sem ela, a conectada pelo painel. */
export async function chaveDoProvedor(sql: Sql | null, p: Provedor): Promise<{ chave: string | null; origem: OrigemChave }> {
  for (const nome of PROVEDOR[p].variaveis) {
    const c = process.env[nome]?.trim();
    if (c) return { chave: c, origem: "vercel" };
  }
  if (!sql) return { chave: null, origem: null };
  const [l] = await sql<{ valor: string | null }[]>`SELECT valor FROM integracoes WHERE chave = ${"chave_voz:" + p}`.catch(() => []);
  const c = decifrar(l?.valor);
  return c ? { chave: c, origem: "painel" } : { chave: null, origem: null };
}

export async function estadoDasChaves(sql: Sql): Promise<Record<Provedor, EstadoChave>> {
  const r = {} as Record<Provedor, EstadoChave>;
  for (const p of PROVEDORES_VOZ) {
    const { chave, origem } = await chaveDoProvedor(sql, p);
    r[p] = { origem, final: chave ? finalDaChave(chave) : null };
  }
  return r;
}

export async function guardarChave(sql: Sql, p: Provedor, chave: string): Promise<void> {
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (${"chave_voz:" + p}, ${cifrar(chave)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`;
}

export async function apagarChave(sql: Sql, p: Provedor): Promise<void> {
  await sql`DELETE FROM integracoes WHERE chave = ${"chave_voz:" + p}`;
}

const recusa = (p: Provedor, status: number, detalhe = "") => {
  const quem = oProvedor(p).replace(/^./, (c) => c.toUpperCase());
  if (status === 401 || status === 403) return `A chave ${doProvedor(p)} foi recusada${detalhe ? ` (${detalhe})` : ""}.`;
  if (status === 404) return p === "elevenlabs" ? "A ElevenLabs não achou essa voz nesta conta." : `${quem} não reconheceu o modelo ou a voz.`;
  if (status === 429) return `${quem} recusou por limite ou falta de crédito. Confira o saldo da conta.`;
  if (status === 402) return `A conta ${doProvedor(p)} está sem crédito.`;
  return `${quem} respondeu ${status}${detalhe ? `: ${detalhe}` : ""}.`;
};

async function detalheDoErro(r: Response): Promise<string> {
  const t = await r.text().catch(() => "");
  try {
    const j = JSON.parse(t);
    const m = j?.detail?.message ?? j?.detail?.status ?? j?.error?.message ?? j?.message;
    if (typeof m === "string") return m.slice(0, 160);
  } catch { /* sem JSON */ }
  return t.slice(0, 160);
}

/** Confere a chave antes de guardar: não adianta conectar uma que não funciona. */
export async function testarChave(p: Provedor, chave: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const r = p === "elevenlabs"
      ? await fetch(`${base(p)}/v1/voices`, { headers: { "xi-api-key": chave }, signal: AbortSignal.timeout(12_000) })
      : p === "openai"
        ? await fetch(`${base(p)}/v1/models`, { headers: { authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(12_000) })
        : await fetch(`${base(p)}/v1beta/models`, { headers: { "x-goog-api-key": chave }, signal: AbortSignal.timeout(12_000) });
    if (r.ok) return { ok: true };
    return { ok: false, erro: recusa(p, r.status, await detalheDoErro(r)) };
  } catch (e) {
    return { ok: false, erro: `Não consegui falar com ${oProvedor(p)}: ${(e as Error).message}` };
  }
}

/* ── vozes da conta ElevenLabs ───────────────────────────────────── */

export type VozConta = { id: string; nome: string; jeito: string; previa: string | null; categoria: string };

const GENERO: Record<string, string> = { female: "feminina", male: "masculina", neutral: "neutra" };

export async function listarVozesEleven(chave: string): Promise<{ ok: true; vozes: VozConta[] } | { ok: false; erro: string }> {
  try {
    const r = await fetch(`${base("elevenlabs")}/v1/voices`, { headers: { "xi-api-key": chave }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return { ok: false, erro: recusa("elevenlabs", r.status, await detalheDoErro(r)) };
    const j = (await r.json()) as { voices?: Record<string, unknown>[] };
    const vozes = (j.voices ?? []).flatMap((v) => {
      const id = typeof v.voice_id === "string" ? v.voice_id : null;
      if (!id) return [];
      const l = (v.labels && typeof v.labels === "object" ? v.labels : {}) as Record<string, unknown>;
      const jeito = [GENERO[String(l.gender ?? "")] ?? null, l.accent, l.descriptive ?? l.description, l.use_case]
        .filter((x): x is string => typeof x === "string" && x.length > 0).join(" · ");
      return [{
        id, nome: typeof v.name === "string" ? v.name : id, jeito,
        previa: typeof v.preview_url === "string" ? v.preview_url : null,
        categoria: typeof v.category === "string" ? v.category : "",
      }];
    });
    /* As da própria conta (clonadas, criadas) primeiro. */
    vozes.sort((a, b) => Number(a.categoria === "premade") - Number(b.categoria === "premade") || a.nome.localeCompare(b.nome));
    return { ok: true, vozes };
  } catch (e) {
    return { ok: false, erro: `Não consegui falar com a ElevenLabs: ${(e as Error).message}` };
  }
}

/* ── o áudio ─────────────────────────────────────────────────────── */

export type Audio = { ok: true; audio: ArrayBuffer; tipo: string } | { ok: false; erro: string; status: number };

/**
 * Gera a fala com o provedor escolhido, com os mesmos parâmetros que o
 * OpenClaw usa no WhatsApp (camposDoProvedor). MP3 na ElevenLabs e na
 * OpenAI; WAV no Google (o Gemini só devolve PCM).
 */
export async function sintetizar(o: OpcoesVoz, fala: string, chave: string): Promise<Audio> {
  const p = o.provedor;
  try {
    if (p === "elevenlabs") {
      const e = o.elevenlabs;
      if (!e.voz) return { ok: false, erro: "Escolha uma voz da ElevenLabs.", status: 400 };
      const r = await fetch(`${base(p)}/v1/text-to-speech/${encodeURIComponent(e.voz)}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "audio/mpeg", "xi-api-key": chave },
        body: JSON.stringify({
          text: fala, model_id: e.modelo, language_code: "pt",
          // Sem isto ela lê "26/09" como dígito solto em vez de data.
          apply_text_normalization: "on",
          voice_settings: { stability: e.estabilidade / 100, similarity_boost: e.semelhanca / 100, style: 0, use_speaker_boost: true, speed: e.velocidade / 100 },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) return { ok: false, erro: recusa(p, r.status, await detalheDoErro(r)), status: 502 };
      return { ok: true, audio: await r.arrayBuffer(), tipo: "audio/mpeg" };
    }

    if (p === "openai") {
      const a = o.openai;
      const r = await fetch(`${base(p)}/v1/audio/speech`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
        body: JSON.stringify({
          model: a.modelo, voice: a.voz, input: fala, response_format: "mp3",
          ...(openaiAceitaInstrucoes(a.modelo) && a.instrucoes ? { instructions: a.instrucoes } : {}),
          ...(openaiAceitaVelocidade(a.modelo) && a.velocidade !== 100 ? { speed: a.velocidade / 100 } : {}),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) return { ok: false, erro: recusa(p, r.status, await detalheDoErro(r)), status: 502 };
      return { ok: true, audio: await r.arrayBuffer(), tipo: "audio/mpeg" };
    }

    const g = o.google;
    const r = await fetch(`${base(p)}/v1beta/models/${encodeURIComponent(g.modelo)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: textoGoogle(g.estilo, fala) }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: g.voz } } } },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) return { ok: false, erro: recusa(p, r.status, await detalheDoErro(r)), status: 502 };
    const j = (await r.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const parte = j.candidates?.flatMap((c) => c.content?.parts ?? []).find((x) => x.inlineData?.data)?.inlineData;
    if (!parte?.data) return { ok: false, erro: "O Google não devolveu áudio.", status: 502 };
    const taxa = Number(/rate=(\d+)/.exec(parte.mimeType ?? "")?.[1]) || 24_000;
    const wav = pcmParaWav(new Uint8Array(Buffer.from(parte.data, "base64")), taxa);
    return { ok: true, audio: wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer, tipo: "audio/wav" };
  } catch (e) {
    return { ok: false, erro: `Não consegui falar com ${oProvedor(p)}: ${(e as Error).message}`, status: 502 };
  }
}

/** Atalho para quem só quer o áudio com a voz gravada (chat do site, API oficial). */
export async function falarComAVozGravada(sql: Sql, fala: string): Promise<Audio> {
  const o = await lerOpcoesVoz(sql);
  const { chave } = await chaveDoProvedor(sql, o.provedor);
  if (!chave) return { ok: false, erro: "Voz não configurada.", status: 503 };
  return sintetizar(o, fala, chave);
}

/* ── a mesma voz no WhatsApp (OpenClaw) ──────────────────────────── */

export type Conferencia = {
  /** O WhatsApp vai falar com a voz do site. */
  igual: boolean;
  /** Deu para ler o servidor da Marina. */
  alcancou: boolean;
  erro: string | null;
  efetiva: VozEfetiva | null;
  diferencas: string[];
};

/** Só lê o que o WhatsApp vai usar e compara com o site. */
export async function conferirVozNoWhatsapp(o: OpcoesVoz): Promise<Conferencia> {
  const c = await lerConfigOpenClaw();
  if (!c.ok) return { igual: false, alcancou: false, erro: c.erro, efetiva: null, diferencas: [] };
  const efetiva = vozDoWhatsapp(c.config);
  const dif = diferencas(o, efetiva);
  return { igual: dif.length === 0, alcancou: true, erro: null, efetiva, diferencas: dif };
}

/**
 * Leva a voz ao OpenClaw e confere lendo de volta. A chave vai junto
 * (decisão do Vinicios, 21/10): assim o WhatsApp usa a MESMA conta do site
 * — uma voz clonada só existe na conta que a criou.
 * Mudar `tts` faz o OpenClaw reiniciar os canais: o WhatsApp reconecta
 * sozinho em alguns segundos.
 */
export async function aplicarVozNoWhatsapp(o: OpcoesVoz, chave: string | null): Promise<Conferencia> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const atual = await lerConfigOpenClaw();
    if (!atual.ok) return { igual: false, alcancou: false, erro: atual.erro, efetiva: null, diferencas: [] };
    const r = await corrigirConfig(patchDaVoz(o, atual.config, chave), atual.hash, "Voz da Marina escolhida no painel");
    if (r.ok) break;
    /* Alguém mexeu na config entre a leitura e a escrita: lê de novo uma vez. */
    if (tentativa === 0 && /changed since last load|re-run config\.get/i.test(r.erro)) continue;
    return { igual: false, alcancou: true, erro: r.erro, efetiva: null, diferencas: [] };
  }
  return conferirVozNoWhatsapp(o);
}
