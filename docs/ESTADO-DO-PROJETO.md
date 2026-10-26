# Estado do projeto — Marimar Site

> **Central de reservas privada /reservas — 26/10/2026:** página implementada com login próprio Cecília (credenciais protegidas em variáveis de ambiente no cofre Vercel: hash scrypt + segredo HMAC), sessão httpOnly/Secure/SameSite Strict de 8 horas, visualização responsiva do calendário por suíte e registros futuros. A conexão local de quartos usa apenas SELECT na tabela quartos; **não há integração autenticada de registros de reservas confirmadas ao Desbravador PMS/ROL**, então os períodos são exibidos como sem informação, sem inventar hóspedes, valores ou ocupação. Teste navegador em preview validou login, navegação de datas, alerta sobre integração pendente e logout. Preview não tem DATABASE_URL, portanto catálogo de suítes somente pode ser validado em produção. Próxima etapa: aprovar credenciais read-only PMS ou exportação oficial; nunca extrair nomes de clientes do motor público de tarifas.


> **Fotos da Marina no WhatsApp — 26/10/2026:** o OpenClaw na Hostinger recebe HTTP 403 ao tentar baixar imagens originais do Desbravador. Rota `/api/midia-quarto/[slug]/[indice]` prepara bytes JPEG/PNG/WebP de fotos ativas e visíveis no banco via Vercel/gru1, com fallback do cache da imagem do próprio site; `/api/agent/quartos` fornece `fotos[].url_whatsapp`; skill `marimar-pousada` passa este URL no campo `media` da ferramenta `message` (máx. 3 anexos), nunca pelo Browser. **Pendente:** reinstalar skill no OpenClaw/Hostinger e testar anexo real num WhatsApp; isso não é feito por deploy Vercel. Código isolado de banco/reservas/preços.


> **Marina WhatsApp — ajuste de 26/10/2026:** a skill `consulta-desbravador` foi corrigida para usar `/api/agent/disponibilidade` via Vercel/`gru1` e não mais chamar o Worker diretamente da Hostinger (502 externo). Incluídos cinco testes de regressão, instruções de instalação e proteção contra preços inventados. **PENDENTE:** reinstalar `consulta-desbravador` e `marimar-pousada` no OpenClaw da Hostinger, validar `MARIMAR_API_KEY` e testar WhatsApp real; o merge no GitHub sozinho não atualiza habilidades instaladas. Sem alteração de banco ou motor.


> **Atualização /saude V2 (26/10/2026):** reorganização da interface com Marina SVG expressiva (olhos/cabeça/braços/pernas), navegação e sondas reais de leitura em src/app/api/saude/status/route.ts. Nenhuma correção automática. OpenClaw/WhatsApp, ElevenLabs, Blob, DNS/TLS e tabelas têm verificações específicas; alertas externos e webhooks permanecem não verificados por dependerem de envios. Histórico do navegador, não uptime 30 dias. Ver docs/saude-marina.md.


> **/saude — 26/10/2026:** nova página pública *isolada* com escritório 2.5D da Marina, inventário de serviços, sondas somente de leitura, navegação, simulação de incidentes e aprovações que não alteram nada. Não é um agente corretivo real; monitoria autenticada do OpenClaw/WhatsApp e persistência de histórico ainda não foram feitas. Detalhes para Claude em `docs/saude-marina.md`.


> **Incidente de disponibilidade — 26/10/2026:** o site de producao retornou Worker HTTP 502 nas buscas; teste isolado em Vercel `gru1` retornou Worker HTTP 200 (9 quartos, 1 indisponivel). Correcao versionada em `vercel.json` (`regions: ["gru1"]`). **Resolvido em producao:** deploy `dpl_G8uK5LhX66s3EZZT18FGg8FVeMCn` em `gru1`; API `/api/disponibilidade` HTTP 200, `ok:true`, com 6 suites disponiveis em 10-12/11 e 9 em 08-11/12; `/reservar` tambem conferida. **Pendente:** validar especificamente a rota autenticada da Marina e acompanhar recorrencias de 502. Ver `docs/incidente-disponibilidade-2026-10-26.md`.


