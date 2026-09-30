import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { CONTEXTO_CANAL, gatewayConfigurado, urlGateway, cabecalhosGateway } from "@/lib/chat";
import {
  montarTreinamento, PEDIDO_FONTES, separarFontes, codigoItem, registrarHistorico,
  type Ensinamento,
} from "@/lib/marina";
import { palavrasDaBusca, normalizar } from "@/lib/busca-documentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Área de teste do painel: conversar com a Marina ali mesmo.
 *
 * Usa o MESMO gateway e o MESMO texto de treinamento do chat do site
 * (`montarTreinamento`) — se usasse outro caminho, o teste poderia passar
 * e o hóspede continuar recebendo resposta errada. As diferenças são só
 * duas, e ambas existem para o teste ser útil:
 *
 * 1. Os itens vão com um código curto (#a1b2c3) e a Marina é pedida a
 *    dizer, no fim, quais usou. É o que mostra à Cecília "ela respondeu
 *    isso por causa DESTE item".
 * 2. Cada conversa de teste tem sessão própria e nova. A Marina guarda
 *    memória por conversa no OpenClaw; testar numa sessão velha mistura o
 *    que ela disse antes do treino com o treino novo — foi o que confundiu
 *    o teste pelo WhatsApp em 29/09.
 *
 * `verificar: <id>` roda o teste automático de um item: faz a pergunta
 * dele e confere se ela usou o item. O resultado fica no item.
 */
type Troca = { papel: "voce" | "marina"; conteudo: string };

async function perguntarAoGateway(sessao: string, sistema: string, historico: Troca[], mensagem: string) {
  const resposta = await fetch(urlGateway("/v1/chat/completions"), {
    method: "POST",
    headers: cabecalhosGateway(),
    signal: AbortSignal.timeout(55_000),
    body: JSON.stringify({
      model: process.env.OPENCLAW_MODELO || "openclaw",
      stream: true,
      user: sessao,
      messages: [
        { role: "system", content: sistema },
        ...historico.slice(-10).map((t) => ({ role: t.papel === "voce" ? "user" : "assistant", content: t.conteudo })),
        { role: "user", content: mensagem },
      ],
    }),
  });
  if (!resposta.ok || !resposta.body) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`o gateway respondeu ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ""}`);
  }
  /* Mesmo formato SSE do chat do site. */
  const leitor = resposta.body.getReader();
  const dec = new TextDecoder();
  let sobra = "";
  let texto = "";
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    sobra += dec.decode(value, { stream: true });
    const linhas = sobra.split("\n");
    sobra = linhas.pop() ?? "";
    for (const l of linhas) {
      if (!l.startsWith("data:")) continue;
      const d = l.slice(5).trim();
      if (d === "[DONE]") continue;
      try {
        const p = JSON.parse(d)?.choices?.[0];
        texto += p?.delta?.content ?? p?.message?.content ?? "";
      } catch { /* keep-alive */ }
    }
  }
  return texto;
}

