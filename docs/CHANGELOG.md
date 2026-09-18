# Changelog — Marimar Site

Historico de mudancas do projeto. **Toda sessao de trabalho (humana ou de IA) adiciona
uma entrada no topo.**

Formato de cada entrada:

```
## AAAA-MM-DD — Titulo curto
**Autor:** quem fez (ex.: Claude Opus 5 / Agent Hermes / Vinicios)
**Commits:** hashes envolvidos

### Adicionado / Corrigido / Alterado / Removido / Seguranca
- descricao objetiva

### Acao necessaria
- o que ainda precisa ser feito fora do codigo (Vercel, OpenClaw, DNS...)
```

---

## 2026-09-18 — Correcoes pos-migracao Vercel + hardening da API do agente

**Autor:** Claude Opus 5 (Cowork)
**Commits:** _(pendente de commit)_

### Seguranca
- **Bypass de autenticacao nas 7 rotas `/api/agent/*` corrigido.** As rotas comparavam
  `key !== process.env.AGENT_API_KEY` diretamente. Com a env var ausente no ambiente,
  os dois lados eram `undefined`, a comparacao passava e **qualquer request sem header
  de Authorization era autorizado** — expondo dados da pousada, catalogo, precos e o
  endpoint de criacao de leads.
- Criado `src/lib/agent-auth.ts` com `checkAgentAuth()`: fail-closed (nega se a env var
  faltar ou tiver menos de 16 chars), parsing estrito do header `Bearer`, comparacao em
  tempo constante contra timing attack. As 6 rotas com auth foram migradas para ele.
- Removido o fallback hardcoded `"marina-agent-key-marimar-2026"` de
  `src/app/(admin)/admin/integracoes/page.tsx`. A tela agora mostra
  "⚠️ AGENT_API_KEY nao configurada" em vez de vazar uma chave que funcionava.
- Removido o valor da `AGENT_API_KEY` em texto claro de `docs/openclaw-integracao.md`
  (arquivo versionado no GitHub).
- `AGENT_API_KEY` rotacionada em `.env.local`. A chave antiga
  `marina-agent-key-marimar-2026` esta **revogada**.

### Corrigido
- `src/app/(admin)/admin/blocos-home/page.tsx`: link de "Editar" apontava para
  `/amin/blocos-home` (typo) — botao dava 404. Corrigido para `/admin/blocos-home`.
- Criado `.gitattributes` com `* text=auto eol=lf` + `git config core.autocrlf input`
  + `git add --renormalize .`. Isso eliminou 15 arquivos que apareciam como
  "modificados" no `git status` com 537 insercoes / 537 delecoes que eram **apenas
  CRLF vs LF**, sem uma unica mudanca real de codigo.

### Alterado
- `docs/runbook.md` reescrito: removidas as instrucoes de deploy via
  `wrangler pages deploy` (Cloudflare foi abandonado nos commits `1b72a79` e `f578f12`).
  Agora documenta deploy Vercel, tabela completa de env vars, procedimento de rotacao
  da chave e checklist pos-deploy.
- `docs/openclaw-integracao.md`: nova secao documentando o comportamento fail-closed
  da autenticacao.

### Adicionado
- `docs/ESTADO-DO-PROJETO.md` — documento de handoff: stack, arquitetura de dados,
  mapa do codigo, convencoes, pendencias e protocolo para agentes de IA.
- `docs/CHANGELOG.md` — este arquivo.
- Ponteiros em `CLAUDE.md` e `AGENTS.md` para que qualquer agente leia as docs na entrada.

### Acao necessaria (fora do codigo)
1. **Vercel** → Settings → Environment Variables → atualizar `AGENT_API_KEY` com a nova
   chave (Production **e** Preview) → **redeploy** (env nova so vale com novo build)
2. **OpenClaw** → Custom API Tool `consultar-pousada-marimar` → atualizar o header
   `Authorization: Bearer <nova chave>`
3. Validar em producao:
   - `curl -i .../api/agent/pousada` (sem header) → deve dar **401**
   - `curl -i -H "Authorization: Bearer <nova>" .../api/agent/pousada` → deve dar **200**
4. Considerar revisar os logs do Worker/Vercel para trafego suspeito nas rotas
   `/api/agent/*` no periodo em que o bypass esteve ativo

---

## 2026-09-17 — Migracao Cloudflare Pages → Vercel

**Autor:** Vinicios (sessao anterior)
**Commits:** `41dd238` `1b72a79` `a6d1065` `f578f12` `aa7eae3` `a0c097e` `0f8cb73` `ba5c794`

### Alterado
- `41dd238` — Marimar Site v1.0 (commit inicial do projeto completo)
- `1b72a79` — removidas dependencias do Cloudflare, adicionadas deps de client faltantes
  para a Vercel
- `a6d1065` — `.gitignore` passa a ignorar artefatos de build
- `f578f12` — removido `open-next.config.ts`
- `aa7eae3` — server action de contato movida para arquivo separado
- `a0c097e` — ajuste de deps no `package.json`, rota de API nao usada removida
- `0f8cb73` — corrigido loop de redirect do middleware em `*.vercel.app`: o split de
  hostname `admin.*` agora so se aplica nos dominios de producao reais
- `ba5c794` — monitor de integracoes passa a resolver a URL base pelo host real da
  requisicao (em vez de `localhost`); spec OpenAPI gerada dinamicamente

---

## 2026-09-14 — v1.0 construida

**Autor:** Vinicios

### Adicionado
- Site publico completo: 11 paginas
- Painel admin: 14 CRUDs + login, troca de senha, diagnostico, integracoes
- API do agente: 7 rotas + OpenAPI 3.1
- Schema Drizzle com 18 tabelas + seeds
- Integracao com o Worker PousadaHub (scraping do motor Desbravador)
- Docs: `contrato-api.md`, `padrao-crud.md`, `manual-admin.md`, `runbook.md`,
  `openclaw-integracao.md`