> Atualizado em 21/10/2026 (voz da Marina igual no site e no WhatsApp, com ElevenLabs, OpenAI e Google; blindagem do WhatsApp: vigia, disjuntor, QR seguro e alerta; WhatsApp da Marina: QR e API oficial da Meta prontos, escolha no painel; Marina fora do WhatsApp desde 18/10: o motivo real e o aviso no painel; mapa da rota em 3D, Mapbox opcional e navegação em tela inteira com prévia do caminho; painel novo fase 1 em vidro líquido; busca do topo abaixo da foto, em vidro; busca de datas tolerante e com 45 s; "à beira-mar" no lugar de "pé na areia"; domínios saindo da Cloudflare antiga para a Vercel; Marina no número de atendimento da Cecília).

## Onde estamos

**No ar e funcionando**

- Site publicado na Vercel (`marimar-site.vercel.app`). Em 26/10/2026, a integracao de disponibilidade/tarifas com o Desbravador foi corrigida com Vercel Functions em Sao Paulo (`gru1`) e validada em producao em 26/10 (HTTP 200, quartos e precos reais).
- **Chat da Marina no site**, falando com a MESMA agente do WhatsApp pelo
  gateway do OpenClaw. Interruptor em `/admin/integracoes`.
- **Audio nos dois canais**: no site a pessoa grava e recebe resposta falada;
  quem escreve le e decide se quer ouvir. No WhatsApp, `tts.auto: "inbound"`.
- **`/admin/marina`** — a Cecilia treina a agente sem abrir a Hostinger: voz,
  jeito de falar, fatos, limites e revisao das conversas do site.

**O que so existe depois de rodar**

```
npm run db:migrate          # migrations 0009 a 0021 (0021: "pé na areia" → "à beira-mar" no conteúdo gravado — 18/10)
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

## Rota no site, movimento e Cérebro novo (30/09/2026, sexta entrega)

`/como-chegar#rota` traça a rota de onde a pessoa estiver até a porta
(carro/ônibus → barco → a pé), com navegação ao vivo no celular — tudo
gratuito (MapLibre, OpenFreeMap, OSRM, Photon). Painel: **Rota e mapa**.
Tudo em **`docs/fluxo-rota.md`**. O site ganhou movimento configurável
(Identidade visual → Forma → Movimento do site) e o Cérebro ganhou o mapa
no visual novo (Marina no centro, painel do assunto, equipes de apoio).

## As pendencias que importam

00000000000000000. **Voz da Marina (21/10):** o WhatsApp falava com outra voz porque
   o painel e o guia gravavam nomes que o OpenClaw não lê, por um método que ele
   recusa (`docs/voz-marina.md`). Corrigido e com três provedores. **Fazer:** em
   Marina → Voz, conferir o cartão "A voz da Marina agora" e usar "Salvar nos
   dois canais" uma vez (o WhatsApp reconecta em segundos); depois mandar um
   áudio para a Marina e conferir a voz. Para OpenAI ou Google: conectar a conta
   na mesma tela (chave de API; o login do ChatGPT da Hostinger não gera voz).
   Não testado com o OpenClaw e os provedores de verdade daqui.
0000000000000000. **Blindagem do WhatsApp (21/10):** feita no site
   (`docs/blindagem-whatsapp.md`). No servidor, `groupPolicy "disabled"` e
   `selfChatMode false` **aplicados em 21/10** (connected, healthy). Faltam: a
   cópia de segurança pelo `tar` (o `openclaw backup create` falha na 2026.9.4)
   e a atualização para a 2026.10.5 pelo **Docker Manager** do hPanel (o
   terminal não deixa) — não urgente. **Aviso no celular:** ligar no painel
   (WhatsApp da Marina → Aviso no seu celular), instalar o ntfy e mandar o
   alerta de teste; não testado com o ntfy de verdade. Falta o agendador a cada
   5 min em `/api/cron/chamados` (vigia + prazos). Hoje a Marina está num
   **celular de testes**; para o número real, seguir "Ao ligar o número real da
   pousada" no mesmo documento.
