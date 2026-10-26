<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Marimar Site — leitura obrigatoria antes de codar

Este projeto e mantido por **varias ferramentas agenticas diferentes** (Claude, Agent
Hermes/OpenRouter, e outras). Para nao se atropelarem, existe um protocolo.

## Ordem de leitura

1. **`docs/ESTADO-DO-PROJETO.md`** — visao geral, arquitetura, mapa do codigo,
   convencoes e pendencias. **Este e o ponto de entrada.**
2. **`docs/CHANGELOG.md`** — o que mudou por ultimo e o que ficou pendente
2b. **`docs/HANDOFF-PROXIMO-AGENTE.md`** — se voce esta retomando o trabalho, comece por aqui
3. `git log --oneline -15` e `git status`
4. `docs/padrao-crud.md` — se for criar/alterar tela de admin
5. `docs/contrato-api.md` — se for mexer em disponibilidade/tarifas
6. `docs/runbook.md` — deploy, env vars, rotacao de chave

## Ao terminar qualquer trabalho (continuidade obrigatoria entre IAs)

O proprietario pediu explicitamente em **26/10/2026** que tudo fique
documentado para Claude e os demais agentes continuarem depois. Ao concluir
cada mudanca relevante, na MESMA entrega:

1. Nova entrada **no topo** de `docs/CHANGELOG.md`: intencao, arquivos
   alterados, contexto, teste/evidencia, commit/PR, o que ainda falta.
2. Atualizar estado e **pendencias reais** em `docs/ESTADO-DO-PROJETO.md`.
3. Atualizar a secao **ESTADO ATUAL** de
   `docs/HANDOFF-PROXIMO-AGENTE.md`: resumo que alguem sem o chat
   consiga entender e procedimento de validacao/continuidade.
4. Se a mudanca exigir comando na Hostinger, registrar se foi so preparada
   no repositorio, realmente instalada, ou validada em atendimento real.
   **Merge no GitHub e deploy Vercel NAO instalam skills OpenClaw.**
5. Diferenciar claramente: implementado, compilado, implantado, testado
   em producao, **confirmado pelo usuario**, parcial e pendente.
   Nao afirmar sucesso que nao foi observado.
6. Commitar tudo. Nunca commitar segredos, transcricoes ou identificadores
   de hospedes; nao guardar backup de config OpenClaw no repositorio.

## Regras rigidas

- **Nunca commitar segredos.** `AGENT_API_KEY`, `AUTH_SECRET` e `DATABASE_URL` vivem
  apenas em `.env.local` (gitignored) e no painel da Vercel.
- **Nunca reintroduzir Cloudflare/wrangler.** O deploy e Vercel desde 17/09/2026.
- **Nunca assumir que uma env var existe.** Falhe fechado — ver `src/lib/agent-auth.ts`
  e o bug de bypass documentado no CHANGELOG de 18/09/2026.
- **O site nao fecha reserva.** O escopo e consulta; o fechamento e no motor
  Desbravador ou WhatsApp.
- **Idioma do codigo:** portugues sem acento em rotas, tabelas, colunas e funcoes
  (`disponibilidade`, `criado_em`, `visivel_agente`).
