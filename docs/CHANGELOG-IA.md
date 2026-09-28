# Revisão geral por IA — 28/09/2026

**Autor:** Claude (Claude Code, sessão remota)
**Branch:** `claude/eager-cannon-lxyok3`
**Escopo pedido:** revisão geral (bugs, código duplicado, performance), corrigir o
que é simples, listar o que é complexo, **sem quebrar o que já funciona**.

Este arquivo existe para quem continuar o trabalho com outra ferramenta. Leia a
seção "Como continuar" no fim antes de mexer em qualquer coisa.

---

## Resumo em uma tela

| | Quantidade |
|---|---|
| Problemas de segurança corrigidos | 3 (1 crítico) |
| Bugs corrigidos | 10 |
| Melhorias de performance aplicadas | 5 |
| Duplicações removidas | 5 |
| Pendências listadas (não mexidas) | 20 |
| Migrations novas | **nenhuma** |
| Variáveis de ambiente novas | **nenhuma** |
| Dependências novas | **nenhuma** (o lock só foi sincronizado) |

Verificação feita: `tsc --noEmit` limpo, `next build` limpo, e o build foi
**executado** (`next start`) com o banco propositalmente fora do ar, para ver os
caminhos de erro. Detalhes na seção "Como foi verificado".

---

## 1. Segurança (corrigido)

### 1.1 🔴 CRÍTICO — qualquer pessoa trocava a senha de qualquer conta
`src/app/(admin)/admin/trocar-senha/actions.ts`

A action `trocarSenha` lia o id do usuário de um `<input type="hidden" name="userId">`
e **não conferia a sessão**. Server Action é um endpoint POST público: bastava
enviar outro `userId` para trocar a senha de outra conta — inclusive sem estar
logado (`/admin/trocar-senha` está na lista de rotas públicas do middleware).

**Correção:** o id vem de `auth()` e de nenhum outro lugar; o campo hidden saiu da
página. Também saíram os `console.log` que imprimiam o `userId` e o tamanho da senha.

**Bug junto:** depois de trocar a senha a pessoa voltava para `/admin`, mas o JWT
ainda carregava `mustReset = true` (gravado no login), e o painel a mandava de volta
para a troca de senha — em loop, até sair e entrar de novo. Agora a sessão é
encerrada após a troca (`signOut({ redirectTo: "/admin/login" })`) e a pessoa entra
com a senha nova.

> ⚠️ **Mudança de comportamento visível:** após trocar a senha, a pessoa cai na
> tela de login. É intencional.

### 1.2 🔴 Server Actions do admin sem autenticação
`src/lib/admin-actions.ts` (19 actions), `admin/categorias/actions.ts`,
`admin/comodidades/actions.ts`, `admin/quartos/actions.ts` (10 actions)

A página que mostra o botão era protegida; **a action não**. Quem obtivesse o id de
uma action (ele aparece no HTML da página) conseguia criar, editar e **apagar**
FAQ, pacotes, passeios, depoimentos, mídias, quartos, categorias, comodidades,
políticas e identidade visual sem login.

**Correção:** novo helper `exigirSessao()` em `src/lib/admin-sessao.ts`. As fábricas
de conexão desses arquivos (`db()` / `sql()`) viraram `async` e chamam a trava
antes de abrir conexão — as 29 actions ficam cobertas sem repetir código. As demais
actions do projeto (banners, cardápio, cartões, blocos, marina, identidade visual,
chat) já checavam sessão e não foram tocadas.

Testado contra o build rodando: POST direto em `excluirFaq` e `trocarSenha` sem
cookie → `303 → /admin/login`, sem nenhuma tentativa de conexão ao banco.

### 1.3 🟠 Rota de documentos da Marina aceitava qualquer URL
`src/app/api/admin/marina/documento/route.ts`

A rota (só admin) baixava qualquer URL enviada pelo cliente e, se a leitura falhasse,
chamava `del()` nela — dava para buscar URL externa pelo servidor ou apagar um banner
do Blob passando a URL dele. Agora exige `https://*.public.blob.vercel-storage.com`
(`urlDoNossoBlob()` em `src/lib/blob.ts`) e tem timeout de 30s no download.

---

## 2. Bugs corrigidos

