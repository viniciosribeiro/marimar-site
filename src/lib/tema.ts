/**
 * Modelo do tema do site.
 *
 * Tudo que o editor controla mora aqui, num unico objeto gravado em
 * `pousada.tema` (jsonb) + as colunas historicas de cor e fonte. Ter o
 * formato num so lugar e o que torna possivel exportar, importar, comparar
 * e restaurar versoes — recursos que nao existiriam se cada opcao fosse uma
 * coluna solta.
 */

export type Tema = {
  // Cores (espelhadas nas colunas cor_primaria/cor_secundaria)
  marca: string;
  acento: string;

  // Tipografia
  fonteTitulo: string;
  fonteCorpo: string;
  fonteManuscrita: string;
  textoBase: number;      // px
  escala: number;         // razao entre niveis
  alturaLinha: number;
  pesoTitulo: number;

  // Forma e ritmo
  raio: number;           // px
  sombra: "none" | "sm" | "md" | "lg";
  densidade: number;      // multiplicador do respiro vertical
  animacoes: boolean;

  // Faixa de aviso
  banner: { ativo: boolean; texto: string | null; subtexto: string | null; animado: boolean };
};

export const TEMA_PADRAO: Tema = {
  marca: "#B45309",
  acento: "#0E7490",
  fonteTitulo: "Playfair Display",
  fonteCorpo: "Inter",
  fonteManuscrita: "Caveat",
  textoBase: 16,
  escala: 1.25,
  alturaLinha: 1.6,
  pesoTitulo: 700,
  raio: 12,
  sombra: "sm",
  densidade: 1,
  animacoes: true,
  banner: { ativo: false, texto: null, subtexto: null, animado: true },
};

/** Junta o que veio do banco com o padrao, tolerando campo faltando. */
export function lerTema(pousada: Record<string, any> | null): Tema {
  const t = (pousada?.tema ?? {}) as Partial<Tema> & Record<string, any>;
  return {
    ...TEMA_PADRAO,
    ...t,
    // As cores tem coluna propria: ela manda, o jsonb e espelho
    marca: pousada?.cor_primaria || t.marca || TEMA_PADRAO.marca,
    acento: pousada?.cor_secundaria || t.acento || TEMA_PADRAO.acento,
    fonteTitulo: pousada?.fonte_titulo || t.fonteTitulo || TEMA_PADRAO.fonteTitulo,
    fonteCorpo: pousada?.fonte_corpo || t.fonteCorpo || TEMA_PADRAO.fonteCorpo,
    // `raio` era string em versoes antigas do editor
    raio: Number(t.raio ?? TEMA_PADRAO.raio),
    banner: { ...TEMA_PADRAO.banner, ...(t.banner ?? {}) },
  };
}

const SOMBRAS: Record<Tema["sombra"], string> = {
  none: "none",
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
};

/**
 * Converte o tema nas variaveis CSS cruas.
 *
 * Usada em dois lugares: no layout raiz (site real) e na previa do editor,
 * injetada dentro do iframe. Uma funcao so garante que a previa mostre
 * exatamente o que o site vai mostrar — duas implementacoes divergiriam.
 */
export function temaParaCss(t: Tema, pilhas: { titulo: string; corpo: string; manuscrita: string }): string {
  return [
    `--marca:${t.marca}`,
    `--acento:${t.acento}`,
    `--fonte-titulo:${pilhas.titulo}`,
    `--fonte-corpo:${pilhas.corpo}`,
    `--fonte-manuscrita:${pilhas.manuscrita}`,
    `--texto-base:${t.textoBase}px`,
    `--escala:${t.escala}`,
    `--altura-linha:${t.alturaLinha}`,
    `--peso-titulo:${t.pesoTitulo}`,
    `--raio:${t.raio}px`,
    `--sombra:${SOMBRAS[t.sombra] ?? SOMBRAS.sm}`,
    `--densidade:${t.densidade}`,
    `--duracao:${t.animacoes ? "200ms" : "0.01ms"}`,
  ].join(";") + ";";
}

