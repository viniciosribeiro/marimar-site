/**
 * A parte do treinamento da Marina que não toca o banco: categorias, tipos,
 * a situação de cada item e a sugestão de categoria.
 *
 * Existe separada de `marina.ts` para poder ser importada pelas telas (que
 * rodam no navegador) sem levar junto o driver do Postgres.
 */
import type { ItemTreino, Leitura } from "./marina";

/* ── categorias e tipos ──────────────────────────────────────────── */

export const CATEGORIAS = [
  { id: "pousada", rotulo: "A pousada", exemplo: "Recepção funciona das 8h às 22h." },
  { id: "quartos", rotulo: "Quartos", exemplo: "A suíte Família tem berço sob pedido." },
  { id: "politicas", rotulo: "Políticas", exemplo: "Crianças que não são de colo pagam como adulto." },
  { id: "checkin", rotulo: "Check-in e check-out", exemplo: "Chegada antecipada depende de liberação do quarto." },
  { id: "pagamentos", rotulo: "Pagamentos", exemplo: "Aceitamos Pix e cartão de crédito." },
  { id: "ilha", rotulo: "Ilha do Mel", exemplo: "Não circulam carros na ilha." },
  { id: "passeios", rotulo: "Passeios", exemplo: "O passeio de barco sai às 10h do trapiche." },
  { id: "barcos", rotulo: "Barcos e travessia", exemplo: "O último barco de Pontal sai às 19h no verão." },
  { id: "faq", rotulo: "Perguntas frequentes", exemplo: "Tem wi-fi em todos os quartos." },
  { id: "geral", rotulo: "Outros assuntos", exemplo: "" },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]["id"];
export const rotuloCategoria = (id: string) =>
  CATEGORIAS.find((c) => c.id === id)?.rotulo ?? "Outros assuntos";
export const categoriaValida = (id: unknown): Categoria =>
  (CATEGORIAS.some((c) => c.id === id) ? id : "geral") as Categoria;

export const TIPOS = {
  fato: { rotulo: "Informação", plural: "Informações", ajuda: "Algo que ela passa a tratar como oficial." },
  pergunta: { rotulo: "Pergunta e resposta", plural: "Perguntas e respostas", ajuda: "Uma pergunta, as formas de fazê-la e a resposta certa." },
  limite: { rotulo: "Nunca dizer", plural: "Nunca dizer", ajuda: "Algo que ela não diz nem se o hóspede insistir." },
  escalar: { rotulo: "Passar para uma pessoa", plural: "Passar para uma pessoa", ajuda: "Situações em que ela chama a recepção." },
} as const;

export type Tipo = keyof typeof TIPOS;
export const tipoValido = (t: unknown): Tipo =>
  (typeof t === "string" && t in TIPOS ? t : "fato") as Tipo;

/** Código curto do item, usado só na área de teste para citar a fonte. */
export const codigoItem = (id: string) => "#" + id.replace(/-/g, "").slice(0, 6);

/**
 * Situação de um item, em palavras de quem opera.
 *
 * "Em uso" só aparece quando a Marina do WhatsApp comprovadamente leu a
 * versão atual. Antes disso o item está salvo mas "aguardando": ela lê na
 * próxima conversa. É a diferença entre o painel afirmar e o painel saber.
 */
export function situacaoItem(
  i: Pick<ItemTreino, "ativo" | "excluido_em" | "atualizado_em" | "verificacao">,
  leituras: Record<string, Leitura>,
): { id: "lixeira" | "desligado" | "falhou" | "aguardando" | "em-uso"; rotulo: string; detalhe: string } {
  if (i.excluido_em) return { id: "lixeira", rotulo: "Na lixeira", detalhe: "Não vale para a Marina." };
  if (!i.ativo) return { id: "desligado", rotulo: "Desligado", detalhe: "Guardado, mas a Marina não usa." };
  if (i.verificacao === "falhou") {
    return { id: "falhou", rotulo: "Revisar", detalhe: "No último teste a Marina não usou este item." };
  }
  const zap = leituras.whatsapp?.lido_em;
  if (!zap || new Date(zap) < new Date(i.atualizado_em)) {
    return {
      id: "aguardando",
      rotulo: "Salvo · aguardando WhatsApp",
      detalhe: "Já vale no site. O WhatsApp lê na próxima conversa.",
    };
  }
  return { id: "em-uso", rotulo: "Em uso", detalhe: "Lido pelo site e pelo WhatsApp." };
}

/* ── sugestão de categoria ───────────────────────────────────────── */

const PISTAS: [Categoria, RegExp][] = [
  ["barcos", /barco|travessia|abaline|pontal|trapiche|embarca/i],
  ["checkin", /check.?in|check.?out|chegada|sa[ií]da|hor[aá]rio de entrada/i],
  ["pagamentos", /pix|cart[aã]o|pagamento|parcel|boleto|sinal|dep[oó]sito/i],
  ["politicas", /crian[cç]a|pet|cachorro|cancel|pol[ií]tica|regra|idade/i],
  ["quartos", /quarto|su[ií]te|cama|ar.condicionado|banheiro|acomoda/i],
  ["passeios", /passeio|trilha|gruta|farol|fortaleza|tour/i],
  ["ilha", /ilha|encantadas|nova bras[ií]lia|praia/i],
  ["pousada", /pousada|recep[cç][aã]o|restaurante|caf[eé] da manh[aã]|wi.?fi/i],
];

/** Chuta a categoria pelo texto. Serve de sugestão — quem decide é a Cecília. */
export function sugerirCategoria(texto: string): Categoria {
  return PISTAS.find(([, r]) => r.test(texto))?.[0] ?? "geral";
}