| # | Onde | Bug | Correção |
|---|---|---|---|
| 2.1 | `package-lock.json` | Dessincronizado: faltavam `mammoth` e `unpdf` (adicionados em 19/09). `npm ci` falhava com `EUSAGE`. | `npm install` — só entraram os pacotes que faltavam. |
| 2.2 | 6 arquivos | **Data fixa `2026-10-15`** na página do quarto (preço **e link "Reservar"**), diagnóstico, integrações, admin de quartos, prévia do tema e rota do agente. A partir de 15/10/2026 tudo isso consultaria uma estadia no passado. | `datasExemplo()` em `src/lib/format.ts`: uma semana à frente, 2 noites. |
| 2.3 | `/contato` | A página recebia `?ok=` e `?erro=` e **não mostrava nenhum dos dois**: quem enviava mensagem não tinha confirmação. | Mensagens de sucesso e erro renderizadas. |
| 2.4 | `/contato`, `/api/agent/lead`, `POST /api/agent/pousada` | `leads.telefone` é `varchar(20)`; um telefone digitado mais longo derrubava o insert com 500. Sem limite em nenhum campo. | `registrarLead()` corta cada campo no tamanho da coluna; inputs com `maxLength`. |
| 2.5 | `/api/agent/lead`, `POST /api/agent/pousada` | JSON inválido → 500 sem explicação. | 400 com mensagem. |
| 2.6 | `/api/disponibilidade`, `/api/agent/disponibilidade`, `/reservar` | Sem validação: `adultos=abc` virava `NaN` e ia para a URL do Worker; check-out antes do check-in gastava uma consulta ao motor; datas entravam cruas na querystring do Worker. | `validarConsulta()` em `src/lib/worker.ts` (datas `AAAA-MM-DD` reais, saída > entrada, hóspedes 1–20 / 0–20). `/reservar` mostra "A data de saída precisa ser depois da data de entrada." |
| 2.7 | ~10 rotas/páginas | Conexão com o banco **vazava quando uma consulta falhava** (`sql.end()` só no caminho feliz): `/api/disponibilidade`, agente `disponibilidade`/`faq`/`pacotes`/`quartos`/`pousada`, `/reservar`, home, admin de quartos (redirect de Motor ID duplicado), DELETE de documento. | `comSql()` em `src/lib/db-conexao.ts` (fecha em `finally`) ou `try/finally` local. |
| 2.8 | SEO | Não existiam `/robots.txt` nem `/sitemap.xml` — só `/api/robots` e `/api/sitemap`, que buscador nenhum procura. O robots apontava para um `/sitemap.xml` inexistente. | `rewrites()` no `next.config.ts`. Sitemap ganhou restaurante, como-chegar, galeria, avaliações e eventos, e não cai mais se o banco estiver fora. |
| 2.9 | `/api/agent/openapi` | Documentava 6 das 14 rotas e dizia que `/lead` responde 201 (responde 200). Sem `securitySchemes`. | Gerado a partir de `AREAS` (`src/lib/agent-mapa.ts`), a mesma fonte do `/indice`. |
| 2.10 | Textos da Marina | Disponibilidade dizia `R$ 520/noite` sem formatação, `2026-10-15` em ISO, "2 adultos" fixo no plural; pacotes dizia "min 2 noites". | `brl()`, `dataBR()`, `pluralizar()` — padrão da seção 5 do ESTADO-DO-PROJETO. |

---

## 3. Performance (aplicado)

| # | Onde | Antes | Depois |
|---|---|---|---|
| 3.1 | Toda página do site | A linha da tabela `pousada` era lida **3×** por requisição (generateMetadata, layout raiz, layout do site), **cada uma com conexão nova ao Neon**; home, a-pousada, quarto e reservar faziam a 4ª. | `lerPousada()` em `src/lib/pousada.ts` com `cache()` do React: 1 consulta por requisição. Nada é guardado entre visitas — o que o admin salva aparece na visita seguinte. (Documentado em `node_modules/next/dist/docs/.../generate-metadata.md`.) |
| 3.2 | `/quartos/[slug]` | Motor consultado **depois** de 4 consultas ao banco. | Consulta ao motor começa logo após achar o quarto e corre em paralelo. |
| 3.3 | `/reservar` | Idem: banco, depois motor. | Motor em paralelo com o banco. |
| 3.4 | `/admin/integracoes` | 7 testes de rede **em sequência**, timeouts somados ≈ 40s no pior caso — justamente quando algo está fora do ar. | `Promise.all`: pior caso ≈ 12s. |
| 3.5 | `/api/agent/quartos` | Agrupamento de comodidades copiava o array a cada item (O(n²)). | `push`. |

---

## 4. Duplicação removida

