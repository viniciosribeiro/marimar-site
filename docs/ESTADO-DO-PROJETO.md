# Estado do projeto — Marimar Site

> Atualizado em 19/09/2026.

## Onde estamos

**No ar e funcionando**

- Site na Vercel (`marimar-site.vercel.app`), disponibilidade e tarifas ao
  vivo do motor Desbravador.
- **Chat da Marina no site**, falando com a MESMA agente do WhatsApp pelo
  gateway do OpenClaw. Interruptor em `/admin/integracoes`.
- **Audio nos dois canais**: no site a pessoa grava e recebe resposta falada;
  quem escreve le e decide se quer ouvir. No WhatsApp, `tts.auto: "inbound"`.
- **`/admin/marina`** — a Cecilia treina a agente sem abrir a Hostinger: voz,
  jeito de falar, fatos, limites e revisao das conversas do site.

**O que so existe depois de rodar**

```
npm run db:migrate          # migrations 0009, 0010 e 0011
npm run db:migrar-fotos     # tira as imagens do WordPress antigo
```

## As tres pendencias que importam

1. **Imagens no servidor antigo.** O numero exato esta em
   `/admin/diagnostico`. Enquanto for maior que zero, a virada de DNS derruba
   imagem do site. Resolve com `npm run db:migrar-fotos`.
2. **DNS.** `www.pousadamarimarilhadomel.com.br` ainda serve o WordPress
   5.8.16 de 2021. Nao virar antes do item 1.
3. **3 quartos faltando** — o motor retorna 10 tipos, o banco tem 7 ativos.

## Pendencias menores

- As conversas do **WhatsApp** nao aparecem na revisao do painel: ficam no
  OpenClaw. Falta ver o que o gateway expoe.
- 13 itens em `PENDENTE_CONFIRMACAO`, em `src/lib/conteudo-pousada.ts`.
  **Nao publicar nenhum sem confirmacao da pousada.**
- Design system ainda nao aplicado em `a-pousada`, `ilha-do-mel`, `galeria`,
  `faq`, `politicas`, `contato`, `eventos`, `avaliacoes`.
- Galeria categorizada com lightbox.
- Redesenhar o admin no padrao editorial do site.

## O que este sistema NAO faz

A Marina **nao aprende sozinha** com as conversas. Nao ha ajuste fino. O que
parece aprendizado e a base de conhecimento crescendo porque alguem escreveu
nela pelo painel. Isto esta dito na tela, no `agente/README.md` e aqui de
proposito: prometer o contrario faz quem opera parar de ensinar, que e a
unica coisa que de fato melhora as respostas.

---

## 5. Convencoes do projeto

**Leia `docs/padrao-crud.md` antes de criar uma tela de admin nova.** Resumo:

- Telas de admin sao **Server Components** com `export const dynamic = "force-dynamic"`
- Mutacoes via **Server Actions** (`src/lib/admin-actions.ts` ou `actions.ts` local)
- Feedback por querystring: `?ok=...` e `?erro=...`
- Edicao inline por `?editar=<id>` (nao ha rota `/editar/[id]`)
- CRUDs simples usam `<CrudPage />`; telas com regra propria montam a mao
- Toda pagina de admin comeca com `const s = await auth(); if (!s?.user) redirect("/admin/login");`
- Conexao SQL: `postgres(process.env.DATABASE_URL!, { max: 1 })` + `await sql.end()`
- **Idioma:** codigo, tabelas, colunas e rotas em **portugues sem acento**
  (`disponibilidade`, `criado_em`, `visivel_agente`). Mantenha o padrao.
- ⚠️ **Mas todo texto que o HÓSPEDE lê vai acentuado e por extenso.** "Diária",
  "Até 4 pessoas", "2 noites" (nunca "noite(s)"). Valores em BRL passam por
  `brl()`, nomes de quarto por `tituloQuarto()`, textos longos por `resumir()`.
- **Nunca invente dado de contato.** Sem `whatsapp` configurado, não renderize o
  botão — não caia para um número fictício.
- Resposta padrao das rotas do agente:
  `{ ok, dados, resumo_texto, fonte: "worker"|"local", consultado_em }`
  — `resumo_texto` ja vem formatado para WhatsApp, com emoji.

---

## 6. Ambiente e deploy

Deploy automatico por push em `main`. Detalhes, checklist e troubleshooting:
**`docs/runbook.md`**.

Variaveis obrigatorias (precisam existir em `.env.local` **e** na Vercel):
`DATABASE_URL` · `DATABASE_URL_UNPOOLED` · `AUTH_SECRET` · `AUTH_URL` ·
`AUTH_TRUST_HOST` · `NEXT_PUBLIC_SITE_URL` · `WORKER_BASE_URL` · `WORKER_SLUG` ·
`AGENT_API_KEY`

```bash
npx vercel env pull .env.local   # sincroniza da Vercel
```

> ⚠️ **Nao ha mais Cloudflare Pages neste projeto.** `wrangler.toml`, `.open-next/` e
> `.wrangler/` sao restos ignorados pelo git. Nunca rode `wrangler pages deploy`.

Line endings normalizados por `.gitattributes` (`* text=auto eol=lf`). Se o
`git status` mostrar dezenas de arquivos "modificados" sem mudanca real, rode
`git add --renormalize .`.

---

## 7. Onde estao as outras docs

