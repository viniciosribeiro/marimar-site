/**
 * Ícones de linha, desenhados aqui.
 *
 * Eram emojis. Emoji não é ícone: cada sistema desenha o seu, o mesmo 🍤
 * muda de cor e de forma entre iPhone, Android e Windows, e nenhum deles
 * aceita a cor da marca. Num bloco de oito cartões isso vira oito estilos
 * gráficos diferentes na mesma tela.
 *
 * São SVG inline: herdam `currentColor`, escalam sem borrar e não custam
 * nenhuma requisição.
 */

export type NomeIcone = keyof typeof CAMINHOS;

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const CAMINHOS = {
  /* hospedagem */
  cama: <><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" /><path d="M3 14h18" /><path d="M7 10V7h5v3" /><path d="M3 18v2" /><path d="M21 18v2" /></>,
  chuveiro: <><path d="M5 16V7a3 3 0 0 1 6 0v1" /><path d="M9 8h10a2 2 0 0 1 2 2" /><path d="M13 13v.01M16 13v.01M19 13v.01M14.5 17v.01M17.5 17v.01" /></>,
  ar: <><path d="M12 3v18" /><path d="M4.5 7.5 19.5 16.5" /><path d="M19.5 7.5 4.5 16.5" /><path d="M12 7l2-2M12 7l-2-2M12 17l2 2M12 17l-2 2" /></>,
  wifi: <><path d="M2.5 9a16 16 0 0 1 19 0" /><path d="M6 12.5a11 11 0 0 1 12 0" /><path d="M9.5 16a6 6 0 0 1 5 0" /><path d="M12 19.5v.01" /></>,
  tv: <><rect x="2.5" y="5" width="19" height="12" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>,
  chave: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9" /><path d="M17 12v3" /><path d="M20 12v2" /></>,

  /* gastronomia */
  talheres: <><path d="M6 3v8a2 2 0 0 0 4 0V3" /><path d="M8 11v10" /><path d="M17 3c-1.5 1.5-2 3.5-2 5.5S15.5 12 17 12v9" /></>,
  cafe: <><path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M7 3v2M11 3v2" /><path d="M3 21h15" /></>,
  taca: <><path d="M7 3h10l-1 6a4 4 0 0 1-8 0L7 3Z" /><path d="M12 13v6" /><path d="M8.5 21h7" /></>,
  peixe: <><path d="M3 12c3-4 7-6 11-6 3 0 5 2 7 6-2 4-4 6-7 6-4 0-8-2-11-6Z" /><path d="M16 10v.01" /><path d="M6 8c-.5 2.5-.5 5.5 0 8" /></>,

  /* lugar */
  praia: <><path d="M3 20h18" /><path d="M12 20V9" /><path d="M12 9c-3-3-7-2-8 1 3-1 6 0 8-1Z" /><path d="M12 9c3-3 7-2 8 1-3-1-6 0-8-1Z" /></>,
  ondas: <><path d="M2 8c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0" /><path d="M2 14c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0" /><path d="M2 20c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0" /></>,
  barco: <><path d="M3 17c1.5 1.5 3 2 4.5 2s3-1 4.5-1 3 1 4.5 1 3-.5 4.5-2" /><path d="M5 14 12 3l7 11" /><path d="M12 3v11" /></>,
  folha: <><path d="M4 20c0-9 6-14 16-14 0 10-5 15-14 15-1 0-2-.3-2-1Z" /><path d="M9 15c2-3 5-5 8-6" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  trilha: <><path d="M13 4v16" /><path d="M13 7 8 5v3l5 2" /><path d="M13 13l5-2v3l-5 2" /><path d="M5 20h14" /></>,
  caminhar: <><circle cx="13" cy="4" r="1.6" /><path d="M11 21l2-6-3-3 1-4 3 2 2 1" /><path d="M10 12l-3 3-1 6" /></>,
  mapa: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,

  /* pessoas e ocasiões */
  familia: <><circle cx="8" cy="7" r="2.6" /><circle cx="16.5" cy="8.5" r="2" /><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5" /><path d="M14 20c0-2.3 1.4-4 3-4s3 1.7 3 4" /></>,
  coracao: <><path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" /></>,
  festa: <><path d="M4 20l5-12 7 7-12 5Z" /><path d="M14 4v.01M18 7v.01M20 12v.01M16 11l2-2" /></>,
  estrela: <><path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3Z" /></>,
  pet: <><ellipse cx="7" cy="9" rx="1.7" ry="2.3" /><ellipse cx="12" cy="7" rx="1.7" ry="2.5" /><ellipse cx="17" cy="9" rx="1.7" ry="2.3" /><path d="M12 12c-3 0-5 2-5 4.3C7 18.4 9 19 12 19s5-.6 5-2.7C17 14 15 12 12 12Z" /></>,

  /* serviço */
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  escudo: <><path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
  telefone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" /></>,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  carro: <><path d="M4 16v3M20 16v3" /><path d="M3 16v-3l2-5h14l2 5v3H3Z" /><circle cx="7.5" cy="16" r="1.5" /><circle cx="16.5" cy="16" r="1.5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
} as const;

