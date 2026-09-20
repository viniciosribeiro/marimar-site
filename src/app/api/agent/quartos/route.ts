import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import postgres from "postgres";

/**
 * Catálogo de acomodações para a Marina.
 *
 * Devolve, além dos campos do quarto, DUAS coisas que antes faltavam e que
 * a obrigavam a improvisar: as fotos (da nossa tabela `midias`) e o endereço
 * da página do quarto no NOSSO site.
 *
 * Sem isso ela respondia "veja o tour virtual" apontando para o WordPress
 * antigo — um domínio que não é nosso sistema e que sai do ar na virada de
 * DNS. Um agente sem a fonte certa não fica calado: ele acha outra.
 *
 * Preço e disponibilidade continuam fora daqui de propósito: isso é do motor,
 * pela `consulta-desbravador`, sempre ao vivo.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  const lista = await sql`
    SELECT q.*, c.nome as cat_nome
    FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id
    WHERE q.ativo = true ORDER BY q.ordem
  `;

  /* As fotos vêm numa consulta só, e não uma por quarto: são poucos quartos
     hoje, mas uma consulta por item é a coisa que sempre volta como lentidão
     quando o catálogo cresce. Seis por quarto é o que cabe numa conversa —
     mandar quinze fotos no WhatsApp de alguém é agressão, não atendimento. */
  const fotos = await sql<{ quarto_id: string; url: string; alt: string }[]>`
    SELECT quarto_id, url, alt FROM midias
    WHERE quarto_id IS NOT NULL AND tipo = 'foto'
    ORDER BY destaque DESC, ordem ASC
  `;
  /* Comodidades por quarto. Sem isto a Marina descrevia um quarto sem saber
     se ele tem ar-condicionado — e "tem ar?" e das tres perguntas mais
     feitas no verao. Uma consulta so, pelo mesmo motivo das fotos. */
  let comodidades: { quarto_id: string; nome: string }[] = [];
  try {
    comodidades = await sql<{ quarto_id: string; nome: string }[]>`
      SELECT qc.quarto_id, c.nome FROM quarto_comodidades qc
      JOIN comodidades c ON c.id = qc.comodidade_id
      WHERE c.ativo = true ORDER BY c.ordem`;
  } catch { /* tabela ausente neste banco */ }

  await sql.end();

  const comodidadesDe = new Map<string, string[]>();
  for (const c of comodidades) {
    comodidadesDe.set(c.quarto_id, [...(comodidadesDe.get(c.quarto_id) ?? []), c.nome]);
  }

  const porQuarto = new Map<string, { url: string; alt: string }[]>();
  for (const f of fotos) {
    const atual = porQuarto.get(f.quarto_id) ?? [];
    if (atual.length < 6) atual.push({ url: f.url, alt: f.alt });
    porQuarto.set(f.quarto_id, atual);
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://marimar-site.vercel.app")
    .replace(/\/+$/, "");

  type Quarto = Record<string, unknown> & { id: string; slug: string; nome: string; ocupacao_max: number };

  const dados = (lista as unknown as Quarto[]).map((q) => ({
    ...q,
    url: `${base}/quartos/${q.slug}`,
    fotos: porQuarto.get(q.id) ?? [],
    comodidades: comodidadesDe.get(q.id) ?? [],
  }));

  const nomes = dados
    .map((q) =>
      `• ${q.nome} (ate ${q.ocupacao_max} pessoas)` +
      `${q.comodidades.length ? ` — ${q.comodidades.join(", ")}` : " — comodidades nao cadastradas"}` +
      ` — ${q.fotos.length} fotos — ${q.url}`,
    )
    .join("\n");

  return Response.json({
    ok: true,
    dados,
    resumo_texto: `Catalogo com ${dados.length} quartos:\n${nomes}`,
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
