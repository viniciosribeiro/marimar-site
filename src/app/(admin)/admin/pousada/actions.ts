"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";
import { digitosWhatsApp } from "@/lib/pousada";

const txt = (f: FormData, k: string, max: number) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

/**
 * Dados de contato e apresentação da pousada.
 *
 * Até 28/09/2026 não havia tela para nada disto: o WhatsApp, o e-mail e a
 * história só mudavam no banco, na mão. A Marina ainda por cima usava um
 * número fixo no código. Agora o que é salvo aqui vale no site inteiro
 * (topo, rodapé, botões) e na Marina (/api/agent/pousada).
 */
export async function salvarPousada(f: FormData) {
  await exigirSessao();

  const whatsapp = txt(f, "whatsapp", 20);
  if (whatsapp && digitosWhatsApp(whatsapp).length < 12) {
    redirect("/admin/pousada?erro=" + encodeURIComponent("WhatsApp incompleto. Use DDD + número, ex.: (41) 99501-2920."));
  }

  const dados = {
    nome: txt(f, "nome", 255) ?? "Pousada Marimar",
    whatsapp,
    telefone: txt(f, "telefone", 20),
    email: txt(f, "email", 255),
    instagram: txt(f, "instagram", 255),
    endereco: txt(f, "endereco", 500),
    horario_recepcao: txt(f, "horario_recepcao", 50),
    descricao_longa: txt(f, "descricao_longa", 5000),
  };

  await comSql(async (sql) => {
    const [linha] = await sql`SELECT id FROM pousada LIMIT 1`;
    if (linha) {
      await sql`UPDATE pousada SET ${sql(dados)}, atualizado_em = now() WHERE id = ${linha.id}`;
    } else {
      await sql`INSERT INTO pousada ${sql({ ...dados, slug: "pousada-marimar" })}`;
    }
  });

  // Topo, rodapé e botões de WhatsApp estão no layout de TODAS as páginas.
  revalidatePath("/", "layout");
  redirect("/admin/pousada?ok=" + encodeURIComponent("Dados salvos. Já valem no site e para a Marina."));
}
