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

## 2026-09-18 (4) — Admin reorganizado, editor visual funcional e migração do WordPress

**Autor:** Claude Opus 5 (Cowork)
**Commits:** _(pendente de commit)_

### Corrigido: /quartos nunca mostrou foto nenhuma
A página de acomodações **não consultava a tabela `midias`**. O card tinha
`<span className="text-5xl">🏨</span>` fixo no lugar da imagem. Agora a query traz
a mídia em destaque do quarto (com fallback para a primeira por ordem), renderiza
com `next/image` e mostra o contador de fotos. Verificado: 7 de 7 cards com foto
real do motor.

Os selos de categoria também não passavam por `tituloQuarto()` — apareciam como
"Familia" e "Suite" sem acento em `/quartos`, na home e em `/reservar`. Corrigido
nos três.

### Novo: `npm run db:migrar-wp`
Script que traz as 68 imagens e os textos do WordPress legado (a API REST dele
está aberta). Idempotente, não apaga nada, aceita `--dry` e `--textos`.

- **Classifica por slug** e descarta 7 imagens que são do tema/demo do WordPress
  (`macbook-png`, `woocommerce-placeholder`, `about-jpg`…), além de logos e favicons.
- **Gera `alt` para todas.** Nenhuma imagem do WP tem `alt_text` preenchido, e a
  coluna é `NOT NULL` — além de ser barreira de acessibilidade.
- **Encontrou 6 fotos aéreas de drone** (`created-by-dji-camera`, 1600×750). A
  primeira é marcada como `destaque = true` **sem** `quarto_id`, que é exatamente o
  que a home procura para o hero. Resolve a foto de beliche no topo do site.

### Admin reorganizado
- **Sidebar agrupada em 6 módulos** (Visão geral, Acomodações, Conteúdo do site,
  Aparência, Hóspedes, Sistema). Eram 15 itens chapados numa lista única.
- **Passou a funcionar no celular.** Era `w-56` fixa dentro de um `flex h-screen`,
  sem nenhuma alternativa mobile — o painel ficava inutilizável. Agora tem barra
  superior, drawer, trava de scroll e marca a página ativa.
