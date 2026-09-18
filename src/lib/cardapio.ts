/**
 * Cardápio digital do Marimar Café Bistrô Bar.
 *
 * Marcadores são fixos de propósito: um campo livre viraria "vegetariano",
 * "Vegetariano", "veget." na mesma casa, e o filtro pararia de funcionar.
 */

export const MARCADORES = {
  "vegetariano":  { rotulo: "Vegetariano",  icone: "🌱", cor: "green" },
  "vegano":       { rotulo: "Vegano",       icone: "🌿", cor: "green" },
  "sem-gluten":   { rotulo: "Sem glúten",   icone: "🌾", cor: "amber" },
  "sem-lactose":  { rotulo: "Sem lactose",  icone: "🥛", cor: "blue" },
  "picante":      { rotulo: "Picante",      icone: "🌶️", cor: "red" },
  "novidade":     { rotulo: "Novidade",     icone: "✨", cor: "marca" },
  "mais-pedido":  { rotulo: "Mais pedido",  icone: "🔥", cor: "marca" },
  "da-casa":      { rotulo: "Especialidade da casa", icone: "⭐", cor: "marca" },
} as const;

export type ChaveMarcador = keyof typeof MARCADORES;

export const LISTA_MARCADORES = Object.entries(MARCADORES).map(([chave, m]) => ({
  chave: chave as ChaveMarcador, ...m,
}));

export function marcador(chave: string) {
  return MARCADORES[chave as ChaveMarcador] ?? null;
}

/** Classes por cor do marcador — Tailwind precisa das classes por extenso. */
export function classesMarcador(cor: string): string {
  switch (cor) {
    case "green": return "bg-green-50 text-green-800 border-green-200";
    case "amber": return "bg-amber-50 text-amber-900 border-amber-200";
    case "blue":  return "bg-sky-50 text-sky-800 border-sky-200";
    case "red":   return "bg-red-50 text-red-800 border-red-200";
    default:      return "bg-areia text-tinta border-linha";
  }
}

export type ItemCardapio = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string | null;
  preco_promocional: string | null;
  porcao: string | null;
  foto_url: string | null;
  marcadores: string[] | null;
  destaque: boolean;
  disponivel: boolean;
};

export type CategoriaCardapio = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  icone: string | null;
  horario: string | null;
  itens: ItemCardapio[];
};

/** Slug a partir do nome, para a categoria ancorar na navegação. */
export function gerarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}