000000000000000. **WhatsApp da Marina pelo painel (20/10):** Marina → WhatsApp
   da Marina conecta pelo QR e desconecta, só perfil Administração (a
   Cecília precisa desse perfil em Pessoas e acessos para usar). Primeiro uso
   real: conferir que o gateway da Hostinger aceita `web.login.start` pelo
   `admin-http-rpc`. **API oficial da Meta: pronta e desligada.** Para usar:
   conta na Meta, as quatro `WHATSAPP_META_*` na Vercel, webhook e modelos
   (`docs/fluxo-whatsapp-oficial.md`), depois "Usar a API oficial" na tela.
   Decidir antes o número (estudo: mesmo número com parceiro, ou número novo).
   Não testado com a Meta real.
00000000000000. **Marina fora do WhatsApp desde 18/10 (~11h):** o WhatsApp
   removeu o aparelho conectado (código 401; não é Marina duplicada, que daria
   440). Ela não volta sozinha: ler o QR de novo (pelo painel desde 20/10, ou
   `docs/runbook.md`, "WhatsApp caiu"). Antes, descobrir a causa no celular da pousada
   (Aparelhos conectados) e no log de 18/10. Combinar com quem usa o celular
   de atendimento: não remover "openclaw" e não reinstalar o WhatsApp. Se cair
   de novo sem ninguém mexer, pensar na API oficial do WhatsApp.
0000000000000. **Calendário de estadia (19/10):** entrada e saída num calendário
   só, na busca da home e em /reservar (abre no mês da entrada). Conferir
   num iPhone e num Android de verdade.
000000000000. **Botão "Reservar no site oficial" (19/10):** passou ao formato
   novo do motor (o mesmo da Marina), para abrir com datas e hóspedes em vez
   da página inicial do Desbravador. Conferir num celular. Para abrir já na
   suíte escolhida, falta saber se o motor aceita um parâmetro de quarto
   (pedir ao Vinicios o endereço que aparece depois de escolher a suíte lá).
00000000000. **Ícone e abertura (19/10):** o ícone do site agora sai da logo
   (antes era o triângulo da Vercel) e o site abre com a logo animada e
   "Pousada" embaixo. Conferir num celular de verdade; quem tinha o atalho na
   tela inicial precisa apagar e pôr de novo para ver o ícone novo.
0000000000. **Marina demorando no teste do painel (19/10):** o print mostrou
   "timeout" ao testar o roteiro "Como chegar a pousada". O teste agora diz
   se o servidor do OpenClaw não atendeu ou se só está lento. Conferir no
   servidor (`openclaw gateway status`, `openclaw logs`) e se a skill ainda
   alcança `https://marimar-site.vercel.app` depois da troca de domínio.
000000000. **Mapa da rota (19/10):** em 3D, com navegação em tela inteira e
   "Ver o caminho em 3D". Para ligar o Mapbox: painel → Site → Como chegar
   (mapa) → Visual e serviços → token **público** (`pk.`). Recomendado criar
   no Mapbox um token só do site, com restrição de URL para os domínios da
   pousada e `marimar-site.vercel.app` (o "Default public token" não aceita
   restrição). Conferir num celular de verdade: abrir `/como-chegar`, "Ver o
   caminho em 3D" e, na ilha, "Começar a navegação". O Mapbox **não foi
   aberto daqui**.
00000000. **Painel como central (19/10):** aprovado; **fase 1 no ar** (7 áreas,
   vidro líquido, tela Hoje, busca Ctrl+K, perfis). Próximas fases em
   `docs/estudo-painel-central.md`; as fases 4 e 5 mexem no banco: perguntar
   antes. Conferir num celular de verdade (iPhone e Android) o desfoque do vidro.
0000000. **"À beira-mar" (18/10):** rodar `npm run db:migrate` (migration
   **0021**). Ela troca "pé na areia" por "à beira-mar" em todo texto gravado
   no banco (seções da home, cartões, banners, SEO, FAQ, treinamento da
   Marina…). Sem ela, o título da home continua "…pé na areia".
