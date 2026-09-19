import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ouvir a voz antes de salvar.
 *
 * Sem isto, escolher voz vira tentativa e erro em produção: salva, abre o
 * site, pergunta alguma coisa, escuta, volta. Com o botão de prova a
 * Cecília decide em cinco segundos — e é a diferença entre ela mexer nos
 * ajustes ou ter medo deles.
 *
 * Só quem está logado no admin chega aqui, e o texto é fixo: este endereço
 * não pode virar uma API de voz de uso livre.
 */
const FRASE =
  "Oi! Sou a Marina, da Pousada Marimar. O café da manhã é servido das 8 às 10, " +
  "e o check-in começa às 14 horas. Posso ajudar com mais alguma coisa?";

export async function POST(req: Request) {
  const sessao = await auth();
  if (!sessao?.user) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  if (!process.env.ELEVENLABS_API_KEY) {
    return Response.json({ erro: "Falta a chave da ElevenLabs nas variáveis do site." }, { status: 503 });
  }

  const corpo = await req.json().catch(() => null);
  const voz = typeof corpo?.voz_id === "string" ? corpo.voz_id.trim() : "";
  if (!voz) return Response.json({ erro: "Escolha um ID de voz." }, { status: 400 });

  const limite = (v: unknown, min: number, max: number, padrao: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
  };

  const resposta = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "audio/mpeg",
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: FRASE,
      model_id: typeof corpo?.voz_modelo === "string" ? corpo.voz_modelo : "eleven_multilingual_v2",
      language_code: "pt",
      apply_text_normalization: "on",
      voice_settings: {
        stability: limite(corpo?.voz_estabilidade, 0, 100, 50) / 100,
        similarity_boost: limite(corpo?.voz_semelhanca, 0, 100, 75) / 100,
        speed: limite(corpo?.voz_velocidade, 70, 120, 100) / 100,
      },
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    console.error("[voz-teste] elevenlabs", resposta.status, detalhe.slice(0, 300));
    return Response.json(
      { erro: resposta.status === 401
          ? "A chave da ElevenLabs foi recusada."
          : "Não consegui gerar a prova. Confira o ID da voz." },
      { status: 502 },
    );
  }

  return new Response(await resposta.arrayBuffer(), {
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
  });
}
