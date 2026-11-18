import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { mesmaOrigem } from "@/lib/mesma-origem";
import { comSql } from "@/lib/db-conexao";
import { ACOES, acaoExiste } from "@/lib/marina-voz-acoes";
import { garantirSessao, anexarAcaoFeita, anexarTranscricao } from "@/lib/marina-voz";
import { garantirEsquemaVoz } from "@/lib/esquema-voz-treino";
import { novoContexto, registrarFeita, estadoPilha, type EstadoPilha } from "@/lib/marina-voz-desfazer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A pessoa respondeu a um "confirma?" do modo voz: executa a ação (sim) ou
 * só registra a recusa (não).
 *
 * É uma ROTA, e não uma Server Action, de propósito. Server Action com
 * `revalidatePath` re-renderiza no servidor a página do painel que está
 * aberta ANTES de devolver a resposta, e as Server Actions de um navegador
 * andam em fila, uma por vez. Era isso que deixava o "Confirmar" pensando:
 * a gravação levava um instante, mas a resposta esperava a página inteira
 * do painel ser montada de novo. Aqui a resposta sai assim que grava; a
 * página de trás se atualiza sozinha depois (o painel chama refresh).
 *
 * Segurança igual à das telas: login obrigatório, mesma origem, validação de
 * novo no servidor (nunca confia no que o navegador descreveu), ação técnica
 * só para o perfil Administração, e tudo assinado com o login de quem falou.
 */
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ ok: false, mensagem: "Entre no painel de novo." }, { status: 401 });
  if (!mesmaOrigem(req)) return Response.json({ ok: false, mensagem: "Pedido recusado." }, { status: 403 });

  const tecnico = (s.user as { role?: string }).role === "master";
  const autor = (s.user.name || s.user.email || "painel") as string;

  const corpo = await req.json().catch(() => null);
  const sessao = UUID.test(String(corpo?.sessao ?? "")) ? String(corpo.sessao) : null;
  const fala = typeof corpo?.fala === "string" ? corpo.fala.trim().slice(0, 500) : "";

  /* "Não": nada muda no painel; só fica na conversa, para a Marina lembrar. */
  if (corpo?.cancelar === true) {
    if (sessao) registrar(sessao, autor, [{ papel: "voce", texto: fala || "(não confirmou)" }, { papel: "marina", texto: "Tudo bem, não vou mexer nisso." }]);
    return Response.json({ ok: true, mensagem: "Tudo bem, não vou mexer nisso." });
  }

  const nome = typeof corpo?.nome === "string" ? corpo.nome : "";
  if (!acaoExiste(nome, tecnico)) {
    return Response.json({ ok: false, mensagem: "Essa ação não existe ou precisa do perfil Administração." });
  }
  const acao = ACOES[nome];
  const dados = corpo?.dados && typeof corpo.dados === "object" && !Array.isArray(corpo.dados) ? corpo.dados : {};
  const validacao = acao.validar(dados);
  if (!validacao.ok) return Response.json({ ok: false, mensagem: validacao.erro });

  let resultado: { ok: boolean; mensagem: string; caminhos: string[]; pilha: EstadoPilha | null };
  try {
    resultado = await comSql(async (sql) => {
      await garantirEsquemaVoz(sql);
      /* Foto de cada linha antes/depois: é o que o botão Desfazer usa. */
      const ctx = novoContexto(sql);
      const r = await acao.executar(sql, validacao.dados, autor, ctx);
      if (!r.ok) return { ok: false, mensagem: r.erro, caminhos: [], pilha: null };
      await registrarFeita(sql, autor, sessao, nome, r.resumo, await ctx.mudancas());
      return { ok: true, mensagem: r.resumo, caminhos: [...(acao.caminhos ?? []), ...(r.caminhos ?? [])], pilha: await estadoPilha(sql, autor) };
    });
  } catch (e) {
    console.error("[voz/acao]", nome, (e as Error).message);
    resultado = { ok: false, mensagem: "Não consegui gravar agora. Confira na tela se algo mudou e tente de novo.", caminhos: [], pilha: null };
  }

  if (resultado.ok) {
    /* Só marca as páginas como velhas (numa rota isto não re-renderiza nada). */
    for (const p of new Set(["/admin/marina", ...resultado.caminhos])) revalidatePath(p);
  }
  if (sessao) {
    registrar(sessao, autor, [{ papel: "voce", texto: fala || "(confirmou)" }, { papel: "marina", texto: resultado.mensagem }],
      resultado.ok ? { nome, resumo: resultado.mensagem } : null);
  }
  return Response.json(resultado);
}

/** Grava a conversa e o que foi feito DEPOIS de responder (não atrasa a tela). */
function registrar(sessao: string, autor: string, turnos: { papel: "voce" | "marina"; texto: string }[], feita: { nome: string; resumo: string } | null = null) {
  after(() => comSql(async (sql) => {
    await garantirEsquemaVoz(sql);
    await garantirSessao(sql, sessao, autor);
    await anexarTranscricao(sql, sessao, turnos);
    if (feita) await anexarAcaoFeita(sql, sessao, feita);
  }).catch((e) => console.error("[voz/acao] registro", (e as Error).message)));
}
