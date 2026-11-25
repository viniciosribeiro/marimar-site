import { comEnderecoOficial, ehFotoNossa, ehVideoNosso } from "./endereco-oficial";

/**
 * Como uma linha da resposta da Marina vira o que aparece no chat.
 *
 * A regra combinada com ela é "cada foto em markdown, numa linha sozinha".
 * Mas ela é um modelo de linguagem: às vezes põe um marcador de lista antes,
 * escreve a legenda na mesma linha, manda o endereço solto ou como link. Antes
 * (até 25/11) qualquer desvio fazia a foto aparecer como link — o hóspede via
 * um endereço comprido no lugar da imagem. Aqui a foto aparece em todos esses
 * casos; o que não é mídia nossa continua texto.
 *
 * Função pura (sem React), para ter teste: `Marcacao.tsx` só desenha.
 */

export type Bloco =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; url: string; alt: string }
  | { tipo: "video"; url: string; alt: string };

/* imagem em markdown | link em markdown | endereço solto */
const PADRAO = /!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>"]+)/g;

/** Sobra que não diz nada: marcador de lista, número, pontuação solta. */
const SO_MARCADOR = /^[\s\-–—*•·>\d.):,;|]*$/;

/** Pontuação grudada no fim de um endereço solto ("…/suite-queen."). */
export function semPontuacaoFinal(url: string): { url: string; resto: string } {
  let fim = url.length;
  while (fim > 0) {
    const c = url[fim - 1];
    if (".,;:!?".includes(c) || (c === ")" && !url.slice(0, fim).includes("("))) fim--;
    else break;
  }
  return { url: url.slice(0, fim), resto: url.slice(fim) };
}

export function blocosDaLinha(linhaCrua: string): Bloco[] {
  const linha = comEnderecoOficial(linhaCrua);
  const blocos: Bloco[] = [];
  let texto = "";
  const fecharTexto = () => {
    if (!SO_MARCADOR.test(texto)) blocos.push({ tipo: "texto", texto: texto.trim() });
    texto = "";
  };
  const midia = (url: string, alt: string) => {
    fecharTexto();
    blocos.push({ tipo: ehVideoNosso(url) ? "video" : "imagem", url, alt: alt.trim() });
  };

  let ultimo = 0;
  PADRAO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PADRAO.exec(linha)) !== null) {
    texto += linha.slice(ultimo, m.index);
    ultimo = m.index + m[0].length;
    if (m[2] !== undefined) {
      midia(m[2], m[1]);                                   // ![alt](url): sempre mídia
    } else if (m[4] !== undefined) {
      if (ehFotoNossa(m[4]) || ehVideoNosso(m[4])) midia(m[4], m[3]);  // [texto](foto nossa)
      else texto += m[0];                                  // link comum: fica no texto
    } else {
      const { url } = semPontuacaoFinal(m[5]);
      /* "![legenda](https://…" ainda sem o ")" é uma foto chegando (a resposta
         vem aos poucos): fica como texto até fechar, para não piscar. */
      const chegando = linha.slice(0, m.index).endsWith("](");
      if (!chegando && (ehFotoNossa(url) || ehVideoNosso(url))) midia(url, "");   // a pontuação grudada some junto
      else texto += m[0];
    }
  }
  texto += linha.slice(ultimo);
  fecharTexto();

  /* Linha sem mídia nenhuma: devolve como veio (com o recuo e os marcadores). */
  if (blocos.every((b) => b.tipo === "texto")) return [{ tipo: "texto", texto: linha }];
  return blocos;
}

/** A resposta inteira, linha a linha. */
export function blocosDaResposta(texto: string): Bloco[][] {
  return texto.split("\n").map(blocosDaLinha);
}
