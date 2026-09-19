import postgres from "postgres";
import {
  LIMITE_AUDIO_POR_HORA, LIMITE_AUDIO_BYTES,
  URL_TRANSCRICAO, MODELO_TRANSCRICAO,
  hashIp, ipDaRequisicao, vozConfigurada,
} from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transforma o áudio gravado pelo visitante em texto.
 *
 * A pergunta falada vira texto AQUI e segue o mesmo caminho de qualquer
 * pergunta escrita: passa pelo /api/chat, é gravada no banco, entra no
 * histórico. Sem isso teríamos duas conversas paralelas — uma falada e uma
 * escrita — e a Marina perderia o fio quando a pessoa alternasse entre as
 * duas, que é o que toda pessoa faz.
 *
 * A pergunta segue direto, sem passo de confirmação — é o que quem gravou
 * um áudio espera. Em compensação o texto transcrito aparece na tela como a
 * fala do visitante: se a transcrição entendeu errado, a pessoa vê na hora
 * o que foi perguntado em vez de descobrir pela resposta estranha.
 */
export async function POST(req: Request) {
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    if (!vozConfigurada()) {
      return Response.json({ erro: "Voz não configurada." }, { status: 503 });
    }

    const form = await req.formData().catch(() => null);
    const arquivo = form?.get("audio");
    const sessao = String(form?.get("sessao") ?? "").slice(0, 64);

    if (!sessao || !(arquivo instanceof File)) {
      return Response.json({ erro: "Áudio não recebido." }, { status: 400 });
    }
    if (arquivo.size > LIMITE_AUDIO_BYTES) {
      return Response.json({ erro: "Áudio muito longo." }, { status: 400 });
    }

    sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });

    const [p] = await sql<{ chat_ativo: boolean }[]>`
      SELECT chat_ativo FROM pousada LIMIT 1`;
    if (!p?.chat_ativo) {
      await sql.end();
      return Response.json({ erro: "desligado" }, { status: 503 });
    }

    const ip = hashIp(ipDaRequisicao(req));
    const [{ usadas }] = await sql<{ usadas: number }[]>`
      SELECT COUNT(*)::int AS usadas FROM chat_voz
      WHERE ip_hash = ${ip} AND tipo = 'stt' AND criado_em > now() - interval '1 hour'`;
    if (usadas >= LIMITE_AUDIO_POR_HORA) {
      await sql.end();
      return Response.json(
        { erro: "Muitos áudios seguidos. Escreva sua pergunta ou continue no WhatsApp." },
        { status: 429 },
      );
    }

    const envio = new FormData();
    envio.append("file", arquivo, "pergunta.webm");
    envio.append("model_id", MODELO_TRANSCRICAO);
    envio.append("language_code", "por");

    const resposta = await fetch(URL_TRANSCRICAO, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
      body: envio,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      console.error("[transcrever] elevenlabs", resposta.status, detalhe.slice(0, 300));
      await sql.end();
      return Response.json({ erro: "Não consegui entender o áudio." }, { status: 502 });
    }

    const dados = await resposta.json().catch(() => null);
    const texto = typeof dados?.text === "string" ? dados.text.trim() : "";

    if (!texto) {
      await sql.end();
      return Response.json({ erro: "Não consegui entender o áudio. Pode repetir?" }, { status: 422 });
    }

    // Conta só o que deu certo — cobrar do teto uma falha nossa puniria
    // o visitante por um problema que não é dele.
    await sql`
      INSERT INTO chat_voz (sessao, ip_hash, tipo, caracteres, segundos)
      VALUES (${sessao}, ${ip}, 'stt', ${texto.length}, 0)`;
    await sql.end();

    return Response.json({ texto });
  } catch (e) {
    console.error("[transcrever] falha:", (e as Error).message);
    try { await sql?.end(); } catch {}
    return Response.json({ erro: "Não consegui entender o áudio." }, { status: 500 });
  }
}
