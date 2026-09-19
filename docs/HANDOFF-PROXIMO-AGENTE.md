# Handoff — continuar de onde paramos

> Atualizado em 19/09/2026, ao fim da quarta sessão com Claude (Cowork).
> Cole a seção **PROMPT** em qualquer ferramenta agêntica para retomar.

---

## PROMPT

Você vai continuar o desenvolvimento do site da Pousada Marimar (Ilha do Mel/PR),
em `D:\Projetos\Dev\Marimar Site` (Next.js 16 + Neon + Vercel).

A sessão anterior deixou **1 commit local não enviado**. **Não há migration
pendente** — a `0007` já foi aplicada no deploy anterior.

### Passo 1 — Leia antes de tocar em qualquer coisa

1. `docs/ESTADO-DO-PROJETO.md`
2. `docs/CHANGELOG.md` — as entradas de 18 e 19/09/2026 explicam cada mudança e
   **por quê**. A mais recente é a correção de responsividade.
3. `AGENTS.md` e `docs/briefing/briefing-administracao-2026-09-18.txt`
4. `git log --oneline -12` e `git status`

### Passo 2 — O commit pendente

`d8d54f2` — **a home estourava a largura da tela no celular**.

A fila de abas da caixa de busca somava ~430px de rótulos que não quebram
linha; a caixa cresceu até caber tudo, passou dos 390px e levou a página
inteira junto. A causa de fundo é o `min-width: auto` do flex — o filho se
recusa a encolher abaixo do próprio conteúdo.

Corrigido com `min-w-0` nos dois níveis, abas dividindo a largura e rótulos
curtos no celular. Junto, entrou um teto para o conjunto logo + nome em telas
pequenas, que exigiu separar `--logo-altura-base` (escrita pelo editor) de
`--logo-altura` (derivada no CSS): o tema é injetado como `style` inline no
`<html>`, e **estilo inline ganha de qualquer media query**.

**Ao validar, meça em 320px e 390px** — foi assim que o bug apareceu, e é o
único jeito de confirmar que sumiu.

### Passo 3 — O que entrou nas duas últimas sessões

| Commit | O que é |
|---|---|
| `b68bc97` | Alinhamento: barra do topo (3 arranjos), títulos, hero e justificado |
| `e27713d` | Módulo de **Banners do topo** + corrige título invisível no hero |
| `4172c64` | **Correção de segurança**: a tela de banners renderizava sem login |
| `07663bc` | Banners em camadas: vídeo, texturas, ponto focal, Ken Burns |
| `7a988bb` | Home: ícones SVG, busca em abas, cartões editáveis (**migration 0007**) |
| `24dd160` | Conjunto logo + nome configurável (posição, espaço, estilo) |
| `d8d54f2` | **Correção**: rolagem horizontal no celular + teto da marca em tela pequena |

Pontos que merecem atenção ao revisar:

- **`src/lib/banners.ts` e `src/lib/tema.ts` guardam ESCOLHAS, não CSS.** O CSS
  correspondente é derivado numa função só. Se for adicionar uma opção, derive
  no mesmo lugar — espalhar pelos componentes é como uma consequência fica para
  trás.
- **Todo token de cor novo vai no `@theme inline`**, não só no `:root`.
- **Medida que o editor controla e que precisa de teto no celular tem duas
  variáveis**: o editor escreve a `-base`, o CSS deriva a de uso. Estilo inline
  (que é como o tema chega ao `<html>`) ganha de media query.
- **Em flex, o filho não encolhe abaixo do próprio conteúdo** (`min-width:
  auto`). Qualquer coisa larga dentro de um flex precisa de `min-w-0` no
  caminho todo, ou estoura a página. Já aconteceu três vezes neste projeto. Cinco
  ficaram de fora antes e 102 classes não pintavam nada, em silêncio.
- **Cada página do admin faz a própria checagem de sessão.** O `layout.tsx`
  desenha a moldura e não protege nada. Página nova sem `await auth()` fica
  aberta — foi o bug do commit `4172c64`.
- **Componentes compartilhados entre site e admin**: `BannerCamadas` e
  `MarcaLockup` são usados também na prévia do editor. É o que impede a prévia
  de mentir. Não crie um segundo renderizador.
- **`lerBanner()` e `lerTema()` completam o que falta** ao ler do banco. Campos
  novos em tema/banner não precisam de migration para os registros antigos.

### Passo 4 — Validar com `npm run dev`

- **Home**: busca do topo com três abas (Hospedagem / Pacotes / Informações);
  cartões com ícones coloridos; onda sob os títulos de seção; faixa final com
  foto.
- **`/admin/identidade-visual`**: abas Alinhamento e Marca; ao arrastar o tamanho
  da logo ou mudar a posição do nome, a prévia do lado acompanha.
- **`/admin/banners`**: pedir login; o editor abre com as abas Mídia / Texto /
  Layout / Camadas / Movimento / Agenda e a prévia em três larguras.
- **`/admin/cartoes`**: lista as seções "complexo" e "diferenciais".
- **`/reservar?check_in=2026-10-15&check_out=2026-10-17&adultos=2`**: traz
  quartos com preço, do motor.

```
npm run build
```

