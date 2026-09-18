# Handoff — continuar de onde paramos

> Escrito em 18/09/2026, ao fim de uma sessão com Claude (Cowork).
> Cole a seção **PROMPT** em qualquer ferramenta agêntica para retomar.

---

## PROMPT

Você vai continuar o desenvolvimento do site da Pousada Marimar (Ilha do Mel/PR).
O projeto está em `D:\Projetos\Dev\Marimar Site` (Next.js 16 + Neon + Vercel).

### Passo 1 — Leia antes de tocar em qualquer coisa

Nesta ordem, sem pular:

1. `docs/ESTADO-DO-PROJETO.md` — visão geral, arquitetura, convenções, pendências
2. `docs/CHANGELOG.md` — as 7 entradas de 18/09/2026 descrevem tudo que mudou e
   **por quê**, incluindo os bugs encontrados e as decisões tomadas
3. `AGENTS.md` — regras do projeto e do Next.js 16
4. `docs/briefing/briefing-administracao-2026-09-18.txt` — fatos oficiais da pousada
5. `git log --oneline -10` e `git status`

### Passo 2 — Estado atual

Há **9 commits locais ainda não enviados** ao GitHub. Working directory limpo.
O banco Neon já recebeu:

- `db:baseline` + `db:migrate` → migrations 0001 (coluna `tema`) e 0002 (tipos de bloco)
- `db:migrar-wp` → 56 fotos importadas do WordPress antigo
- `db:corrigir` → rodou **parcialmente**: aplicou telefone, textos, coordenadas e
  passeio de teste, mas **abortou** no passo das políticas (bug já corrigido)

### Passo 3 — O que falta

**a) Rodar o script de dados que ficou pela metade**

```
npm run db:corrigir
```

A versão corrigida isola cada passo, então aplica o que faltou: políticas,
depoimentos, o subtítulo errado do topo, as seções da home e a escolha da foto de
topo. É idempotente. Confira na saída que nenhum passo falhou — se algum falhar,
corrija a causa e rode de novo, não pule.

**b) Validar localmente**

```
npm run dev
```

Em `http://localhost:3000`:
- O topo mostra foto aérea/panorâmica (não foto de quarto)
- O subtítulo do topo **não** diz "pé na areia" se referindo à pousada. O certo é:
  "O Marimar Café Bistrô Bar fica em frente ao mar. A Pousada Marimar está anexada
  logo aos fundos do restaurante"
- `/reservar?check_in=2026-10-15&check_out=2026-10-17&adultos=2` traz quartos com preço
- `/quartos` mostra foto em todos os cards
- `/admin` abre com o motor "Online"

**c) Build**

```
npm run build
```

Precisa passar. Todas as páginas do site devem sair como `ƒ` (dinâmicas) — se
alguma sair `○` (estática), perdeu o `force-dynamic` e vai congelar conteúdo do
banco no HTML.

**d) Deploy**

```
git push origin main
```

Deploy automático na Vercel. Confirme no painel que o build passou.

**e) Verificar em produção**

```
curl -i https://marimar-site.vercel.app/api/agent/pousada
# DEVE dar 401 (sem header de autorização)

curl -i -H "Authorization: Bearer <AGENT_API_KEY>" https://marimar-site.vercel.app/api/agent/pousada
# DEVE dar 200
```

Se a primeira der **200**, a `AGENT_API_KEY` não está na Vercel e as rotas do
agente estão abertas para qualquer um. Isso é crítico — avise imediatamente.

---

### Pendências que dependem do Vinicios (não tente resolver sozinho)

1. **`AGENT_API_KEY` na Vercel.** Rotacionada no `.env.local`, mas precisa ser
   atualizada em Settings → Environment Variables (Production **e** Preview) +
   redeploy, e no OpenClaw (agente Marina do WhatsApp). A antiga
   `marina-agent-key-marimar-2026` está revogada e não deve voltar.
2. **DNS.** `www.pousadamarimarilhadomel.com.br` ainda serve o **WordPress 5.8.16
   antigo**. O Next.js só existe em `marimar-site.vercel.app`.
3. **3 quartos faltando.** O motor retorna 10 tipos; o banco tem 7 ativos. Os 3
   ausentes aparecem em `/reservar` e somem de `/quartos`.
4. **13 itens pendentes de confirmação** — listados em `PENDENTE_CONFIRMACAO`, em
   `src/lib/conteudo-pousada.ts`, e visíveis no painel do admin. Incluem razão
   social/CNPJ vigentes, número real de suítes, horários do restaurante e
   capacidade para eventos. **Não publique nenhum sem confirmação.**

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
