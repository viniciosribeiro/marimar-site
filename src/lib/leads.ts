import { comSql } from "@/lib/db-conexao";

export type DadosLead = {
  nome?: unknown; telefone?: unknown; email?: unknown; mensagem?: unknown;
};

/** Texto limpo e cortado no tamanho da coluna; vazio vira null. */
function campo(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Grava um contato vindo do site ou da Marina.
 *
 * Era o mesmo INSERT copiado em tres lugares (formulario de contato,
 * /api/agent/lead e o POST de /api/agent/pousada), sem limite de tamanho:
 * `telefone` e varchar(20), e um "(41) 99999-9999 whatsapp" derrubava o
 * insert com erro 500. Os limites aqui batem com o schema.
 *
 * Retorna false quando falta o nome — o unico campo obrigatorio.
 */
export async function registrarLead(dados: DadosLead, origem: "site" | "agente"): Promise<boolean> {
  const nome = campo(dados.nome, 255);
  if (!nome) return false;
  const telefone = campo(dados.telefone, 20);
  const email = campo(dados.email, 255);
  const mensagem = campo(dados.mensagem, 5000);

  await comSql((sql) => sql`
    INSERT INTO leads (nome, telefone, email, mensagem, origem)
    VALUES (${nome}, ${telefone}, ${email}, ${mensagem}, ${origem})`);
  return true;
}

/**
 * Corpo do POST de /api/agent/lead e de /api/agent/pousada, que faz a mesma coisa
 * (mantido la porque versoes antigas da skill da Marina ainda o chamam).
 * JSON invalido agora e 400 com mensagem, e nao um 500 sem explicacao.
 */
export async function receberLead(request: Request): Promise<Response> {
  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") {
    return Response.json({ ok: false, erro: "Corpo JSON invalido" }, { status: 400 });
  }
  try {
    const gravou = await registrarLead(corpo, "agente");
    if (!gravou) return Response.json({ ok: false, erro: "Nome obrigatorio" }, { status: 400 });
  } catch (e) {
    console.error("[agent/lead] nao gravou:", (e as Error).message);
    return Response.json({ ok: false, erro: "Nao foi possivel registrar o lead" }, { status: 500 });
  }
  return Response.json({
    ok: true, dados: {}, resumo_texto: "Lead registrado com sucesso",
    fonte: "local", consultado_em: new Date().toISOString(),
  });
}