| Arquivo | Conteudo |
|---|---|
| `docs/ESTADO-DO-PROJETO.md` | **este arquivo** — visao geral e ponto de entrada |
| `docs/HANDOFF-PROXIMO-AGENTE.md` | prompt pronto para retomar o trabalho e fazer o deploy |
| `docs/CHANGELOG.md` | historico datado de mudancas |
| `docs/contrato-api.md` | contrato completo do Worker PousadaHub (todos os campos) |
| `docs/padrao-crud.md` | convencoes das telas de admin |
| `docs/openclaw-integracao.md` | como a Marina consome a API |
| `docs/manual-admin.md` | manual de uso para a operacao da pousada |
| `docs/runbook.md` | deploy, env vars, incidentes, rotacao de chave |
| `docs/samples/` | amostras de payload do Worker |
| `AGENTS.md` | regras do Next.js 16 (bloco gerado pelo `next dev`) |
| `Inicio.txt` | prompt historico do scraper — contexto de origem, nao e spec atual |

---

## 8. Pendencias conhecidas

### 🔴 Bloqueia o lançamento

| # | Item | Quem resolve |
|---|---|---|
| 1 | **DNS ainda aponta para o WordPress 5.8.16.** O Next.js só existe em `marimar-site.vercel.app`. O WP roda tema Consulting, WooCommerce 4.7.4, RevSlider 5.4.8.3 — stack de 2021 sem atualização | Vinicios (registrador + Vercel) |
| 2 | **Dados de produção com placeholder.** Rodar `npm run db:corrigir` (telefone real, acentos, desativar passeio de teste "Vinicios/VR/R$350" que está público) | Vinicios (precisa de rede até o Neon) |
| 3 | **Hero sem foto.** Cadastrar em Admin → Mídias uma imagem com `destaque = true` e **sem quarto vinculado** | Vinicios |
| 4 | Pendente da 1ª sessão: `AGENT_API_KEY` nova na Vercel + OpenClaw | Vinicios |

### ✅ Verificado nesta sessão

Deploy da terceira sessão validado contra `marimar-site-rnkyimtse.vercel.app`:

- Migration `0007_blocos_itens` aplicada (cartões editáveis da home)
- `npm run build`: limpo, todas as páginas do site como `ƒ`
- API do agente: 401 sem header, 200 com
- `/admin/banners` e `/admin/cartoes`: 307 → login (protegidos)
- `/reservar`: dados do motor

> **URL de producao e `marimar-site.vercel.app`.** A Vercel tambem da a cada
> build uma URL propria (`marimar-site-<hash>.vercel.app`), que congela naquele
> deployment — nao use essa para verificar o estado atual, ou voce vai testar um
> retrato velho do site.

### 🟠 Verificar após o deploy

| # | Item |
|---|---|
| 5 | O otimizador de imagem da Vercel consegue buscar de `reservas.desbravador.com.br`? Se o motor bloquear hotlink de datacenter, espelhar as fotos em Vercel Blob |
| 6 | Medir o `load` de novo. Era **6192ms** com 12 hotlinks crus; deve cair bastante com `next/image` |
| 7 | `estadia_minima` e `unidades_disponiveis` agora aparecem na UI — conferir contra o motor se os números batem |

### 🔵 Backlog

| # | Item |
|---|---|
| 8 | Upload de mídia só aceita URL — sem upload de arquivo (falta Vercel Blob ou S3) |
| 9 | `audit_log` existe no schema mas nao e populado pelas server actions |
| 10 | Sem testes automatizados. `src/lib/format.ts` é puro e seria o primeiro bom alvo |
| 11 | Coluna dedicada `hero_url` em `pousada` (hoje o hero deduz da tabela `midias`) |
| 12 | Lint tem ~23 erros pré-existentes (`any`, `react-hooks/purity` com `Date.now`, aspas não escapadas) — não bloqueiam o build |
| 13 | Seletor de crianças não pede idade, mas o motor tem faixas etárias (`politica_crianca`) |
| 14 | `src/middleware.ts` usa a convenção `middleware`, deprecada no Next 16 — o build avisa e sugere `npx @next/codemod@canary middleware-to-proxy .`. Funciona hoje; não mexido de propósito porque esse arquivo teve um bug de redirect loop corrigido há pouco (`0f8cb73`) e a troca merece teste dedicado |

### Verificacao pendente apos o deploy desta sessao

```bash
# deve retornar 401 — se retornar 200, a AGENT_API_KEY nao esta na Vercel
curl -i https://www.pousadamarimarilhadomel.com.br/api/agent/pousada

# deve retornar 200
curl -i -H "Authorization: Bearer <AGENT_API_KEY>" \
  https://www.pousadamarimarilhadomel.com.br/api/agent/pousada
```

---

## 9. Protocolo para agentes de IA

Este projeto e tocado por **multiplas ferramentas agenticas** (Claude, Agent Hermes via
OpenRouter, e outras). Para nao se atropelarem:

**Antes de comecar:**
1. Leia este arquivo e `docs/CHANGELOG.md` (entradas mais recentes primeiro)
2. Rode `git log --oneline -15` e `git status`
3. Se for mexer em Next.js, consulte `node_modules/next/dist/docs/`
4. Se for criar tela de admin, leia `docs/padrao-crud.md`

**Ao terminar:**
1. Adicione uma entrada no topo de `docs/CHANGELOG.md` (formato la dentro)
2. Atualize a secao **8. Pendencias conhecidas** deste arquivo
3. Atualize a data de "Ultima atualizacao" no topo
4. Commit com mensagem descritiva; nao deixe trabalho so no working dir

**Nunca:**
- Commitar segredos. `AGENT_API_KEY`, `AUTH_SECRET` e `DATABASE_URL` vivem so em
  `.env.local` (gitignored) e na Vercel
- Reintroduzir dependencia de Cloudflare/wrangler
- Fechar reserva pelo site — o escopo e consulta apenas
- Assumir que uma env var existe: sempre falhe fechado (ver `src/lib/agent-auth.ts`)
