import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { abrirChamado, talvezProcessarPrazos, vinculoDaAbertura } from "@/lib/escalonamento";
import { normalizarNumero } from "@/lib/escalonamento-base";
import { registrarLacuna } from "@/lib/marina";

export const dynamic = "force-dynamic";

/**
 * A Marina não sabe a resposta: abre um chamado para a equipe.
 *
 *   POST { "pergunta": "...", "cliente": "5541999990000", "contexto": "...", "assunto": "financeiro" }
 *
 * O site escolhe a pessoa (setor → horário → prioridade), manda a
 * mensagem com o código do chamado e devolve a frase para o cliente.
 * Se o site não conseguir mandar, devolve `aviso_manual` — aí a Marina
 * manda ela mesma para o número indicado. Com o escalonamento desligado,
 * a pergunta vai para "Sem resposta" como antes.
 */
export async function POST(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const corpo = await request.json().catch(() => null);
  const pergunta = typeof corpo?.pergunta === "string" ? corpo.pergunta.trim() : "";
  const cliente = normalizarNumero(String(corpo?.cliente ?? ""));
  if (pergunta.length < 4 || !cliente) {
    return Response.json({ ok: false, erro: "Informe a pergunta e o número do cliente (com DDD)." }, { status: 400 });
  }

  const r = await comSql(async (sql) => {
    const a = await abrirChamado(sql, {
      canal: "whatsapp", destino: cliente, pergunta,
      contexto: typeof corpo?.contexto === "string" ? corpo.contexto : null,
      assunto: typeof corpo?.assunto === "string" ? corpo.assunto : null,
    });
    if (a.ok || a.motivo === "desligado") await registrarLacuna(sql, { pergunta, canal: "whatsapp", ...vinculoDaAbertura(a) });
    await talvezProcessarPrazos(sql);
    return a;
  });

  if (!r.ok) {
    return Response.json({
      ok: true,
      dados: { escalado: false, motivo: r.motivo },
      resumo_texto: r.motivo === "desligado"
        ? "O escalonamento está desligado. A pergunta foi anotada para a administração. Diga ao cliente que vai confirmar com a pousada e ofereça o contato da recepção."
        : r.erro,
      fonte: "local", consultado_em: new Date().toISOString(),
    });
  }
  const avisoOk = r.aviso?.envio.ok ?? true;
  return Response.json({
    ok: true,
    dados: {
      escalado: true, novo: r.novo, codigo: r.chamado.codigo, setor: r.chamado.setor,
      equipe_avisada: r.aviso?.contato ? { nome: r.aviso.contato.nome, enviado: avisoOk } : null,
      aviso_manual: r.aviso?.contato && !avisoOk ? { para: r.aviso.contato.numero, texto: r.aviso.texto } : null,
      mensagem_cliente: r.mensagemCliente,
    },
    resumo_texto: [
      `Chamado #${r.chamado.codigo} ${r.novo ? "aberto" : "já estava aberto"}.`,
      r.aviso?.contato
        ? avisoOk ? `A equipe (${r.aviso.contato.nome}) já foi avisada.` : `NÃO consegui avisar a equipe pelo sistema: mande você mesma a mensagem de "aviso_manual" para +${r.aviso.contato.numero}.`
        : r.novo ? "Não há ninguém da equipe disponível para avisar agora; a administração vai ver no painel." : "",
      `Diga ao cliente, com as suas palavras: "${r.mensagemCliente}"`,
    ].filter(Boolean).join("\n"),
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
