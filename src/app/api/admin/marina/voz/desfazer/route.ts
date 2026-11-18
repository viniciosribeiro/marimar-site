import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { mesmaOrigem } from "@/lib/mesma-origem";
import { garantirEsquemaVoz } from "@/lib/esquema-voz-treino";
import { desfazerOuRefazer, estadoPilha } from "@/lib/marina-voz-desfazer";
import { ACOES } from "@/lib/marina-voz-acoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Os botões ↶ Desfazer e ↷ Refazer do chat de voz (e "desfaz isso" falado).
 * Desfaz/refaz a ÚLTIMA ação da pessoa logada, numa transação, e recusa se
 * o registro foi mudado depois por outro caminho (ver marina-voz-desfazer.ts).
 */
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ ok: false, mensagem: "Entre no painel de novo." }, { status: 401 });
  if (!mesmaOrigem(req)) return Response.json({ ok: false, mensagem: "Pedido recusado." }, { status: 403 });
  const autor = (s.user.name || s.user.email || "painel") as string;
  const corpo = await req.json().catch(() => null);
  const sentido = corpo?.sentido === "refazer" ? "refazer" : "desfazer";

  try {
    const r = await comSql(async (sql) => {
      await garantirEsquemaVoz(sql);
      const feito = await desfazerOuRefazer(sql, autor, sentido);
      return { ...feito, pilha: await estadoPilha(sql, autor) };
    });
    if (r.ok) {
      const caminhos = new Set(["/admin/marina", ...r.caminhosDe.flatMap((n) => ACOES[n]?.caminhos ?? [])]);
      for (const p of caminhos) revalidatePath(p);
    }
    return Response.json({ ok: r.ok, mensagem: r.mensagem, pilha: r.pilha });
  } catch (e) {
    console.error("[voz/desfazer]", (e as Error).message);
    return Response.json({ ok: false, mensagem: "Não consegui agora. Confira na tela e tente de novo." });
  }
}
