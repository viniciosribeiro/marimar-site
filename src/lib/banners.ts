/**
 * Banners do topo — modelo e derivacoes.
 *
 * O banco guarda ESCOLHAS ("esquerda-base", "vinheta", "grao"). Tudo que é
 * CSS nasce aqui. O mesmo motivo do alinhamento do tema: uma escolha vira
 * varias consequencias (posicao do bloco, alinhamento do texto, direcao do
 * veu), e espalha-las pelos componentes garantiria que uma ficasse para trás.
 *
 * E a mesma funcao alimenta o site e a previa do admin — por isso a previa
 * nao pode mentir sobre o resultado.
 */

export type Banner = {
  id: string;

  // Midia
  tipo_midia: "imagem" | "video";
  imagem_url: string;
  video_url: string | null;
  alt: string | null;
  foco_x: number;
  foco_y: number;
  video_no_celular: boolean;

  // Forma
  altura: "compacto" | "medio" | "alto" | "tela";
  posicao: Posicao;
  largura_texto: "estreita" | "media" | "larga";
  centralizar_celular: boolean;

  // Camadas
  veu: "nenhum" | "escuro" | "escuro-baixo" | "claro-esquerda" | "vinheta";
  veu_forca: number;
  textura: "nenhuma" | "grao" | "pontos" | "linhas";
  textura_forca: number;

  // Conteudo
  rotulo: string | null;
  titulo: string | null;
  subtitulo: string | null;
  texto: string | null;
  cta_texto: string | null;
  cta_href: string | null;
  cta2_texto: string | null;
  cta2_href: string | null;
  cor_texto: "claro" | "escuro";
  sombra_texto: boolean;

  // Movimento
  animacao: "nenhuma" | "fade" | "subir" | "zoom";
  ken_burns: boolean;
};

export type Posicao =
  | "esquerda-topo" | "centro-topo" | "direita-topo"
  | "esquerda-meio" | "centro-meio" | "direita-meio"
  | "esquerda-base" | "centro-base" | "direita-base";

export const POSICOES: Posicao[] = [
  "esquerda-topo", "centro-topo", "direita-topo",
  "esquerda-meio", "centro-meio", "direita-meio",
  "esquerda-base", "centro-base", "direita-base",
];

/* ─────────────────────── derivacoes ─────────────────────── */

/**
 * `100svh` e nao `100vh` no "tela cheia".
 *
 * No celular, `100vh` conta a barra do navegador que aparece e some: o
 * banner ficava mais alto que a tela e empurrava a busca de
 * disponibilidade para fora. `svh` usa a altura MENOR, a que sempre existe.
 */
export const ALTURAS: Record<Banner["altura"], string> = {
  compacto: "min-h-[22rem] sm:min-h-[26rem]",
  medio: "min-h-[28rem] sm:min-h-[34rem]",
  alto: "min-h-[34rem] sm:min-h-[42rem]",
  tela: "min-h-[100svh]",
};

export const LARGURAS: Record<Banner["largura_texto"], string> = {
  estreita: "max-w-md",
  media: "max-w-2xl",
  larga: "max-w-4xl",
};

/** Posicao do bloco dentro do banner + alinhamento do texto dentro dele. */
export function posicaoClasses(p: Posicao, centralizarNoCelular: boolean) {
  const [h, v] = p.split("-") as ["esquerda" | "centro" | "direita", "topo" | "meio" | "base"];

  const vertical = { topo: "justify-start pt-20", meio: "justify-center", base: "justify-end pb-20" }[v];

  /* No celular o bloco vai para o centro quando pedido. Nao e capricho: a
     coluna e estreita demais para um texto encostado num canto parecer
     intencional — parece erro de layout. */
  const horizontal = {
    esquerda: centralizarNoCelular ? "items-center sm:items-start" : "items-start",
    centro: "items-center",
    direita: centralizarNoCelular ? "items-center sm:items-end" : "items-end",
  }[h];

  const texto = {
    esquerda: centralizarNoCelular ? "text-center sm:text-left" : "text-left",
    centro: "text-center",
    direita: centralizarNoCelular ? "text-center sm:text-right" : "text-right",
  }[h];

  const botoes = {
    esquerda: centralizarNoCelular ? "justify-center sm:justify-start" : "justify-start",
    centro: "justify-center",
    direita: centralizarNoCelular ? "justify-center sm:justify-end" : "justify-end",
  }[h];

  return { vertical, horizontal, texto, botoes };
}

