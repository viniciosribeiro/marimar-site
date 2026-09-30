import { chamarRpc } from "./openclaw-config";
import { urlGateway, cabecalhosGateway } from "./chat";

/**
 * Manda uma mensagem de WhatsApp pelo número da pousada (o que a Marina usa),
 * através do gateway do OpenClaw.
 *
 * Três caminhos, tentados em ordem (variável `OPENCLAW_ENVIO`):
 *
 *  1. "ferramenta" — `POST /tools/invoke` com a ferramenta `message`
 *     (ação `send`). Direto, sem passar pelo modelo.
 *  2. "agente" — pede à própria Marina, pelo mesmo `/v1/chat/completions`
 *     que o chat do site já usa, que mande a mensagem com a ferramenta de
 *     mensagens dela. É o caminho que funciona onde o 1 está fechado.
 *  3. "rpc:<método>" — RPC de administração (plugin admin-http-rpc). NÃO é
 *     o padrão: em 30/09/2026 o OpenClaw real respondeu "admin HTTP RPC
 *     method is not supported: send" — esse plugin só aceita métodos de
 *     configuração.
 *
 * Padrão ("auto"): 1, depois 2. Nunca lança: devolve `{ ok, erro, via }`.
 * Quando tudo falha, quem chamou ainda tem o plano B da skill (a Marina
 * recebe o texto e manda ela mesma) e o painel mostra o erro.
 */

export type Envio = { ok: true; via?: string } | { ok: false; erro: string };

export type Template = { nome: string; idioma: string };

type Opcoes = { template?: Template | null; chave?: string };

async function porFerramenta(para: string, texto: string, o: Opcoes): Promise<Envio> {
  try {
    const r = await fetch(urlGateway("/tools/invoke"), {
      method: "POST",
      headers: cabecalhosGateway(),
      body: JSON.stringify({
        tool: "message",
        args: {
          action: "send", channel: "whatsapp", to: para, target: para, message: texto,
          ...(o.template ? { template: { name: o.template.nome, language: o.template.idioma, parameters: [texto.slice(0, 1000)] } } : {}),
        },
        idempotencyKey: o.chave,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const corpo = await r.text();
    if (!r.ok) return { ok: false, erro: `ferramenta ${r.status}: ${corpo.slice(0, 200)}` };
    try {
      const d = JSON.parse(corpo);
      if (d?.ok === false || d?.error) return { ok: false, erro: `ferramenta: ${String(d.error?.message ?? d.error ?? corpo).slice(0, 200)}` };
    } catch { /* 2xx sem JSON: aceito */ }
    return { ok: true, via: "ferramenta" };
  } catch (e) {
    return { ok: false, erro: `ferramenta: ${(e as Error).message}` };
  }
}

/**
 * Pede à Marina que mande. A resposta dela tem de terminar em
 * "ENVIADO" — qualquer outra coisa conta como falha, para o site não
 * achar que avisou alguém quando ela só conversou.
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
              `Use a sua ferramenta de mensagens para enviar pelo WhatsApp, para o número ${para}, EXATAMENTE o texto entre as linhas ===, sem mudar uma vírgula e sem acrescentar nada.`,
              "Não converse, não explique. Depois de enviar, responda só: ENVIADO. Se não conseguir enviar, responda só: FALHOU: <motivo em poucas palavras>.",
            ].join("\n"),
          },
          { role: "user", content: `===\n${texto}\n===` },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return { ok: false, erro: `agente ${r.status}: ${(await r.text()).slice(0, 200)}` };
    const d = await r.json();
    const resposta = String(d?.choices?.[0]?.message?.content ?? "").trim();
    return /ENVIADO\s*\.?$/i.test(resposta)
      ? { ok: true, via: "agente" }
      : { ok: false, erro: `a Marina não confirmou o envio: ${resposta.slice(0, 160) || "(resposta vazia)"}` };
  } catch (e) {
    return { ok: false, erro: `agente: ${(e as Error).message}` };
  }
}

export async function enviarWhatsapp(numero: string, texto: string, opcoes: Opcoes = {}): Promise<Envio> {
  if (!process.env.OPENCLAW_GATEWAY_URL || !process.env.OPENCLAW_GATEWAY_TOKEN) {
    return { ok: false, erro: "O gateway do OpenClaw não está configurado neste site." };
  }
  const para = `+${numero.replace(/\D/g, "")}`;
  const modo = (process.env.OPENCLAW_ENVIO || "auto").trim();
  const chave = opcoes.chave ?? crypto.randomUUID();

  if (modo.startsWith("rpc:")) {
    const r = await chamarRpc(modo.slice(4) || "send", {
      channel: "whatsapp", to: para, message: texto, idempotencyKey: chave,
      ...(opcoes.template ? { template: { name: opcoes.template.nome, language: opcoes.template.idioma, parameters: [texto.slice(0, 1000)] } } : {}),
    });
    return r.ok ? { ok: true, via: "rpc" } : { ok: false, erro: r.erro };
  }
  if (modo === "ferramenta") return porFerramenta(para, texto, { ...opcoes, chave });
  if (modo === "agente") return porAgente(para, texto, { ...opcoes, chave });

  const primeiro = await porFerramenta(para, texto, { ...opcoes, chave });
  if (primeiro.ok) return primeiro;
  const segundo = await porAgente(para, texto, { ...opcoes, chave });
  return segundo.ok ? segundo : { ok: false, erro: `${primeiro.erro} · ${segundo.erro}` };
}
