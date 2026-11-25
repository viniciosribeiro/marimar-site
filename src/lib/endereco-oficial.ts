/**
 * O endereço que o hóspede vê.
 *
 * O site responde em dois endereços: o oficial (o domínio da pousada) e o
 * técnico da Vercel (`marimar-site.vercel.app`), que existe para as consultas
 * internas da Marina e para testes. Em setembro o domínio da pousada ainda
 * mostrava o site antigo, e a Marina foi ensinada a usar só o da Vercel. O
 * domínio mudou de dono em outubro e a regra ficou ao contrário — em 25/11 ela
 * ainda mandava hóspede para `marimar-site.vercel.app`.
 *
 * Este arquivo é a rede de segurança: qualquer texto que vá para a tela (ou
 * para o WhatsApp) passa por `comEnderecoOficial`, e o endereço técnico vira o
 * oficial. Sem nada de servidor: o chat do navegador também usa.
 */

/** Domínio oficial; o mesmo de `SITE_PADRAO` (src/lib/seo.ts), do sitemap e das fotos. */
export const SITE_OFICIAL = "https://www.pousadamarimarilhadomel.com.br";

const TECNICO = /https?:\/\/(?:marimar-site(?:-[a-z0-9-]+)?\.vercel\.app|(?:www\.)?pousadamarimarilhadomel\.com\.br)(?=[/?#\s)\]"'<>,;:!]|\.(?:\s|$)|$)/gi;

/** Troca o endereço técnico da Vercel (e o domínio sem `www` ou com `http`) pelo oficial. */
export function comEnderecoOficial(texto: string): string {
  return texto.replace(TECNICO, SITE_OFICIAL);
}

/* ── o que é mídia nossa ─────────────────────────────────────────────
   Endereço solto no meio do texto só vira foto ou player se for do nosso
   sistema: um chat que mostra imagem de qualquer endereço é convite a abuso. */

const FOTO_ROTA = /^https:\/\/www\.pousadamarimarilhadomel\.com\.br\/api\/midia-(?:quarto|secao)\/[a-z0-9-]{1,80}\/\d$/;
const FOTO_BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/\S+\.(?:jpe?g|png|webp|avif)(?:\?\S*)?$/i;
const VIDEO_BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/\S+\.(?:mp4|webm|mov|m4v)(?:\?\S*)?$/i;

/** Foto servida pelo nosso site (suíte ou seção) ou guardada no nosso armazenamento. */
export function ehFotoNossa(url: string): boolean {
  return FOTO_ROTA.test(url) || FOTO_BLOB.test(url);
}

/** Vídeo do nosso armazenamento (o único lugar de onde o player toca). */
export function ehVideoNosso(url: string): boolean {
  return VIDEO_BLOB.test(url);
}
