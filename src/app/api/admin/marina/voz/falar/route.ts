import { after } from "next/server";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { lerOpcoesVoz, chaveDoProvedor, sintetizar } from "@/lib/voz";
import { prepararFalaDaMarina } from "@/lib/voz-fala";
import { garantirEsquemaVoz } from "@/lib/esquema-voz-treino";
import { lerPrecosVoz, usoDoMesCentavos, somarCusto, garantirSessao } from "@/lib/marina-voz";
import { estadoGasto } from "@/lib/marina-voz-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Falar: o texto da Marina vira áudio, com a MESMA voz do WhatsApp e do chat
 * (src/lib/voz.ts). Só quem está logado chega aqui; o gasto conta no teto do
 * mês e, se o mês estourou, a voz para (o treino segue por texto). Links e
 * endereços nunca vão ao provedor (prepararFalaDaMarina), como no site.
 */
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const autor = (s.user.name || s.user.email || "painel") as string;

  const corpo = await req.json().catch(() => null);
  const sessao = String(corpo?.sessao ?? "").slice(0, 64);
  const texto = typeof corpo?.texto === "string" ? corpo.texto.trim().slice(0, 1500) : "";
  if (!texto) return Response.json({ erro: "Nada para falar." }, { status: 400 });

  return comSql(async (sql) => {
    await garantirEsquemaVoz(sql);
    /* Teto do mês e voz configurada, em paralelo (mesma conexão, consultas juntas). */
    const [gasto, { o, chave }] = await Promise.all([
      lerPrecosVoz(sql).then(async (precos) => estadoGasto(await usoDoMesCentavos(sql, precos), precos)),
      lerOpcoesVoz(sql).then(async (o) => ({ o, chave: (await chaveDoProvedor(sql, o.provedor)).chave })),
    ]);
    if (gasto.nivel === "estourou") return Response.json({ erro: "limite", gasto }, { status: 402 });
    if (!chave) return Response.json({ erro: "Voz não configurada." }, { status: 503 });

    const fala = prepararFalaDaMarina(texto);
    if (!fala) return Response.json({ erro: "Nada para falar." }, { status: 400 });

    const r = await sintetizar(o, fala, chave);
    if (!r.ok) {
      if (r.status !== 503) console.error("[voz/falar]", r.erro);
      return Response.json({ erro: r.status === 503 ? "Voz não configurada." : "Não consegui gerar o áudio agora." }, { status: r.status === 503 ? 503 : 502 });
    }
    /* O custo entra na conta DEPOIS de devolver o áudio: não atrasa a fala. */
    if (UUID.test(sessao)) {
      after(() => comSql(async (s2) => {
        await garantirSessao(s2, sessao, autor);
        await somarCusto(s2, sessao, { ttsCaracteres: fala.length });
      }).catch((e) => console.error("[voz/falar] custo", (e as Error).message)));
    }
    return new Response(r.audio, { headers: { "content-type": r.tipo, "cache-control": "no-store" } });
  });
}
