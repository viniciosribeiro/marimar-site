/**
 * Textos e limites do chat que o NAVEGADOR usa (src/components/site/ChatMarina.tsx).
 *
 * Arquivo sem nenhuma importação de servidor de propósito: o widget
 * importava estas constantes de lib/chat.ts, que usa o módulo de criptografia do Node, e
 * isso fazia o navegador baixar a versão de navegador desse módulo inteira
 * (~100 KB comprimidos) em todas as páginas. lib/chat.ts reexporta daqui.
 */

/** Um minuto e meio. Acima disso nao e pergunta, e outra coisa. */
export const LIMITE_AUDIO_SEGUNDOS = 90;

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