Todas as páginas do site como `ƒ` (dinâmicas). Se alguma sair `○`, perdeu o
`force-dynamic`.

### Passo 5 — Deploy e verificação

```
git push origin main
```

Depois, em produção:

```
curl -i https://marimar-site.vercel.app/api/agent/pousada          # DEVE dar 401
curl -i -H "Authorization: Bearer <AGENT_API_KEY>" \
     https://marimar-site.vercel.app/api/agent/pousada             # DEVE dar 200
```

Se a primeira der 200, as rotas do agente estão abertas — avise imediatamente.
Confirme também que `/admin/banners` e `/admin/cartoes` **pedem login**.

> A URL de produção é `marimar-site.vercel.app`. A Vercel também dá a cada build
> uma URL própria (`marimar-site-<hash>.vercel.app`), que congela naquele
> deployment — não use essa para verificar o estado atual.

---

## ⚠️ O item mais urgente do projeto

**As 56 fotos importadas do WordPress ainda são servidas pelo servidor antigo.**

O script de migração gravou as URLs originais (`m.source_url`) em vez de copiar
os arquivos. Hoje elas carregam de
`pousadamarimarilhadomel.com.br/wp-content/uploads/...`.

No dia em que o DNS apontar para a Vercel, **esse servidor sai do ar e todas
essas fotos somem de uma vez** — topo da home, galeria, fotos de quarto. E, por
ser um WordPress 5.8.16 de 2021 sem atualização, ele pode cair antes disso por
conta própria.

A solução é mecânica: um script que lê cada mídia com URL do domínio antigo,
baixa o arquivo, sobe para o Vercel Blob e reescreve a URL no banco. **Isso
precisa acontecer antes da virada de DNS.**

---

## Outras pendências que dependem do Vinicios

1. **`AGENT_API_KEY` na Vercel** — a antiga `marina-agent-key-marimar-2026` ainda
   responde em produção. Rotacionar em Settings → Environment Variables
   (Production **e** Preview) + redeploy, e no OpenClaw (agente Marina).
2. **DNS** — `www.pousadamarimarilhadomel.com.br` ainda serve o WordPress antigo.
3. **3 quartos faltando** — o motor retorna 10 tipos; o banco tem 7 ativos.
4. **13 itens pendentes de confirmação** — em `PENDENTE_CONFIRMACAO`, em
   `src/lib/conteudo-pousada.ts`. **Não publique nenhum sem confirmação.**

---

## Backlog aberto (combine antes de fazer)

- **Aplicar o design system nas demais páginas.** `a-pousada`, `ilha-do-mel`,
  `galeria`, `faq`, `politicas`, `contato`, `eventos` e `avaliacoes` têm marcação
  própria com `text-gray-900` em vez dos componentes e tokens. Por isso nem o
  visual editorial nem os controles de alinhamento chegam nelas.
- **Galeria categorizada** com lightbox — hoje as fotos aparecem numa grade só.
- **Fundir Identidade Visual + Blocos da Home** num módulo só do admin.
- **Redesenhar o admin** no padrão editorial do site.

---

## Regras rígidas

**NÃO QUEBRE O MOTOR DE RESERVAS.** Não altere sem necessidade real:

- `src/lib/worker.ts` — contrato com o Worker PousadaHub
- `src/lib/deeplink.ts` — URL de reserva no motor
- `src/app/api/**` — as 7 rotas do agente + disponibilidade
- `src/lib/agent-auth.ts` — autenticação da Marina
- a query de disponibilidade em `src/app/(site)/reservar/page.tsx`

Quartos, tarifas e disponibilidade vêm **sempre** do motor. Nunca escreva quarto
ou preço fixo no código.

**Demais regras:**

- **Nunca commite segredos.** Há um `openai api.txt` com chave da OpenAI em texto
  claro na raiz. Está no `.gitignore`.
- **Nunca reintroduza Cloudflare/wrangler.** Deploy é Vercel desde 17/09/2026.
- **`prepare: false` em toda chamada `postgres()`** — o `DATABASE_URL` aponta
  para o pooler do Neon.
- **Todo token de cor novo vai no `@theme inline`**, não só no `:root`.
- **Toda página nova do admin começa com `await auth()`** e redirect para
  `/admin/login`.
- **Flags do npm precisam de `--`**: `npm run db:migrar-wp -- --dry`.
- **Texto que o hóspede lê vai acentuado e por extenso.** Código, colunas e rotas
  em português sem acento. BRL por `brl()`, nome de quarto por `tituloQuarto()`,
  texto longo por `resumir()` — tudo em `src/lib/format.ts`.
- **Nunca invente fato sobre a pousada.** Ou vem do banco, ou de
  `src/lib/conteudo-pousada.ts`, ou do motor. Nada de garantia que a pousada não
  deu ("melhor preço garantido") nem depoimento sem identificar a plataforma.
- **O site não fecha reserva.** O escopo é consulta.
- **Ambiente:** `.env.local` (não `.env`). Scripts de banco usam `src/db/env.ts`.

## Ao terminar

1. Nova entrada **no topo** de `docs/CHANGELOG.md`
2. Atualize as pendências e a data em `docs/ESTADO-DO-PROJETO.md`
3. Commit com mensagem descritiva
4. Relate: o que rodou, o que falhou, o que ficou pendente
