import postgres from "postgres";
import {
  LIMITE_POR_HORA, LIMITE_CARACTERES, CONTEXTO_MENSAGENS,
  hashIp, ipDaRequisicao, gatewayConfigurado, urlGateway, cabecalhosGateway,
  INDISPONIVEL,
} from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Atendimento da Marina no site.
 *
 * Esta rota é a ÚNICA coisa pública desta história. Ela não recebe chave
 * nenhuma do navegador e não aceita nada além de uma pergunta em texto.
 *
 * Três decisões que valem explicação:
 *
 * 1. **O histórico vem do banco, não do navegador.** O cliente manda só a
 *    mensagem nova. Se o histórico viesse dele, qualquer pessoa poderia
 *    forjar uma mensagem de "sistema" e reescrever as instruções da Marina
 *    — é o caminho mais fácil para fazer um agente sair do papel.
 *
 * 2. **O token do gateway não sai daqui.** A documentação do OpenClaw trata
 *    aquele endpoint como acesso de operador; ele nunca pode chegar ao
 *    navegador.
 *
 * 3. **Falha vira resposta, não erro.** Quando o gateway cai, o visitante
 *    recebe uma frase e o WhatsApp — nunca uma tela de erro.
 */
export async function POST(req: Request) {
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const corpo = await req.json().catch(() => null);
    const sessao = typeof corpo?.sessao === "string" ? corpo.sessao.slice(0, 64) : "";
    const mensagem = typeof corpo?.mensagem === "string" ? corpo.mensagem.trim() : "";

    if (!sessao || !mensagem) {
      return Response.json({ erro: "Mensagem vazia." }, { status: 400 });
    }
    if (mensagem.length > LIMITE_CARACTERES) {
      return Response.json(
        { erro: `Mensagem muito longa (máximo ${LIMITE_CARACTERES} caracteres).` },
        { status: 400 },
      );
    }

    sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });

    // Interruptor da administração. Desligado, a rota nem chega ao gateway.
    const [p] = await sql<{ chat_ativo: boolean; whatsapp: string | null }[]>`
      SELECT chat_ativo, whatsapp FROM pousada LIMIT 1`;
    if (!p?.chat_ativo) {
      return Response.json({ erro: "desligado", whatsapp: p?.whatsapp ?? null }, { status: 503 });
    }
    if (!gatewayConfigurado()) {
      console.error("[chat] OPENCLAW_GATEWAY_URL/TOKEN ausentes");
      return Response.json({ erro: INDISPONIVEL }, { status: 503 });
    }

    const ip = hashIp(ipDaRequisicao(req));

    const [{ usadas }] = await sql<{ usadas: number }[]>`
      SELECT COUNT(*)::int AS usadas FROM chat_mensagens
      WHERE ip_hash = ${ip} AND papel = 'visitante' AND criado_em > now() - interval '1 hour'`;
    if (usadas >= LIMITE_POR_HORA) {
      return Response.json(
        { erro: "Você fez muitas perguntas seguidas. Continue no WhatsApp, que a pousada responde direto." },
        { status: 429 },
      );
    }

    await sql`
      INSERT INTO chat_mensagens (sessao, ip_hash, papel, conteudo)
      VALUES (${sessao}, ${ip}, 'visitante', ${mensagem})`;

    const anteriores = await sql<{ papel: string; conteudo: string }[]>`
      SELECT papel, conteudo FROM chat_mensagens
      WHERE sessao = ${sessao}
      ORDER BY criado_em DESC
      LIMIT ${CONTEXTO_MENSAGENS}`;

    const mensagens = anteriores
      .reverse()
      .map((m) => ({
        role: m.papel === "visitante" ? "user" : "assistant",
        content: m.conteudo,
      }));

    const resposta = await fetch(urlGateway("/v1/chat/completions"), {
      method: "POST",
      headers: cabecalhosGateway(),
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODELO || "openclaw",
        stream: true,
        // A sessão viaja para o agente manter o fio da conversa do lado dele
        // também — o mesmo mecanismo que separa uma conversa do WhatsApp da
        // outra. O prefixo evita colidir com um número de telefone.
        user: `site:${sessao}`,
        messages: mensagens,
      }),
    });

    if (!resposta.ok || !resposta.body) {
      const detalhe = await resposta.text().catch(() => "");
      console.error("[chat] gateway respondeu", resposta.status, detalhe.slice(0, 300));
      await sql.end();
      return Response.json({ erro: INDISPONIVEL }, { status: 502 });
    }

    /* Converte o SSE do gateway em texto corrido para o navegador.
       O cliente não precisa entender protocolo nenhum: recebe letras. */
    const conexao = sql;
    const fluxo = new ReadableStream<Uint8Array>({
      async start(controlador) {
        const leitor = resposta.body!.getReader();
        const decodificador = new TextDecoder();
        const codificador = new TextEncoder();
        let sobra = "";
        let completa = "";

        try {
          for (;;) {
            const { done, value } = await leitor.read();
            if (done) break;
            sobra += decodificador.decode(value, { stream: true });

            const linhas = sobra.split("\n");
            sobra = linhas.pop() ?? "";

            for (const linha of linhas) {
              if (!linha.startsWith("data:")) continue;
              const dado = linha.slice(5).trim();
              if (dado === "[DONE]") continue;
              try {
                const pedaco = JSON.parse(dado)?.choices?.[0]?.delta?.content;
                if (typeof pedaco === "string" && pedaco) {
                  completa += pedaco;
                  controlador.enqueue(codificador.encode(pedaco));
                }
              } catch {
                // Linha parcial ou keep-alive: ignorar é o certo aqui.
              }
            }
          }
        } catch (e) {
          console.error("[chat] fluxo interrompido:", (e as Error).message);
        } finally {
          controlador.close();
          // Grava o que a Marina respondeu, mesmo que o fluxo tenha sido
          // cortado no meio: o pedaço que a pessoa leu faz parte da conversa.
          try {
            if (completa.trim()) {
              await conexao`
                INSERT INTO chat_mensagens (sessao, ip_hash, papel, conteudo)
                VALUES (${sessao}, ${ip}, 'marina', ${completa.trim()})`;
            }
          } catch (e) {
            console.error("[chat] nao gravou a resposta:", (e as Error).message);
          } finally {
            await conexao.end();
          }
        }
      },
    });

    return new Response(fluxo, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    });
  } catch (e) {
    console.error("[chat] falha:", (e as Error).message);
    try { await sql?.end(); } catch {}
    return Response.json({ erro: INDISPONIVEL }, { status: 500 });
  }
}
