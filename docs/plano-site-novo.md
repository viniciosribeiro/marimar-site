# Plano do site novo (`/site-novo`) — análise e proposta de 04/11/2026

> **Situação em 04/11/2026:** proposta publicada para o proprietário em
> <https://claude.ai/artifact/TpNqehNji4siweqz5U6Avc> (página privada do
> Vinicios, com capturas, direção de design e rascunho da home). **Nada do
> site novo foi construído.** Só constrói depois de ele responder
> "aprovo" (ou "aprovo, mas…"). Se ele reprovar, este plano vira histórico.
> Este arquivo é a versão para o próximo agente (inclusive Opus 5.5) executar
> sem depender do chat.

## 1. O pedido do proprietário (04/11/2026)

- Análise completa da página inicial e de todas as subpáginas, "usando skill
  especializada em design/redesign", para deixar o site "muito mais bonito,
  muito mais responsivo, sem quebrar nada".
- Antes de aprovar, quer saber **tudo o que será criado**.
- Quer ver num endereço de prévia terminado em `/site-novo` (ele citou um
  subdomínio; a decisão foi usar o mesmo domínio, ver §6). Se não aprovar,
  "essa página deve ser destruída".
- "Módulos, galerias, mapa, tudo"; "a forma com que o cliente interage com
  toda a plataforma"; "pesquise na internet as melhores skills para redesign
  e instale o que precisar".
- Vai trocar o modelo (Fable → Opus 5.5) para a execução.

## 2. Como a análise foi feita (reproduzível)

- Capturas reais de produção (`https://www.pousadamarimarilhadomel.com.br`)
  das 15 páginas públicas em iPhone 13 (390 px) e desktop (1440 px), com a
  abertura já vista (mesma aba), fatiadas em trechos de 1100/1000 px, mais
  estados: menu, calendário, chat, modal da suíte, lightbox, cardápio, rota.
  Script: `testes/auditoria-site.mjs` (versão versionada do que foi usado).
- Lighthouse 12 (celular) da home e de `/reservar?check_in=…`.
- Leitura de `src/app/(site)/**`, `src/components/site/**`, `globals.css`,
  `src/lib/tema.ts`, `navegacao.ts`, `conteudo-pousada.ts`.
- Skills de referência lidas: Anthropic `frontend-design` e Vercel
  `web-interface-guidelines` (agora em `.claude/skills/`, ver §8).

### Números medidos (04/11, celular)

| Métrica | Home | /reservar |
|---|---|---|
| Lighthouse Performance | 54 | 77 |
| Acessibilidade | 94 | 91 |
| Boas práticas | 96 | 96 |
| SEO | 100 | 100 |
| LCP | 4,1 s (elemento: `<video id="abertura-video">`) | 3,9 s |
| TBT | 1.460 ms | 370 ms |
| Trabalho na thread principal | 8,7 s | 2,1 s |
| Fontes do Google bloqueando render | 450 ms | 450 ms |
| JS sem uso | 103 KB | 103 KB |
| Altura da página no celular | 8.012 px | 4.705 px (galeria: 12.777; quartos: 6.787) |
| Alvos de toque < 40 px | 20 | 48 |

Componentes `"use client"` em `src/components/site`: 19.

## 3. Achados (o que está errado ou fraco hoje)

Graves (experiência):
1. **Dois botões flutuantes** ("Marina" + WhatsApp verde) lado a lado, em
   todas as páginas, cobrindo o campo Bebês da busca da home, cards e textos
   no celular (`src/app/(site)/layout.tsx` + `ChatMarina.tsx`).
2. **/reservar no celular**: cards em 2 colunas com texto de 10–11 px, botões
   "WhatsApp"/"Detalhes" de 10 px, 48 alvos abaixo do tamanho; preço com
   `clamp` espremido (`src/app/(site)/reservar/page.tsx`, `CardQuarto`).
