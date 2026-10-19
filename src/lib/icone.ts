/**
 * Versão do ícone do site: muda quando a logo ou o favicon mudam, e vai no
 * endereço (`?v=`). Assim o navegador busca o ícone novo em vez de guardar o
 * velho (src/app/marca/icone/[tamanho]/route.tsx).
 */
export function versaoIcone(p: Record<string, unknown> | null): string {
  const base = `${p?.favicon_url ?? ""}|${p?.logo_url ?? ""}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
