/**
 * Prepara SOMENTE a fala sintetizada da Marina.
 * A mensagem original fica intacta no chat, inclusive todos os links.
 * Nao se deve cobrar ElevenLabs por ler URLs, tokens, imagens e markdown.
 *
 * Sem links: preservar o comportamento anterior. Com links: falar uma
 * explicacao curta, nunca ler o endereco inteiro.
 */
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"'´`]+/giu;
const LINK_MARKDOWN = /!?\[([^\]]*)\]\(\s*(?:https?:\/\/|www\.)[^)\s]*(?:\([^)]*\)[^)\s]*)?\s*\)/giu;
const EMAIL = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/giu;
const SO_LINKS = "Enviei o link na mensagem. É só tocar nele para abrir.";

/* O bloco de fala do OpenClaw: `[[tts:text]]frase curta[[/tts:text]]`. A skill
   manda a Marina terminar toda resposta com link por um desses; o OpenClaw
   fala só o bloco. Aqui fazemos o mesmo nos canais do site (chat e API
   oficial do WhatsApp) e, principalmente, nunca mostramos o bloco à pessoa. */
const BLOCO_TTS = /\[\[tts:text\]\]([\s\S]*?)\[\[\/tts:text\]\]/giu;
const BLOCO_TTS_ABERTO = /\[\[tts:text\]\][\s\S]*$/iu;
/* Um "[[tts:te" ainda chegando pelo streaming: some em vez de piscar na tela. */
const MARCADOR_PARCIAL = /\[\[[^\]\n]{0,12}$/u;

/** O texto que a pessoa lê (sem o bloco) e a frase que a Marina quer falar (ou null). */
export function separarFalaDaMarina(texto: string): { texto: string; fala: string | null } {
  let fala: string | null = null;
  const semBloco = texto.replace(BLOCO_TTS, (_, dentro: string) => {
    const f = dentro.replace(/\s+/g, " ").trim();
    if (f && !fala) fala = f;
    return " ";
  });
  const limpo = semBloco.replace(BLOCO_TTS_ABERTO, "").replace(MARCADOR_PARCIAL, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
  return { texto: limpo, fala };
}

/** O que mostrar na tela: a resposta sem o bloco de fala. */
export const textoSemBlocoDeFala = (texto: string): string => separarFalaDaMarina(texto).texto;

export function prepararFalaDaMarina(texto: string): string {
  const separado = separarFalaDaMarina(texto);
  /* Com bloco, a frase da Marina manda — passando pela mesma limpeza de
     links e pelo mesmo limite, caso ela tenha escorregado uma URL. */
  if (separado.fala) return prepararFalaDoTexto(separado.fala, true);
  return prepararFalaDoTexto(separado.texto, false);
}

function prepararFalaDoTexto(texto: string, doBloco: boolean): string {
  const original = texto.trim();
  if (!original) return "";
  const contemLink = /(?:https?:\/\/|www\.)\S+/i.test(original);
  if (!contemLink && !doBloco) return original;

  let limpo = original
    // Fotos inline nao devem virar "imagem descricao" no audio.
    .replace(/!\[[^\]]*\]\(\s*(?:https?:\/\/|www\.)[^)]*\)/giu, " ")
    // Links com nome descritivo mantem apenas o nome, sem endereco.
    .replace(LINK_MARKDOWN, "$1")
    .replace(URL, " ")
    .replace(EMAIL, " ")
    // Tags e sintaxe visual desnecessarias na fala.
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_~#|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s*[:;,\-–—]\s*$/u, "")
    .trim();

  // Resposta longa com link: evitar sintetizar paragrafos inteiros.
  const LIMITE = 235;
  if (limpo.length > LIMITE) {
    let corte = limpo.slice(0, LIMITE);
    const espaco = corte.lastIndexOf(" ");
    if (espaco > LIMITE - 35) corte = corte.slice(0, espaco);
    limpo = corte.replace(/[,;:—–\- ]+$/u, "").trim();
    if (limpo && !/[.!?]$/.test(limpo)) limpo += ".";
  }
  if (limpo.length < 12 || /^[\W\d]+$/u.test(limpo)) return SO_LINKS;
  return limpo;
}
