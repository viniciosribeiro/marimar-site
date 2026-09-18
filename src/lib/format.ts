/**
 * Camada de apresentacao sobre os dados crus do motor Desbravador.
 *
 * O motor devolve nomes em CAIXA ALTA ("SUITE KING"), descricoes longas no
 * campo `categoria` e valores numericos sem formatacao. Nada disso deve
 * chegar ao hospede do jeito que veio.
 */

/** "SUITE KING" -> "Suíte King". Preserva siglas curtas e acentos ja existentes. */
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "sem", "na", "no", "em", "para", "a", "o"]);

/** Corrige grafias que o motor devolve sem acento. */
const ACENTOS: Record<string, string> = {
  suite: "Suíte",
  familia: "Família",
  standard: "Standard",
  triplo: "Triplo",
  quadruplo: "Quádruplo",
  duplo: "Duplo",
  casal: "Casal",
  king: "King",
  queen: "Queen",
  rede: "Rede",
  lua: "Lua",
  mel: "Mel",
  premium: "Premium",
  luxo: "Luxo",
  hidromassagem: "Hidromassagem",
  vista: "Vista",
  mar: "Mar",
  varanda: "Varanda",
};

export function tituloQuarto(nome: string | null | undefined): string {
  if (!nome) return "";
  const limpo = nome.trim().replace(/\s+/g, " ");

  // Ja vem com capitalizacao mista? Confia na fonte (veio do admin, nao do motor).
  if (limpo !== limpo.toUpperCase()) return limpo;

  return limpo
    .toLowerCase()
    .split(" ")
    .map((palavra, i) => {
      if (ACENTOS[palavra]) return ACENTOS[palavra];
      if (i > 0 && MINUSCULAS.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

/**
 * Corta no limite de palavra, nunca no meio.
 * "...viaja em grupo ou com cria" -> "...viaja em grupo ou com…"
 */
export function resumir(texto: string | null | undefined, max = 120): string {
  if (!texto) return "";
  const limpo = texto.trim().replace(/\s+/g, " ");
  if (limpo.length <= max) return limpo;

  const cortado = limpo.slice(0, max);
  const ultimoEspaco = cortado.lastIndexOf(" ");
  const base = ultimoEspaco > max * 0.5 ? cortado.slice(0, ultimoEspaco) : cortado;

  return base.replace(/[\s,;.:—-]+$/, "") + "…";
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const BRL_CENTAVOS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1040 -> "R$ 1.040"  |  1040.5 -> "R$ 1.040,50" */
export function brl(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? BRL.format(n) : BRL_CENTAVOS.format(n);
}

/** Plural sem "(s)": pluralizar(1,"noite") -> "1 noite"; pluralizar(2,"noite") -> "2 noites" */
export function pluralizar(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : plural ?? singular + "s"}`;
}

/**
 * Mensagem de escassez a partir do estoque real do motor.
 * Só fala em escassez quando ela existe de verdade — nunca inventa urgência.
 */
export function escassez(unidades: number | null | undefined): string | null {
  if (unidades === null || unidades === undefined) return null;
  if (unidades <= 0) return null;
  if (unidades === 1) return "Última unidade disponível";
  if (unidades === 2) return "Restam 2 unidades";
  return null;
}

/** "2026-10-15" -> "15/10/2026" */
export function dataBR(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("pt-BR");
}
