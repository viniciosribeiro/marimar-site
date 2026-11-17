import { urlGateway, cabecalhosGateway } from "./chat";

/**
 * Falar com o gateway do OpenClaw (a Marina) e devolver o texto.
 *
 * É o mesmo caminho da área de teste do painel (que tem a sua própria cópia
 * histórica): servidor → gateway → Marina, com o token só no servidor. Fica
 * aqui para o modo voz e o botão "melhorar texto" usarem sem duplicar a
 * leitura do fluxo SSE.
 */

export class ErroGateway extends Error {}

export type Troca = { papel: "voce" | "marina"; conteudo: string };

const PRAZO_ATENDER = 20_000;
const PRAZO_TOTAL = 52_000;

export async function perguntarAoGateway(
  sessao: string, sistema: string, historico: Troca[], mensagem: string,
): Promise<{ texto: string; cortada: boolean }> {
  const inicio = Date.now();
  const controle = new AbortController();
  const atender = setTimeout(() => controle.abort(), PRAZO_ATENDER);
  let resposta: Response;
  try {
    resposta = await fetch(urlGateway("/v1/chat/completions"), {
      method: "POST",
      headers: cabecalhosGateway(),
      signal: controle.signal,
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODELO || "openclaw",
        stream: true,
        user: sessao,
        messages: [
          { role: "system", content: sistema },
          ...historico.slice(-10).map((t) => ({ role: t.papel === "voce" ? "user" : "assistant", content: t.conteudo })),
          { role: "user", content: mensagem },
        ],
      }),
    });
  } catch (e) {
    if (controle.signal.aborted) {
      throw new ErroGateway("O servidor da Marina (OpenClaw, na Hostinger) não atendeu em 20 segundos. Ele pode estar desligado ou travado.");
    }
    throw new ErroGateway(`Não consegui chegar ao servidor da Marina (${(e as Error).message}).`);
  } finally {
    clearTimeout(atender);
  }
  if (!resposta.ok || !resposta.body) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`o gateway respondeu ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ""}`);
  }
  const terminar = setTimeout(() => controle.abort(), Math.max(5_000, PRAZO_TOTAL - (Date.now() - inicio)));
  const leitor = resposta.body.getReader();
  const dec = new TextDecoder();
  let sobra = "";
  let texto = "";
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      sobra += dec.decode(value, { stream: true });
      const linhas = sobra.split("\n");
      sobra = linhas.pop() ?? "";
      for (const l of linhas) {
        if (!l.startsWith("data:")) continue;
        const d = l.slice(5).trim();
        if (d === "[DONE]") continue;
        try {
          const p = JSON.parse(d)?.choices?.[0];
          texto += p?.delta?.content ?? p?.message?.content ?? "";
        } catch { /* keep-alive */ }
      }
    }
  } catch (e) {
    if (!controle.signal.aborted) throw e;
    if (!texto.trim()) {
      throw new ErroGateway("A Marina recebeu a mensagem, mas não respondeu em 50 segundos. O servidor dela está lento.");
    }
    return { texto, cortada: true };
  } finally {
    clearTimeout(terminar);
  }
  return { texto, cortada: false };
}
