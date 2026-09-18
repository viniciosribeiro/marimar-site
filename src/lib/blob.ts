/**
 * Armazenamento de imagens (Vercel Blob).
 *
 * `blobConfigurado()` roda no servidor e serve para a tela de admin avisar
 * o que falta em vez de mostrar um botao que sempre da erro.
 */
export function blobConfigurado(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Caminho do arquivo no storage. Sem acento e sem espaco. */
export function caminhoFoto(pasta: string, id: string, nomeArquivo: string): string {
  const limpo = nomeArquivo
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-60);
  return `${pasta}/${id}/${limpo}`;
}

export const LIMITE_BYTES = 12 * 1024 * 1024;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];
