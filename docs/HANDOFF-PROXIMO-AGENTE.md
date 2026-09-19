# Handoff — continuar de onde paramos

> Reescrito em 18/09/2026, ao fim da segunda sessão com Claude (Cowork).
> Cole a seção **PROMPT** em qualquer ferramenta agêntica para retomar.

---

## PROMPT

Você vai continuar o desenvolvimento do site da Pousada Marimar (Ilha do Mel/PR).
O projeto está em `D:\Projetos\Dev\Marimar Site` (Next.js 16 + Neon + Vercel).

A sessão anterior deixou **5 commits locais ainda não enviados ao GitHub**.
Sua tarefa: analisar tudo que foi feito, validar, e fazer o deploy.

### Passo 1 — Leia antes de tocar em qualquer coisa

Nesta ordem, sem pular:

1. `docs/ESTADO-DO-PROJETO.md` — visão geral, arquitetura, convenções, pendências
2. `docs/CHANGELOG.md` — as **11 entradas de 18/09/2026** descrevem tudo que mudou
   e **por quê**, incluindo os bugs encontrados e as decisões tomadas. As quatro
   mais recentes (8 a 11) são as desta sessão e ainda não foram para produção.
3. `AGENTS.md` — regras do projeto e do Next.js 16
4. `docs/briefing/briefing-administracao-2026-09-18.txt` — fatos oficiais da pousada
5. `git log --oneline -12` e `git status`

### Passo 2 — O que entrou nos 5 commits pendentes

| Commit | O que é |
|---|---|
| `3f4c51d` | Linguagem editorial (tokens de design), rota inteligente em Como Chegar, cardápio digital |
| `2fc0f28` | Upload real de fotos do cardápio via Vercel Blob (galeria por item) |
| `2e3e159` | Funde `/restaurante` + `/cardapio` numa página só; reconstrói a Identidade Visual |
| `55c794a` | Responsividade: prévia do editor estourava o layout; títulos criavam rolagem horizontal |
| `68ad63b` | Menu: árvore única de navegação + registra 5 tokens que nunca geraram classe |

Pontos que valem sua atenção ao revisar:

- **`src/lib/navegacao.ts` é a fonte única da navegação.** Topo, gaveta do celular
  e rodapé leem dela. Página nova entra só nesse arquivo.
- **`@theme inline` no `globals.css`.** No Tailwind v4, variável declarada só no
  `:root` **não** vira classe. Cinco tokens (`--areia`, `--areia-forte`, `--tinta`,
  `--tinta-suave`, `--linha`) estavam fora do `@theme` e 102 usos de
  `text-tinta` / `bg-areia` / `border-linha` não pintavam nada. Se você adicionar
  um token novo, registre-o no `@theme` também.
- **`src/components/site/MobileNav.tsx` foi apagado** — substituído por
  `MenuPrincipal.tsx`, que cobre desktop e celular.
- **Migrations 0003 e 0004** (cardápio e fotos do cardápio) já foram aplicadas no
  Neon pelo Vinicios.
- **Redirects 301** de `/cardapio` e `/cafe-da-manha` para `/restaurante` estão no
  `next.config.ts`. Não remova: são URLs que existiam no WordPress antigo.

### Passo 3 — Validar antes de enviar

```
npm run dev
```

Em `http://localhost:3000`, confirme:

- **Menu:** em tela larga, passar o mouse em "Restaurante" abre um painel com
  quatro itens e descrições. Abaixo de 1024px o menu vira o botão "Menu" e a
  gaveta abre **em tela cheia** (se ela aparecer recortada na faixa do topo, o
  bug do `backdrop-filter` voltou — veja a entrada 11 do CHANGELOG).
- **Cores:** os títulos das seções são azul-petróleo, não cinza. Se estiverem
  cinza, os tokens saíram do `@theme`.
- **`/reservar?check_in=2026-10-15&check_out=2026-10-17&adultos=2`** traz quartos
  com preço — vindos do motor.
- **`/quartos`** mostra foto em todos os cards.
- **`/restaurante`** carrega hero, café da manhã e cardápio na mesma página.
- **`/admin/identidade-visual`**: a prévia do site fica **dentro** da sua coluna,
  sem cobrir os controles, em qualquer largura de janela. *(Esta tela não foi
  verificada visualmente na sessão anterior — a sessão do admin tinha expirado.)*

```
npm run build
```

Precisa passar. Todas as páginas do site devem sair como `ƒ` (dinâmicas) — se
alguma sair `○` (estática), perdeu o `force-dynamic` e vai congelar conteúdo do
banco no HTML.

### Passo 4 — Deploy

```
git push origin main
```

Deploy automático na Vercel. Confirme no painel que o build passou.

### Passo 5 — Verificar em produção

```
curl -i https://marimar-site.vercel.app/api/agent/pousada
# DEVE dar 401 (sem header de autorização)

curl -i -H "Authorization: Bearer <AGENT_API_KEY>" https://marimar-site.vercel.app/api/agent/pousada
# DEVE dar 200
```

