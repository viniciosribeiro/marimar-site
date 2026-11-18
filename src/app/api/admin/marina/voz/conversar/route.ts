import { after } from "next/server";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { gatewayConfigurado } from "@/lib/chat";
import { perguntarAoGateway, ErroGateway, type Troca } from "@/lib/marina-gateway";
import { garantirEsquemaVoz } from "@/lib/esquema-voz-treino";
import {
  montarSistemaVoz, lerPrecosVoz, usoDoMesCentavos, garantirSessao, anexarTranscricao,
} from "@/lib/marina-voz";
import { extrairAcao, estadoGasto } from "@/lib/marina-voz-base";
import { ACOES, acaoExiste } from "@/lib/marina-voz-acoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Um turno da conversa por voz: a fala (já em texto) vai à Marina pelo mesmo
 * gateway e o mesmo treinamento do chat, com o contexto de voz e a lista de
 * ações. A resposta pode trazer uma AÇÃO proposta — aqui ela é validada e
 * descrita para o cartão de confirmação; executar é outro passo, só depois do
 * "sim" (ver admin/marina/voz-acoes.ts). O texto falado e o que a Marina
 * respondeu ficam guardados na sessão.
 */
export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user) return Response.json({ erro: "Entre no painel de novo." }, { status: 401 });
  if (!gatewayConfigurado()) {
    return Response.json({ erro: "A Marina ainda não está ligada a este site (faltam OPENCLAW_GATEWAY_URL e OPENCLAW_GATEWAY_TOKEN na Vercel)." }, { status: 503 });
  }
  const tecnico = (s.user as { role?: string }).role === "master";
  const autor = (s.user.name || s.user.email || "painel") as string;

  const corpo = await req.json().catch(() => null);
  const sessao = String(corpo?.sessao ?? "").slice(0, 64);
  const mensagem = typeof corpo?.mensagem === "string" ? corpo.mensagem.trim().slice(0, 2000) : "";
  const historico: Troca[] = Array.isArray(corpo?.historico)
    ? corpo.historico.filter((t: Troca) => t && typeof t.conteudo === "string" && (t.papel === "voce" || t.papel === "marina")).slice(-10)
    : [];
  if (!mensagem) return Response.json({ erro: "Não ouvi nada. Pode falar de novo?" }, { status: 400 });

  /* Havia um "confirma?" no ar e a resposta não foi um sim/não claro: a
     Marina recebe a ação pendente para decidir (repetir = confirmar). */
  const p = corpo?.pendente;
  const aguardando = p && typeof p.nome === "string" && p.nome.length <= 40
    ? {
        nome: p.nome,
        descricao: String(p.descricao ?? "").slice(0, 300),
        dados: JSON.stringify(p.dados ?? {}).slice(0, 2000),
        situacao: corpo?.situacao === "corrige" ? ("corrige" as const) : ("outra" as const),
      }
    : null;

  try {
    return await comSql(async (sql) => {
      await garantirEsquemaVoz(sql);
      /* Em paralelo (o postgres.js manda as consultas juntas na mesma conexão). */
      const [{ sistema }, gasto] = await Promise.all([
        montarSistemaVoz(sql, tecnico, aguardando),
        lerPrecosVoz(sql).then(async (precos) => estadoGasto(await usoDoMesCentavos(sql, precos), precos)),
      ]);
      const { texto: bruto, cortada } = await perguntarAoGateway(`painel-voz:${sessao || "sem-sessao"}`, sistema, historico, mensagem);
      const { texto: fala, acao } = extrairAcao(bruto);

      let cartao: { nome: string; dados?: Record<string, unknown>; descricao: string; valido: boolean } | null = null;
      if (acao) {
        if (!acaoExiste(acao.nome, tecnico)) {
          cartao = { nome: acao.nome, descricao: "Essa ação ainda não dá para fazer por voz.", valido: false };
        } else {
          const def = ACOES[acao.nome];
          const val = def.validar(acao.dados);
          if (!val.ok) cartao = { nome: acao.nome, descricao: val.erro, valido: false };
          else cartao = { nome: acao.nome, dados: val.dados, descricao: await def.descrever(sql, val.dados), valido: true };
        }
      }

      /* A conversa fica guardada DEPOIS de responder: não atrasa a fala. */
      if (UUID.test(sessao)) {
        after(() => comSql(async (s2) => {
          await garantirSessao(s2, sessao, autor);
          await anexarTranscricao(s2, sessao, [{ papel: "voce", texto: mensagem }, { papel: "marina", texto: fala }]);
        }).catch((e) => console.error("[voz/conversar] registro", (e as Error).message)));
      }

      return Response.json({
        ok: true,
        resposta: fala || "(a Marina não respondeu nada)",
        acao: cartao,
        cortada,
        gasto,
      });
    });
  } catch (e) {
    console.error("[voz/conversar]", (e as Error).message);
    const erro = e instanceof ErroGateway ? e.message : `Não consegui falar com a Marina agora (${(e as Error).message}).`;
    return Response.json({ erro }, { status: 502 });
  }
}
