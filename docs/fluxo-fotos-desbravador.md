# Fotos das suítes: sincronização com o Desbravador (04/11/2026)

> Para quem opera: a pousada sobe as fotos das suítes **no Desbravador**, como
> sempre fez. O site copia de lá sozinho; o que a pousada sobe **no painel do
> site** fica intacto. Botão para não esperar: Admin → Mídias →
> **Sincronizar com o Desbravador**.

## O problema que existia (até 03/11/2026)

- O motor devolve, para cada tipo de suíte, a lista de fotos (`fotos[]`,
  endereços em `reservas.desbravador.com.br/reservas/images/hoteis/...`).
- O sincronizador anterior (`/api/cron/sincronizar-fotos`, do PR de 26/10)
  só rodava pela Vercel com uma `CRON_SECRET` que **nunca foi criada**; o
  plano Hobby chama uma vez por dia; e ele só **acrescentava** fotos — a
  foto trocada no Desbravador ficava no site para sempre, e a página da
  suíte ignorava as fotos do motor quando a biblioteca estava vazia.
- O `seed` original marcou `ativo = disponivel` no dia em que rodou: por
  isso 3 dos 10 tipos do motor ficaram **desativados** no site (a página
  `/quartos/[slug]` deles dá 404 e a home não os lista). Isso é cadastro,
  não bug do motor.

## O que faz agora (`src/lib/sincronizar-fotos-desbravador.ts`)

Uma rodada (`sincronizarFotosDoMotor()`):

1. Consulta o motor para daqui a 7 dias, 2 noites, 2 adultos
   (`datasExemplo(7, 2)`), e junta `quartos` + `indisponiveis`: a foto não
   depende de ter vaga.
2. Trava `pg_try_advisory_lock(20261102)`: o botão e o agendador nunca rodam
   ao mesmo tempo.
3. Para cada tipo do motor (`id` = código, ex. `QUEEN`):
   - **Não existe no site** → cria a suíte **ativa** (decisão do proprietário
     em 04/11: "se tem na Desbravador tem que aparecer"), `ordem 100+`, slug
     limpo (`slugDe`), com nome, categoria e ocupação do motor. (`ON CONFLICT
     (desbravador_room_id) DO NOTHING`, então nunca duplica.)
   - **Existe, mas desativada** → é religada (`suites_ativadas`).
   - **Tem código do motor e o motor não a devolveu** → é desligada
     (`suites_desativadas`), só quando a rodada viu 3+ tipos; volta sozinha
     quando o motor voltar a vendê-la. O campo Ativo do painel não manda mais.
   - **Fotos novas** → `INSERT` em `midias` com `origem = 'desbravador'`,
     `url_origem` = endereço no Desbravador, `secao = 'quarto'`. Com
     `BLOB_READ_WRITE_TOKEN` na Vercel, a imagem é **copiada para o Vercel
     Blob** (`fotos/desbravador/<slug>/<n>`): o site não depende mais do
     servidor do Desbravador, e a Marina (que recebe 403 dele na Hostinger)
     passa a ter a foto no nosso domínio. Sem o token, `url` aponta para o
     Desbravador (`espelho: "sem_blob"`, com aviso).
   - **Foto que sumiu do motor** → `DELETE ... WHERE origem = 'desbravador'`
     (e `del` no Blob). Fotos com `origem = 'painel'` **nunca** são tocadas.
4. Grava o resumo em `integracoes.fotos_sync` (lido pelo Diagnóstico).

Quando roda:

| Gatilho | Onde | Quem autoriza |
|---|---|---|
| Botão **Sincronizar com o Desbravador** | Admin → Mídias (em "Todas" e nos álbuns de suíte) | sessão do painel (`exigirSessao`) |
| De carona nas buscas de `/reservar` | `after()` no `page.tsx`, **no máximo 1×/hora** (`talvezSincronizarFotos`) | ninguém: só se a última rodada tem mais de 1 h |
| Vercel Cron diário (`vercel.json`, 12:00 UTC) | `GET /api/cron/sincronizar-fotos` | `Authorization: Bearer <CRON_SECRET>` (16+ chars) **ou** `AGENT_API_KEY` |

**Sem `CRON_SECRET` a rodada diária roda mesmo assim** (desde 04/11, parte 2):
a chamada sem chave roda a sincronização **antes de responder** quando a
última tem mais de 1 h (200 com o resumo; 503 com o erro) e, fora disso,
devolve 202 `{modo:"carona", ultima_em, ultimo_resumo, ultimo_erro}`. Com a
chave (ou a `AGENT_API_KEY`) roda sempre. Não usa `after()` de propósito:
quem chama vê o resultado na resposta. O Diagnóstico mostra a chave como
"opcional".

## Migration 0022 (`drizzle/0022_midias_origem.sql`, só acrescenta)

- `midias.origem text NOT NULL DEFAULT 'painel'` + índice; as fotos já
  importadas do Desbravador (URL `reservas.desbravador.com.br/.../hoteis/`)
  são marcadas `'desbravador'` no próprio script.
- `midias.url_origem text` (endereço no Desbravador, para reconhecer a foto
  depois de espelhada).

