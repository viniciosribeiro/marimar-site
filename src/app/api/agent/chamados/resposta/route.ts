import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import { responderChamado, talvezProcessarPrazos } from "@/lib/escalonamento";

export const dynamic = "force-dynamic";

/**
 * Alguém da EQUIPE mandou mensagem para o número da pousada.
 *
 *   POST { "numero": "5541...", "texto": "...", "citado": "texto da mensagem respondida (se houver)" }
 *
 * O site acha o chamado (código no texto ou na mensagem citada; sem
 * código, o único chamado aberto daquela pessoa), escreve a resposta no
 * tom da Marina e entrega ao cliente no canal dele. Devolve o que dizer à
 * pessoa da equipe. Se não for ninguém da equipe: `equipe: false` — a
 * conversa segue normal, como com um hóspede.
 *
 * Depois de entregar, pergunta à pessoa se pode guardar a resposta como
 * aprendizado. A próxima mensagem dela (SIM / NÃO / uma versão nova) chega
 * por esta mesma rota e volta `dados.confirmacao`.
 */
export async function POST(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();
  const corpo = await request.json().catch(() => null);
  const texto = typeof corpo?.texto === "string" ? corpo.texto.trim().slice(0, 4000) : "";
  const numero = typeof corpo?.numero === "string" ? corpo.numero : "";
  if (!texto || !numero) return Response.json({ ok: false, erro: "Informe o número de quem escreveu e o texto." }, { status: 400 });

  const r = await comSql(async (sql) => {
    const x = await responderChamado(sql, {
      numero, texto,
      citado: typeof corpo?.citado === "string" ? corpo.citado.slice(0, 4000) : null,
      codigo: typeof corpo?.codigo === "string" ? corpo.codigo : null,
    });
    await talvezProcessarPrazos(sql);
    return x;
  });

  const agora = new Date().toISOString();
  if (r.tipo === "nao_equipe") {
    return Response.json({ ok: true, dados: { equipe: false }, resumo_texto: "Este número não é da equipe. Atenda como um hóspede.", fonte: "local", consultado_em: agora });
  }
  if (r.tipo === "confirmacao") {
    /* Resposta à pergunta "posso guardar?". O resumo_texto vai LITERAL para
       a pessoa da equipe (é a próxima pergunta ou o "guardado"). */
    return Response.json({ ok: true, dados: { equipe: true, confirmacao: r.resultado, codigo: r.codigo }, resumo_texto: r.mensagem, fonte: "local", consultado_em: agora });
  }
  if (r.tipo !== "respondido") {
    return Response.json({ ok: true, dados: { equipe: true, respondido: false, codigos: r.tipo === "qual" ? r.codigos : [] }, resumo_texto: r.mensagem, fonte: "local", consultado_em: agora });
  }
  return Response.json({
    ok: true,
    dados: {
      equipe: true, respondido: true, codigo: r.chamado.codigo, canal: r.chamado.canal, entregue: r.entregue,
      entregar_manual: r.entregarManual, aprendizado: r.aprendizado?.status ?? null,
      /* true: o resumo_texto termina com a pergunta "posso guardar?" — a
         próxima mensagem desta pessoa volta para esta rota (sim/não/versão). */
      confirmando: r.confirmando,
    },
    resumo_texto: r.entregarManual
      ? `${r.mensagem}\nMande você mesma ao cliente +${r.entregarManual.para} esta mensagem:\n${r.entregarManual.texto}`
      : r.mensagem,
    fonte: "local",
    consultado_em: agora,
  });
}