/**
 * O veu. `forca` e 0–100 e vira a opacidade do preto (ou do branco).
 *
 * "escuro-baixo" e o padrao porque o texto quase sempre fica embaixo e essa
 * e a unica variante que escurece onde o texto esta sem apagar a foto
 * inteira — o erro mais comum em banner e matar a imagem para salvar o texto.
 */
export function veuCss(veu: Banner["veu"], forca: number): string | undefined {
  const a = Math.max(0, Math.min(100, forca)) / 100;
  const preto = (o: number) => `rgb(0 0 0 / ${(o * a).toFixed(3)})`;
  const branco = (o: number) => `rgb(255 255 255 / ${(o * a).toFixed(3)})`;

  switch (veu) {
    case "nenhum": return undefined;
    case "escuro": return `linear-gradient(${preto(1)}, ${preto(1)})`;
    case "escuro-baixo":
      return `linear-gradient(to bottom, ${preto(0.25)} 0%, ${preto(0.55)} 45%, ${preto(1.15)} 100%)`;
    case "claro-esquerda":
      return `linear-gradient(to right, ${branco(1.25)} 0%, ${branco(0.8)} 45%, ${branco(0.1)} 100%)`;
    case "vinheta":
      return `radial-gradient(ellipse at center, ${preto(0.15)} 0%, ${preto(0.6)} 55%, ${preto(1.25)} 100%)`;
  }
}

/**
 * Texturas em CSS puro — nenhuma imagem baixada.
 *
 * O grao usa `feTurbulence` num SVG embutido: e o unico jeito de ter ruido
 * real sem um arquivo. Os outros dois sao gradientes repetidos.
 */
export function texturaCss(textura: Banner["textura"], forca: number) {
  const o = Math.max(0, Math.min(100, forca)) / 100;
  if (textura === "nenhuma" || o === 0) return undefined;

  if (textura === "grao") {
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
      `<filter id='r'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter>` +
      `<rect width='160' height='160' filter='url(%23r)' opacity='1'/></svg>`;
    return { backgroundImage: `url("data:image/svg+xml,${svg}")`, opacity: o * 0.55 };
  }

  if (textura === "pontos") {
    return {
      backgroundImage: "radial-gradient(rgb(255 255 255 / 0.9) 1px, transparent 1px)",
      backgroundSize: "14px 14px",
      opacity: o * 0.35,
    };
  }

  return {
    backgroundImage:
      "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.9) 0 1px, transparent 1px 9px)",
    opacity: o * 0.25,
  };
}

/** Classe de animacao de entrada do conteudo. Ver keyframes no globals.css. */
export const ANIMACOES: Record<Banner["animacao"], string> = {
  nenhuma: "",
  fade: "anim-banner-fade",
  subir: "anim-banner-subir",
  zoom: "anim-banner-zoom",
};

/**
 * Completa uma linha do banco com os padroes.
 *
 * Existe por dois motivos concretos: entre o deploy e a migration 0006 as
 * colunas novas ainda nao existem, e um banner criado antes dela nunca teve
 * esses valores. Sem este merge, `ALTURAS[undefined]` devolveria uma classe
 * vazia e o banner apareceria com altura zero — invisivel, sem erro nenhum
 * no log para explicar.
 *
 * `?? padrao` e nao `||`: `veu_forca: 0` e uma escolha legitima.
 */
export function lerBanner(linha: Record<string, any>): Banner {
  const b: any = { ...BANNER_PADRAO, id: String(linha.id) };
  for (const chave of Object.keys(BANNER_PADRAO) as (keyof typeof BANNER_PADRAO)[]) {
    const v = linha[chave];
    if (v !== undefined && v !== null) b[chave] = v;
  }
  return b as Banner;
}

/** Valores de um banner novo — tambem usados como padrao na previa. */
export const BANNER_PADRAO: Omit<Banner, "id"> = {
  tipo_midia: "imagem",
  imagem_url: "",
  video_url: null,
  alt: null,
  foco_x: 50,
  foco_y: 50,
  video_no_celular: false,
  altura: "alto",
  posicao: "centro-meio",
  largura_texto: "media",
  centralizar_celular: true,
  veu: "escuro-baixo",
  veu_forca: 55,
  textura: "nenhuma",
  textura_forca: 18,
  rotulo: null,
  titulo: null,
  subtitulo: null,
  texto: null,
  cta_texto: null,
  cta_href: null,
  cta2_texto: null,
  cta2_href: null,
  cor_texto: "claro",
  sombra_texto: true,
  animacao: "subir",
  ken_burns: false,
};
