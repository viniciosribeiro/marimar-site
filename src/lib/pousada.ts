import { cache } from "react";
import postgres from "postgres";
import { CONTATO } from "@/lib/conteudo-pousada";

/**
 * A linha da tabela `pousada`, uma vez por requisicao.
 *
 * Cada pagina do site pedia esta mesma linha tres vezes — generateMetadata,
 * layout raiz e layout do site —, cada uma abrindo uma conexao nova com o
 * Neon (o custo de conexao+TLS e maior que o da consulta). O `cache` do React
 * guarda o resultado so durante a renderizacao de UMA requisicao: nada fica
 * velho entre visitas, e o que o admin salva aparece na visita seguinte.
 *
 * `to_jsonb` evita nomear colunas: funciona antes e depois de qualquer
 * migration que acrescente campo na tabela. Falha vira null — quem chama
 * decide o fallback, porque o site nao pode cair por causa do banco.
 */
export const lerPousada = cache(async (): Promise<Record<string, any> | null> => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
  try {
    const [row] = await sql`SELECT to_jsonb(p) AS dados FROM pousada p LIMIT 1`;
    return (row?.dados as Record<string, any>) ?? null;
  } catch (e) {
    console.error("[pousada] banco indisponivel:", (e as Error).message);
    return null;
  } finally {
    await sql.end().catch(() => {});
  }
});

/**
 * Número de WhatsApp no formato que o wa.me exige: só dígitos, COM o 55.
 *
 * O banco guarda como a pessoa digita — "(41) 99501-2920". Até 28/09/2026 o
 * site só tirava a pontuação e gerava wa.me/41995012920: sem o código do
 * Brasil, o WhatsApp lê "41" como código de país (Suíça) e o botão abria uma
 * conversa com um número que não existe.
 */
export function digitosWhatsApp(bruto: string | null | undefined): string {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) return "55" + d; // DDD + número
  return d;
}

/**
 * Contato público da pousada: o que a administração salvou em "Dados da
 * pousada", com o valor confirmado do código como reserva. Site e Marina
 * leem daqui — antes a Marina usava um número fixo no código e ignorava o
 * que fosse salvo no painel.
 */
export async function lerContato(pousada?: Record<string, any> | null) {
  const p = pousada === undefined ? await lerPousada() : pousada;
  const whatsappDigitos = digitosWhatsApp(p?.whatsapp) || CONTATO.whatsappDigitos;
  return {
    whatsapp: (p?.whatsapp as string | undefined)?.trim() || CONTATO.whatsapp,
    whatsappDigitos,
    telefone: (p?.telefone as string | undefined)?.trim() || null,
    email: (p?.email as string | undefined)?.trim() || null,
    instagram: (p?.instagram as string | undefined)?.trim() || null,
    horarioRecepcao: (p?.horario_recepcao as string | undefined)?.trim() || null,
  };
}