| O quê | Onde estava | Onde ficou |
|---|---|---|
| INSERT de lead | contato, `/api/agent/lead`, `POST /api/agent/pousada` | `registrarLead()` / `receberLead()` em `src/lib/leads.ts` |
| URL do Worker | `lib/worker.ts` e admin de quartos (host e slug fixos, ignorando `WORKER_BASE_URL`) | `urlTarifas()` em `src/lib/worker.ts` |
| Leitura da `pousada` | 7 lugares | `lerPousada()` em `src/lib/pousada.ts` |
| Rota `/api/auth/trocar-senha` | duplicava a action e não era usada em lugar nenhum | **removida** |
| `urlVoz()` / `corpoVoz()` em `lib/chat.ts` | sem uso (a rota de voz monta a chamada) | **removidas** |

O `POST /api/agent/pousada` (registro de lead) **foi mantido** de propósito: versões
antigas da skill da Marina podem chamá-lo. Agora ele só delega para a mesma função
do `/lead`.

### Lint
Corrigidos: imports sem uso (`trocar-senha/layout`, `quartos/[slug]`, `BannerCamadas`,
`GaleriaItem`), expressão solta no `LightboxCardapio`, aspas no JSX (`avaliacoes`,
`integracoes`). Total de problemas: **205 → 182** (todos os restantes são
pré-existentes; ver pendência 5.9).

---

## 5. Pendências — NÃO corrigidas (complexas ou arriscadas)

Ordenadas por prioridade. Cada uma diz **por que** não foi feita agora.

### 🔴 Alta

**5.1 A chave `AGENT_API_KEY` aparece inteira no HTML de `/admin/integracoes`.**
O "Guia OpenClaw" renderiza `curl -H "Authorization: Bearer <chave>"`. Qualquer
pessoa com acesso ao painel (ou a um print da tela) leva a chave. Sugestão: mostrar
só os 4 últimos caracteres e um botão "copiar" que busca a chave por Server Action.
*Não feito:* muda o fluxo de quem configura o OpenClaw — decisão do Vinicios.

**5.2 `/admin/integracoes` envia a `AGENT_API_KEY` para o host do cabeçalho da requisição.**
`baseUrl` sai de `x-forwarded-host`/`host`. Na Vercel esse cabeçalho é confiável;
em outro proxy seria vazamento de chave. Sugestão: usar `NEXT_PUBLIC_SITE_URL` ou
`VERCEL_URL`. *Não feito:* o comentário no código diz que foi trocado de propósito
para funcionar em dev e produção; precisa de teste nos dois.

**5.3 Login sem limite por IP.** O bloqueio é por conta (5 erros → 15 min). Isso
permite a um atacante **travar a conta da Cecília de propósito** e não impede
tentar uma senha em muitas contas. Sugestão: contador por `hashIp()` (como o do
chat) além do da conta. *Não feito:* mexe no fluxo de login do NextAuth, merece
teste dedicado.

**5.4 Formulário de contato sem limite de envio.** Coloquei um campo-armadilha
(honeypot) contra robô simples, mas um script dirigido ainda enche a tabela
`leads`. Sugestão: mesmo contador por IP do chat (`chat_mensagens` tem o padrão).
*Não feito:* precisa de tabela ou coluna nova → migration.

### 🟠 Média

**5.5 Home faz 7 consultas em sequência numa conexão só.** postgres.js faz
pipelining se as consultas forem disparadas juntas (`Promise.all`), o que cortaria
~6 idas e voltas ao Neon. *Não feito:* os blocos `try/catch` isolados ali existem
para tolerar tabelas ausentes antes de migration; paralelizar muda essa semântica
e precisa de teste com o pooler do Neon (PgBouncer em modo transaction).

**5.6 Conexão nova por requisição em todo o projeto.** Cada rota abre e fecha uma
conexão (`postgres(..., { max: 1 })`). Com o pooler do Neon funciona, mas cada
conexão custa TLS + autenticação. `src/db/index.ts` já tem um cliente compartilhado
(`max: 10`) que **ninguém usa**. Sugestão: um cliente de módulo reaproveitado entre
invocações quentes. *Não feito:* é a convenção documentada do projeto
(`docs/padrao-crud.md`) — mudar é decisão de arquitetura.

**5.7 `src/middleware.ts` → `proxy.ts`.** O Next 16 deprecou `middleware`. Já estava
na pendência 14 do ESTADO; continua. O arquivo teve bug de redirect loop recente.

**5.8 Fallback de `NEXT_PUBLIC_SITE_URL` inconsistente.** Sitemap e robots caem no
domínio antigo (`pousadamarimarilhadomel.com.br`, que hoje serve o WordPress);
`/api/agent/quartos` cai em `marimar-site.vercel.app`. Se a variável faltar, o
sitemap aponta para o WordPress. Resolver junto com a virada de DNS.

