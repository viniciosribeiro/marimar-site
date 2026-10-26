import postgres from "postgres";
import {
  LIMITE_VOZ_POR_HORA, LIMITE_VOZ_CARACTERES,
  hashIp, ipDaRequisicao,
} from "@/lib/chat";
import { falarComAVozGravada } from "@/lib/voz";
import { prepararFalaDaMarina } from "@/lib/voz-fala";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A voz da Marina no chat do site.
 *
 * Só entra aqui texto que a Marina REALMENTE disse nesta sessão — a rota
 * confere no banco antes de sintetizar. Sem essa conferência, este endpoint
 * seria uma API de text-to-speech aberta na internet, paga por nós: bastaria
 * alguém mandar o texto que quisesse.
 *
 * Três travas, nesta ordem: o interruptor da administração, o teto por IP
 * por hora, e o tamanho do texto. A chave do provedor nunca sai daqui.
 * A voz (ElevenLabs, OpenAI ou Google) é a escolhida no painel, gerada do
 * mesmo jeito que o OpenClaw gera no WhatsApp (src/lib/voz.ts).
 */
export async function POST(req: Request) {
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const corpo = await req.json().catch(() => null);
    const sessao = typeof corpo?.sessao === "string" ? corpo.sessao.slice(0, 64) : "";
    const texto = typeof corpo?.texto === "string" ? corpo.texto.trim() : "";

    if (!sessao || !texto) {
      return Response.json({ erro: "Pedido incompleto." }, { status: 400 });
    }
    if (texto.length > LIMITE_VOZ_CARACTERES) {
      return Response.json({ erro: "Mensagem longa demais para áudio." }, { status: 400 });
    }

    sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });

    const [p] = await sql<{ chat_ativo: boolean }[]>`
      SELECT chat_ativo FROM pousada LIMIT 1`;
    if (!p?.chat_ativo) {
      await sql.end();
      return Response.json({ erro: "desligado" }, { status: 503 });
    }

    /* A conferência que impede o endereço de virar API pública: o texto tem
       que ser, palavra por palavra, algo que a Marina escreveu NESTA sessão. */
    const [dito] = await sql<{ id: string }[]>`
      SELECT id FROM chat_mensagens
      WHERE sessao = ${sessao} AND papel = 'marina' AND conteudo = ${texto}
      LIMIT 1`;
    if (!dito) {
      await sql.end();
      return Response.json({ erro: "Texto não encontrado nesta conversa." }, { status: 400 });
    }

    const ip = hashIp(ipDaRequisicao(req));
    const [{ usadas }] = await sql<{ usadas: number }[]>`
      SELECT COUNT(*)::int AS usadas FROM chat_voz
      WHERE ip_hash = ${ip} AND tipo = 'tts' AND criado_em > now() - interval '1 hour'`;
    if (usadas >= LIMITE_VOZ_POR_HORA) {
      await sql.end();
      return Response.json({ erro: "Muitos áudios seguidos. Tente mais tarde." }, { status: 429 });
    }

    // A fala e menor que a mensagem do chat: links continuam clicaveis no
    // texto original, mas nao seguem para a API de voz (custo por caractere).
    const fala = prepararFalaDaMarina(texto);
    if (!fala) {
      await sql.end();
      return Response.json({ erro: "Não há conteúdo para narrar." }, { status: 400 });
    }
    const falado = await falarComAVozGravada(sql, fala);
    if (!falado.ok) {
      if (falado.status !== 503) console.error("[voz]", falado.erro);
      await sql.end();
      return Response.json({ erro: falado.status === 503 ? "Voz não configurada." : "Não consegui gerar o áudio agora." }, { status: falado.status === 503 ? 503 : 502 });
    }

    // Só conta depois que a síntese deu certo: cobrar do teto um pedido que
    // falhou puniria o visitante por um problema nosso.
    await sql`
      INSERT INTO chat_voz (sessao, ip_hash, tipo, caracteres)
      VALUES (${sessao}, ${ip}, 'tts', ${fala.length})`;
    await sql.end();

    return new Response(falado.audio, {
      headers: {
        "content-type": falado.tipo,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("[voz] falha:", (e as Error).message);
    try { await sql?.end(); } catch {}
    return Response.json({ erro: "Não consegui gerar o áudio agora." }, { status: 500 });
  }
}