3. **Sete páginas no desenho antigo** (cartões cinza, `text-gray-*`, emojis):
   `/quartos/[slug]` (nome em CAIXA ALTA cru do motor, migalhas, `Spec` com
   emoji), `/a-pousada`, `/eventos`, `/avaliacoes`, `/faq`, `/politicas`,
   `/contato`, `/pacotes`.
4. **Home sem H1** quando há banners (`CarrosselBanners` não tem h1); sem
   JSON-LD; sem canonical em nenhuma página.
5. **Galeria em parede**: 51 fotos pequenas em "A pousada", 92 na página,
   15 telas de celular.

Bugs visíveis (conferidos no site no ar em 04/11):
- `/a-pousada`: `{d.icone}` impresso como texto ("talheres", "caminhar",
  "cafe", "ar", "wifi", "familia", "festa", "folha") —
  `src/app/(site)/a-pousada/page.tsx` linha ~82; usar `<Icone nome=…>`.
- `/politicas`: "a partir de 1 anos" e "até 0 anos" — texto gerado das regras
  de crianças (`idadeColoMax = 0`); pluralizar e tratar o caso 0.
- `/reservar`: "R$ 0" em Diária/Total quando o motor devolve a suíte sem
  tarifa (visto em 04/11 ~17:55 UTC, quando o motor devolveu as 10 suítes
  como "sem tarifa publicada" por alguns minutos); nunca mostrar R$ 0.
- `/pacotes`: vazio sem mensagem.
- Home, bloco mapa: "Localizacao e acesso." sem acento (subtítulo gravado em
  `blocos_home`; é conteúdo do painel, não código).

Atenção (visual e performance):
- Enfeites repetidos e genéricos: ondas entre seções, folhas de palmeira,
  Caveat manuscrita, rótulos em caixa alta espaçada ("eyebrows") acima de
  todo título, emojis como ícones (🐟 🍹 ☕ 📞 ✉️ 📷 🛏 📐 👥 🌅).
- Hero fraco: foto escura da fachada em carrossel + formulário de 5 campos.
- Contraste insuficiente: `text-tinta-suave/60` nos placeholders de data,
  eyebrows em `text-marca` a 0,72 rem; `h4` no rodapé sem h2/h3 (ordem de
  títulos); logo sem `width/height` (unsized).
- Contato só com o formulário; rodapé pesado repetido; duas "vozes" visuais.
- Google Fonts por `<link>` (render-blocking) porque as fontes são escolhidas
  no painel (`src/app/layout.tsx`).

