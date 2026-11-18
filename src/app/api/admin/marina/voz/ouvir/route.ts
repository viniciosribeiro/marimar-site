import { after } from "next/server";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { LIMITE_AUDIO_BYTES, URL_TRANSCRICAO, MODELO_TRANSCRICAO } from "@/lib/chat";
import { chaveDoProvedor } from "@/lib/voz";
import { garantirEsquemaVoz } from "@/lib/esquema-voz-treino";
import { lerPrecosVoz, usoDoMesCentavos, garantirSessao, somarCusto } from "@/lib/marina-voz";
import { estadoGasto } from "@/lib/marina-voz-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ouvir: o áudio que a pessoa falou vira texto (ElevenLabs Scribe), como no
 * chat do site — mas aqui a porta é fechada (precisa de login) e o gasto
 * entra no teto do mês do treinamento. Transcrição recusada quando o mês já
 * estourou: nesse caso a pessoa continua treinando por texto.
 */
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const autor = (s.user.name || s.user.email || "painel") as string;

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("audio");
  const sessao = String(form?.get("sessao") ?? "").slice(0, 64);
  const segundos = Number(form?.get("segundos")) || 0;
  if (!(arquivo instanceof File)) return Response.json({ erro: "Áudio não recebido." }, { status: 400 });
  if (arquivo.size > LIMITE_AUDIO_BYTES) return Response.json({ erro: "Áudio muito longo." }, { status: 400 });

  return comSql(async (sql) => {
    await garantirEsquemaVoz(sql);
    /* Teto do mês e chave da voz, em paralelo. */
    const [gasto, { chave }] = await Promise.all([
      lerPrecosVoz(sql).then(async (precos) => estadoGasto(await usoDoMesCentavos(sql, precos), precos)),
      chaveDoProvedor(sql, "elevenlabs"),
    ]);
    if (gasto.nivel === "estourou") {
      return Response.json({ erro: "limite", gasto }, { status: 402 });
    }
    if (!chave) return Response.json({ erro: "Voz não configurada." }, { status: 503 });

    const envio = new FormData();
    envio.append("file", arquivo, "fala.webm");
    envio.append("model_id", MODELO_TRANSCRICAO);
    envio.append("language_code", "por");
    const r = await fetch(URL_TRANSCRICAO, { method: "POST", headers: { "xi-api-key": chave }, body: envio });
    if (!r.ok) {
      console.error("[voz/ouvir] elevenlabs", r.status, (await r.text().catch(() => "")).slice(0, 200));
      return Response.json({ erro: "Não consegui entender o áudio." }, { status: 502 });
    }
    const dados = await r.json().catch(() => null);
    const texto = typeof dados?.text === "string" ? dados.text.trim() : "";
    if (!texto) return Response.json({ erro: "Não entendi. Pode repetir?" }, { status: 422 });

    /* Segundos vêm do navegador (gravou o áudio); sem isso, uma estimativa pelo tamanho. */
    const seg = segundos > 0 ? Math.min(600, Math.round(segundos)) : Math.min(600, Math.round(arquivo.size / 2000));
    /* Custo e sessão gravados DEPOIS de devolver o texto: não atrasa a conversa. */
    if (UUID.test(sessao)) {
      after(() => comSql(async (s2) => {
        await garantirSessao(s2, sessao, autor);
        await somarCusto(s2, sessao, { sttSegundos: seg });
      }).catch((e) => console.error("[voz/ouvir] custo", (e as Error).message)));
    }
    return Response.json({ texto });
  });
}
