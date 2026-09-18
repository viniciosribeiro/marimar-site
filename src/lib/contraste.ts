/**
 * Verificacao de contraste (WCAG 2.1) para o editor visual.
 *
 * O editor deixa escolher qualquer cor, e algumas combinacoes deixam o texto
 * ilegivel — um amarelo claro como cor de marca produz botao branco sobre
 * amarelo, que nao se le no celular ao sol. Em vez de bloquear a escolha,
 * avisamos e sugerimos o texto que funciona.
 */

function hexParaRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Luminancia relativa conforme a WCAG. */
function luminancia(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razao de contraste entre duas cores: 1 (nenhum) a 21 (maximo). */
export function razaoContraste(corA: string, corB: string): number | null {
  const a = hexParaRgb(corA);
  const b = hexParaRgb(corB);
  if (!a || !b) return null;
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Qual cor de texto se le melhor sobre esse fundo. */
export function textoIdeal(fundo: string): "#ffffff" | "#111827" {
  const comBranco = razaoContraste(fundo, "#ffffff") ?? 0;
  const comEscuro = razaoContraste(fundo, "#111827") ?? 0;
  return comBranco >= comEscuro ? "#ffffff" : "#111827";
}

export type Diagnostico = {
  razao: number;
  nivel: "AAA" | "AA" | "AA-grande" | "insuficiente";
  ok: boolean;
  mensagem: string;
};

/**
 * Avalia a cor de marca como fundo de botao com texto branco — o uso mais
 * comum e mais critico no site.
 */
export function avaliarCorDeMarca(cor: string): Diagnostico | null {
  const texto = textoIdeal(cor);
  const razao = razaoContraste(cor, texto);
  if (razao === null) return null;

  const r = Math.round(razao * 10) / 10;
  const usaBranco = texto === "#ffffff";

  if (razao >= 7) {
    return { razao: r, nivel: "AAA", ok: true, mensagem: `Contraste excelente (${r}:1) com texto ${usaBranco ? "branco" : "escuro"}.` };
  }
  if (razao >= 4.5) {
    return { razao: r, nivel: "AA", ok: true, mensagem: `Contraste bom (${r}:1) com texto ${usaBranco ? "branco" : "escuro"}.` };
  }
  if (razao >= 3) {
    return {
      razao: r, nivel: "AA-grande", ok: false,
      mensagem: `Contraste baixo (${r}:1). Serve para títulos grandes, mas botões e textos pequenos ficam difíceis de ler. Escureça um pouco a cor.`,
    };
  }
  return {
    razao: r, nivel: "insuficiente", ok: false,
    mensagem: `Contraste insuficiente (${r}:1). O texto sobre esta cor fica ilegível, principalmente no celular sob o sol. Escolha um tom mais escuro.`,
  };
}
