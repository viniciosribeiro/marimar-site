/**
 * URLs publicas de fotos da Marimar para envio como midia no WhatsApp.
 * O OpenClaw nao deve baixar arquivos do Desbravador diretamente (HTTP 403).
 * Somente fotos publicadas para a Marina no banco podem ser retransmitidas.
 */
export const BASE_FOTOS_MARIMAR = "https://www.pousadamarimarilhadomel.com.br";

export const MAX_FOTOS_WHATSAPP = 6;
export const MAX_BYTES_FOTO = 10 * 1024 * 1024;

export function slugFotoValido(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug);
}

export function indiceFotoValido(indice: string): number | null {
  if (!/^(0|[1-5])$/.test(indice)) return null;
  return Number(indice);
}

export function urlFotoWhatsapp(slug: string, indice: number): string {
  if (!slugFotoValido(slug) || !Number.isInteger(indice) || indice < 0 || indice >= MAX_FOTOS_WHATSAPP) {
    throw new Error("Foto da Marina invalida");
  }
  return `${BASE_FOTOS_MARIMAR}/api/midia-quarto/${slug}/${indice}`;
}

/** Impede SSRF: a URL vem do banco, mas o painel pode receber links externos. */
export function origemFotoPermitida(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.port || u.username || u.password || u.search || u.hash) return false;
    if (u.hostname === "reservas.desbravador.com.br") {
      return /^\/reservas\/images\/hoteis\/[a-zA-Z0-9_./-]+\.(jpe?g|png|webp)$/i.test(u.pathname) && !u.pathname.includes("..");
    }
    return /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname) &&
      u.pathname.startsWith("/midias/") && !u.pathname.includes("..");
  } catch { return false; }
}

export function tipoFotoPermitido(tipo: string | null): string | null {
  const base = (tipo ?? "").split(";")[0].trim().toLowerCase();
  return ["image/jpeg", "image/png", "image/webp"].includes(base) ? base : null;
}

export function urlOtimizadaFoto(original: string): string {
  const params = new URLSearchParams({ url: original, w: "1080", q: "75" });
  return `${BASE_FOTOS_MARIMAR}/_next/image?${params.toString()}`;
}
