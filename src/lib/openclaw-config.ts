/**
 * Escreve na configuração do OpenClaw a partir do painel.
 *
 * Existe por um defeito concreto: a aba Voz gravava no nosso banco, que
 * governa só o chat do site. A Marina do WhatsApp lê a voz da config do
 * OpenClaw, e o painel nunca a tocava — então trocar a voz mudava um canal
 * e deixava o outro falando com a voz antiga, sem dizer nada.
 *
 * Um painel que promete "a voz da Marina" e entrega metade é pior do que um
 * que diz onde mexer: quem opera confia, testa pelo WhatsApp, e conclui que
 * o sistema não funciona.
 *
 * Depende do plugin `admin-http-rpc`, que vem desligado de fábrica:
 *
 *   openclaw config set plugins.entries.admin-http-rpc.enabled true --strict-json
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

function configurado(): boolean {
  return Boolean(process.env.OPENCLAW_GATEWAY_URL && process.env.OPENCLAW_GATEWAY_TOKEN);
}

/**
 * Chama um método do RPC de administração.
 *
 * Devolve o erro em texto em vez de lançar: quem chama está no meio de um
 * salvamento que JÁ deu certo do nosso lado, e derrubar a ação inteira por
 * causa da segunda metade faria a Cecília perder o que digitou.
 */
async function rpc(method: string, params: Record<string, unknown>): Promise<Resultado> {
  if (!configurado()) return { ok: false, erro: "O gateway do OpenClaw não está configurado." };

  const base = process.env.OPENCLAW_GATEWAY_URL!.replace(/\/+$/, "");
  try {
    const r = await fetch(`${base}/api/v1/admin/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({ method, params }),
      signal: AbortSignal.timeout(12_000),
    });

    const texto = await r.text();
    if (!r.ok) {
      /* O corpo do erro é o que diz se o plugin está desligado, se o token
         foi recusado ou se o formato do parâmetro está errado. Levar ele
         para a tela evita a próxima meia hora de adivinhação. */
      return { ok: false, erro: `gateway respondeu ${r.status}: ${texto.slice(0, 300)}` };
    }

    try {
      const dados = JSON.parse(texto);
      if (dados?.error) return { ok: false, erro: String(dados.error?.message ?? dados.error).slice(0, 300) };
    } catch { /* resposta sem JSON e com status 2xx: consideramos aceita */ }

    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Grava um caminho da config do OpenClaw. */
export async function definirConfig(caminho: string, valor: unknown): Promise<Resultado> {
  return rpc("config.set", { path: caminho, value: valor });
}

/**
 * Manda a voz do painel para o OpenClaw, para o WhatsApp falar igual ao site.
 *
 * Os ajustes finos (estabilidade, semelhança, velocidade) não vão: o
 * OpenClaw os expõe sob outro formato e enviar às cegas arriscaria corromper
 * uma config que hoje funciona. Voz e modelo são o que muda o timbre, que é
 * o que a Cecília percebe.
 */
export async function sincronizarVoz(vozId: string, modelo: string): Promise<Resultado> {
  const voz = await definirConfig("tts.providers.elevenlabs.speakerVoiceId", vozId);
  if (!voz.ok) return voz;
  return definirConfig("tts.providers.elevenlabs.model", modelo);
}