**5.9 Lint: 182 problemas pré-existentes.** 162 `no-explicit-any`, 12
`react-hooks/purity` (`Date.now()` para medir latência em Server Components —
falso positivo prático; resolve extraindo um `medir()` para fora do componente),
5 `set-state-in-effect` (AdminNav, CrudPage, LightboxCardapio, MenuPrincipal,
RotaInteligente), 3 `<img>` em vez de `next/image`. Nenhum bloqueia o build.
*Não feito:* volume grande, risco de regressão visual sem teste; melhor por arquivo.

**5.10 Testes automatizados: zero.** Os primeiros alvos, puros e já com casos
conhecidos: `validarConsulta()` e `urlTarifas()` (`lib/worker.ts`), `datasExemplo()`,
`brl()`, `tituloQuarto()`, `resumir()` (`lib/format.ts`), `checkAgentAuth()`.
Os casos que usei para verificar `validarConsulta` estão na seção "Como foi verificado".

### 🔵 Baixa

**5.11** Query de quartos da home usa 4 subconsultas correlacionadas por quarto
(foto e alt, destaque e fallback). Um `LEFT JOIN LATERAL` resolveria em uma. Com 6
quartos o ganho é pequeno.

**5.12** `hashIp()` (`lib/chat.ts`) usa `"marimar"` como sal se `AUTH_SECRET` faltar.
Como o `AUTH_SECRET` é obrigatório para o login, não acontece em produção — mas o
padrão do projeto é falhar fechado.

**5.13** `audit_log` existe no schema e nenhuma action grava nele (já estava na
pendência 9 do ESTADO).

**5.14** `docs/openclaw-integracao.md` está desatualizado (cita campo `como_chegar`
em `/pousada`, que hoje é `/api/agent/chegar`). O guia em `/admin/integracoes`
também lista só 6 rotas.

**5.15** O resumo de `/api/agent/disponibilidade` mostra só os 5 primeiros quartos
(`slice(0, 5)`). Parece intencional (tamanho de mensagem no WhatsApp), mas com 10
tipos no motor a Marina pode não "ver" metade no resumo — os dados completos estão
em `dados`.

**5.16** A página de login não mostra mensagem depois da troca de senha (a pessoa
só cai no login). Um `?ok=` exigiria `useSearchParams` + `Suspense` no componente
cliente.

**5.17** Várias actions do admin gravam o que vier do formulário sem validar
tamanho/formato (slug, URLs de imagem, cores). Só o admin chega lá, então o risco
é erro de digitação, não ataque.

**5.18** `/api/agent/disponibilidade` sem datas usa uma estadia de exemplo em vez
de pedir as datas. Mantive (era o comportamento anterior, com data fixa); as datas
usadas agora vão escritas no resumo. Talvez seja melhor devolver 400 e forçar a
Marina a perguntar — decisão de produto.

**5.19** `package.json`: ESLint 9 marcado como sem suporte pelo npm; `tsx`,
`drizzle-kit` puxam pacotes `@esbuild-kit` deprecados. Nada quebra hoje.

**5.20** A home e várias páginas do admin usam `any` para linhas do banco — é a
causa raiz da maior parte do lint e esconde erros de coluna renomeada.

---

## Como foi verificado

1. `npx tsc --noEmit` — limpo.
2. `npx next build` — limpo, todas as rotas como `ƒ`.
3. `npx next start` com `DATABASE_URL` apontando para uma porta fechada:
   - `/robots.txt` e `/sitemap.xml` → 200 (sitemap com as páginas fixas).
   - `/api/disponibilidade` com saída < entrada → 400; com data `abc` → 400.
   - `/api/agent/lead` sem chave → 401; JSON inválido → 400; sem nome → 400.
   - `POST /api/agent/pousada` sem nome → 400.
   - `/api/agent/disponibilidade?check_in=2026-13-01` → 400.
   - `/contato?ok=...` e `?erro=...` mostram as mensagens.
   - `/reservar` com datas invertidas mostra "A data de saída precisa ser depois…".
   - `/`, `/a-pousada`, `/reservar` → 200 com o banco fora (degradam, não caem).
   - POST direto nas actions `excluirFaq` e `trocarSenha` **sem cookie** → 303
     para `/admin/login`, sem tentativa de conexão ao banco.
4. `validarConsulta()` testada à parte:
   `adultos=abc` → 2 · `criancas=-3` → 0 · `adultos=99` → 20 ·
   `2026-02-30` → inválida · `2026-10-15&x=1` → inválida · saída < entrada → `motivo: "ordem"`.

