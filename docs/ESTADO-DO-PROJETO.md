# Estado do projeto — Marimar Site

> Atualizado em 30/09/2026.

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
npm run db:migrate          # migrations 0009 a 0019 (0019: equipe, chamados e aprendizado da Marina — 30/09)
npm run db:migrar-fotos     # tira as imagens do WordPress antigo
```

## Resolvido em 20/09/2026: as imagens

As 56 fotos importadas do WordPress foram trazidas para o Vercel Blob
(`npm run db:migrar-fotos`, 56/56, zero falhas). **O servidor antigo pode
cair agora sem levar nada junto**, e o dominio dele saiu da lista de imagens
permitidas no `next.config.ts` — para uma imagem antiga reintroduzida por
engano falhar na hora, e nao no dia em que aquele servidor sair do ar.

O registro de volta ficou em `backups/fotos-2026-09-20-02-32-28.json`, na
maquina do Vinicios (a pasta esta no `.gitignore`). Para desfazer:

```
npm run db:migrar-fotos -- --reverter backups/fotos-2026-09-20-02-32-28.json
```

A conferencia e o contador em `/admin/diagnostico`: verde e zero.

## Revisao geral de 28/09/2026

Seguranca, bugs e performance revisados; relatorio e pendencias priorizadas
em **`docs/CHANGELOG-IA.md`**. Duas falhas graves corrigidas (troca de senha
de qualquer conta; Server Actions do admin sem sessao). Ao criar Server Action
nova no admin, a primeira linha e `await exigirSessao()`
(`src/lib/admin-sessao.ts`). Nunca escrever data fixa: `datasExemplo()`.

## Painel x Marina e visual novo (28/09/2026, segunda revisao)

O painel salvava coisas que nunca chegavam ao site nem a Marina ("+ Novo"
nao abria em 6 telas; editar desativava; FAQ invisivel; WhatsApp sem o 55;
contato fixo no codigo). Corrigido — detalhes em `docs/CHANGELOG-IA.md`,
"Terceira rodada". Telas novas: **Dados da pousada**, **Ilha, chegada e
eventos**, **Fotos** (por secao e por suite). Galeria publica por secao.
Menu e home redesenhados (tropical, SVG nas cores do tema:
`src/components/site/Tropical.tsx`). Manual da operacao:
`docs/manual-admin.md`.

## Treinamento da Marina e painel novo (30/09/2026)

O painel virou a fonte confiavel do treinamento: status por item baseado na
leitura real de cada canal, area de teste com as fontes usadas, historico com
restauracao, lacunas. Fluxo e armadilhas: **`docs/fluxo-painel-marina.md`**.
Todo o admin (e o login) no design system novo: **`docs/design-system-admin.md`**.
Proxima ferramenta: **`docs/HANDOFF-PROXIMO-AGENTE.md`**.

## Fotos, vídeos e roteiros da Marina (30/09/2026, fim do dia)

`/admin/midias` virou a biblioteca central (álbuns, arrastar, capa, lote,
"onde é usada"). Vídeos de até 5 min comprimidos no próprio aparelho; versão
de até 16 MB para o WhatsApp. Marina → **Mídias de orientação**: roteiros com
vídeo que ela manda etapa por etapa. Tudo em **`docs/fluxo-midia.md`**.

## Escalonamento e aprendizado da Marina (30/09/2026, quinta entrega)

Quando a Marina não sabe, ela pergunta pelo WhatsApp a quem cuida do assunto
(**`/admin/equipe`**) e devolve a resposta ao cliente no canal dele (WhatsApp
ou chat do site). A resposta da equipe vira **aprendizado** (fila de revisão em
Marina → Aprendizado) e ela passa a responder sozinha. Panorama em
**`/admin/cerebro`**. Tudo em **`docs/fluxo-escalonamento.md`**.

## As pendencias que importam

000. **Escalonamento (30/09, quinta entrega):** rodar a migration **0019**,
   reinstalar a skill `marimar-pousada`, cadastrar a equipe em
   `/admin/equipe`, usar "Testar envio" (confirma se o método `send` do
   gateway funciona no OpenClaw real — **não verificado daqui**), ligar o
   escalonamento e configurar um agendador a cada 5 min para
   `/api/cron/chamados`. Aprendizado começa em "Só depois de aprovado".
00. **Mídia (30/09, quarta entrega):** rodar a migration 0018, reinstalar a
   skill `marimar-pousada` no OpenClaw e testar num celular de verdade (foto
   HEIC, vídeo pela câmera, selo "WhatsApp ok"). O caminho MP4/H.264 não pôde
   ser testado no ambiente em nuvem.

0. **Regra de crianças (30/09, segunda entrega):** rodar a migration 0017 e
   configurar em Marina → Crianças e adicionais (idade de colo, bebê). Sem
   isso o site segue com o cálculo do motor e o aviso dele.
   **Depois do deploy de 30/09:** rodar a migration 0016 e **reinstalar a
   skill `marimar-pousada` no OpenClaw** — sem isso o WhatsApp continua com a
   skill antiga (que nao le o treinamento em pergunta de preco). Conferir em
   `/admin/marina` que o WhatsApp "leu agora ha pouco" e testar na aba Testar.

0b. **Testar mídia num celular de verdade** (iPhone e Android): foto HEIC,
   vídeo gravado pela câmera, barra de progresso, selo "WhatsApp ok". O
   caminho MP4/H.264 não pôde ser testado no ambiente em nuvem. E pedir à
   Marina, no WhatsApp, "como chego?" com um roteiro cadastrado.
1. **DNS.** `www.pousadamarimarilhadomel.com.br` ainda serve o WordPress
   5.8.16 de 2021. O caminho para virar esta livre — e decisao do Vinicios,
   que ate 20/09 optou por seguir testando na URL da Vercel.
2. **Nada do que entrou em 19-20/09 foi exercitado por um usuario real.**
   Gravar audio no site, o botao "ouvir", o upload de documentos, as sete
   rotas novas do agente, a Marina mandando foto no chat, a aba de cobertura
   e a correcao de resposta: tudo passou em `tsc`, `lint` e `build`, e nada
   passou por uma pessoa. E o maior risco aberto do projeto hoje.
3. **3 quartos faltando** — o motor retorna 10 tipos, o banco tem 7 ativos.

## Pendencias menores

- **Seguranca (da revisao de 28/09):** login sem limite por IP; contato sem
  limite de envio. (A `AGENT_API_KEY` inteira em `/admin/integracoes` foi
  corrigida em 30/09.)
- **Banco novo do zero:** `db:migrate` falha na 0014 num banco vazio (enum
  usado na mesma transacao em que ganha valor). Producao nao e afetada.
  Receita em `docs/HANDOFF-PROXIMO-AGENTE.md`. Detalhes e sugestoes em `docs/CHANGELOG-IA.md`, secao 5.

- As conversas do **WhatsApp** nao aparecem na revisao do painel: ficam no
  OpenClaw. Falta ver o que o gateway expoe.
- 13 itens em `PENDENTE_CONFIRMACAO`, em `src/lib/conteudo-pousada.ts`.
  **Nao publicar nenhum sem confirmacao da pousada.**
- Visual novo (28/09) na home, menu, galeria, `/quartos`, `/reservar` e no
  cabecalho das paginas internas; o corpo de `a-pousada`, `faq`, `politicas`,
  `contato`, `eventos`, `avaliacoes` ainda usa os cartoes antigos.
- Atracoes da ilha: tela nova em `/admin/atracoes` (29/09), ainda nao usada por uma pessoa.
- Painel redesenhado em 30/09. Telas com formulario proprio grande (cardapio,
  banners, cartoes, blocos, fotos, identidade visual) receberam so os tokens
  de cor e o cabecalho — o miolo delas ainda e o de antes.
- Fotos importadas do WordPress entraram como "A pousada": reclassificar em
  Admin → Fotos (a migration 0015 so separou o que o texto alternativo dizia).

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
- ⚠️ **A Pousada Marimar é a protagonista; o restaurante é DELA.** Decisão do
  Vinicios em 28/09/2026, que **substitui** o briefing de 18/09
  (`docs/briefing/`): não repetir "pousada anexada aos fundos" nas páginas.
  O que continua valendo: as suítes NÃO ficam na areia — "pé na areia" é
  sempre o restaurante. Textos centralizados em `COMPLEXO`
  (`src/lib/conteudo-pousada.ts`).
- ⚠️ **Mas todo texto que o HÓSPEDE lê vai acentuado e por extenso.** "Diária",
  "Até 4 pessoas", "2 noites" (nunca "noite(s)"). Valores em BRL passam por
  `brl()`, nomes de quarto por `tituloQuarto()`, textos longos por `resumir()`.
- **Nunca invente dado de contato.** Sem `whatsapp` configurado, não renderize o
  botão — não caia para um número fictício.
- ⚠️ **Tudo em tempo real.** Painel, treinamento, fotos, vídeos, roteiros e
  dados do motor valem na hora, no site e na Marina. Por isso: páginas do site
  e rotas `/api/agent/*` com `dynamic = "force-dynamic"`; nada de
  `revalidate`, `unstable_cache`, `"use cache"` ou `fetch` com cache para
  dados do banco ou do motor; toda Server Action do admin chama
  `revalidatePath` do que mudou. A skill manda a Marina reler o treinamento a
  cada 15 min e consultar as rotas na hora de responder. Mídia nova sempre
  ganha URL nova (o Blob põe sufixo aleatório), então o cache de imagem da
  Vercel nunca serve foto velha. Quebrar isto exige decisão do Vinicios.
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
| `docs/CHANGELOG-IA.md` | revisao geral de 28/09/2026: o que foi corrigido e pendencias priorizadas |
| `docs/contrato-api.md` | contrato completo do Worker PousadaHub (todos os campos) |
| `docs/padrao-crud.md` | convencoes das telas de admin |
| `docs/openclaw-integracao.md` | como a Marina consome a API |
| `docs/manual-admin.md` | manual de uso para a operacao da pousada |
| `docs/fluxo-painel-marina.md` | como o treinamento sai do painel e chega a Marina, e como provar |
| `docs/design-system-admin.md` | componentes, tokens e regras visuais do painel |
| `docs/fluxo-midia.md` | fotos, vídeos, compressão no navegador, limites do WhatsApp e roteiros da Marina |
| `docs/fluxo-escalonamento.md` | escalonamento para a equipe, base de aprendizado, Cérebro da Marina, segurança |
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
| 8 | Resolvido em 30/09: upload de foto e vídeo direto para o Vercel Blob (biblioteca `/admin/midias`) |
| 9 | `audit_log` existe no schema mas nao e populado pelas server actions |
| 9b | Escalonamento: agrupamento por significado é léxico (sinônimos + trigramas); embeddings seriam melhores. Números da equipe reconhecidos pela Marina (LLM), não por regra do OpenClaw. Cliente do site que fecha a aba perde a resposta. Ver `docs/fluxo-escalonamento.md`, "Próximos passos" |
| 10 | Testes: existem desde 30/09 (`npm test`, `testes/e2e-marina.mjs`). Faltam `validarConsulta()`/`urlTarifas()` em `src/lib/worker.ts` e `src/lib/format.ts` (casos prontos no `CHANGELOG-IA.md`) |
| 11 | Coluna dedicada `hero_url` em `pousada` (hoje o hero deduz da tabela `midias`) |
| 12 | Lint: 179 problemas em 30/09 (eram 182; nenhum nos arquivos novos) — pré-existentes (162 são `any`; medido em 28/09) — antes dizia ~23 (`any`, `react-hooks/purity` com `Date.now`, aspas não escapadas) — não bloqueiam o build |
| 13 | Resolvido em 30/09 pela regra configurável (crianças 3+ / bebês). Falta: usar `adicionais` em pacotes e na página de cada suíte, e permitir adicional por suíte |
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