Se a primeira der **200**, a `AGENT_API_KEY` não está na Vercel e as rotas do
agente estão abertas para qualquer um. Isso é crítico — avise imediatamente.

Depois, no site em produção:

- `/cardapio` redireciona (301) para `/restaurante#cardapio`
- O menu abre e fecha, e a gaveta ocupa a tela inteira no celular
- `/quartos` e `/reservar` trazem dados do motor

---

### Pendências que dependem do Vinicios (não tente resolver sozinho)

1. **`AGENT_API_KEY` na Vercel.** Precisa ser rotacionada em Settings →
   Environment Variables (Production **e** Preview) + redeploy, e no OpenClaw
   (agente Marina do WhatsApp). A antiga `marina-agent-key-marimar-2026` ainda
   responde em produção e deve ser revogada.
2. **`BLOB_READ_WRITE_TOKEN`.** O store do Vercel Blob foi conectado ao projeto.
   Rode `npx vercel env pull .env.local` e **reinicie o dev server** — sem isso o
   upload de fotos do cardápio falha em desenvolvimento.
3. **DNS.** `www.pousadamarimarilhadomel.com.br` ainda serve o **WordPress 5.8.16
   antigo**. O Next.js só existe em `marimar-site.vercel.app`.
4. **3 quartos faltando.** O motor retorna 10 tipos; o banco tem 7 ativos. Os 3
   ausentes aparecem em `/reservar` e somem de `/quartos`.
5. **13 itens pendentes de confirmação** — listados em `PENDENTE_CONFIRMACAO`, em
   `src/lib/conteudo-pousada.ts`, e visíveis no painel do admin. Incluem razão
   social/CNPJ vigentes, número real de suítes, horários do restaurante e
   capacidade para eventos. **Não publique nenhum sem confirmação.**

---

### Backlog aberto (não faça sem combinar com o Vinicios)

- **Galeria categorizada.** Hoje as fotos aparecem numa grade só; o pedido é
  agrupar por ambiente com lightbox.
- **Fotos reais na página A Pousada.** A página existe, o conteúdo é texto.
- **Fundir Identidade Visual + Seções da Home** num módulo só do admin.
- **Redesenhar o admin** no mesmo padrão editorial do site.

---

### Regras rígidas

**NÃO QUEBRE O MOTOR DE RESERVAS.** Integração com o Desbravador — não altere sem
necessidade real:

- `src/lib/worker.ts` — contrato com o Worker PousadaHub
- `src/lib/deeplink.ts` — URL de reserva no motor
- `src/app/api/**` — as 7 rotas do agente + disponibilidade
- `src/lib/agent-auth.ts` — autenticação da Marina
- a query de disponibilidade em `src/app/(site)/reservar/page.tsx`

Quartos, tarifas e disponibilidade vêm **sempre** do motor. Nunca escreva quarto ou
preço fixo no código.

**Demais regras:**

- **Nunca commite segredos.** Há um `openai api.txt` com chave da OpenAI em texto
  claro na raiz. Está no `.gitignore` — não commite nem exponha.
  `AGENT_API_KEY`, `AUTH_SECRET` e `DATABASE_URL` vivem só em `.env.local` e na Vercel.
- **Nunca reintroduza Cloudflare/wrangler.** Deploy é Vercel desde 17/09/2026.
- **`prepare: false` em toda chamada `postgres()`.** `DATABASE_URL` aponta para o
  pooler do Neon (PgBouncer em transaction mode). Sem isso, qualquer migration
  quebra as conexões vivas com `cached plan must not change result type`.
- **Todo token de cor novo vai no `@theme inline`**, não só no `:root` — senão a
  classe simplesmente não existe e falha em silêncio.
- **Flags do npm precisam de `--`.** `npm run db:migrar-wp --dry` **não** é
  simulação: o npm engole o argumento. Use `npm run db:migrar-wp -- --dry`.
- **Texto que o hóspede lê vai acentuado e por extenso** ("Diária", "2 noites").
  Código, colunas e rotas em português sem acento (`disponibilidade`, `criado_em`).
  BRL passa por `brl()`, nome de quarto por `tituloQuarto()`, texto longo por
  `resumir()` — tudo em `src/lib/format.ts`.
- **Nunca invente fato sobre a pousada.** Ou vem do banco, ou de
  `src/lib/conteudo-pousada.ts`, ou do motor. Depoimento sem identificar a
  plataforma de origem não vai ao ar.
- **O site não fecha reserva.** O escopo é consulta; fechamento é no motor ou WhatsApp.
- **Ambiente:** `.env.local` (não `.env`). Scripts de banco usam `src/db/env.ts`.

### Ao terminar

1. Nova entrada **no topo** de `docs/CHANGELOG.md` (formato no próprio arquivo)
2. Atualize "Pendências conhecidas" e a data em `docs/ESTADO-DO-PROJETO.md`
3. Commit com mensagem descritiva — não deixe trabalho só no working directory
4. Relate: o que rodou, o que falhou, o que ficou pendente
