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
 * O que a Marina precisa saber sobre ONDE ela está atendendo.
 *
 * Vai como mensagem de sistema em toda conversa do site, montada aqui no
 * servidor — nunca vinda do navegador, que poderia reescrevê-la.
 *
 * Existe por um motivo concreto: no WhatsApp ela manda foto, e por isso
 * responde "enviei as fotos". Aqui nada disso sai — o canal é texto puro.
 * Um atendimento que diz ter enviado o que não enviou é pior que um que
 * diz não poder enviar: o hóspede fica esperando.
 */
export const CONTEXTO_CANAL = [
  "Você está atendendo pelo CHAT DE TEXTO DO SITE da pousada. Não é o WhatsApp.",
  "",
  "FOTOS: você CONSEGUE mostrar fotos aqui. Escreva a imagem em markdown —",
  "![descrição](url) — e ela aparece para o visitante. Use somente as URLs que",
  "vieram do campo `fotos` da rota /api/agent/quartos. No máximo três por",
  "resposta: quem está lendo no celular não quer rolar uma galeria inteira.",
  "Para ver todas, mande o link do quarto (campo `url` da mesma rota).",
  "",
  "Se a rota não trouxer foto daquele quarto, diga isso e ofereça o WhatsApp.",
  "Nunca diga que enviou uma foto que você não escreveu na resposta.",
  "",
  "LINKS: só existem dois destinos válidos — páginas do NOSSO site",
  "(marimar-site.vercel.app) e o link oficial de reserva do motor",
  "Desbravador. NUNCA aponte para pousadamarimarilhadomel.com.br nem para",
  "pousadamarimar.com.br: é o site antigo, não faz parte do nosso sistema e",
  "sai do ar. Se não tiver o link certo em mãos, não invente um.",
  "",
  "Áudio e arquivos não passam por este canal. Não prometa mandar nenhum.",
  "",
  "Nunca afirme escassez — \"última unidade\", \"últimas vagas\", \"só resta um\",",
  "\"está acabando\" — a menos que esse dado tenha vindo da consulta de",
  "disponibilidade nesta mesma conversa. Sem o dado, não diga. Pressão de",
  "venda inventada é o tipo de coisa que a pousada não autorizou e que a",
  "recepção descobre quando o hóspede chega cobrando.",
].join("\n");

/* ── voz ───────────────────────────────────────────────────────────
   A Marina fala no site sob demanda: um botao por mensagem, nunca
   automatico. A diferenca nao e estetica — a ElevenLabs cobra por
   caractere, e tocar audio sozinho num canal publico transforma cada
   visitante curioso em gasto. Quem quer ouvir, clica.                */

/** Teto de sinteses por IP, por hora. */
export const LIMITE_VOZ_POR_HORA = 25;

/** Mensagem maior que isto nao vira audio — e resposta para ler. */
export const LIMITE_VOZ_CARACTERES = 900;

/** Teto de transcricoes por IP, por hora. */
export const LIMITE_AUDIO_POR_HORA = 20;

/** Um minuto e meio. Acima disso nao e pergunta, e outra coisa. */
export const LIMITE_AUDIO_SEGUNDOS = 90;

/** Teto de tamanho do arquivo, como segunda linha de defesa. */
export const LIMITE_AUDIO_BYTES = 4 * 1024 * 1024;

/** Transcricao (audio -> texto). Mesmo fornecedor da voz, mesma chave. */
export const URL_TRANSCRICAO = "https://api.elevenlabs.io/v1/speech-to-text";
export const MODELO_TRANSCRICAO = "scribe_v2";

export function vozConfigurada(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

/**
 * Endereco da sintese na ElevenLabs.
 *
 * `eleven_multilingual_v2` e `apply_text_normalization: "on"` sao os mesmos
 * do WhatsApp, de proposito: a voz da pousada tem que ser uma so, e sem a
 * normalizacao ela le "26/09" como digito solto em vez de data.
 */
export function urlVoz(): string {
  const voz = process.env.ELEVENLABS_VOICE_ID;
  return `https://api.elevenlabs.io/v1/text-to-speech/${voz}`;
}

export function corpoVoz(texto: string) {
  return {
    text: texto,
    model_id: "eleven_multilingual_v2",
    language_code: "pt",
    apply_text_normalization: "on",
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
