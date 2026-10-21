import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { opcoesDeCampos } from "@/lib/voz-base";
import { chaveDoProvedor, sintetizar } from "@/lib/voz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ouvir a voz antes de salvar, com o provedor e os ajustes da tela.
 *
 * Sem isto, escolher voz vira tentativa e erro em produção: salva, abre o
 * site, pergunta alguma coisa, escuta, volta. O pedido sai igual ao do
 * chat e ao do WhatsApp (src/lib/voz.ts), então o que se ouve aqui é o
 * que o cliente ouve.
 *
 * Só quem está logado no admin chega aqui. A frase pode ser escolhida (até
 * 300 caracteres), mas o teto impede que este endereço vire uma API de voz
 * de uso livre.
 */
const FRASE =
  "Oi! Sou a Marina, da Pousada Marimar. O café da manhã é servido das 8 às 10, " +
  "e o check-in começa às 14 horas. Posso ajudar com mais alguma coisa?";

export async function POST(req: Request) {
  const sessao = await auth();
  if (!sessao?.user) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const o = opcoesDeCampos((k) => corpo?.[k]);
  if (o.provedor === "elevenlabs" && !o.elevenlabs.voz) return Response.json({ erro: "Escolha uma voz." }, { status: 400 });

  const { chave } = await comSql((sql) => chaveDoProvedor(sql, o.provedor));
  if (!chave) return Response.json({ erro: "Conecte a conta deste provedor para ouvir." }, { status: 503 });

  const frase = typeof corpo?.frase === "string" && corpo.frase.trim() ? corpo.frase.trim().slice(0, 300) : FRASE;
  const r = await sintetizar(o, frase, chave);
  if (!r.ok) {
    console.error("[voz-teste]", o.provedor, r.erro);
    return Response.json({ erro: r.erro }, { status: r.status });
  }
  return new Response(r.audio, { headers: { "content-type": r.tipo, "cache-control": "no-store" } });
}
