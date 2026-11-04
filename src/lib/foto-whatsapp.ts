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
      u.pathname.length > 1 && !u.pathname.includes("..");
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

/** Endereço seguro de uma foto de seção (café, restaurante, praia, pousada) para o WhatsApp. */
export function urlFotoSecaoWhatsapp(secao: string, indice: number): string {
  if (!/^[a-z]{3,20}$/.test(secao) || !Number.isInteger(indice) || indice < 0 || indice >= MAX_FOTOS_WHATSAPP) {
    throw new Error("Foto de seção inválida");
  }
  return `${BASE_FOTOS_MARIMAR}/api/midia-secao/${secao}/${indice}`;
}

/**
 * Baixa uma foto aprovada e devolve os bytes já conferidos (tipo e
 * assinatura do arquivo). Tenta a origem e, se for o Desbravador, o cache
 * do otimizador do próprio site. null = nenhuma fonte serviu.
 */
export async function lerBytesDaFoto(fonte: string): Promise<{ buffer: Buffer; tipo: string; fonteUsada: "origem" | "cache-site" } | null> {
  if (!origemFotoPermitida(fonte)) return null;
  const caminhos: [string, "origem" | "cache-site"][] = [[fonte, "origem"]];
  if (new URL(fonte).hostname === "reservas.desbravador.com.br") caminhos.push([urlOtimizadaFoto(fonte), "cache-site"]);

  for (const [url, fonteUsada] of caminhos) {
    try {
      const resposta = await fetch(url, {
        headers: { Accept: "image/jpeg,image/png,image/webp" },
        signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store",
      });
      if (!resposta.ok || !resposta.body) continue;
      const tipo = tipoFotoPermitido(resposta.headers.get("content-type"));
      if (!tipo) continue;
      if (Number(resposta.headers.get("content-length") || "0") > MAX_BYTES_FOTO) continue;

      const leitor = resposta.body.getReader();
      const pedacos: Uint8Array[] = [];
      let total = 0, grande = false;
      try {
        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_BYTES_FOTO) { grande = true; break; }
          pedacos.push(value);
        }
      } finally {
        if (grande) await leitor.cancel().catch(() => {});
      }
      if (grande || total < 16) continue;

      const buffer = Buffer.concat(pedacos.map((p) => Buffer.from(p)), total);
      const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
      if ((tipo === "image/jpeg" && !jpeg) || (tipo === "image/png" && !png) || (tipo === "image/webp" && !webp)) continue;
      return { buffer, tipo, fonteUsada };
    } catch (e) {
      console.warn("[foto-whatsapp] fonte indisponível:", fonteUsada, (e as Error).message);
    }
  }
  return null;
}

/** A resposta HTTP de uma foto para o WhatsApp, com os cabeçalhos certos. */
export function respostaDaFoto(foto: { buffer: Buffer; tipo: string; fonteUsada: string }, nomeArquivo: string): Response {
  const ext = foto.tipo === "image/png" ? "png" : foto.tipo === "image/webp" ? "webp" : "jpg";
  return new Response(new Uint8Array(foto.buffer), {
    headers: {
      "content-type": foto.tipo,
      "content-length": String(foto.buffer.length),
      "content-disposition": `inline; filename="${nomeArquivo}.${ext}"`,
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
      "x-marimar-foto-fonte": foto.fonteUsada,
    },
  });
}
