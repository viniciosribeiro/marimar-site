import { comSql, type Sql } from "./db-conexao";
import { CONTEXTO_MENSAGENS, LIMITE_AUDIO_BYTES, LIMITE_VOZ_CARACTERES, MODELO_TRANSCRICAO, URL_TRANSCRICAO, cabecalhosGateway, gatewayConfigurado, urlGateway } from "./chat";
import { montarTreinamento, pareceSemResposta, registrarLacuna } from "./marina";
import { chaveDoProvedor, falarComAVozGravada } from "./voz";
import { abrirChamado, lerConfigEscalonamento, responderChamado, talvezProcessarPrazos, vinculoDaAbertura } from "./escalonamento";
import type { ConfigEscalonamento } from "./escalonamento-base";
import { registrarUso } from "./aprendizado";
import { CONTEXTO_WHATSAPP_OFICIAL, lerEntrada, partirResposta, type MensagemRecebida } from "./whatsapp-meta-base";
import { baixarMidiaMeta, enviarAudioMeta, enviarMidiaMeta, enviarTextoMeta, marcarLidaMeta } from "./whatsapp-meta";

/**
 * Atendimento pela API oficial da Meta: cada mensagem que chega no webhook
 * (/api/whatsapp/meta) passa por aqui, DEPOIS que a rota já respondeu 200
 * à Meta (`after`), para ela não reenviar por demora.
 *
 *   cliente ──► Meta ──► webhook ──► Marina (gateway, como o chat do site) ──► Meta ──► cliente
 *   equipe  ──► Meta ──► webhook ──► responderChamado (como a skill faz no WhatsApp Web)
 *
 * A conversa fica em `chat_mensagens` com sessão "wa:<número>": a Marina
 * recebe o histórico como no site, e o painel mostra as conversas.
 */

/** A pousada respondeu pelo aplicativo há menos que isto: a Marina fica quieta. */
export const PAUSA_EQUIPE_MIN = 30;
/** Teto por conversa, por hora: dois robôs conversando não viram conta aberta. */
export const LIMITE_POR_HORA_WA = 40;

const INDISPONIVEL_WA = "Oi! Não consegui responder agora. A equipe da pousada vai te responder por aqui em breve.";

const DESCRICAO: Record<string, string> = {
  image: "uma foto", video: "um vídeo", document: "um arquivo", sticker: "uma figurinha", audio: "um áudio",
};

export async function processarAvisoMeta(payload: unknown): Promise<void> {
  const mensagens = lerEntrada(payload, process.env.WHATSAPP_META_PHONE_ID?.trim() || null);
  if (!mensagens.length) return;
  await comSql(async (sql) => {
    const cfg = await lerConfigEscalonamento(sql);
    if (cfg.whatsapp_modo !== "oficial") {
      console.warn("[whatsapp-oficial] mensagem recebida, mas a forma em uso é o WhatsApp Web (QR): ignorada");
      return;
    }
    for (const m of mensagens) {
      try {
        await atender(sql, cfg, m);
      } catch (e) {
        console.error("[whatsapp-oficial] falha ao atender", m.id, (e as Error).message);
      }
    }
  });
}

async function primeiraVez(sql: Sql, id: string, de: string): Promise<boolean> {
  /* A Meta pode entregar o mesmo aviso mais de uma vez. A chave única de
     `integracoes` faz a trava sem tabela nova; a limpeza leva o que tem
     mais de 3 dias. */
  const [novo] = await sql`
    INSERT INTO integracoes (chave, valor) VALUES (${"wa_msg:" + id}, ${de})
    ON CONFLICT (chave) DO NOTHING RETURNING id`;
  if (Math.random() < 0.05) {
    await sql`DELETE FROM integracoes WHERE (chave LIKE 'wa_msg:%' OR chave LIKE 'wa_env:%') AND atualizado_em < now() - interval '3 days'`.catch(() => {});
  }
  return Boolean(novo);
}

