import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { gatewayConfigurado } from "@/lib/chat";
import { chaveDoProvedor } from "@/lib/voz";
import { garantirEsquemaVoz } from "@/lib/esquema-voz-treino";
import { lerPrecosVoz, usoDoMesCentavos, lacunasAbertas, ultimaConversa } from "@/lib/marina-voz";
import { estadoGasto, emReais } from "@/lib/marina-voz-base";
import { estadoPilha } from "@/lib/marina-voz-desfazer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O que o botão de voz precisa saber ao abrir: a Marina está ligada? a voz
 * está configurada? quanto já gastou no mês? quais perguntas faltam responder?
 * Tudo só leitura.
 */
export async function GET() {
  const s = await auth();
  if (!s?.user) return Response.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const tecnico = (s.user as { role?: string }).role === "master";
  const autor = (s.user.name || s.user.email || "painel") as string;

  return comSql(async (sql) => {
    await garantirEsquemaVoz(sql);
    const [precos, { chave }] = await Promise.all([lerPrecosVoz(sql), chaveDoProvedor(sql, "elevenlabs")]);
    const [uso, lacunas, ultima, pilha] = await Promise.all([usoDoMesCentavos(sql, precos), lacunasAbertas(sql, 8), ultimaConversa(sql, autor), estadoPilha(sql, autor)]);
    const gasto = estadoGasto(uso, precos);
    return Response.json({
      ok: true,
      gateway: gatewayConfigurado(),
      voz: Boolean(chave),
      tecnico,
      autor,
      gasto,
      reais: { uso: emReais(gasto.usoCentavos), limite: emReais(precos.limiteCentavos) },
      lacunas,
      ultima,
      pilha,
    });
  });
}