/** Nomes válidos, para o seletor do admin. */
export const ICONES = Object.keys(CAMINHOS) as NomeIcone[];

export function Icone({ nome, tamanho = 22, className = "" }: {
  nome: string; tamanho?: number; className?: string;
}) {
  const caminho = CAMINHOS[nome as NomeIcone] ?? CAMINHOS.check;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden className={className} {...T}>
      {caminho}
    </svg>
  );
}

/**
 * Cores dos ícones.
 *
 * Fixas, não derivadas da marca: a graça de uma grade de oito é a variedade,
 * e oito tons da mesma cor de marca viram oito cartões iguais. Todas foram
 * escolhidas escuras o bastante para o ícone ler sobre o próprio fundo claro.
 */
export const CORES_ICONE = {
  marca:   { fundo: "var(--marca-sutil)", tinta: "var(--marca)" },
  acento:  { fundo: "color-mix(in oklab, var(--acento), white 90%)", tinta: "var(--acento)" },
  areia:   { fundo: "var(--areia)", tinta: "#8a5a22" },
  mar:     { fundo: "#e3f0f6", tinta: "#1d6c8c" },
  mata:    { fundo: "#e6f1e6", tinta: "#2f6b3d" },
  coral:   { fundo: "#fdeae5", tinta: "#c1512f" },
  sol:     { fundo: "#fdf1dc", tinta: "#a5741a" },
  noite:   { fundo: "#e8eaf2", tinta: "#3a4370" },
} as const;

export type NomeCor = keyof typeof CORES_ICONE;
export const CORES = Object.keys(CORES_ICONE) as NomeCor[];

/** Ícone dentro do círculo colorido — o formato usado nos cartões da home. */
export function IconeCirculo({ nome, cor = "marca", tamanho = 44 }: {
  nome: string; cor?: string; tamanho?: number;
}) {
  const c = CORES_ICONE[cor as NomeCor] ?? CORES_ICONE.marca;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: tamanho, height: tamanho, backgroundColor: c.fundo, color: c.tinta }}
    >
      <Icone nome={nome} tamanho={Math.round(tamanho * 0.5)} />
    </span>
  );
}

/**
 * Ornamento de ondas usado sob os títulos de seção.
 *
 * É o elemento que amarra a identidade: aparece sempre no mesmo lugar e no
 * mesmo tamanho, então a página inteira passa a ter um ritmo reconhecível
 * em vez de títulos soltos.
 */
export function OndaTitulo({ className = "" }: { className?: string }) {
  return (
    <svg width="46" height="10" viewBox="0 0 46 10" aria-hidden
      className={`text-acento ${className}`} fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round">
      <path d="M1 6c3-4 6.5-4 9.5 0s6.5 4 9.5 0 6.5-4 9.5 0 6.5 4 9.5 0" opacity="0.95" />
    </svg>
  );
}
