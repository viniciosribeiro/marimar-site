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

export function prepararFalaDaMarina(texto: string): string {
  const original = texto.trim();
  if (!original) return "";
  const contemLink = /(?:https?:\/\/|www\.)\S+/i.test(original);
  if (!contemLink) return original;

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
