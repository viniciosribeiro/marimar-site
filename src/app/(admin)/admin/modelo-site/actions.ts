"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";
import { garantirColunaModeloSite } from "@/lib/esquema-modelo-site";
import { lerConfigModelo } from "@/lib/modelo-site";
import { PAGINAS_SITE, todasProntas } from "@/lib/site-novo/paginas";

const TELA = "/admin/modelo-site";

/** Grava a configuração mesclando com a atual (o que não veio fica como estava). */
async function gravar(mudanca: { modelo?: "classico" | "novo"; ceu_por_hora?: boolean }, quem: string | null) {
  await comSql(async (sql) => {
    await garantirColunaModeloSite(sql);
    const [linha] = await sql<{ modelo_site: Record<string, unknown> | null }[]>`SELECT modelo_site FROM pousada LIMIT 1`;
    const atual = lerConfigModelo(linha ?? null);
    const nova = {
      modelo: mudanca.modelo ?? atual.modelo,
      ceu_por_hora: mudanca.ceu_por_hora ?? atual.ceuPorHora,
      alterado_em: new Date().toISOString(),
      alterado_por: quem,
    };
    await sql`UPDATE pousada SET modelo_site = ${sql.json(nova)}`;
  });
  /* O modelo decide o layout de todo o site. */
  revalidatePath("/", "layout");
}

/**
 * Troca o que os VISITANTES veem. Só a Administração (papel master), e o
 * Novo só com todas as páginas prontas (decisão de 04/11/2026: o visitante
 * nunca vê os dois visuais misturados).
 */
export async function trocarModeloSite(formData: FormData) {
  const s = await exigirSessao();
  if ((s.user as { role?: string }).role !== "master") {
    redirect(`${TELA}?erro=${encodeURIComponent("Só quem tem o perfil Administração pode trocar o site dos visitantes.")}`);
  }
  const modelo = formData.get("modelo") === "novo" ? "novo" : "classico";
  if (modelo === "novo" && !todasProntas()) {
    const faltam = PAGINAS_SITE.filter((p) => !p.pronta).length;
    redirect(`${TELA}?erro=${encodeURIComponent(`O site novo ainda tem ${faltam} ${faltam === 1 ? "página" : "páginas"} em construção. Ele só pode ir para todos quando estiver completo.`)}`);
  }
  let erro = "";
  try {
    await gravar({ modelo }, s.user?.email ?? null);
  } catch (e) {
    console.error("[modelo-site] não gravou:", (e as Error).message);
    erro = "Não consegui salvar agora. Tente de novo em instantes.";
  }
  if (erro) redirect(`${TELA}?erro=${encodeURIComponent(erro)}`);
  redirect(`${TELA}?ok=${encodeURIComponent(modelo === "novo" ? "Pronto: os visitantes já veem o site novo." : "Pronto: os visitantes voltaram ao site clássico.")}`);
}

/** O céu do topo do Novo acompanhando a hora na ilha: ligar ou desligar. */
export async function alternarCeuPorHora(formData: FormData) {
  const s = await exigirSessao();
  const ligar = formData.get("ligar") === "1";
  let erro = "";
  try {
    await gravar({ ceu_por_hora: ligar }, s.user?.email ?? null);
  } catch (e) {
    console.error("[modelo-site] céu não gravou:", (e as Error).message);
    erro = "Não consegui salvar agora. Tente de novo em instantes.";
  }
  if (erro) redirect(`${TELA}?erro=${encodeURIComponent(erro)}`);
  redirect(`${TELA}?ok=${encodeURIComponent(ligar ? "O céu do site novo volta a acompanhar a hora na ilha." : "O céu do site novo fica sempre igual.")}`);
}
