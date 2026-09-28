/**
 * Seções de foto — a única lista, usada pelo painel, pela galeria e pela
 * Marina.
 *
 * Antes a única classificação era "tem quarto ou não": tudo que não era de
 * quarto caía junto na galeria como "A pousada" (restaurante, café, praia,
 * fachada), e o site adivinhava a foto do restaurante pelo texto
 * alternativo. Uma foto agora diz onde ela pertence.
 *
 * A ordem aqui é a ordem das abas na galeria e no painel.
 */
export const SECOES_FOTO = [
  { chave: "pousada", nome: "A pousada", descricao: "Fachada, jardim, recepção e áreas comuns" },
  { chave: "quarto", nome: "Suítes", descricao: "Cada foto ligada à sua suíte" },
  { chave: "restaurante", nome: "Restaurante", descricao: "Marimar Café Bistrô Bar, pratos e drinks" },
  { chave: "cafe", nome: "Café da manhã", descricao: "O café servido aos hóspedes" },
  { chave: "praia", nome: "Praia e ilha", descricao: "Encantadas, a praia e a Ilha do Mel" },
  { chave: "eventos", nome: "Eventos", descricao: "Casamentos e festas no complexo" },
] as const;

export type SecaoFoto = (typeof SECOES_FOTO)[number]["chave"];

const CHAVES = new Set<string>(SECOES_FOTO.map((s) => s.chave));

/** Valor vindo de formulário ou querystring → seção válida (ou a padrão). */
export function secaoValida(v: unknown, padrao: SecaoFoto = "pousada"): SecaoFoto {
  return typeof v === "string" && CHAVES.has(v) ? (v as SecaoFoto) : padrao;
}

export function nomeSecao(chave: string): string {
  return SECOES_FOTO.find((s) => s.chave === chave)?.nome ?? "A pousada";
}
