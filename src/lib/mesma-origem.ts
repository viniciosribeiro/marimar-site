/**
 * O pedido veio do próprio site? (para rotas POST do painel que não são
 * Server Action — essas conferem sozinhas.) Atrás do proxy da Vercel o host
 * pode vir em mais de um cabeçalho (e em lista): vale se a origem bater com
 * qualquer um. Sem Origin, deixa passar: o cookie de sessão (SameSite=Lax)
 * já não viaja de outro site.
 */
export function mesmaOrigem(req: Request): boolean {
  const origem = req.headers.get("origin");
  if (!origem) return true;
  let deOnde: string;
  try { deOnde = new URL(origem).host.toLowerCase(); } catch { return false; }
  let daUrl = "";
  try { daUrl = new URL(req.url).host; } catch { /* sem URL completa */ }
  const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host"), daUrl]
    .flatMap((h) => (h ?? "").split(","))
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return hosts.length === 0 || hosts.includes(deOnde);
}