export function pilhaFonte(nome: string): string {
  return nome && nome !== "Geist"
    ? `"${nome}", var(--font-geist-sans), system-ui, sans-serif`
    : `var(--font-geist-sans), system-ui, sans-serif`;
}

export function pilhaManuscrita(nome: string): string {
  return nome && nome !== "nenhuma"
    ? `"${nome}", var(--font-geist-sans), cursive`
    : `var(--font-geist-sans), system-ui, sans-serif`;
}

/* ─────────────── Conjuntos prontos ─────────────── */

export type Conjunto = { id: string; nome: string; desc: string; tema: Partial<Tema> };

export const CONJUNTOS: Conjunto[] = [
  {
    id: "editorial", nome: "Editorial Marimar",
    desc: "Serifada elegante, anotações à mão, hierarquia marcada",
    tema: { marca: "#B45309", acento: "#0E7490", fonteTitulo: "Playfair Display", fonteCorpo: "Inter",
            fonteManuscrita: "Caveat", escala: 1.333, raio: 12, sombra: "sm", densidade: 1, pesoTitulo: 700 },
  },
  {
    id: "litoral", nome: "Litoral",
    desc: "Verde-água e areia, leitura leve e espaçada",
    tema: { marca: "#0D9488", acento: "#F59E0B", fonteTitulo: "Lora", fonteCorpo: "Inter",
            fonteManuscrita: "Caveat", escala: 1.25, raio: 12, sombra: "sm", densidade: 1.15, pesoTitulo: 600 },
  },
  {
    id: "classico", nome: "Clássico",
    desc: "Sóbrio, sem manuscrito, cantos retos",
    tema: { marca: "#1E3A5F", acento: "#B45309", fonteTitulo: "Libre Baskerville", fonteCorpo: "Inter",
            fonteManuscrita: "nenhuma", escala: 1.2, raio: 4, sombra: "sm", densidade: 1, pesoTitulo: 700 },
  },
  {
    id: "moderno", nome: "Moderno",
    desc: "Sem serifa, arredondado, compacto",
    tema: { marca: "#0891B2", acento: "#F97316", fonteTitulo: "Montserrat", fonteCorpo: "Inter",
            fonteManuscrita: "nenhuma", escala: 1.2, raio: 20, sombra: "md", densidade: 0.9, pesoTitulo: 700 },
  },
];

/* ─────────────── Catálogo de fontes ─────────────── */

export const FONTES_TITULO = [
  "Geist", "Playfair Display", "Lora", "Merriweather", "Cormorant Garamond",
  "Libre Baskerville", "Spectral", "Montserrat", "Raleway", "Poppins", "Inter",
];
export const FONTES_CORPO = ["Geist", "Inter", "Roboto", "Open Sans", "Lato", "Nunito", "Source Sans 3"];
export const FONTES_MANUSCRITA = [
  "Caveat", "Kalam", "Dancing Script", "Shadows Into Light", "Patrick Hand", "Gloria Hallelujah", "nenhuma",
];

/** Todas as que o layout raiz pode precisar buscar no Google Fonts. */
export const TODAS_AS_FONTES = new Set([...FONTES_TITULO, ...FONTES_CORPO, ...FONTES_MANUSCRITA]
  .filter((f) => f !== "Geist" && f !== "nenhuma"));

export const ESCALAS = [
  { v: 1.125, nome: "Sutil", desc: "Diferença pequena entre títulos" },
  { v: 1.2,   nome: "Discreta", desc: "Hierarquia contida" },
  { v: 1.25,  nome: "Equilibrada", desc: "Padrão para a maioria dos sites" },
  { v: 1.333, nome: "Marcada", desc: "Títulos que dominam a página" },
  { v: 1.414, nome: "Dramática", desc: "Contraste forte, estilo revista" },
];
