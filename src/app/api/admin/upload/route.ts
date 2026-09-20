import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Emissao do token de upload direto para o Vercel Blob.
 *
 * O arquivo NAO passa por aqui: o navegador envia direto para o storage.
 * Isso evita o limite de corpo de requisicao da funcao serverless (~4,5 MB),
 * que impediria fotos de celular — uma foto moderna passa disso com folga.
 *
 * Esta rota so decide QUEM pode enviar e O QUE pode ser enviado. A checagem
 * de sessao acontece dentro de onBeforeGenerateToken, antes de qualquer
 * token ser gerado: sem ela, a rota seria um upload aberto na internet.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Armazenamento de imagens não configurado. Falta BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const resultado = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const sessao = await auth();
        if (!sessao?.user) throw new Error("Não autorizado");

        // Nunca aceitar caminho arbitrario vindo do cliente
        const pastasPermitidas = ["banners/", "cardapio/", "galeria/", "marca/", "marina/", "quartos/"];
        if (!pastasPermitidas.some((pasta) => pathname.startsWith(pasta))) {
          throw new Error("Destino de upload inválido");
        }

        /* Video so e aceito em `banners/`, e com limite proprio.
           Nao e generosidade: um mp4 de fundo de topo passa de 12 MB com
           facilidade, enquanto uma foto de cardapio que chegue perto disso
           quase sempre e um arquivo que ninguem otimizou. Limites diferentes
           para usos diferentes. */
        const ehBanner = pathname.startsWith("banners/");
        /* `marina/` e a base de conhecimento: documento, nao foto de site.
           Aceita PDF, Word e texto alem de imagem, com teto maior — um
           contrato ou um cardapio escaneado passa de 12 MB sem esforco. */
        const ehDocumento = pathname.startsWith("marina/");
        const imagens = [
          "image/jpeg", "image/png", "image/webp", "image/avif",
          "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon",
        ];
        const videos = ["video/mp4", "video/webm"];
        const documentos = [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "text/plain", "text/markdown", "text/csv",
        ];

        return {
          allowedContentTypes: ehBanner
            ? [...imagens, ...videos]
            : ehDocumento
              ? [...imagens, ...documentos]
              : imagens,
          maximumSizeInBytes: (ehBanner ? 50 : ehDocumento ? 25 : 12) * 1024 * 1024,
          addRandomSuffix: true,
          // Fotos de cardapio mudam pouco: cache longo na borda
          cacheControlMaxAge: 60 * 60 * 24 * 365,
          tokenPayload: JSON.stringify({ por: sessao.user.email ?? "admin" }),
        };
      },
      // Nao usamos para gravar no banco: a Vercel nao consegue chamar de volta
      // um localhost, entao em desenvolvimento nunca dispararia. Quem grava e
      // o cliente, chamando a server action com a url devolvida pelo upload.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(resultado);
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: msg === "Não autorizado" ? 401 : 400 });
  }
}
