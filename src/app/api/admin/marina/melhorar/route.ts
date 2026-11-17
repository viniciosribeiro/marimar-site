import { auth } from "@/lib/auth";
import { gatewayConfigurado } from "@/lib/chat";
import { perguntarAoGateway, ErroGateway } from "@/lib/marina-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "✨ Melhorar texto": pega o que está no campo e pede à própria Marina
 * (mesmo gateway) uma versão mais clara, SEM inventar fato nem mudar o
 * sentido. Devolve o texto melhorado para a tela preencher — a pessoa vê
 * antes de salvar e pode desfazer. Só quem está logado chega aqui.
 */
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ erro: "Entre no painel de novo." }, { status: 401 });
  if (!gatewayConfigurado()) {
    return Response.json({ erro: "A Marina ainda não está ligada a este site (faltam OPENCLAW_GATEWAY_URL e OPENCLAW_GATEWAY_TOKEN na Vercel)." }, { status: 503 });
  }

  const corpo = await req.json().catch(() => null);
  const texto = typeof corpo?.texto === "string" ? corpo.texto.trim().slice(0, 6000) : "";
  const contexto = typeof corpo?.contexto === "string" ? corpo.contexto.slice(0, 200) : "";
  if (!texto) return Response.json({ erro: "Escreva alguma coisa primeiro." }, { status: 400 });

  const sistema = [
    "Você é um editor de textos do painel da Pousada Marimar.",
    "Melhore o texto a seguir: deixe mais claro, correto e com um bom tom de atendimento,",
    "SEM inventar fatos, sem mudar o sentido e sem acrescentar informação nova.",
    "Mantenha preços, horários, números e nomes exatamente como estão.",
    contexto ? `Sobre o texto: ${contexto}.` : "",
    "Responda SOMENTE com o texto melhorado — sem aspas, sem comentários, sem explicação.",
  ].filter(Boolean).join("\n");

  try {
    const { texto: bruto } = await perguntarAoGateway(`painel-melhorar:${crypto.randomUUID()}`, sistema, [], texto);
    const melhorado = bruto.trim().replace(/^["“]|["”]$/g, "").trim();
    if (!melhorado) return Response.json({ erro: "A Marina não devolveu um texto. Tente de novo." }, { status: 502 });
    return Response.json({ ok: true, texto: melhorado.slice(0, 6000) });
  } catch (e) {
    console.error("[melhorar]", (e as Error).message);
    const erro = e instanceof ErroGateway ? e.message : "Não consegui melhorar o texto agora.";
    return Response.json({ erro }, { status: 502 });
  }
}
