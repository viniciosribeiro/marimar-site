import { chamarRpc } from "./openclaw-config";
import { urlGateway, cabecalhosGateway } from "./chat";

/**
 * Manda uma mensagem de WhatsApp pelo número da pousada (o que a Marina usa),
 * através do gateway do OpenClaw.
 *
 * O CAMINHO CERTO é `POST /tools/invoke` com a ferramenta `message`
 * (docs/gateway/tools-invoke-http-api.md do pacote openclaw). Duas coisas que
 * aprendemos lendo o código do OpenClaw 2026.9 (30/09/2026), depois de o
 * "Testar envio" dizer "enviado" e nada chegar:
 *
 *  1. Sem `bestEffort: false` a ferramenta envia em modo "melhor esforço":
 *     se o WhatsApp não entrega, ela responde 200/ok assim mesmo, só que SEM
 *     `details.result` (o id da mensagem). O site contava isso como enviado.
 *     Agora pedimos entrega obrigatória: falha vira erro de verdade.
 *  2. Mesmo com ok, só vale como enviado se voltar a confirmação do canal
 *     (`details.result`, com o id da mensagem) no canal "whatsapp". Envio
 *     "suppressed", "dry_run" ou para outro canal é falha.
 *
 * Caminhos (variável `OPENCLAW_ENVIO`):
 *  - "auto" (padrão) / "ferramenta": o de cima. No "auto", se a ferramenta
 *    não existir no gateway (404), pede à Marina — ver `porAgente`.
 *  - "agente": só pela Marina. Ela precisa devolver o id da mensagem.
 *  - "rpc:<método>": RPC de administração. O OpenClaw real recusa "send"
 *    por aí (só aceita métodos de configuração); fica para compatibilidade.
 *
 * Nunca lança: devolve `{ ok, erro | via, id, detalhe }`.
 */

/** `id`: o id da mensagem no WhatsApp — a prova de que saiu. */
export type Envio = { ok: true; via?: string; id?: string | null; detalhe?: string } | { ok: false; erro: string; via?: string };

export type Template = { nome: string; idioma: string };

type Opcoes = { template?: Template | null; chave?: string };

/** A resposta da ferramenta: `result.details` (ou o JSON do `content`). */
function detalhesDa(res: unknown): Record<string, unknown> | null {
  const r = res as { details?: unknown; content?: { type?: string; text?: string }[] } | null;
  if (r?.details && typeof r.details === "object") return r.details as Record<string, unknown>;
  const txt = r?.content?.find((c) => c?.type === "text")?.text;
  if (txt) { try { const j = JSON.parse(txt); if (j && typeof j === "object") return j; } catch { /* texto solto */ } }
  return r && typeof r === "object" ? (r as Record<string, unknown>) : null;
}

/** Procura o id da mensagem em qualquer um dos formatos que o OpenClaw usa. */
function idDaMensagem(d: Record<string, unknown>): string | null {
  const alvos = [d.result, d.sendResult, d.payload, d];
  for (const a of alvos) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    for (const k of ["messageId", "message_id", "id", "key"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 80);
      if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return String((v as { id: string }).id).slice(0, 80);
    }
    if (Array.isArray(o.results)) {
      const ultimo = o.results.at(-1) as Record<string, unknown> | undefined;
      if (ultimo && typeof ultimo.messageId === "string") return ultimo.messageId;
    }
  }
  return null;
}

/** Avalia a resposta da ferramenta. Exportada para os testes. */
export function avaliarRespostaFerramenta(corpo: unknown): Envio {
  const d0 = corpo as { ok?: boolean; error?: { message?: string } | string; result?: unknown } | null;
  if (!d0 || d0.ok === false || d0.error) {
    const m = typeof d0?.error === "object" ? d0.error?.message : d0?.error;
    return { ok: false, via: "ferramenta", erro: `o OpenClaw recusou: ${String(m ?? "resposta vazia").slice(0, 200)}` };
  }
  const res = d0.result as { isError?: boolean } | undefined;
  const d = detalhesDa(res);
  const resumo = JSON.stringify(d ?? res ?? "").slice(0, 300);
  if (res?.isError) return { ok: false, via: "ferramenta", erro: `a ferramenta de mensagens deu erro: ${resumo}` };
  if (!d) return { ok: false, via: "ferramenta", erro: "o OpenClaw respondeu sem nenhum detalhe do envio." };
  if (d.dryRun === true || d.deliveryStatus === "dry_run") return { ok: false, via: "ferramenta", erro: "o OpenClaw só simulou o envio (dry run)." };
  if (d.deliveryStatus === "suppressed" || d.status === "suppressed") return { ok: false, via: "ferramenta", erro: `o OpenClaw segurou a mensagem (suppressed): ${String(d.reason ?? d.message ?? "").slice(0, 120)}` };
  if (d.status === "error" || d.ok === false) return { ok: false, via: "ferramenta", erro: `a ferramenta de mensagens deu erro: ${resumo}` };
  if (typeof d.channel === "string" && d.channel.toLowerCase() !== "whatsapp") {
    return { ok: false, via: "ferramenta", erro: `a mensagem foi para o canal "${d.channel}", não para o WhatsApp. Confira se o WhatsApp está configurado no OpenClaw.` };
  }
  const id = idDaMensagem(d);
  /* Entrega direta ou pelo gateway sem `result` = o WhatsApp não confirmou. */
  if (!id && (d.via === "direct" || d.via === "gateway") && !d.result) {
    return { ok: false, via: "ferramenta", erro: "o OpenClaw aceitou, mas o WhatsApp não confirmou a entrega (nenhum id de mensagem voltou). Veja se o WhatsApp da pousada está conectado no OpenClaw e se o número está certo." };
  }
  return { ok: true, via: "ferramenta", id, detalhe: resumo };
}

