# Estado do Projeto — Marimar Site

> **Para agentes de IA:** este e o documento de entrada. Leia antes de tocar em codigo.
> Mantenha-o atualizado ao final de cada sessao de trabalho, junto com `docs/CHANGELOG.md`.
>
> **Ultima atualizacao:** 18/09/2026
> **Fase atual:** v1.0 em producao na Vercel — estabilizacao pos-migracao

---

## 1. O que e este projeto

Site oficial + painel administrativo + API para agente de IA da **Pousada Ilha do Mel
Marimar** (45 quartos, Ilha do Mel / Parana).

Tres consumidores, um codebase:

| Consumidor | Onde | O que faz |
|---|---|---|
| **Site publico** | `www.pousadamarimarilhadomel.com.br` | Vitrine + consulta de disponibilidade em tempo real |
| **Painel admin** | `admin.pousadamarimarilhadomel.com.br/admin` | CRUD de todo o conteudo do site |
| **Marina (agente WhatsApp/Instagram)** | OpenClaw, hospedado na Hostinger | Consome `/api/agent/*` para responder hospedes |

### Regra de negocio central

**O site NAO fecha reserva.** Ele apenas consulta e exibe: quartos, valores, pacotes,
grupos de quartos, valor por adulto/crianca, diarias minimas, comodidades, capacidades
e midias. O fechamento acontece no motor Desbravador (deeplink) ou pelo WhatsApp.

---

## 2. Stack

| Camada | Tecnologia | Versao |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.5 |
| Runtime UI | React | 19.2.8 |
| Linguagem | TypeScript | 5.x |
| Estilo | Tailwind CSS | v4 (via `@tailwindcss/postcss`) |
| Banco | Neon PostgreSQL | — |
| ORM / migrations | Drizzle ORM + drizzle-kit | 0.45 / 0.31 |
| Driver SQL | `postgres` (porsager) | 3.4 |
| Auth | Auth.js (next-auth) v5 beta + bcryptjs | 5.0.0-beta.32 |
| Validacao | Zod | 4.6 |
| Forms | react-hook-form + @hookform/resolvers | 7.54 |
| Icones | lucide-react | 0.468 |
| Deploy | **Vercel** | — |
| Repo | github.com/viniciosribeiro/marimar-site | branch `main` |

> ⚠️ **Next.js 16 tem breaking changes.** Antes de escrever codigo Next, consulte
> `node_modules/next/dist/docs/` (é a doc da versao exata instalada). Exemplos reais
> neste projeto: `searchParams` e `params` sao **Promise** e precisam de `await`;
> `headers()` e assincrono. Ver `AGENTS.md`.

---

## 3. Arquitetura de dados

```
Motor Desbravador (reservas.desbravador.com.br)
        │  scraping
        ▼
Worker PousadaHub (Cloudflare Worker)
  pousadahub.viniciosribeiro.workers.dev/tarifas
        │  JSON (contrato em docs/contrato-api.md)
        ▼
src/lib/worker.ts  ──> fetchTarifas() valida com Zod
        │
        ├──> /api/disponibilidade        (publico, usado pelo site)
        ├──> /api/agent/disponibilidade  (Bearer, usado pela Marina)
        └──> cache_tarifas (tabela Postgres, TTL via TARIFAS_CACHE_TTL)

Neon Postgres ──> conteudo editorial (quartos, pacotes, FAQ, midias, politicas...)
```

**Degradacao:** se o Worker cair, o site continua no ar mostrando o catalogo **sem
precos** + CTA de WhatsApp. Nao derrube a pagina por falha do Worker.

**Slug do motor:** `pousada-ilha-do-mel-marimar` — **nao** `marimar`. Slug errado
retorna `quartos: []` silenciosamente (parece "sem disponibilidade", nao erro).

---

## 4. Mapa do codigo

```
src/
├── app/
│   ├── (site)/                 # Site publico — 11 paginas
│   │   ├── page.tsx                    home (com busca de disponibilidade)
│   │   ├── quartos/ + [slug]/
│   │   ├── pacotes/ + [slug]/
│   │   ├── a-pousada/  ilha-do-mel/  passeios(via blocos)
│   │   ├── faq/  politicas/  contato/ (+ actions.ts)
│   │   └── reservar/                   monta deeplink pro motor
│   │
│   ├── (admin)/admin/          # Painel — 14 CRUDs + 4 telas de sistema
│   │   ├── page.tsx                    dashboard
│   │   ├── login/  trocar-senha/       auth
│   │   ├── quartos/ categorias/ comodidades/   (actions.ts proprias)
│   │   ├── midias/ pacotes/ passeios/ politicas/
│   │   ├── faq/ depoimentos/ blocos-home/ leads/ usuarios/
│   │   ├── identidade-visual/          cores, fontes, logos, SEO
│   │   ├── integracoes/                monitor ao vivo + chave da API
│   │   └── diagnostico/                teste do Worker
│   │
│   └── api/
│       ├── agent/              # 7 rotas — Bearer obrigatorio
│       │   ├── pousada  quartos  disponibilidade  pacotes  faq
│       │   ├── lead     (POST)
│       │   └── openapi  (spec OpenAPI 3.1 gerada dinamicamente)
│       ├── auth/[...nextauth]/  auth/trocar-senha/
│       ├── disponibilidade/    # publica, consumida pelo site
│       └── robots/  sitemap/
│
├── components/
│   ├── admin/   CrudPage  CrudForm  Modal  DeleteButton
│   │            SubmitButton  IconPicker  ThemeEditor
│   └── site/    Gallery  ChatWidget
│
├── db/
│   ├── schema.ts       18 tabelas (Drizzle)
│   ├── index.ts  migrate.ts
│   ├── seed.ts  seed-data.ts  seed-fotos.ts  seed-admin.ts
│   └── reset-admin.ts  check-users.ts  counts.ts
│
├── lib/
│   ├── auth.ts          Auth.js v5: credentials, bcrypt, must_reset,
│   │                    tentativas_falhas, bloqueado_ate
│   ├── agent-auth.ts    ⭐ auth das rotas /api/agent/* (fail-closed)
│   ├── worker.ts        fetchTarifas() + schemas Zod do Worker
│   ├── deeplink.ts      monta URL de reserva no Desbravador
│   └── admin-actions.ts server actions compartilhadas dos CRUDs
│
└── middleware.ts        split de hostname: /admin no dominio publico
                         redireciona para admin.<dominio> (SO em producao;
                         em dev e preview vercel.app roda na mesma origem)
```

### Tabelas do banco (18)

`pousada` · `usuarios` · `categorias` · `quartos` · `midias` · `comodidades` ·
`quarto_comodidades` · `pousada_comodidades` · `pacotes` · `politicas` · `faq` ·
`blocos_home` · `passeios` · `depoimentos` · `leads` · `integracoes` ·
`cache_tarifas` · `audit_log`

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

| # | Item | Gravidade | Status |
|---|---|---|---|
| 1 | Upload de midia so aceita URL — sem upload de arquivo (falta Vercel Blob ou S3) | 🔵 feature | aberto |
| 2 | `audit_log` existe no schema mas nao e populado pelas server actions | 🔵 | aberto |
| 3 | Producao nao validada nesta sessao (sem acesso de rede a partir do ambiente) | ⚠️ | **verificar** |
| 4 | Sem testes automatizados | 🔵 | aberto |
| 5 | `integracoes/page.tsx` exibe a `AGENT_API_KEY` completa nos exemplos de curl (tela autenticada, aceitavel, mas revisar) | 🟡 | aberto |

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
