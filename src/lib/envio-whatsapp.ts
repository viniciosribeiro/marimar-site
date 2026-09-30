import { chamarRpc } from "./openclaw-config";

/**
 * Manda uma mensagem de WhatsApp pelo número da pousada (o que a Marina usa),
 * através do gateway do OpenClaw.
 *
 * É o caminho usado para avisar a equipe e para devolver a resposta ao
 * cliente. Usa o RPC de administração do gateway (plugin `admin-http-rpc`,
 * o mesmo da voz) com o método `send` — trocável pela variável
 * `OPENCLAW_ENVIO_METODO` se a versão do OpenClaw usar outro nome.
 *
 * Nunca lança: devolve `{ ok, erro }`. Quando falha, quem chamou tem um
 * plano B — a própria Marina manda (a rota do agente devolve o texto e o
 * destino para ela) — e o painel mostra o erro do gateway como veio.
 */

export type Envio = { ok: true } | { ok: false; erro: string };

export type Template = { nome: string; idioma: string };

export async function enviarWhatsapp(numero: string, texto: string, opcoes: { template?: Template | null; chave?: string } = {}): Promise<Envio> {
  if (!process.env.OPENCLAW_GATEWAY_URL || !process.env.OPENCLAW_GATEWAY_TOKEN) {
    return { ok: false, erro: "O gateway do OpenClaw não está configurado neste site." };
  }
  const metodo = process.env.OPENCLAW_ENVIO_METODO || "send";
  const params: Record<string, unknown> = {
    channel: "whatsapp",
    to: `+${numero.replace(/\D/g, "")}`,
    message: texto,
    /* O gateway ignora um reenvio com a mesma chave — um clique duplo ou um
       processamento de prazo repetido não manda a mesma mensagem duas vezes. */
    idempotencyKey: opcoes.chave ?? crypto.randomUUID(),
  };
  /* API oficial fora da janela de 24 h: só template aprovado na Meta. */
  if (opcoes.template) {
    params.template = { name: opcoes.template.nome, language: opcoes.template.idioma, parameters: [texto.slice(0, 1000)] };
  }
  const r = await chamarRpc(metodo, params);
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}
