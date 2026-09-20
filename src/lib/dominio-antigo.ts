import postgres from "postgres";

/**
 * Quantas imagens ainda dependem do WordPress anterior.
 *
 * Existe para tornar VISÍVEL um problema que é invisível até o dia em que
 * explode: hoje essas fotos carregam normalmente, porque o servidor antigo
 * ainda está de pé. Na virada de DNS ele sai do ar e todas somem juntas —
 * topo da home, galeria, fotos de quarto, e as fotos que a Marina manda.
 *
 * O contador vive no Diagnóstico para que a conferência depois da migração
 * seja olhar um número, e não confiar que o script fez o que disse.
 */
export const DOMINIOS_ANTIGOS = [
  "pousadamarimarilhadomel.com.br",
  "pousadamarimar.com.br",
];

const ALVOS: { tabela: string; coluna: string }[] = [
  { tabela: "midias", coluna: "url" },
  { tabela: "pousada", coluna: "logo_url" },
  { tabela: "pousada", coluna: "favicon_url" },
  { tabela: "pousada", coluna: "og_image_url" },
  { tabela: "pacotes", coluna: "imagem_url" },
  { tabela: "blocos_home", coluna: "imagem_url" },
  { tabela: "passeios", coluna: "imagem_url" },
  { tabela: "cardapio_itens", coluna: "foto_url" },
  { tabela: "cardapio_fotos", coluna: "url" },
  { tabela: "banners", coluna: "imagem_url" },
  { tabela: "banners", coluna: "video_url" },
  { tabela: "blocos_itens", coluna: "imagem_url" },
];

export async function contarDominioAntigo(
  sql: ReturnType<typeof postgres>,
): Promise<{ total: number; porLugar: { onde: string; quantas: number }[] }> {
  const filtro = DOMINIOS_ANTIGOS.map((d) => `%${d}%`);
  const porLugar: { onde: string; quantas: number }[] = [];
  let total = 0;

  for (const a of ALVOS) {
    try {
      const [{ n }] = await sql<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM ${sql(a.tabela)}
        WHERE ${sql(a.coluna)} LIKE ANY(${filtro})`;
      if (n > 0) {
        porLugar.push({ onde: `${a.tabela}.${a.coluna}`, quantas: n });
        total += n;
      }
    } catch {
      // Coluna ou tabela que ainda nao existe neste banco: ignorar uma nao
      // pode impedir a contagem das outras.
    }
  }
  return { total, porLugar };
}