- Rótulos reescritos para a operação ("Fotos" em vez de "Mídias", "Contatos
  recebidos" em vez de "Leads").

### Dashboard real
Eram 3 cartões, um deles com `Status Worker: "—"` hardcoded. Agora:
- **Testa o motor de verdade** com `fetchTarifas()` para daqui a 7 dias e mostra
  latência e quantos tipos voltaram (medido: 1380ms, 6 tipos).
- **Avisos acionáveis**: sem foto de topo, quartos sem foto, motor fora do ar,
  contatos não lidos — cada um com link direto para resolver.
- Últimos contatos recebidos e a lista de pendências do briefing.

### Editor visual: agora salva o que mostra
- **Abas "Banner" e "Forma" passaram a persistir** em `pousada.tema` (jsonb). Antes
  eram `useState` que nunca chegava no `salvarTema` — a Cecília editava, via
  "Tema aplicado ao site" e nada acontecia.
- **A faixa de aviso é renderizada no site.** Salvar sem renderizar seria repetir o
  mesmo bug de outra forma.
- **Upload base64 bloqueado.** O editor antigo lia o arquivo com `FileReader` e
  gravava a imagem inteira em base64 na coluna `logo_url`; como o layout do site faz
  `SELECT *` em toda página, a logo trafegava inteira a cada request. A server action
  agora rejeita `data:` URL e a tela explica o porquê quando encontra uma já gravada.
- **Prévia ao vivo** refletindo cor, fonte, arredondamento, sombra, logo e faixa.
- A server action valida sessão, trata erro e diz para rodar a migration quando a
  coluna `tema` não existe. A tela detecta isso sozinha e avisa no topo.
- Nova aba **SEO** com prévia do resultado no Google e contador de caracteres.

### Pendência nova descoberta
O banco local tem **7 quartos ativos**, o motor Desbravador retorna **10** tipos.
O briefing já apontava divergência (histórico 24 · agregador 18 · site 11 categorias
· Expedia 13 opções) e isso confirma: o cadastro local está incompleto. Um tipo que
o motor tem e o banco não some do site, mesmo aparecendo em `/reservar`.

### Ação necessária
1. `npm run db:migrate` — cria a coluna `tema` (sem ela, Forma e Banner não salvam)
2. `npm run db:migrar-wp --dry` para conferir, depois sem `--dry` para importar
3. `npm run db:corrigir`
4. Conferir os 3 quartos que existem no motor e não no banco local

---

## 2026-09-18 (3) — Design tokens, redesign do site e conteúdo real da pousada

**Autor:** Claude Opus 5 (Cowork) — sessão ao vivo com dev server + briefing da administração
**Commits:** _(pendente de commit)_

### ERRO FACTUAL CORRIGIDO
O site afirmava **"Sua pousada pé na areia na Ilha do Mel"**. Pelo briefing da
administração, quem está pé na areia é o **Marimar Café Bistrô Bar**, na parte da
frente do complexo. As acomodações ficam **anexadas aos fundos** e não devem ser
apresentadas como se estivessem sobre a areia. Corrigido no código, no seed e no
script de produção. A frase canônica passa a aparecer na home, no rodapé, no FAQ,
em "A Pousada", no restaurante, em eventos e em como chegar.

**Coordenadas também estavam erradas:** o banco tinha `-25.5117, -48.3389`.
O correto é `-25.5684375, -48.3151875` (Plus Code CMJM+JW), que é o ponto do
restaurante, usado como referência para acessar a pousada aos fundos.

### O editor visual nunca esteve ligado ao site
Descoberto ao subir o dev server: o banco já tinha `cor_primaria = #B45309`
(paleta Âmbar) e `fonte_titulo = Montserrat` salvos, e o site **ignorava os dois** —
pintava `bg-teal-600` hardcoded em 11 arquivos e tinha `font-family: Arial` fixo
no `body`, por cima do Geist que era carregado e nunca usado.

Sistema de tokens instalado:
- `src/app/globals.css` — `--marca` e `--acento` viram uma escala completa via
  `color-mix(in oklab, ...)`: hover, ativa, escura, suave, borda, sutil. Uma cor
  de entrada gera o tom inteiro. Mapeados em `@theme inline`, então `bg-marca`,
  `text-marca`, `from-marca` respondem ao banco em tempo real, sem rebuild.
- `src/app/layout.tsx` — lê a pousada com `to_jsonb` (funciona antes e depois da
  migration), emite os tokens, e busca no Google Fonts **apenas** a fonte que o
  admin escolheu. Tokens de raio, sombra e duração de animação também saem daqui.
- 11 arquivos convertidos. Zero cor de marca hardcoded restante.

### Novo: coluna `tema jsonb` + migration `0001_tema_jsonb.sql`
As abas "Banner" e "Avançado" do editor tinham controles que **não salvavam nada** —
`useState` que nunca chegava no `salvarTema`. Não havia onde gravar. A coluna
`tema` resolve isso sem exigir migration a cada opção nova.

### Novo: `src/lib/conteudo-pousada.ts`
Fonte canônica do conteúdo da pousada, com separação explícita entre o que está
**confirmado** e o que está **pendente de confirmação** interna. O que não está
confirmado não renderiza (`RESTAURANTE.horarios = null`, `EVENTOS.capacidade = null`,
`CONTATO.telefoneRestaurante = null`). Guarda também os telefones históricos e o
CNPJ baixado, marcados para que ninguém os reintroduza por engano.

### Páginas novas
`/restaurante` · `/cafe-da-manha` · `/eventos` · `/como-chegar` · `/avaliacoes` · `/galeria`

Reescritas: `/` (home), `/a-pousada`, `/ilha-do-mel`, `/faq`, `/politicas`.

- **Home** — o complexo explicado visualmente (restaurante na frente ↔ pousada aos
  fundos), busca com campo de crianças, diferenciais, avaliações reais com barra por
  critério, localização e atrações.
- **Como chegar** — as 3 etapas do briefing, terminais, valores da travessia com
  data de consulta e link da ABALINE, aviso destacado sobre Encantadas ≠ Nova
  Brasília, Plus Code e links para Google Maps e OpenStreetMap.
- **Avaliações** — notas reais das 5 plataformas (1.691 avaliações somadas), com
  data de consulta e link para a origem. Inclui as subnotas baixas do Booking
  (Wi-Fi 6,0; custo-benefício 7,4) de propósito.
- **FAQ** — conjunto canônico agrupado em 4 temas cobrindo o que o briefing exige,
  mesclado sem duplicar com o que a administração cadastrar no admin.

### Corrigido
- **Menu mobile não existia.** O header era `hidden md:flex` sem alternativa: no
  celular não havia navegação nenhuma. Novo `MobileNav` com drawer, trava de
  scroll, fecha ao navegar e marca a página ativa.
- **Hover do menu era código morto.** `style={{ ":hover": {...} } as any}` — React
  não aplica pseudo-seletor em style inline, e o `as any` silenciava o TypeScript.
- **Header com fundo sólido**, conforme o briefing pede (era `bg-white/85` translúcido).
- `tituloQuarto()` agora repõe acento também em capitalização mista ("Familia" →
  "Família"), não só em CAIXA ALTA. 10 casos validados.
- Rodapé com a frase estrutural obrigatória e a arquitetura completa de navegação.

### Impacto do schema Zod corrigido (sessão anterior), agora visível
Com os campos do contrato deixando de ser descartados, a página de reserva passou
a exibir o `aviso_crianca` vindo do próprio motor ("Faixas etárias de criança não
configuradas...") e o selo de escassez a partir de `unidades_disponiveis`.

### Ação necessária
1. `npm run db:migrate` — cria a coluna `tema`
2. `npm run db:corrigir` — agora também aplica descrição correta do complexo,
   coordenadas, endereço, Instagram, políticas (check-in 14h, check-out 11h,
   **pets NÃO aceitos**) e **desativa os depoimentos do seed**, que não
   identificam plataforma de origem — o briefing proíbe depoimento sem atribuição
3. Cadastrar foto do hero (mídia com `destaque = true` e **sem** quarto vinculado).
   Hoje o hero cai numa foto de beliche
4. Migrar as 68 fotos e os textos do WordPress (API REST aberta)

### Pendente de confirmação da administração
Ver `PENDENTE_CONFIRMACAO` em `src/lib/conteudo-pousada.ts` — 13 itens, incluindo
razão social e CNPJ vigentes, número físico de suítes, horários do restaurante,
telefone próprio do restaurante e capacidade para eventos.

---

## 2026-09-18 (2) — Camada de apresentação, imagens e limpeza de conteúdo

**Autor:** Claude Opus 5 (Cowork) — revisão ao vivo do site publicado
**Commits:** _(pendente de commit)_

### Contexto: o domínio ainda é o WordPress antigo
`www.pousadamarimarilhadomel.com.br` serve **WordPress 5.8.16** (tema Consulting,
WooCommerce 4.7.4, Revolution Slider 5.4.8.3, Visual Composer 6.0.3). O Next.js
está publicado apenas em `marimar-site.vercel.app`. O DNS nunca foi apontado.
**Apontar o DNS é ação manual do Vinicios** — ver "Ação necessária".

### Adicionado
- `src/lib/format.ts` — camada de apresentação sobre os dados crus do motor:
  - `tituloQuarto()` — "SUITE KING" → "Suíte King" (com dicionário de acentos;
    respeita nomes que já vêm formatados do admin)
  - `resumir()` — corta no limite de palavra + reticências, em vez de `.slice(0,N)`
    que cortava no meio ("...viaja em grupo ou com cria")
  - `brl()` — `Intl.NumberFormat` pt-BR: 1040 → "R$ 1.040", 350.5 → "R$ 350,50"
  - `pluralizar()` — "2 noites" em vez de "2 noite(s)"
  - `escassez()` — mensagem só quando o estoque real do motor justifica
    (1 ou 2 unidades); nunca inventa urgência
  - `dataBR()`
- `src/db/corrigir-producao.ts` + script `npm run db:corrigir` — corrige os dados
  já gravados no Neon (idempotente, não destrutivo)

### Corrigido
- **Telefone placeholder em produção.** `src/db/seed.ts` semeava `(41) 99999-9999`,
  que estava no rodapé do site publicado. Real: **(41) 99501-2920** (confirmado no
  site WordPress). Corrigido no seed e no script de produção.
- Removidos todos os fallbacks `|| "5541999999999"` de `layout.tsx`, `page.tsx`,
  `quartos/[slug]/page.tsx` e `ChatWidget.tsx`. Sem número configurado, o botão
  de WhatsApp simplesmente não é renderizado — melhor que mandar o hóspede para
  um número inexistente.
- **Acentuação do texto visível ao hóspede.** A convenção "português sem acento"
  vale para código/colunas/rotas e tinha vazado para a UI: "Diaria", "Ate 4
  pessoas", "Esgotado no periodo", "pousada pe na areia", "Conheca nossas opcoes",
  "Localizacao", "Experiencias", "Paranagua".
- **Zod descartava campos do contrato.** `workerResponseSchema` declarava só um
  subconjunto e o Zod descarta chaves não declaradas por padrão — então
  `estadia_minima`, `unidades_disponiveis`, `disponibilidade_por_noite`,
  `total_geral`, `motivo_indisponivel`, `politica_crianca` e `aviso_crianca`
  chegavam do Worker e eram jogados fora antes da UI. Schema completo agora,
  com campos novos `.optional()` para não quebrar em payload degradado.
- `WORKER_TIMEOUT_MS` passou a ser respeitado (estava fixo em 12000).

### Alterado
- **Imagens via `next/image`.** As 12 fotos eram hotlink cru de
  `reservas.desbravador.com.br` (534–921ms cada, `load` medido em **6192ms**).
  `next.config.ts` ganhou `remotePatterns` + `minimumCacheTTL` de 7 dias, e os
  `<img>` viraram `<Image fill sizes=...>` na home e na busca.
- **Hero com foto.** Era um gradiente liso. Agora usa a primeira mídia em destaque
  **sem `quarto_id`** (foto da pousada/praia), com fallback para `og_image_url` e,
  por último, o gradiente. Overlay escuro garante legibilidade sobre qualquer foto.
- **Página `/reservar` reescrita.** Disponíveis e esgotados agora em blocos
  separados; card extraído para o componente `CardQuarto`; exibe estadia mínima,
  selo de escassez, valor de criança com faixa quando variável, aviso de política
  de criança do motor, e mensagem de erro com saída para o WhatsApp.
- Header: nome da pousada não some mais no mobile; logo de h-8 para h-9/h-10.

### Corrigido (build verificado no container, apos a revisao ao vivo)
- **O `next build` estava quebrando o deploy inteiro se o banco piscasse.**
  `src/app/(site)/layout.tsx` consulta a tabela `pousada` e nao declarava
  `force-dynamic`. O Next entao tentava PRERENDERIZAR as paginas cujo proprio
  `page.tsx` tambem nao declarava (`/contato`, `/faq`, `/politicas`,
  `/a-pousada`) e batia no Neon durante o build. Duas consequencias:
  1. Neon fora do ar ou lento na hora do deploy = **build falha por inteiro**
     (reproduzido: `Error occurred prerendering page "/contato"` →
     `ECONNREFUSED 127.0.0.1:5432` → `build worker exited with code: 1`)
  2. Quando passava, telefone, cores e textos ficavam **congelados no HTML
     estatico** — edicoes no admin so apareceriam no deploy seguinte
  Agora o layout declara `force-dynamic` e envolve a consulta em try/catch com
  defaults, entao uma queda do banco degrada a pagina em vez de derrubar o site.
- Build validado de ponta a ponta no container (`npx next build`): compila,
  TypeScript limpo, 42 rotas, todas as paginas do site como `ƒ` (dinamicas).

### Ação necessária (só o Vinicios pode fazer)
1. **`npm run db:corrigir`** — aplica telefone real, acentos e desativa o passeio
   de teste ("Vinicios / VR / R$ 350") que está público na home. O ambiente desta
   sessão não tem rota de rede até o Neon.
2. **Cadastrar a foto do hero** — Admin → Mídias → imagem com `destaque = true` e
   **sem quarto vinculado**. Sem isso o hero continua no gradiente.
3. **Apontar o DNS** para a Vercel e aposentar o WordPress.
4. Verificar se o otimizador de imagem da Vercel consegue buscar de
   `reservas.desbravador.com.br` (se o motor bloquear hotlink do datacenter, o
   plano B é espelhar as fotos em Vercel Blob).
5. Pendente da sessão anterior: `AGENT_API_KEY` na Vercel + OpenClaw.

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
