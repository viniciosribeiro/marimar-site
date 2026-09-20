/**
 * Tira o texto de um arquivo enviado pelo painel.
 *
 * A Marina não abre PDF nem Word: o que ela lê é texto. Toda a utilidade de
 * "mandar um documento para ensinar" depende desta conversão — e de ela
 * falhar com uma explicação em português, e não com um erro técnico numa
 * tela que a Cecília usa sozinha.
 */

export type Extracao = { texto: string; aviso?: string };

/** Teto de texto por documento. Acima disso é livro, não material de consulta. */
export const LIMITE_TEXTO = 120_000;

/** O que entra no contexto de TODA conversa. Curto de propósito. */
export const LIMITE_TRECHO = 900;

function limpar(bruto: string): string {
  return bruto
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITE_TEXTO);
}

export async function extrairTexto(
  arquivo: ArrayBuffer,
  tipo: string,
  nome: string,
): Promise<Extracao> {
  const ext = nome.toLowerCase().split(".").pop() ?? "";

  // ── texto puro ───────────────────────────────────────────────
  if (tipo.startsWith("text/") || ["txt", "md", "csv"].includes(ext)) {
    return { texto: limpar(new TextDecoder().decode(arquivo)) };
  }

  // ── PDF ──────────────────────────────────────────────────────
  if (tipo === "application/pdf" || ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(arquivo));
    const { text } = await extractText(pdf, { mergePages: true });
    const limpo = limpar(Array.isArray(text) ? text.join("\n\n") : text);

    /* PDF escaneado é imagem dentro de um PDF: sai vazio e ninguém entende
       por quê. Dizer isso, com a saída prática, vale mais que um erro. */
    if (limpo.length < 40) {
      return {
        texto: "",
        aviso:
          "Este PDF parece ser escaneado (imagem, sem texto dentro). " +
          "Envie as páginas como foto, que aí eu consigo ler.",
      };
    }
    return { texto: limpo };
  }

  // ── Word ─────────────────────────────────────────────────────
  if (ext === "docx" || tipo.includes("wordprocessingml")) {
    const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(arquivo) });
    return { texto: limpar(value) };
  }

  if (ext === "doc") {
    return {
      texto: "",
      aviso: "Arquivo .doc antigo não dá para ler. Salve como .docx ou PDF e envie de novo.",
    };
  }

  // ── imagem ───────────────────────────────────────────────────
  if (tipo.startsWith("image/")) {
    return { texto: "", aviso: "IMAGEM" };  // tratada por quem chama, com visão
  }

  return { texto: "", aviso: `Não sei ler arquivos do tipo ${tipo || ext || "desconhecido"}.` };
}

/**
 * Lê uma imagem pelo próprio gateway da Marina.
 *
 * Reaproveita o que já está no ar em vez de pedir mais uma chave: o mesmo
 * agente que atende no WhatsApp enxerga imagem. Uma foto de cardápio ou de
 * um aviso impresso vira texto por esse caminho.
 */
export async function lerImagem(url: string): Promise<Extracao> {
  const base = (process.env.OPENCLAW_GATEWAY_URL ?? "").replace(/\/+$/, "");
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!base || !token) {
    return { texto: "", aviso: "Leitura de imagem indisponível: o gateway não está configurado." };
  }

  try {
    const r = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODELO || "openclaw/default",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Transcreva TODO o texto visível nesta imagem, na ordem em que aparece. " +
                "Se houver tabela ou lista de preços, preserve a estrutura. " +
                "Depois, em uma linha começando com 'IMAGEM:', descreva o que ela mostra. " +
                "Não invente nada que não esteja visível.",
            },
            { type: "image_url", image_url: { url } },
          ],
        }],
      }),
    });

    if (!r.ok) {
      return { texto: "", aviso: "Não consegui ler esta imagem agora. Tente de novo mais tarde." };
    }
    const dados = await r.json();
    const texto = String(dados?.choices?.[0]?.message?.content ?? "").trim();
    return texto
      ? { texto: texto.slice(0, LIMITE_TEXTO) }
      : { texto: "", aviso: "Não encontrei texto legível nesta imagem." };
  } catch {
    return { texto: "", aviso: "Não consegui ler esta imagem agora." };
  }
}

/** O pedaço que vai no contexto de toda conversa: começo do documento. */
export function fazerTrecho(texto: string): string {
  if (texto.length <= LIMITE_TRECHO) return texto;
  const corte = texto.slice(0, LIMITE_TRECHO);
  const ultimoPonto = corte.lastIndexOf(". ");
  return (ultimoPonto > LIMITE_TRECHO * 0.6 ? corte.slice(0, ultimoPonto + 1) : corte) + " […]";
}
