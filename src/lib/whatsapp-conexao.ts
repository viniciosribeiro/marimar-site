/**
 * Ligar e desligar o WhatsApp da Marina pelo painel (tela /admin/whatsapp).
 *
 * Usa os métodos que o plugin `admin-http-rpc` do OpenClaw libera
 * (docs/plugins/admin-http-rpc.md, "Allowed methods"): `web.login.start`
 * mostra o QR, `web.login.wait` espera a leitura e liga o canal,
 * `channels.logout` desconecta. É o mesmo QR do
 * `openclaw channels login --channel whatsapp`, só que na tela do painel.
 *
 * Formato das respostas lido no `@openclaw/whatsapp` 2026.9.4
 * (login-qr.ts): `{ qrDataUrl?, message, connected?, sessionKey? }`, que
 * o gateway pode embrulhar em `{ ok, payload }`. Por isso a leitura procura
 * os campos onde estiverem.
 *
 * Esta é a conexão pelo WhatsApp Web (Baileys). A API oficial da Meta é a
 * segunda opção, em estudo; quando existir, entra ao lado desta.
 */
import { chamarRpc } from "./openclaw-config";

export type PassoQr = { qr: string | null; conectado: boolean; sessao: string | null; mensagem: string };

export type Fase = "qr" | "esperando" | "conectado" | "venceu" | "erro";

/** Os campos do passo, onde quer que venham no envelope do RPC. */
export function lerPassoQr(dados: unknown): PassoQr {
  const passo: PassoQr = { qr: null, conectado: false, sessao: null, mensagem: "" };
  const visitar = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(visitar); return; }
    const obj = o as Record<string, unknown>;
    if (!passo.qr && typeof obj.qrDataUrl === "string" && obj.qrDataUrl.startsWith("data:image/")) passo.qr = obj.qrDataUrl;
    if (obj.connected === true) passo.conectado = true;
    if (!passo.sessao && typeof obj.sessionKey === "string" && obj.sessionKey) passo.sessao = obj.sessionKey;
    if (!passo.mensagem && typeof obj.message === "string") passo.mensagem = obj.message;
    Object.values(obj).forEach(visitar);
  };
  visitar(dados);
  return passo;
}

/**
 * Em que pé está, e o que dizer à Cecília. As mensagens do OpenClaw vêm em
 * inglês e mudam de versão para versão: o que não for reconhecido vai como
 * erro, com o texto original junto, para não esconder um problema novo.
 */
export function faseDoPasso(p: PassoQr): { fase: Fase; texto: string } {
  const m = p.mensagem.toLowerCase();
  if (p.conectado) return { fase: "conectado", texto: "Conectada! A Marina já está atendendo no WhatsApp." };
  if (p.qr) return { fase: "qr", texto: "Leia o QR com o celular da pousada." };
  if (/already linked/.test(m)) return { fase: "conectado", texto: "O WhatsApp já estava conectado." };
  if (/still waiting/.test(m)) return { fase: "esperando", texto: "Esperando a leitura do QR." };
  if (/expired|no active whatsapp login|ended without a connection/.test(m)) return { fase: "venceu", texto: "O QR venceu. Gere outro." };
  if (/timed out waiting for whatsapp qr/.test(m)) return { fase: "erro", texto: "O WhatsApp demorou para gerar o QR. Tente de novo em instantes." };
  if (/stabilizing/.test(m)) return { fase: "erro", texto: "O servidor da Marina ainda está se arrumando. Tente de novo em 1 minuto." };
  return { fase: "erro", texto: p.mensagem ? `O servidor da Marina respondeu: ${p.mensagem}` : "O servidor da Marina não mandou o QR." };
}

type Resultado = { ok: true; passo: PassoQr } | { ok: false; erro: string };

/**
 * Pede um QR novo. `force` limpa a sessão antiga antes: depois de um 401
 * (aparelho removido) a credencial guardada não serve mais, e sem limpar o
 * OpenClaw tentaria usá-la e cairia de novo. Quem chama garante que o
 * WhatsApp NÃO está conectado — `force` com ele no ar desconectaria a Marina.
 */
export async function gerarQr(): Promise<Resultado> {
  const r = await chamarRpc("web.login.start", { channel: "whatsapp", force: true, timeoutMs: 25_000 }, 35_000);
  return r.ok ? { ok: true, passo: lerPassoQr(r.dados) } : r;
}

/** Espera até 20 s pela leitura; volta antes se o QR trocar. */
export async function esperarLeitura(sessao: string | null, qrAtual: string | null): Promise<Resultado> {
  const r = await chamarRpc("web.login.wait", {
    channel: "whatsapp",
    timeoutMs: 20_000,
    ...(sessao ? { sessionKey: sessao } : {}),
    ...(qrAtual ? { currentQrDataUrl: qrAtual } : {}),
  }, 30_000);
  return r.ok ? { ok: true, passo: lerPassoQr(r.dados) } : r;
}

/** Desconecta a Marina do WhatsApp (o mesmo que remover "openclaw" no celular). */
export async function desconectarWhatsapp(): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = await chamarRpc("channels.logout", { channel: "whatsapp" }, 20_000);
  return r.ok ? { ok: true } : r;
}
