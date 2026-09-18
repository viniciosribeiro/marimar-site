/**
 * Autenticacao das rotas /api/agent/* (consumidas pela Marina no OpenClaw).
 *
 * IMPORTANTE — bug corrigido em 18/09/2026:
 * As rotas comparavam `key !== process.env.AGENT_API_KEY` diretamente.
 * Se AGENT_API_KEY nao estivesse definida no ambiente, os dois lados eram
 * `undefined` e a comparacao passava: qualquer request SEM header de
 * Authorization era autorizado. Todas as 7 rotas do agente ficavam abertas.
 *
 * Esta funcao falha fechada: sem env var configurada, ninguem entra.
 */
export function checkAgentAuth(request: Request): boolean {
  const expected = process.env.AGENT_API_KEY;

  // Fail-closed: sem chave configurada no ambiente, nega tudo.
  if (!expected || expected.length < 16) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;

  const provided = match[1].trim();
  if (provided.length !== expected.length) return false;

  // Comparacao de tempo constante (evita timing attack).
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Resposta padrao de 401 para as rotas do agente. */
export function agentUnauthorized(): Response {
  return Response.json(
    { ok: false, erro: "Nao autorizado" },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
  );
}
