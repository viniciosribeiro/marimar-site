/**
 * Itens dos blocos da home.
 *
 * Os cartoes de "Um complexo, duas partes" e de "O que esta incluso" moram
 * em `blocos_itens`. Sem nenhuma linha para um bloco, valem as constantes de
 * `conteudo-pousada.ts` — quem nunca abrir a tela do admin nao perde o
 * conteudo que ja estava no ar.
 */

export type ItemBloco = {
  id: string;
  icone: string | null;
  cor: string;
  titulo: string;
  texto: string | null;
  imagem_url: string | null;
  href: string | null;
  cta_texto: string | null;
};

/** Agrupa as linhas por TIPO do bloco, que e como a home as consome. */
export function agruparItens(linhas: any[]): Record<string, ItemBloco[]> {
  const mapa: Record<string, ItemBloco[]> = {};
  for (const l of linhas) {
    const tipo = String(l.tipo);
    (mapa[tipo] ??= []).push({
      id: String(l.id),
      icone: l.icone ?? null,
      cor: l.cor ?? "marca",
      titulo: String(l.titulo),
      texto: l.texto ?? null,
      imagem_url: l.imagem_url ?? null,
      href: l.href ?? null,
      cta_texto: l.cta_texto ?? null,
    });
  }
  return mapa;
}