O que **está bom e fica** (não refazer): calendário único (`SeletorDatas`),
rolagem suave + "Buscando suas suítes" (`RolarParaResultados`), modal de
detalhes sem 404 (`CardQuartoModal`, PR #61), deep link com `roomCode`,
abertura em vídeo (`Abertura`), menu com descrições (`navegacao.ts`),
cardápio com busca/filtros (`Cardapio`), mapa/rota (`rota/*`), regras de
crianças, sincronização de fotos.

## 4. Direção de design: "Chegando pelo mar"

Conceito: o site conta a chegada de barco até a porta e segue a ordem em que
a pessoa decide: *quando venho → qual suíte → quanto custa → como chego → o
que como*. Regra: **as fotos mandam, o resto fica quieto**; um momento de
impacto por tela; nada de enfeite repetido.

### Tokens (CSS variables do site novo; a marca continua vindo do painel)

| Token | Valor padrão | Uso |
|---|---|---|
| `--sn-mar` | `#0E2A3E` | fundos escuros, rodapé, títulos fortes |
| `--sn-espuma` | `#FBF8F3` | fundo das páginas |
| `--sn-areia` | `#F1E6D4` | faixas, respiro, cards de apoio |
| `--sn-mare` | `var(--marca)` (hoje `#0D9488`) | ação: botões, links |
| `--sn-sol` | `var(--acento)` (hoje laranja) | um destaque por tela |
| `--sn-mata` | `#3F6B4F` | confirmações, natureza |
| `--sn-texto` / `--sn-texto-2` | `#17324A` / `#4F6476` | texto / apoio |
| `--sn-linha` | `#E3D7C3` | bordas finas |

Tipografia: **Fraunces** (títulos, peso 500, eixos `opsz`/`SOFT`) +
**Albert Sans** (texto, 17 px no celular, linha 1,55); números tabulares nos
preços. Entram em `FONTES_TITULO`/`FONTES_CORPO` de `src/lib/tema.ts` para o
painel poder escolher. Caveat deixa de ser padrão (opção no painel). Se o
painel tiver fontes diferentes das padrão (Playfair/Inter), o site novo
respeita o painel.

Layout: fotos em sangria; coluna de leitura 65–72 caracteres; no máximo uma
caixa por tela; seções separadas por espaço (sem ondas/folhas); cards de
suíte com texto **fora** da foto; celular primeiro (390 px) → tablet →
desktop → ultralargo; alvos 44 px; contraste AA; barra fixa de reserva na
página da suíte no celular; páginas curtas (home ~8 telas, galeria com 6
fotos por capítulo + "ver mais").

Movimento: um único momento orquestrado (a "linha da travessia" se desenha na
primeira rolagem da home); tudo o mais responde ao toque; `prefers-reduced-
motion` e `html[data-mov]` do painel respeitados; a abertura em vídeo fica.

Interação: um só botão flutuante "Falar com a Marina" (folha com chat +
WhatsApp + telefone; com `chat_ativo` desligado, vira WhatsApp direto);
calendário dentro da página da suíte com preço real para as datas
(`/api/disponibilidade` filtrado pela suíte) e Reservar com `roomCode`.

Assinaturas visuais (só nossas): a **linha da travessia** (Pontal do Sul →
barco → trapiche → porta) na home, em Como chegar e no rodapé; opcional: o
**céu acompanha a hora na ilha** (tom do topo por faixa horária; o site já tem
`luzDaHora(horaNaIlha())` em `rota/MapaRota.tsx`). O proprietário decide se o
céu entra.

## 5. O que será criado, módulo a módulo

Ver a tabela completa na proposta publicada; resumo operacional:

| Página | Entrega no site novo | Preserva |
|---|---|---|
| Home | hero com o mar + busca "Quando você vem?" (2 toques), suítes com "a partir de" (1 chamada a `fetchTarifas(datasExemplo())` para todas), linha da travessia, restaurante, notas, FAQ curta; H1 sempre; banners como faixa discreta | blocos do painel (`blocos_home`), `BuscaHome`/`SeletorDatas`, abertura |
| /quartos | lista com foto inteira + preço "a partir de", filtro por pessoas, ordenação | dados de `quartos`/`midias` |
| /quartos/[slug] | galeria em sangria, nome via `tituloQuarto`, comodidades com `Icone`, calendário na página com preço real, barra fixa Reservar, suítes parecidas | `buildDeepLink` com `quartoId` |
| /reservar | 1 coluna no celular, resumo fixo das datas, filtros, estados de carregamento/erro, esgotados por último sem R$ 0 | `validarConsulta`, `calcularOcupacao`, `RolarParaResultados`, `CardQuartoModal`, textos aprovados |
| /galeria | capítulos (pousada, suítes, restaurante, café, praia, eventos) com 6 fotos + "ver mais", lightbox com deslize e legenda | `SECOES_FOTO`, `Lightbox` |
| /restaurante | foto grande, horários, reservar mesa, cardápio com categorias fixas, café da manhã; cardápio vazio explicado | `Cardapio`, `LightboxCardapio`, dados do painel |
| /como-chegar | linha do tempo (a mesma linha da travessia), terminais e valores, mapa e planejador atuais com visual novo, abrir no Google/Apple/Waze, "mandar para o WhatsApp" | `rota/*`, `lerRota`, `lerConteudo` |
| /ilha-do-mel, /a-pousada, /eventos, /avaliacoes, /faq, /politicas, /contato, /pacotes | mesmo desenho editorial; FAQ com busca; Políticas com índice; Contato com WhatsApp/telefone/e-mail (copiar), endereço, horários e o formulário | `enviarContato`, `AVALIACOES`, `faqCanonico`, regras |
| Menu e rodapé | topo transparente sobre foto → sólido ao rolar; rodapé leve com linha da travessia em miniatura | `NAVEGACAO`/`COLUNAS_RODAPE` |
| Marina | botão único "Falar com a Marina" + folha; chat com visual próprio | `/api/chat`, áudio, `SUGESTOES`, escalonamento |
| Abertura | continua; capa em WebP/AVIF; não ser o LCP | escolha do painel |

Por baixo: fontes via `next/font` (self-hosted) com fallback métrico; home com
≤ 4 componentes de cliente (menu, busca/calendário, botão Falar, abertura);
chat e mapa carregados sob demanda (`next/dynamic`); imagens com `sizes`
corretos e `placeholder="blur"` quando houver `blurDataURL` (ou cor de fundo);
JSON-LD (`LodgingBusiness`, `Restaurant`, `FAQPage`, `BreadcrumbList`);
`alternates.canonical`; OG por página; skip link; foco visível; ícones SVG
(`Icone`) com nome; `alt` do painel.

Metas (celular, Lighthouse): Performance ≥ 85, Acessibilidade 100, SEO 100,
CLS < 0,05. Se a abertura em vídeo impedir ≥ 85, mostrar os dois números ao
proprietário e deixar a decisão com ele.

## 6. Mecanismo da prévia `/site-novo`

Decisão: **mesmo domínio, caminho `/site-novo`** (não subdomínio): não mexe em
DNS, usa o mesmo banco/motor/Marina, some sem rastro. O ambiente Preview da
Vercel não tem `DATABASE_URL`, por isso um deploy separado não serviria.

Estrutura (nada do site atual é tocado):

```
src/app/(site-novo)/site-novo/layout.tsx      # menu, rodapé, botão Falar, faixa "Prévia do site novo", tokens
src/app/(site-novo)/site-novo/page.tsx        # home
src/app/(site-novo)/site-novo/quartos/page.tsx, quartos/[slug]/page.tsx, reservar/page.tsx, galeria/…, restaurante/…, como-chegar/…, ilha-do-mel/…, a-pousada/…, eventos/…, avaliacoes/…, faq/…, politicas/…, contato/…, pacotes/…
src/components/site-novo/**                   # componentes próprios (copiar e adaptar; não editar os de src/components/site)
src/app/site-novo.css                         # tokens --sn-* e estilos próprios (importado só pelo layout do site novo)
src/lib/site-novo/base.ts                     # BASE = "/site-novo"; hrefNovo(path) prefixa links internos
```

Regras:
- `export const dynamic = "force-dynamic"` em todas as páginas (tempo real).
- `metadata.robots = { index: false, follow: false }` no layout e header
  `X-Robots-Tag: noindex` para `/site-novo/:path*` em `next.config.ts`
  (`headers()`); não listar no sitemap.
- Faixa fixa discreta "Prévia do site novo · nada aqui é definitivo · ver o
  site atual" (link para `/`).
- Todos os links internos passam por `hrefNovo()`; APIs (`/api/*`) ficam
  iguais.
- Reaproveitar bibliotecas de dados sem alterá-las: `lerPousada`, `lerTema`,
  `lerConteudo`, `lerRegras`, `fetchTarifas`, `buildDeepLink`, `comSql`,
  `talvezSincronizarFotos`, `SECOES_FOTO`, `format.ts`.
- Testar com o Postgres local + `testes/motor-simulado.mjs` +
  `testes/gateway-simulado.mjs` (receita no HANDOFF) e com
  `testes/auditoria-site.mjs` apontado para `http://localhost:3000/site-novo`.

Promoção (aprovação final):
1. `BASE = ""` em `src/lib/site-novo/base.ts`; mover
   `src/app/(site-novo)/site-novo/*` para `src/app/(site)/*` substituindo as
   páginas antigas (os arquivos antigos ficam no histórico do git);
   mover `src/components/site-novo` → `src/components/site` (substituindo),
   remover a faixa de prévia, o `noindex` e o header; `TEMA_PADRAO` com as
   fontes novas; `docs/` atualizados.
2. URLs públicas idênticas (`/quartos`, `/reservar`, …): nenhum redirect novo.
3. Rollback: Vercel → Deployments → Promote no deployment anterior.

Rejeição: `git rm -r "src/app/(site-novo)" src/components/site-novo src/app/site-novo.css src/lib/site-novo` +
remover o `headers()` do `/site-novo` + nota no CHANGELOG. Um commit só.

## 7. Fases (cada uma: PR → merge → deploy → link no celular → opinião)

| Fase | Entrega | Aceite |
|---|---|---|
| 1 | Base (tokens, fontes, layout, menu, rodapé, botão Falar, faixa, noindex) + home | `/site-novo` abre em 390 px sem rolagem lateral; H1; Lighthouse ≥ 80; capturas antes/depois no PR |
| 2 | `/site-novo/quartos` e `/site-novo/quartos/[slug]` com preço por datas | preço igual ao de `/reservar` para as mesmas datas; Reservar com `roomCode` |
| 3 | `/site-novo/reservar` | mesmos resultados do `/reservar` atual (ids, preços, totais) para 3 períodos; rolagem suave e mensagem mantidas; modal sem 404; nunca R$ 0 |
| 4 | galeria + restaurante/cardápio | lightbox com teclado e deslize; cardápio vazio explicado |
| 5 | como chegar/mapa, ilha, a pousada, eventos, avaliações, faq, políticas, contato, pacotes | mapa e rota funcionando (testar com 4G de verdade); formulário de contato enviando |
| 6 | acabamento: performance, a11y, SEO, iPhone/Android físicos, correções | metas do §5; relatório antes/depois |
| 7 | decisão: promoção ou remoção | docs atualizados; deploy de produção verificado |

Em cada PR: `npm test`, `tsc` limpo em export `git archive`, `npm run build`,
`testes/auditoria-site.mjs` nas páginas tocadas, e-2-e existentes
(`testes/e2e-cards-reserva.mjs`, `testes/e2e-fotos-sync.mjs`) continuam
passando.

## 8. Ferramentas (skills) no repositório

- `.claude/skills/frontend-design/` — skill oficial da Anthropic (Apache 2.0),
  copiada sem alteração em 04/11/2026. Carregar antes de desenhar cada tela.
- `.claude/skills/web-design-guidelines/` — regras da Vercel (MIT) embutidas,
  com notas do projeto. Rodar sobre os arquivos de cada tela antes do PR.
- Impeccable (`npx impeccable install`): recomendado, **não instalado** —
  baixa um binário e instala um gancho; só com autorização do proprietário.
  Nesta sessão a execução do `npx impeccable detect` foi bloqueada pelo
  classificador do ambiente.

## 9. O que NÃO muda (lista de proteção)

Preços/consulta ao motor, `roomCode`, regras de crianças, Marina (skills,
OpenClaw, áudio curto `tts.auto: "tagged"`, fotos por seção), painel e banco
(nenhuma migration), rotas `/api/agent/*`, sincronização de fotos, textos da
casa ("à beira-mar", pousada protagonista, sem contato inventado), abertura em
vídeo, calendário, rolagem suave, modal sem 404. O site atual não recebe
nenhuma alteração visual enquanto o `/site-novo` existir.

Correções pequenas no site atual (bugs do §3) só com pedido explícito do
proprietário ("corrige já"): PR separado, sem mudança de comportamento.

## 10. Pendências e perguntas feitas ao proprietário

- Aprovar / ajustar / reprovar a proposta.
- O "céu por hora" entra?
- Mantém Fraunces + Albert Sans?
- Corrigir já os 4 bugs visíveis do site atual?
- Fotos faltando no painel: café da manhã e praia (hoje 404 em
  `/api/midia-secao/cafe/0` e `/praia/0`); indicar fotos do acervo para cada
  seção, se ele quiser.
