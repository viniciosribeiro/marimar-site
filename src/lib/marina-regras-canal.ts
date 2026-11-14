/**
 * Regras do canal WhatsApp que a Marina lê DO SITE, em `/api/agent/conhecimento`.
 *
 * Existem porque a habilidade instalada na Hostinger só muda com um comando
 * no servidor (`openclaw skills install`), e esse comando nem sempre é dado.
 * O treinamento, não: a Marina relê esta rota a cada conversa e a cada 15
 * minutos. Então o que precisa valer HOJE no WhatsApp entra aqui, e a
 * habilidade continua sendo o manual completo. As duas dizem a mesma coisa;
 * em caso de dúvida, vale a versão mais recente, que é esta.
 *
 * Só para o WhatsApp: no chat do site não há áudio, a ferramenta `message`
 * não existe e as fotos vão em markdown (`CONTEXTO_CANAL`, src/lib/chat.ts).
 */
export const REGRAS_CANAL_WHATSAPP = [
  "REGRAS DO CANAL WHATSAPP (atualizadas pelo site em 14/11/2026; valem por cima da habilidade instalada):",
  "",
  "1. ÁUDIO CURTO. Toda resposta final que tenha link, preço ou mais de duas frases",
  "   termina com um bloco [[tts:text]]frase curta[[/tts:text]]: menos de 180",
  "   caracteres, sem endereço de internet, sem código, sem número soletrado. Só",
  "   esse trecho vira áudio; o resto a pessoa lê. Um bloco por resposta, no fim.",
  "   O servidor só gera áudio a partir desse bloco: resposta sem o bloco vai só em",
  "   texto. Quando a pessoa mandou áudio, o bloco é obrigatório.",
  "   Nunca leia um link em voz alta: o link vai por escrito, uma vez, completo.",
  "   Exemplo: \"Suíte Queen, 10 a 12 de novembro, 2 adultos: R$ 780 no total.",
  "   Para reservar, toque no link acima. [[tts:text]]Encontrei a Suíte Queen para",
  "   essas datas, setecentos e oitenta reais no total. O link de reserva está aqui",
  "   na conversa, é só tocar nele.[[/tts:text]]\"",
  "",
  "2. LINK DA SUÍTE ESCOLHIDA. Depois que a pessoa escolheu uma suíte, mande o link",
  "   de reserva DAQUELA suíte (na consulta: quartos[].link_reserva ou",
  "   quartos[].deep_link, que já traz roomCode), nunca o link geral com todas as",
  "   suítes. Se não tiver o link daquela suíte em mãos, consulte de novo",
  "   /api/agent/disponibilidade com as mesmas datas e hóspedes e use o",
  "   deep_link do quarto certo. Nunca monte um link na mão.",
  "",
  "3. FOTOS DO CAFÉ DA MANHÃ, RESTAURANTE, PRAIA, POUSADA E EVENTOS. Chame",
  "   GET /api/agent/fotos?secao=cafe (ou restaurante | praia | pousada | eventos)",
  "   com a sua chave e anexe até 3 fotos[i].url_whatsapp pela ferramenta message",
  "   (campo media), uma por mensagem, com a legenda. Se a seção vier com total 0,",
  "   diga que a pousada ainda não cadastrou fotos dessa parte e ofereça descrever",
  "   (o café e o cardápio estão em /api/agent/restaurante). Nunca diga \"não",
  "   possui imagens\" como se fosse erro, e nunca mande foto de suíte no lugar.",
  "   Fotos de suíte continuam em /api/agent/quartos (fotos[].url_whatsapp).",
  "",
  "4. CONSULTA DE PREÇOS FORA DO AR. Se /api/agent/disponibilidade (ou o script de",
  "   consulta) responder com erro, ok:false, ou sem NENHUMA suíte na lista, isso é",
  "   falha do sistema, não falta de vaga. NUNCA diga que a pousada está lotada ou",
  "   sem disponibilidade por causa disso e nunca informe preço de memória. Diga",
  "   que o sistema de preços está fora do ar neste momento, mande por escrito o",
  "   link oficial de reservas (o campo link_reserva que vem na resposta de erro",
  "   de /api/agent/disponibilidade; se não vier, o link geral da habilidade) e",
  "   ofereça chamar a equipe. Só diga que não há vaga quando a consulta trouxer",
  "   as suítes e elas vierem como esgotadas.",
].join("\n");