**O que NÃO foi verificado:** nada disto rodou contra o banco de produção nem contra
o Worker real (o ambiente da revisão não tinha as credenciais). Antes do deploy,
vale abrir no preview da Vercel: login → trocar senha (deve cair no login e entrar
com a nova), salvar um FAQ, enviar o formulário de contato, `/reservar` com datas
reais, e `/admin/integracoes`.

---

## Como continuar

- **Commits desta revisão** (do mais antigo ao mais novo), todos na branch
  `claude/eager-cannon-lxyok3`:
  `fix(deps)` lock → `fix(seguranca)` actions e senha → `fix:` datas/validação →
  `fix:` contato/leads/agente → `perf:` pousada por requisição → `chore(lint)` →
  `fix(admin)` documento/Blob → `fix(seo)` robots/sitemap → `chore:` código morto →
  `docs:` este arquivo.
- **Helpers novos que a próxima ferramenta deve usar** em vez de repetir código:

  | Helper | Arquivo | Para quê |
  |---|---|---|
  | `exigirSessao()` | `src/lib/admin-sessao.ts` | primeira linha de **toda** Server Action nova do admin |
  | `comSql(fn)` | `src/lib/db-conexao.ts` | abrir/fechar conexão sem vazar em erro |
  | `lerPousada()` | `src/lib/pousada.ts` | a linha da `pousada` em qualquer página do site |
  | `validarConsulta()` / `urlTarifas()` | `src/lib/worker.ts` | qualquer coisa que consulte o motor |
  | `datasExemplo()` | `src/lib/format.ts` | nunca mais escrever data fixa |
  | `registrarLead()` | `src/lib/leads.ts` | qualquer novo ponto de entrada de contato |
  | `urlDoNossoBlob()` | `src/lib/blob.ts` | antes de baixar/apagar uma URL vinda do cliente |

- Comece pelas pendências **5.1 a 5.4** (segurança). Depois 5.10 (testes) — ela
  torna todas as outras mais seguras de fazer.

---

# Segunda rodada — 28/09/2026: topo no celular e posicionamento

Pedido do Vinicios, a partir de um print do celular.

## Feito

| O quê | Onde |
|---|---|
| Busca de datas saiu de cima da foto no celular; vai logo abaixo, sobrepondo só a borda. Computador sem mudança. | `CarrosselBanners.tsx` (`BuscaNoCelular`), `BannerCamadas.tsx`, `BlocosHome.tsx` (topo sem banner) |
| Banners mais baixos no celular (a busca não mora mais dentro deles) | `ALTURAS` em `src/lib/banners.ts` |
| Botões "Marina" e WhatsApp numa linha só no celular; rodapé com folga embaixo | `ChatMarina.tsx`, `(site)/layout.tsx` |
| Pousada como protagonista em todo texto para hóspede; fim do "anexada aos fundos" | `COMPLEXO`, `DIFERENCIAIS`, `RESTAURANTE`, `CHEGADA_ETAPAS`, FAQ em `conteudo-pousada.ts`; `BlocosHome`, `a-pousada`, `restaurante`, `como-chegar`; textos de prévia no admin |
| Migration de dados 0014 (só troca texto padrão antigo). Era 0013; renumerada porque outra sessão já tinha criado a `0013_conteudo_editavel` | `drizzle/0014_pousada_protagonista.sql` |

Verificado com Postgres local (migrations + `db:seed` + `db:corrigir`),
banner de teste e prints em 390px e 1280px, antes e depois. `tsc` e
`next build` limpos. A migration foi rodada duas vezes (é idempotente).

**Juntado depois:** o commit `320310c` (voz do painel também no WhatsApp + tabela `conteudo_editavel`, migration 0013), que estava só na máquina do Vinicios. Pendência dele: `sincronizarVoz()` grava `voz_id` e modelo na config do OpenClaw sem validar formato; um erro de digitação no modelo pode calar a voz do WhatsApp até ser corrigido no painel.

## Pendente desta rodada

- **Cartões cadastrados no admin** para a seção da pousada (`blocos_itens`)
  mandam no texto e na ordem e não foram tocados — não há como vê-los daqui.
  Conferir em Admin → Cartões das seções.
- **`seo_description`** da pousada é editada no painel; se tiver "aos
  fundos", trocar em Admin → Identidade visual.
- `docs/briefing/briefing-administracao-2026-09-18.txt` continua pedindo a
  frase antiga. Não editei o briefing (é registro histórico); a decisão nova
  está no `ESTADO-DO-PROJETO.md`, seção 5, e no comentário de `COMPLEXO`.
- A skill da Marina no OpenClaw (`agente/`) não citava "fundos"; as rotas da
  API já saem com o texto novo. Vale uma conversa de teste perguntando "onde
  fica a pousada?".