000000. **Domínios (17/10, em andamento):** os dois domínios já usam o DNS do
   registro.br (modo avançado) e estão na Vercel. Falta criar as linhas A/CNAME
   quando a zona sair de "transição" e, com tudo azul na Vercel, trocar
   `NEXT_PUBLIC_SITE_URL` e `AUTH_URL` e fazer Redeploy. Até lá os domínios
   ficam fora do ar. Passo a passo: `docs/runbook.md`, "Domínios". A Marina
   agora atende no número da Cecília: atualizar **Dados da pousada → WhatsApp**
   e conferir que esse número não está em Equipe responsável.
00000. **Aviso à equipe (30/09, sétima entrega):** rodar a migration **0020**.
   No OpenClaw:
   - liberar a ferramenta `message`: `openclaw config set tools.alsoAllow '["message"]' --strict-json` e `openclaw gateway restart` (ver `docs/runbook.md`);
   - conferir `openclaw channels status`;
   - reinstalar a skill `marimar-pousada`.

   Depois, "Testar envio" precisa dizer "✓ O WhatsApp confirmou a entrega".
   Com o OpenClaw real, **não foi verificado daqui**.
0000. **Rota (30/09, sexta entrega):** abrir `/como-chegar` num celular com
   4G e traçar uma rota de verdade — OpenFreeMap, OSRM e Photon **não foram
   testados daqui** (só o simulador). Depois, em **Rota e mapa**, arrastar o
   trapiche e os terminais para o lugar exato e marcar "Conferi os pontos".
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
1. **DNS (em migração desde 17/10, ver acima).** `www.pousadamarimarilhadomel.com.br` servia o WordPress
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
  O que continua valendo: as suítes NÃO ficam na areia. Desde 18/10/2026
  (decisão do Vinicios) o site **não usa mais "pé na areia"**: o restaurante
  é **"à beira-mar"**, e só ele (nunca "suítes à beira-mar"). Textos centralizados em `COMPLEXO`
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

Opcionais (API oficial do WhatsApp; sem elas, só o QR): `WHATSAPP_META_TOKEN` ·
`WHATSAPP_META_PHONE_ID` · `WHATSAPP_META_APP_SECRET` · `WHATSAPP_META_VERIFY_TOKEN`
(ver `docs/fluxo-whatsapp-oficial.md`). Alerta da Marina fora do WhatsApp:
ligado pelo painel; `ALERTA_WHATSAPP_URL`, se existir, vale por cima (ver
`docs/blindagem-whatsapp.md`). Voz: `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`,
`GEMINI_API_KEY` são opcionais — as contas também se conectam em Marina → Voz
(guardadas cifradas com o `AUTH_SECRET`; ver `docs/voz-marina.md`).

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
| `docs/voz-marina.md` | a voz da Marina: por que o WhatsApp falava diferente, provedores, chaves pelo painel, o que vai ao OpenClaw |
| `docs/blindagem-whatsapp.md` | o que derrubou a Marina, vigia, disjuntor, QR seguro, alerta, comandos do servidor e troca para o número real |
| `docs/fluxo-whatsapp-oficial.md` | as duas formas do WhatsApp (QR e API oficial da Meta), a troca, chaves e passo a passo na Meta |
| `docs/runbook.md` | deploy, env vars, incidentes, rotacao de chave |
| `docs/samples/` | amostras de payload do Worker |
| `AGENTS.md` | regras do Next.js 16 (bloco gerado pelo `next dev`) |
| `Inicio.txt` | prompt historico do scraper — contexto de origem, nao e spec atual |

---

## 8. Pendencias conhecidas

### 🔴 Bloqueia o lançamento

| # | Item | Quem resolve |
|---|---|---|
| 1 | **DNS em migração desde 17/10** (registro.br → Vercel; ver pendência 000000). Antes apontava para o WordPress 5.8.16. O Next.js só existe em `marimar-site.vercel.app`. O WP roda tema Consulting, WooCommerce 4.7.4, RevSlider 5.4.8.3 — stack de 2021 sem atualização | Vinicios (registrador + Vercel) |
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
| 12 | Lint: 177 erros no fim de 30/09 (eram 179; `public/vendor/` agora ignorado — é a cópia do worker do mapa; nenhum nos arquivos novos) — pré-existentes (162 são `any`; medido em 28/09) — antes dizia ~23 (`any`, `react-hooks/purity` com `Date.now`, aspas não escapadas) — não bloqueiam o build |
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
