import { createHash } from "crypto";

/**
 * Chat de atendimento do site.
 *
 * O widget conversa com a MESMA Marina do WhatsApp. O caminho é:
 *
 *   navegador → /api/chat (nosso servidor) → gateway do OpenClaw → Marina
 *
 * O token do gateway nunca sai do servidor. A documentação do OpenClaw é
 * explícita: aquele endpoint equivale a acesso de operador da instância, e
 * não pode ficar exposto. Por isso o navegador nunca fala com ele — fala
 * com um endpoint nosso, público e sem credencial, que só sabe fazer uma
 * coisa: repassar uma pergunta de visitante.
 */

/** Teto por IP, por hora. Um chat público sem teto é uma conta aberta. */
export const LIMITE_POR_HORA = 30;

/** Uma pergunta de hóspede não passa disso. O que passa é outra coisa. */
export const LIMITE_CARACTERES = 1200;

/** Quantas mensagens do histórico vão como contexto para o agente. */
export const CONTEXTO_MENSAGENS = 20;

/**
 * Hash do IP, com sal.
 *
 * Serve para contar requisições do mesmo visitante sem guardar o IP — que é
 * dado pessoal. O sal é o `AUTH_SECRET`: sem ele, uma tabela de hashes de
 * IPv4 é reversível por força bruta em minutos.
 */
export function hashIp(ip: string): string {
  const sal = process.env.AUTH_SECRET ?? "marimar";
  return createHash("sha256").update(sal + "|" + ip).digest("hex").slice(0, 32);
}

/** O IP real do visitante atrás do proxy da Vercel. */
export function ipDaRequisicao(req: Request): string {
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "desconhecido";
}

export function gatewayConfigurado(): boolean {
  return Boolean(process.env.OPENCLAW_GATEWAY_URL && process.env.OPENCLAW_GATEWAY_TOKEN);
}

/** Endereço do gateway, sem barra no fim — evita `//v1/...`. */
export function urlGateway(caminho: string): string {
  const base = (process.env.OPENCLAW_GATEWAY_URL ?? "").replace(/\/+$/, "");
  return base + caminho;
}

export function cabecalhosGateway(): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
  };
}

/**
 * Perguntas sugeridas no primeiro contato.
 *
 * Não são enfeite: um campo de texto vazio faz a pessoa não saber o que
 * perguntar, e as três primeiras mensagens de um chat decidem se ela
 * continua. Todas levam a algo que a Marina responde bem.
 */
export const SUGESTOES = [
  "Tem vaga para o próximo fim de semana?",
  "Como chego na pousada?",
  "O café da manhã está incluso?",
  "Posso levar meu cachorro?",
];

export const SAUDACAO =
  "Oi! Sou a Marina, da Pousada Marimar. Posso ajudar com datas, acomodações, o restaurante e como chegar na ilha.";

/** Mensagem quando a Marina não puder responder — sempre com saída humana. */
export const INDISPONIVEL =
  "Não consegui responder agora. Você pode falar direto com a pousada no WhatsApp — a resposta é rápida.";
