"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";
import { ACOES, acaoExiste } from "@/lib/marina-voz-acoes";
import { garantirSessao, anexarAcaoFeita } from "@/lib/marina-voz";
import { garantirEsquemaVoz } from "@/lib/esquema-voz-treino";

/**
 * Executa uma ação que a Marina propôs no modo voz, DEPOIS da confirmação.
 *
 * É o único ponto onde o painel muda por voz, e começa — como toda Server
 * Action do admin — por `exigirSessao()`. Valida de novo (nunca confia na
 * descrição que o navegador mandou), roda com o login de quem está
 * treinando (autor assinado) e registra na sessão o que foi feito.
 *
 * A confirmação acontece ANTES, na tela: aqui já chega um "sim".
 */
export type ResultadoVoz = { ok: boolean; mensagem: string };

const autorDe = (s: Awaited<ReturnType<typeof exigirSessao>>) =>
  (s.user?.name || s.user?.email || "painel") as string;

export async function executarAcaoVoz(sessaoId: string, nome: string, dados: Record<string, unknown>): Promise<ResultadoVoz> {
  const s = await exigirSessao();
  const tecnico = (s.user as { role?: string } | undefined)?.role === "master";

  if (!acaoExiste(nome, tecnico)) {
    return { ok: false, mensagem: "Essa ação não existe ou precisa do perfil Administração." };
  }
  const acao = ACOES[nome];
  const validacao = acao.validar(dados ?? {});
  if (!validacao.ok) return { ok: false, mensagem: validacao.erro };

  const autor = autorDe(s);
  const id = typeof sessaoId === "string" && /^[0-9a-f-]{8,64}$/i.test(sessaoId) ? sessaoId : null;

  const r = await comSql(async (sql): Promise<ResultadoVoz> => {
    const res = await acao.executar(sql, validacao.dados, autor);
    if (!res.ok) return { ok: false, mensagem: res.erro };
    if (id) {
      await garantirEsquemaVoz(sql);
      await garantirSessao(sql, id, autor).catch(() => {});
      await anexarAcaoFeita(sql, id, { nome, resumo: res.resumo }).catch(() => {});
    }
    return { ok: true, mensagem: res.resumo };
  });

  /* O que a Marina muda por voz aparece nas mesmas telas do painel e no site. */
  for (const p of ["/admin/marina", "/admin/pousada", "/", "/reservar", "/politicas"]) revalidatePath(p);
  return r;
}
