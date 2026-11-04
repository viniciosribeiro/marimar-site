import type postgres from "postgres";
import { comSql } from "./db-conexao";
import { chamarRpc, corrigirConfig, lerConfigOpenClaw } from "./openclaw-config";

type Sql = ReturnType<typeof postgres>;

/**
 * O áudio do WhatsApp fala SÓ a frase curta — nunca o link.
 *
 * O OpenClaw gera o áudio da resposta inteira quando `tts.auto` é "inbound":
 * a Marina pode pôr o link no texto (como deve) e o gateway lê o endereço em
 * voz alta. Em 04/11/2026 o proprietário confirmou, duas vezes, que isso
 * continuava acontecendo mesmo com a skill nova. A decisão dele: "ela só tem
 * que mandar o link, ela não tem que falar em áudio". O modo "tagged" faz
 * exatamente isso: o gateway só sintetiza o que vier dentro de
 * `[[tts:text]]…[[/tts:text]]` (a frase curta que a skill e o treinamento
 * exigem); uma resposta sem o bloco vai só em texto.
 *
 * O site aplica a mudança sozinho pelo RPC de administração que já usa para a
 * voz (config.get + config.patch, merge), uma vez, e guarda o resultado em
 * `integracoes.openclaw_audio_curto` para o Diagnóstico. Não mexe em voz,
 * provedor, chave ou qualquer outro campo.
 */
export const MODO_AUDIO_DESEJADO = "tagged";
const CHAVE = "openclaw_audio_curto";
const REVISAR_A_CADA_MS = 6 * 3600_000;

export type EstadoAudio = {
  modo: string | null;
  desejado: string;
  conferido_em: string;
  aplicado_em: string | null;
  erro: string | null;
};

export async function lerEstadoAudio(sql: Sql): Promise<EstadoAudio | null> {
  const [l] = await sql<{ valor: string }[]>`SELECT valor FROM integracoes WHERE chave = ${CHAVE}`.catch(() => []);
  if (!l) return null;
  try { return JSON.parse(l.valor); } catch { return null; }
}

async function gravar(estado: EstadoAudio): Promise<EstadoAudio> {
  await comSql((sql) => sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (${CHAVE}, ${JSON.stringify(estado)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`).catch(() => {});
  return estado;
}

function modoAtual(config: unknown): string | null {
  const tts = (config as { tts?: { auto?: unknown } } | null)?.tts;
  return typeof tts?.auto === "string" ? tts.auto : null;
}

/* Uma conferência por processo a cada poucos minutos: o agendador e as buscas não precisam perguntar ao gateway toda hora. */
let ultimaConferencia = 0;

/** Garante `tts.auto = "tagged"` no OpenClaw; devolve o estado (sem lançar). */
export async function garantirAudioSoFraseCurta(opcoes: { forcar?: boolean } = {}): Promise<EstadoAudio> {
  const agora = new Date().toISOString();
  const anterior = await comSql((sql) => lerEstadoAudio(sql)).catch(() => null);
  if (!opcoes.forcar) {
    if (Date.now() - ultimaConferencia < 10 * 60_000 && anterior) return anterior;
    if (anterior?.modo === MODO_AUDIO_DESEJADO && !anterior.erro && Date.now() - new Date(anterior.conferido_em).getTime() < REVISAR_A_CADA_MS) return anterior;
  }
  ultimaConferencia = Date.now();

  if (!process.env.OPENCLAW_GATEWAY_URL || !process.env.OPENCLAW_GATEWAY_TOKEN) {
    return gravar({ modo: null, desejado: MODO_AUDIO_DESEJADO, conferido_em: agora, aplicado_em: anterior?.aplicado_em ?? null, erro: "OPENCLAW_GATEWAY_URL/TOKEN não configurados na Vercel" });
  }
  const lido = await lerConfigOpenClaw();
  if (!lido.ok) {
    return gravar({ modo: anterior?.modo ?? null, desejado: MODO_AUDIO_DESEJADO, conferido_em: agora, aplicado_em: anterior?.aplicado_em ?? null, erro: `não li a configuração do OpenClaw: ${lido.erro}` });
  }
  const modo = modoAtual(lido.config);
  if (modo === MODO_AUDIO_DESEJADO) {
    return gravar({ modo, desejado: MODO_AUDIO_DESEJADO, conferido_em: agora, aplicado_em: anterior?.aplicado_em ?? null, erro: null });
  }
  /* Só `tts.auto` e a permissão do bloco; voz, provedor e chaves ficam como estão. */
  const r = await corrigirConfig(
    { tts: { auto: MODO_AUDIO_DESEJADO, modelOverrides: { enabled: true, allowText: true } } },
    lido.hash,
    "Marimar: áudio do WhatsApp só da frase curta ([[tts:text]]), nunca o link — pedido do proprietário em 04/11/2026",
  );
  if (!r.ok) {
    return gravar({ modo, desejado: MODO_AUDIO_DESEJADO, conferido_em: agora, aplicado_em: anterior?.aplicado_em ?? null, erro: `não consegui mudar o modo de áudio (${modo ?? "sem valor"} → ${MODO_AUDIO_DESEJADO}): ${r.erro}` });
  }
  /* Confere o que ficou gravado: o gateway é quem manda. */
  const depois = await chamarRpc("config.get", {}, 8_000);
  const confirmado = depois.ok ? modoAtual(((depois.dados as { payload?: { config?: unknown } })?.payload ?? depois.dados as { config?: unknown })?.config) : MODO_AUDIO_DESEJADO;
  return gravar({ modo: confirmado ?? MODO_AUDIO_DESEJADO, desejado: MODO_AUDIO_DESEJADO, conferido_em: agora, aplicado_em: agora, erro: null });
}