**O site aplica a 0022 sozinho** (`src/lib/esquema-midias.ts`,
`garantirEsquemaMidias`): antes de cada sincronização e ao abrir Mídias ele
confere `information_schema` e, se faltar, roda o mesmo SQL (idempotente).
`npm run db:migrate` continua válido e passa pela 0022 sem erro. Isso vale só
para esta migration, que acrescenta; migration que altera dado continua
exigindo decisão humana.

## O que o site e a Marina mostram

- `/quartos/[slug]`: fotos da biblioteca; se não houver nenhuma, as do motor
  ao vivo (`preco.fotos`), em vez do quadrado vazio.
- `/reservar` (cards e modal), `/galeria`, home e `/quartos`: só suítes
  ativas; nenhum link leva a `/quartos/<inativa>` (sem 404).
- Painel → Mídias: selo **"Do Desbravador"** no cartão e no detalhe; o aviso
  de exclusão explica que ela volta na próxima sincronização se continuar lá.
- Marina: `/api/agent/quartos` segue devolvendo `fotos[].url_whatsapp`
  (bytes pelo nosso domínio, `/api/midia-quarto/[slug]/[indice]`).

## Fotos que não são de suíte (café da manhã, restaurante, praia…)

A Marina respondia "não possui imagens" porque **não existia rota** para as
seções da biblioteca. Agora:

- `GET /api/agent/fotos` (chave da Marina): todas as seções com total e até
  6 fotos; `?secao=cafe|restaurante|praia|pousada|eventos` traz uma. Cada
  foto tem `url_whatsapp` → `/api/midia-secao/<secao>/<indice>`, que serve os
  bytes (mesma validação de origem, tipo e tamanho das fotos de quarto —
  `src/lib/foto-whatsapp.ts`). Só fotos com "A Marina pode enviar" ligado.
- `/api/agent/restaurante` aponta para `?secao=cafe` e `?secao=restaurante`.
- A skill `marimar-pousada` ("Fotos e vídeos: como mandar", item 1b) manda
  anexar até 3 pela ferramenta `message`, e dizer "a pousada ainda não
  cadastrou fotos dessa parte" quando `total: 0` — nunca "não possui imagens".
- Para ter foto do café: Admin → Mídias → álbum **Café da manhã** → Enviar.

## Testes

- `npm test`: `testes/unit/sincronizar-fotos.test.ts` (seleção de fotos,
  código, slug), `testes/unit/voz-fala.test.ts` (bloco de fala),
  `testes/unit/skill-marina.test.mjs` (a skill continua com as regras).
- `testes/e2e-fotos-sync.mjs` (42 verificações, Chromium): agendador 401/200,
  suíte nova desativada, suíte inativa avisada, 8 fotos marcadas, segunda
  rodada sem duplicar, página/galeria/home/busca sem 404, rotas de seção,
  troca de foto no Desbravador (`SIM_FOTOS_V2=1` em `testes/motor-simulado.mjs`),
  fotos do painel intactas, botão e selo no painel, Diagnóstico, chat do site
  sem o bloco de fala. Como rodar está no cabeçalho do arquivo.

## Limites conhecidos

- O espelho no Blob só foi testado **sem** o token (ambiente sem rede para
  o Desbravador). Em produção, a primeira rodada com token copia todas as
  fotos (≈10 suítes × até 6 fotos); conferir o Diagnóstico depois.
- A rodada de carona acontece **depois** da resposta ao hóspede (`after()`),
  mas usa a mesma função: numa Vercel Function de 60 s, com Blob, pode não
  concluir na primeira vez — a próxima rodada continua de onde parou (cada
  foto é inserida individualmente).
- O motor é consultado com uma data exemplo; um tipo que o motor só devolve
  em outra época do ano entra quando ela chegar.

## As regras chegam à Marina sem reinstalar a skill (04/11, parte 2)

`src/lib/marina-regras-canal.ts` (`REGRAS_CANAL_WHATSAPP`) entra no começo do
texto de `/api/agent/conhecimento` para o canal `whatsapp`. A skill instalada
na Hostinger já relê essa rota a cada conversa e a cada 15 minutos, então o
bloco de fala `[[tts:text]]`, o link da suíte escolhida e as fotos por seção
passam a valer no WhatsApp **sem** `openclaw skills install`. O chat do site
não recebe esse bloco. Reinstalar a skill e ajustar `settings/tts.json`
continuam recomendados como rede de segurança (`docs/runbook.md`).

## Ver o que aconteceu sem a chave e sem o painel (04/11, parte 3)

`GET /api/cron/sincronizar-fotos` sem chave devolve, além de agendar a rodada,
`ultimo_resumo` (com `suites[]`: por suíte, fotos no motor, no site, novas,
removidas, nota) e `ultimo_erro` (motivo da última rodada que falhou; some
quando uma conclui). O Diagnóstico mostra o mesmo. O **espelho atrasado**
copia para o Blob, 6 por rodada, as fotos que já estavam no banco apontando
para o Desbravador (`espelho_pendentes` diz quantas faltam); o orçamento é
25 s por rodada para caber na Function de 60 s.

Rodada morta no meio (tempo da Function): a marca "começou e não registrou
conclusão" fica em `fotos_sync_erro` e aparece no Diagnóstico e em
`ultimo_erro`; a rodada seguinte continua de onde parou (cada foto é
inserida sozinha). Orçamento: 40 s por rodada contados antes da consulta ao
motor (25 s de timeout), 8 s por foto copiada.