async function porFerramenta(para: string, texto: string, o: Opcoes): Promise<Envio & { naoExiste?: boolean }> {
  try {
    const r = await fetch(urlGateway("/tools/invoke"), {
      method: "POST",
      headers: { ...cabecalhosGateway(), "x-openclaw-message-channel": "whatsapp" },
      body: JSON.stringify({
        tool: "message",
        action: "send",
        args: {
          action: "send", channel: "whatsapp", target: para, to: para, message: texto,
          /* Entrega obrigatória: sem isto uma falha volta como "ok". */
          bestEffort: false,
          ...(o.template ? { template: { name: o.template.nome, language: o.template.idioma, parameters: [texto.slice(0, 1000)] } } : {}),
        },
        idempotencyKey: o.chave,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const corpo = await r.text();
    let json: unknown = null;
    try { json = JSON.parse(corpo); } catch { /* sem JSON */ }
    if (r.status === 404) {
      return { ok: false, via: "ferramenta", naoExiste: true, erro: "a ferramenta de mensagens não está liberada no gateway (404 — ver manual, “Liberar a ferramenta de mensagens”)." };
    }
    if (r.status === 401 || r.status === 403) return { ok: false, via: "ferramenta", erro: `o gateway recusou a chave (${r.status}). Confira OPENCLAW_GATEWAY_TOKEN.` };
    if (!r.ok) {
      const m = (json as { error?: { message?: string } } | null)?.error?.message;
      return {
        ok: false, via: "ferramenta",
        erro: r.status >= 500
          ? `o OpenClaw tentou e o WhatsApp não entregou (${m ?? "erro interno"}). No servidor: openclaw logs --follow mostra o motivo.`
          : `o OpenClaw recusou o envio (${r.status}): ${String(m ?? corpo).slice(0, 200)}`,
      };
    }
    return avaliarRespostaFerramenta(json ?? { ok: true, result: corpo });
  } catch (e) {
    return { ok: false, via: "ferramenta", erro: `não consegui falar com o gateway: ${(e as Error).message}` };
  }
}

/**
 * Pede à Marina que mande. Só vale se ela devolver "ENVIADO <id da
 * mensagem>" — o id vem da ferramenta; um "ENVIADO" solto pode ser só a
 * Marina dizendo o que achamos que queremos ouvir.
 */
async function porAgente(para: string, texto: string, o: Opcoes): Promise<Envio> {
  try {
    const r = await fetch(urlGateway("/v1/chat/completions"), {
      method: "POST",
      headers: cabecalhosGateway(),
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODELO || "openclaw",
        stream: false,
        user: `sistema:envio:${o.chave ?? para}`,
        messages: [
          {
            role: "system",
            content: [
              "TAREFA INTERNA DO SISTEMA DA POUSADA (não é um hóspede falando com você).",
              `Use a ferramenta message com action "send", channel "whatsapp", target "${para}" e bestEffort false para enviar EXATAMENTE o texto entre as linhas ===, sem mudar uma vírgula.`,
              "Não converse, não explique. Se a ferramenta devolver o id da mensagem (messageId), responda só: ENVIADO <messageId>.",
              "Se não conseguir enviar, ou se não voltar messageId, responda só: FALHOU: <motivo em poucas palavras>.",
            ].join("\n"),
          },
          { role: "user", content: `===\n${texto}\n===` },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return { ok: false, via: "agente", erro: `a Marina não pôde enviar (${r.status}): ${(await r.text()).slice(0, 200)}` };
    const d = await r.json();
    const resposta = String(d?.choices?.[0]?.message?.content ?? "").trim();
    const m = resposta.match(/ENVIADO\s+([A-Za-z0-9_:@.\-]{6,})/i);
    return m
      ? { ok: true, via: "agente", id: m[1], detalhe: resposta.slice(0, 300) }
      : { ok: false, via: "agente", erro: `a Marina não confirmou o envio com o id da mensagem: ${resposta.slice(0, 160) || "(resposta vazia)"}` };
  } catch (e) {
    return { ok: false, via: "agente", erro: `agente: ${(e as Error).message}` };
  }
}

export async function enviarWhatsapp(numero: string, texto: string, opcoes: Opcoes = {}): Promise<Envio> {
  if (!process.env.OPENCLAW_GATEWAY_URL || !process.env.OPENCLAW_GATEWAY_TOKEN) {
    return { ok: false, erro: "O gateway do OpenClaw não está configurado neste site (OPENCLAW_GATEWAY_URL e OPENCLAW_GATEWAY_TOKEN na Vercel)." };
  }
  const para = `+${numero.replace(/\D/g, "")}`;
  const modo = (process.env.OPENCLAW_ENVIO || "auto").trim();
  const chave = opcoes.chave ?? crypto.randomUUID();

  if (modo.startsWith("rpc:")) {
    const r = await chamarRpc(modo.slice(4) || "send", {
      channel: "whatsapp", to: para, message: texto, idempotencyKey: chave,
      ...(opcoes.template ? { template: { name: opcoes.template.nome, language: opcoes.template.idioma, parameters: [texto.slice(0, 1000)] } } : {}),
    });
    return r.ok ? { ok: true, via: "rpc", id: null } : { ok: false, via: "rpc", erro: r.erro };
  }
  if (modo === "agente") return porAgente(para, texto, { ...opcoes, chave });

  const primeiro = await porFerramenta(para, texto, { ...opcoes, chave });
  if (primeiro.ok || modo === "ferramenta") return primeiro;
  /* A Marina só entra quando a ferramenta NÃO EXISTE no gateway. Se ela
     existe e falhou, pedir à Marina seria tentar de novo pelo mesmo cano —
     e esconder o erro real. */
  if (!("naoExiste" in primeiro) || !primeiro.naoExiste) return primeiro;
  const segundo = await porAgente(para, texto, { ...opcoes, chave });
  return segundo.ok ? segundo : { ok: false, via: "agente", erro: `${primeiro.erro} · E pela Marina: ${segundo.erro}` };
}

/**
 * O WhatsApp da pousada está conectado no OpenClaw? Usa `channels.status`
 * (plugin admin-http-rpc). Sem o plugin, diz que não dá para saber — não
 * trava o envio.
 */
export async function statusWhatsapp(): Promise<{ sabe: boolean; conectado: boolean | null; resumo: string }> {
  const r = await chamarRpc("channels.status", {});
  if (!r.ok) return { sabe: false, conectado: null, resumo: `não deu para consultar (${r.erro})` };
  const bruto = JSON.stringify(r.dados ?? "");
  const achar = (o: unknown): Record<string, unknown> | null => {
    if (!o || typeof o !== "object") return null;
    if (Array.isArray(o)) { for (const x of o) { const a = achar(x); if (a) return a; } return null; }
    const obj = o as Record<string, unknown>;
    if (String(obj.id ?? obj.channel ?? obj.name ?? "").toLowerCase() === "whatsapp") return obj;
    if (obj.whatsapp && typeof obj.whatsapp === "object") return obj.whatsapp as Record<string, unknown>;
    for (const v of Object.values(obj)) { const a = achar(v); if (a) return a; }
    return null;
  };
  const w = achar(r.dados);
  if (!w) return { sabe: true, conectado: false, resumo: "o OpenClaw não tem o canal WhatsApp configurado." };
  const texto = JSON.stringify(w).toLowerCase();
  const desligado = /"(connected|linked|running|ok)":\s*false|disconnected|logged.?out|not linked|unlinked|"status":\s*"(error|stopped|offline)"/.test(texto);
  const ligado = /"(connected|linked|running)":\s*true|"status":\s*"(ok|connected|running|online|ready)"/.test(texto);
  return {
    sabe: true,
    conectado: desligado ? false : ligado ? true : null,
    resumo: `${desligado ? "desconectado" : ligado ? "conectado" : "estado incerto"} — ${JSON.stringify(w).slice(0, 220)}${bruto.length > 2000 ? "…" : ""}`,
  };
}