async function transcrever(sql: Sql, idMidia: string): Promise<string | null> {
  /* Transcrição é sempre ElevenLabs (Scribe), seja qual for a voz que a Marina usa para falar. */
  const { chave } = await chaveDoProvedor(sql, "elevenlabs");
  if (!chave) return null;
  const midia = await baixarMidiaMeta(idMidia, LIMITE_AUDIO_BYTES * 2);
  if (!midia.ok) { console.error("[whatsapp-oficial] áudio:", midia.erro); return null; }
  const form = new FormData();
  form.append("file", new Blob([midia.bytes], { type: midia.mime }), "audio.ogg");
  form.append("model_id", MODELO_TRANSCRICAO);
  form.append("language_code", "por");
  try {
    const r = await fetch(URL_TRANSCRICAO, { method: "POST", headers: { "xi-api-key": chave }, body: form, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) { console.error("[whatsapp-oficial] transcrição", r.status); return null; }
    const d = await r.json().catch(() => null);
    return typeof d?.text === "string" && d.text.trim() ? d.text.trim() : null;
  } catch (e) {
    console.error("[whatsapp-oficial] transcrição:", (e as Error).message);
    return null;
  }
}

/** Quem mandou áudio ouve a resposta também (como o `tts.auto: "inbound"` do WhatsApp Web). */
async function responderEmAudio(sql: Sql, para: string, resposta: string) {
  const falar = resposta.replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, "").replace(/https?:\/\/\S+/g, "").replace(/[*_#>`]/g, "").trim();
  if (!falar || falar.length > LIMITE_VOZ_CARACTERES) return;
  /* A mesma voz do site e do WhatsApp Web (src/lib/voz.ts). */
  const r = await falarComAVozGravada(sql, falar);
  if (!r.ok) { if (r.status !== 503) console.error("[whatsapp-oficial] voz:", r.erro); return; }
  /* A Meta não aceita WAV (o Google só devolve PCM): nesse caso vai só o texto. */
  if (r.tipo !== "audio/mpeg") { console.warn("[whatsapp-oficial] voz do Google não vai em áudio pela API oficial (formato)"); return; }
  const envio = await enviarAudioMeta(para, r.audio);
  if (!envio.ok) console.error("[whatsapp-oficial] áudio não saiu:", envio.erro);
}

async function perguntarMarina(mensagens: { role: string; content: string }[], usuario: string): Promise<string | null> {
  try {
    const r = await fetch(urlGateway("/v1/chat/completions"), {
      method: "POST",
      headers: cabecalhosGateway(),
      body: JSON.stringify({ model: process.env.OPENCLAW_MODELO || "openclaw", stream: false, user: usuario, messages: mensagens }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!r.ok) { console.error("[whatsapp-oficial] gateway", r.status, (await r.text().catch(() => "")).slice(0, 200)); return null; }
    const d = await r.json().catch(() => null);
    const texto = d?.choices?.[0]?.message?.content;
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch (e) {
    console.error("[whatsapp-oficial] gateway:", (e as Error).message);
    return null;
  }
}

async function atender(sql: Sql, cfg: ConfigEscalonamento, m: MensagemRecebida) {
  if (!(await primeiraVez(sql, m.id, m.de))) return;
  const sessao = `wa:${m.de}`;

  /* Eco: a Cecília respondeu pelo aplicativo (coexistência). Entra na
     conversa e segura a Marina por PAUSA_EQUIPE_MIN. */
  if (m.eco) {
    if (m.texto) await sql`INSERT INTO chat_mensagens (sessao, papel, conteudo) VALUES (${sessao}, 'equipe', ${m.texto.slice(0, 4000)})`;
    return;
  }

  await marcarLidaMeta(m.id).catch(() => {});

  let texto = m.texto;
  const veioAudio = m.tipo === "audio" && !!m.midia;
  if (veioAudio) {
    const ouvido = await transcrever(sql, m.midia!.id);
    if (!ouvido) {
      await enviarTextoMeta(m.de, "Não consegui ouvir o seu áudio. Pode escrever, por favor?");
      return;
    }
    texto = `[Áudio do cliente: ${ouvido}]`;
  } else if (m.midia) {
    const o_que = DESCRICAO[m.tipo] ?? "um arquivo";
    texto = texto ? `[O cliente mandou ${o_que} com a legenda: ${texto}]` : `[O cliente mandou ${o_que}, sem texto]`;
  }
  if (!texto) texto = "[O cliente mandou uma mensagem que o sistema não consegue ler]";

  /* Alguém da equipe respondendo um chamado? Mesmo caminho da skill no
     WhatsApp Web (POST /api/agent/chamados/resposta). */
  const [citado] = m.citadoId ? await sql<{ valor: string }[]>`SELECT valor FROM integracoes WHERE chave = ${"wa_env:" + m.citadoId}` : [];
  const daEquipe = await responderChamado(sql, { numero: m.de, texto: m.texto ?? texto, citado: citado?.valor ?? null });
  if (daEquipe.tipo !== "nao_equipe") {
    const aviso = daEquipe.tipo === "respondido" && daEquipe.entregarManual
      ? `${daEquipe.mensagem}\nMande você mesma ao cliente +${daEquipe.entregarManual.para} esta mensagem:\n${daEquipe.entregarManual.texto}`
      : daEquipe.mensagem;
    if (aviso) await enviarTextoMeta(m.de, aviso);
    await talvezProcessarPrazos(sql);
    return;
  }

  const [pausa] = await sql`SELECT 1 FROM chat_mensagens WHERE sessao = ${sessao} AND papel = 'equipe'
    AND criado_em > now() - make_interval(mins => ${PAUSA_EQUIPE_MIN}) LIMIT 1`;
  const [{ usadas }] = await sql<{ usadas: number }[]>`SELECT COUNT(*)::int AS usadas FROM chat_mensagens
    WHERE sessao = ${sessao} AND papel = 'visitante' AND criado_em > now() - interval '1 hour'`;
  await sql`INSERT INTO chat_mensagens (sessao, papel, conteudo) VALUES (${sessao}, 'visitante', ${texto.slice(0, 4000)})`;
  if (pausa || usadas >= LIMITE_POR_HORA_WA) return;

  if (!gatewayConfigurado()) { await enviarTextoMeta(m.de, INDISPONIVEL_WA); return; }

  const anteriores = await sql<{ papel: string; conteudo: string }[]>`
    SELECT papel, conteudo FROM chat_mensagens WHERE sessao = ${sessao} ORDER BY criado_em DESC LIMIT ${CONTEXTO_MENSAGENS}`;
  const { texto: ensinado } = await montarTreinamento(sql, "whatsapp");
  const sobreEquipe = cfg.ativo
    ? "\n\nQUANDO VOCÊ NÃO SOUBER: diga com naturalidade que vai confirmar com a equipe da pousada e que responde por aqui mesmo, no WhatsApp, assim que eles responderem. Não invente a resposta enquanto isso."
    : "";
  const quem = m.nome ? `\n\nNome no perfil do WhatsApp do cliente: ${m.nome}.` : "";
  const resposta = await perguntarMarina([
    { role: "system", content: CONTEXTO_WHATSAPP_OFICIAL + quem + sobreEquipe + (ensinado ? "\n\n" + ensinado : "") },
    ...anteriores.reverse().map((x) => ({
      role: x.papel === "visitante" ? "user" : "assistant",
      content: x.papel === "equipe" ? `[A equipe da pousada respondeu pelo celular:] ${x.conteudo}` : x.conteudo,
    })),
  ], sessao);

  if (!resposta) { await enviarTextoMeta(m.de, INDISPONIVEL_WA); return; }

  for (const parte of partirResposta(resposta)) {
    const envio = parte.tipo === "texto" ? await enviarTextoMeta(m.de, parte.texto) : await enviarMidiaMeta(m.de, parte);
    if (!envio.ok) console.error("[whatsapp-oficial] não saiu:", envio.erro);
  }
  if (veioAudio) await responderEmAudio(sql, m.de, resposta).catch((e) => console.error("[whatsapp-oficial] voz:", (e as Error).message));

  const semResposta = pareceSemResposta(resposta);
  await sql`INSERT INTO chat_mensagens (sessao, papel, conteudo, sem_resposta) VALUES (${sessao}, 'marina', ${resposta}, ${semResposta})`;
  if (semResposta && cfg.ativo) {
    const contexto = anteriores.filter((x) => x.papel === "visitante" && x.conteudo !== texto).slice(-3).map((x) => x.conteudo.slice(0, 160)).join(" / ");
    const a = await abrirChamado(sql, { canal: "whatsapp", destino: m.de, pergunta: texto, contexto: contexto || null });
    await registrarLacuna(sql, { pergunta: texto, resposta, canal: "whatsapp", sessao, ...vinculoDaAbertura(a) });
  } else if (semResposta) {
    await registrarLacuna(sql, { pergunta: texto, resposta, canal: "whatsapp", sessao, chamadoId: null, avisoErro: "O aviso à equipe está desligado (Marina → Prazos e WhatsApp)." });
  } else {
    await registrarUso(sql, texto, "whatsapp");
  }
  await talvezProcessarPrazos(sql);
}
