/**
 * Busca por assunto dentro dos documentos da Marina.
 *
 * O documento é dividido em trechos (por parágrafo, até ~800 caracteres) e
 * cada trecho recebe uma nota pelas palavras da busca que contém. É o
 * "índice" do documento: a Marina pergunta "estacionamento" e recebe os
 * três trechos que falam disso, em vez de ler um PDF de 40 páginas.
 *
 * Sem banco vetorial de propósito: para dezenas de documentos de uma
 * pousada, contar palavras resolve, não custa nada por consulta e não
 * depende de outro serviço que pode cair.
 */

const PARADAS = new Set([
  "para", "com", "sem", "que", "uma", "uns", "umas", "dos", "das", "nos", "nas",
  "pelo", "pela", "como", "mais", "tem", "ter", "voces", "voce", "qual", "quais",
  "quando", "onde", "sobre", "isso", "esse", "essa", "este", "esta", "pousada",
]);

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function palavrasDaBusca(busca: string): string[] {
  return [...new Set(
    normalizar(busca).split(/[^a-z0-9]+/).filter((p) => p.length >= 3 && !PARADAS.has(p)),
  )];
}

/** Divide o texto em trechos de tamanho de leitura, sem cortar parágrafo ao meio quando dá. */
export function dividirEmTrechos(texto: string, max = 800): string[] {
  const paragrafos = texto.split(/\n\s*\n|\r\n\s*\r\n/).map((p) => p.trim()).filter(Boolean);
  const trechos: string[] = [];
  let atual = "";
  for (const p of paragrafos) {
    if (p.length > max) {
      if (atual) { trechos.push(atual); atual = ""; }
      for (let i = 0; i < p.length; i += max) trechos.push(p.slice(i, i + max));
      continue;
    }
    if ((atual + "\n\n" + p).length > max && atual) { trechos.push(atual); atual = p; }
    else atual = atual ? atual + "\n\n" + p : p;
  }
  if (atual) trechos.push(atual);
  return trechos;
}

export type Achado = { documento: string; titulo: string; trecho: string; nota: number };

/** Os melhores trechos de todos os documentos para a busca. */
export function buscarNosDocumentos(
  docs: { id: string; nome: string; assunto: string | null; texto: string | null }[],
  busca: string,
  limite = 5,
): Achado[] {
  const palavras = palavrasDaBusca(busca);
  if (!palavras.length) return [];
  const achados: Achado[] = [];
  for (const d of docs) {
    if (!d.texto) continue;
    for (const trecho of dividirEmTrechos(d.texto)) {
      const n = normalizar(trecho);
      let nota = 0;
      for (const p of palavras) {
        const vezes = n.split(p).length - 1;
        if (vezes) nota += 1 + Math.min(vezes, 3) * 0.2; // cobrir mais palavras vale mais que repetir uma
      }
      if (nota > 0) achados.push({ documento: d.id, titulo: d.assunto ?? d.nome, trecho, nota });
    }
  }
  return achados.sort((a, b) => b.nota - a.nota).slice(0, limite);
}