/** Fallback quando a Marina esquece de citar: a resposta cobre o conteúdo do item? */
function cobre(item: Ensinamento, resposta: string) {
  const chave = palavrasDaBusca(item.conteudo).slice(0, 12);
  if (!chave.length) return false;
  const r = normalizar(resposta);
  return chave.filter((p) => r.includes(p)).length / chave.length >= 0.5;
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ erro: "Entre no painel de novo." }, { status: 401 });
  if (!gatewayConfigurado()) {
    return Response.json({
      erro: "A Marina ainda não está ligada a este site (faltam OPENCLAW_GATEWAY_URL e OPENCLAW_GATEWAY_TOKEN na Vercel). O teste usa a mesma ligação do chat do site.",
    }, { status: 503 });
  }

  const corpo = await req.json().catch(() => null);
  const verificar = typeof corpo?.verificar === "string" ? corpo.verificar : null;
  const historico: Troca[] = Array.isArray(corpo?.historico)
    ? corpo.historico.filter((t: Troca) => typeof t?.conteudo === "string").slice(-10) : [];
  const sessaoTeste = typeof corpo?.sessao === "string" && corpo.sessao ? corpo.sessao.slice(0, 64) : crypto.randomUUID();
  const autor = (s.user.name || s.user.email || "painel") as string;

  try {
    return await comSql(async (sql) => {
      const { texto, ensinamentos } = await montarTreinamento(sql, "teste", { codigos: true });
      const todos = [...ensinamentos.fatos, ...ensinamentos.perguntas, ...ensinamentos.limites, ...ensinamentos.escalar];
      const porCodigo = new Map(todos.map((i) => [codigoItem(i.id), i]));

      let mensagem = typeof corpo?.mensagem === "string" ? corpo.mensagem.trim().slice(0, 1200) : "";
      let alvo: Ensinamento | undefined;
      if (verificar) {
        alvo = todos.find((i) => i.id === verificar);
        if (!alvo) return Response.json({ erro: "Ligue o item antes de testar: desligado, a Marina não o usa." }, { status: 400 });
        mensagem = alvo.tipo === "pergunta"
          ? [alvo.titulo, ...(alvo.variacoes ?? [])][Math.floor(Math.random() * (1 + (alvo.variacoes?.length ?? 0)))]
          : `Uma dúvida sobre ${alvo.titulo.toLowerCase()}: como funciona?`;
      }
      if (!mensagem) return Response.json({ erro: "Escreva uma pergunta." }, { status: 400 });

      const sistema = [CONTEXTO_CANAL, texto, PEDIDO_FONTES].filter(Boolean).join("\n\n");
      const t0 = Date.now();
      const bruto = await perguntarAoGateway(`painel-teste:${sessaoTeste}`, sistema, verificar ? [] : historico, mensagem);
      const { resposta, codigos } = separarFontes(bruto);
      const aprendidoPorCodigo = new Map((ensinamentos.aprendidos ?? []).map((a) => [codigoItem(a.id), a]));
      const roteiroPorCodigo = new Map((ensinamentos.roteiros ?? []).map((r) => [codigoItem(r.id), r]));
      const fontes = [
        ...codigos.map((c) => porCodigo.get(c)).filter(Boolean)
          .map((i) => ({ id: i!.id, titulo: i!.titulo, tipo: i!.tipo, categoria: i!.categoria ?? "geral" })),
        ...codigos.map((c) => roteiroPorCodigo.get(c)).filter(Boolean)
          .map((r) => ({ id: r!.id, titulo: r!.titulo, tipo: "roteiro", categoria: "orientacao" })),
        ...codigos.map((c) => aprendidoPorCodigo.get(c)).filter(Boolean)
          .map((a) => ({ id: a!.id, titulo: a!.pergunta, tipo: "aprendido", categoria: a!.categoria })),
      ];

      let verificacao: "ok" | "falhou" | null = null;
      if (alvo) {
        verificacao = fontes.some((f) => f.id === alvo!.id) || cobre(alvo, resposta) ? "ok" : "falhou";
        await sql`
          UPDATE marina_conhecimento
          SET verificacao = ${verificacao}, verificado_em = now(),
              verificacao_resposta = ${`P: ${mensagem}\nR: ${resposta}`.slice(0, 3000)}
          WHERE id = ${alvo.id}`.catch(() => {});
        await registrarHistorico(sql, alvo.id, "testou", null, { verificacao, pergunta: mensagem }, autor);
      }

      return Response.json({
        ok: true,
        sessao: sessaoTeste,
        pergunta: mensagem,
        resposta: resposta || "(a Marina não respondeu nada)",
        fontes,
        verificacao,
        ms: Date.now() - t0,
        tamanho_treino: texto.length,
      });
    });
  } catch (e) {
    console.error("[marina/teste]", (e as Error).message);
    return Response.json({ erro: `Não consegui falar com a Marina agora (${(e as Error).message}).` }, { status: 502 });
  }
}
