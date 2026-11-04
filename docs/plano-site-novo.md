# Plano do site novo ("Chegando pelo mar") — análise de 04/11/2026, aprovado com a chave no painel

> **Situação em 04/11/2026 (fim do dia):** proposta **APROVADA** pelo
> Vinicios, com um ajuste dele: em vez de uma prévia separada em `/site-novo`,
> uma **chave no painel** (Site → Modelo do site) que alterna o site inteiro
> entre o **Clássico** e o **Novo** nos mesmos endereços — "assim não
> faríamos o serviço duas vezes". Respostas dele: a chave troca **o site
> inteiro de uma vez** (o Novo só pode ir para todos com as 15 páginas
> prontas); até lá **só quem entra no painel vê o Novo** (prévia neste
> aparelho, com barrinha para comparar); os 4 erros do Clássico **corrigidos
> já** (PR #78, em produção). Fraunces + Albert Sans e o céu por hora entram
> (o céu pode ser desligado na mesma tela).
>
> **Construído:** a chave e a prévia (§6) e a **Fase 1** (base visual +
> página inicial). Fases 2–6 seguem a tabela do §7. **Ligar o Novo para todos
> é decisão do proprietário** — nenhum agente aperta esse botão.
>
> Proposta original (com capturas e rascunho): 
> <https://claude.ai/artifact/TpNqehNji4siweqz5U6Avc>. Este arquivo é a
> versão para o próximo agente executar sem depender do chat.

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

### Tokens (como ficaram na Fase 1; a marca e o acento continuam vindo do painel)

Cores registradas no `@theme inline` de `src/app/globals.css` (classes
Tailwind `bg-sn-mar`, `text-sn-texto-2`, `border-sn-linha`…):

| Token | Valor | Uso |
|---|---|---|
| `sn-mar` / `sn-mar-2` | `#0E2A3E` / `#163C57` | fundos escuros (travessia, rodapé, botão da Marina) |
| `sn-espuma` | `#FBF8F3` | fundo das páginas |
| `sn-areia` / `sn-areia-2` | `#F1E6D4` / `#E7D7BD` | faixas de respiro (notas dos hóspedes) |
| `sn-texto` / `sn-texto-2` | `#17324A` / `#4F6476` | texto / apoio |
| `sn-linha` | `#E3D7C3` | bordas finas |
| `sn-mata` | `#3F6B4F` | confirmações, natureza |
| `sn-mare-forte` / `sn-mare-texto` | a marca do painel com 30% / 40% de preto | botões (texto branco AA) / links sobre a espuma |

O `LayoutNovo` também sobrepõe as variáveis do Clássico (`--fundo`,
`--tinta`, `--fonte-titulo`…) para que um corpo do Clássico mostrado dentro
do layout novo (página ainda não pronta, só na prévia) fique coerente.
Estilos próprios em `src/components/site-novo/novo.css` (dentro de
`@layer components`, para os utilitários do Tailwind ganharem).

Tipografia: **Fraunces** (títulos, peso 500, eixos `opsz`/`SOFT`) +
**Albert Sans** (texto, 17 px no celular, linha 1,55); números tabulares nos
preços. Na Fase 1 as duas são **fixas** no Novo (`next/font` no
`LayoutNovo`); o seletor de fontes do painel (Identidade visual) continua
valendo para o Clássico. **Ainda não feito (Fase 6):** oferecer Fraunces e
Albert Sans em `FONTES_TITULO`/`FONTES_CORPO` de `src/lib/tema.ts` e o Novo
respeitar uma escolha diferente do painel.

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

## 6. Mecanismo aprovado: a chave Clássico/Novo (Site → Modelo do site)

Os dois modelos vivem nos **mesmos endereços** (`/`, `/quartos`, `/reservar`…).
Cada página decide, a cada visita, qual corpo mostrar. Nada de `/site-novo`,
nada de redirect, nada de `noindex` (o visitante nunca vê o Novo antes da
hora).

**Peças:**

```
drizzle/0023_modelo_site.sql              # pousada.modelo_site jsonb (também aplicada pelo site: src/lib/esquema-modelo-site.ts)
src/lib/site-novo/paginas.ts              # PAGINAS_SITE: as 15 páginas, a fase de cada uma e `pronta`
src/lib/modelo-site.ts                    # lerConfigModelo, prévia assinada, modeloDaVisita (React cache), voltarSeguro, hostPublico
src/app/(admin)/admin/modelo-site/        # a tela (page.tsx) e as Server Actions (actions.ts)
src/app/api/modelo-site/previa/route.ts   # link do painel → cookie de prévia (30 dias) → "/"
src/app/api/modelo-site/ver/route.ts      # barrinha: Ver o Clássico / Ver o Novo / Sair da prévia (POST)
src/components/site-novo/**               # LayoutNovo, TopoNovo, RodapeNovo, BarraPrevia, BuscaNovo, PilulaWhatsApp, useSemFlutuante, novo.css, home/HomeNovo
```

**Quem vê o quê (`modeloDaVisita()`):**
- Visitante: o modelo gravado em `pousada.modelo_site.modelo` — e o Novo só
  vale se `todasProntas()`. Coluna ausente/vazia/estranha = Clássico.
- Quem abriu o link do painel neste aparelho (cookie `marimar_previa`,
  `v1.previa.<expira>.<hmac>`, HMAC-SHA256 com `AUTH_SECRET`, 30 dias,
  HttpOnly, SameSite=Lax): vê o Novo por padrão; `marimar_ver=classico`
  (barrinha) mostra o Clássico. Sem `AUTH_SECRET` não há prévia (falha
  fechada). O link do painel é `v1.entrar.<expira>.<hmac>` e vale 15 min;
  validade maior do que a emitida é recusada.
- Por que cookie assinado e não a sessão do painel: em produção o painel fica
  em `admin.` e o site em `www.`; o cookie de um não chega ao outro.
  `hostPublico()` troca `admin.` por `www.` ao montar o link.

**Como uma página entra no Novo (receita de cada fase):**
1. Componente em `src/components/site-novo/<área>/…` (Server Component;
   cliente só onde há interação), usando os tokens `sn-*` e as classes de
   `novo.css`.
2. Na página do Clássico, **uma linha no topo** (o corpo do Clássico não muda):
   `if ((await modeloDaVisita()).modelo === "novo" && paginaPronta("/rota")) return <XNovo … />;`
3. `pronta: true` no item de `PAGINAS_SITE` **só quando a fase passar no
   aceite** (§7). Enquanto `pronta: false`, quem está na prévia vê o corpo
   do Clássico dentro do layout novo, e a barrinha avisa "Esta página ainda
   está no desenho clássico (fase N)".

**Layout:** `src/app/(site)/layout.tsx` devolve `<LayoutNovo>` quando a
visita é Novo (tokens sobrepostos às variáveis do Clássico, fontes Fraunces e
Albert Sans por `next/font` com `preload: false` — com `true` o Clássico
também baixaria as fontes; virar `true` quando o Clássico for aposentado). O
layout raiz não carrega as fontes do Google do Clássico quando a visita é
Novo (exceto em `/admin`, pelo `x-pathname` do middleware).

**Ligar para todos:** botão "Ligar o Novo para todos" aparece só com 15/15
páginas prontas e só para o perfil Administração (`role === "master"`); a
Server Action recusa em qualquer outro caso. "Voltar ao Clássico" funciona a
qualquer momento e vale na hora (`revalidatePath("/", "layout")`). Se uma
página voltar para `pronta: false`, o site volta sozinho ao Clássico para os
visitantes (nunca dois visuais misturados).

**Aposentar o Clássico (só depois de o proprietário ligar o Novo e aprovar
em uso):** apagar o corpo antigo de cada página e os componentes de
`src/components/site` que ficarem sem uso, `preload: true` nas fontes, docs.
A chave pode ficar (Clássico = some da tela) ou sair num PR próprio.

**Se ele reprovar o Novo:** deixar no Clássico já basta. Para apagar o
código: `src/components/site-novo`, `src/lib/site-novo`, as linhas de
despacho nas páginas, `LayoutNovo` no layout, a tela e as rotas
`modelo-site`; a coluna `modelo_site` pode ficar (inofensiva).

**Testes da chave:** `testes/unit/modelo-site.test.ts` (assinatura, prazo,
segredo, config, endereço de volta) e `testes/e2e-modelo-site.mjs` (banco
LOCAL; visitante no Clássico, cookie forjado ignorado, "novo" no banco com
página faltando ignorado, link vencido → 403, barrinha, painel, home nova no
celular e em duas larguras de computador).

## 7. Fases (cada uma: PR → merge → deploy → prévia no celular → opinião)

| Fase | Entrega | Aceite | Situação |
|---|---|---|---|
| 1 | Chave + prévia; base (tokens, fontes, layout, topo, rodapé, "Falar com a Marina", barrinha) + página inicial | home do Novo em 390 px sem rolagem lateral; um H1; busca leva datas e hóspedes para `/reservar`; o Clássico intacto para os visitantes | **feita (04/11)** |
| 2 | `/quartos` e `/quartos/[slug]` com preço por datas | preço igual ao de `/reservar` para as mesmas datas; Reservar com `roomCode` | a fazer |
| 3 | `/reservar` | mesmos resultados do Clássico (ids, preços, totais) para 3 períodos; rolagem suave e "Buscando suas suítes" mantidas; janela sem 404; nunca R$ 0 | a fazer |
| 4 | galeria + restaurante/cardápio | lightbox com teclado e deslize; cardápio vazio explicado | a fazer |
| 5 | como chegar/mapa, ilha, a pousada, eventos, avaliações, faq, políticas, contato, pacotes | mapa e rota funcionando (4G de verdade); formulário de contato enviando | a fazer |
| 6 | acabamento: performance, a11y, SEO/JSON-LD, iPhone/Android físicos | metas do §5; relatório antes/depois | a fazer |
| 7 | o proprietário liga o Novo para todos (ou não) | deploy de produção verificado; docs | dele |

Em cada PR: `npm test`, `tsc` limpo em export `git archive`, `npm run build`,
`testes/e2e-modelo-site.mjs`, os e2e do Clássico
(`testes/e2e-cards-reserva.mjs`, `testes/e2e-erros-classico.mjs`,
`testes/e2e-calendario-abertura.mjs`, `testes/e2e-abertura.mjs`) continuam
passando, e capturas da prévia no celular e no computador.

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
OpenClaw, áudio curto `tts.auto: "tagged"`, fotos por seção), rotas
`/api/agent/*`, sincronização de fotos, textos da casa ("à beira-mar",
pousada protagonista, sem contato inventado), abertura em vídeo, calendário,
rolagem suave, janela sem 404. Banco: só a migration **0023** (uma coluna
`jsonb` em `pousada`, aprovada junto com a chave). **O corpo das páginas do
Clássico não muda** enquanto ele existir: cada página ganha só a linha de
despacho do §6.

Correções pequenas no Clássico só com pedido explícito do proprietário: PR
separado, sem mudança de comportamento (como o PR #78).

## 10. Pendências e perguntas

Respondidas em 04/11/2026: aprovado (com a chave no painel); céu por hora
entra (desligável); Fraunces + Albert Sans mantidas; 4 erros do Clássico
corrigidos já (PR #78).

Em aberto:
- Fotos faltando no painel: café da manhã e praia (hoje 404 em
  `/api/midia-secao/cafe/0` e `/praia/0`). A foto do topo do Novo
  (`HomeNovo.tsx`): imagem do bloco "hero" da home → foto do álbum **Praia e
  ilha** (capa, senão a mais larga) → do álbum **A pousada** (capa, senão a
  mais larga) → banner → imagem de compartilhamento. Sem fotos de praia hoje,
  produção usa A pousada; vale a pousada escolher uma foto bem larga.
- Quando ligar o Novo para todos: decisão do proprietário depois da Fase 6.
