# Handoff — continuar de onde paramos

## ESTADO ATUAL — 11/11/2026: verificação do carrinho no Desbravador (sem mudança de código)
- **Pedido do proprietário:** os hóspedes desistem na etapa "adicionar ao carrinho" do Desbravador; ele quis saber se o site consegue adicionar sozinho, depois se dava para incorporar e redesenhar a página, e por fim gravou o caminho no navegador para eu analisar. **Resposta entregue: não, nas duas.** Leia `docs/fluxo-reserva-desbravador.md` antes de qualquer coisa sobre o link de reserva.
- **O que ficou provado (gravação do proprietário + reprodução local, 11/11):** o motor lê do endereço só datas, adultos, `child1` (cortesia), `child2`/`child3` (pagantes por faixa), `roomCode`, `rateCode` (a tarifa da pousada é `WEB`), `voucher` e campos de uso do Desbravador; o carrinho nasce no servidor deles no toque em "Adicionar"; não existe link de carrinho. O link que o site gera hoje bate com o motor em quarto, hóspedes e total (10 de 10 casos em 10–12/12).
- **Não refazer:** não tentar abrir o motor daqui (403), não automatizar o "não sou um robô", não chamar o serviço interno do motor pelo site, não propor página incorporada. O proprietário recusou, por ora, o aviso explicativo no nosso site ("toque em Adicionar e depois em Continuar"); só fazer se ele pedir.
- **Com o proprietário:** (1) enviar ao suporte do Desbravador o pedido para desligar a primeira verificação "não sou um robô" e perguntar por reserva direta sem carrinho (texto no documento); (2) subir fotos da suíte FAMILIA no Desbravador (sem nenhuma hoje); (3) dizer se aprova a correção abaixo.
- **Defeito adormecido, aguardando aprovação (NÃO implementado):** criança fora da regra "paga como adulto" sairia em `child1` e o motor esconderia todos os quartos. Hoje a regra está ligada e o link sai com a criança em `adults`. Se aprovado: em `src/lib/deeplink.ts` e no `linkFallback` de `agente/skills/consulta-desbravador/scripts/consultar-api.mjs`, manter `child1=0` e mandar as crianças em `child2` só quando houver; atualizar `testes/unit/worker.test.ts` e `testes/unit/consulta-desbravador.test.mjs`; os links de hoje não podem mudar um caractere; depois do deploy, reinstalar a skill na Hostinger e registrar como "preparado/instalado/confirmado".
- **Fotos:** a STANDARD FAMILIA está com as 4 fotos atuais do motor (pendência da parte 14 resolvida sozinha). A rodada de 11:39 UTC mostrou `suites_lista_antiga: ["FAMILIA"]` porque o motor não devolve foto nenhuma para a FAMILIA e o site mantém a de 04/11: é o comportamento desenhado.
- **Situação:** só documentação, versionada na branch `claude/sleepy-mccarthy-62jmwj` (um commit à frente da `main`); entra na `main` com a próxima publicação aprovada. Nada publicado na Vercel nem instalado na Hostinger. A gravação do proprietário não está no repositório.

## ESTADO ATUAL — 04/11/2026 (parte 14): o motor volta atrás nas fotos; o banner no topo do Novo
- **Relato do proprietário (depois de ver o Novo):** o banner do Novo não era o cadastrado no painel; e nas suítes as fotos eram antigas, "nos dois sites". Diagnóstico e correções no CHANGELOG (parte 14). Produção às 22:58 UTC estava no Clássico para visitantes (ele pode ter ligado e voltado; não há como saber daqui).
- **A regra nova (`src/lib/fotos-motor-historico.ts`, `integracoes.fotos_sync_historico`):** a lista que vale é a que o motor mostrou pela primeira vez **por último**, não a que veio por último. Lista com foto nunca vista entra; lista vista pela primeira vez antes da em vigor é ignorada (`suites_lista_antiga` no resumo + nota por suíte + aviso); lista vazia nunca apaga sozinha. O botão "Sincronizar com o Desbravador" (e `?forcar=1` com chave) aplica a lista atual do motor **sem apagar a memória**. Limite conhecido: se o motor mostrar uma lista antiga com fotos que o site **nunca** teve (a memória nasce do que o site tem no primeiro deploy), ela entra como "nova" — o botão corrige, e a lista mais recente volta sozinha quando o motor a mostrar.
- **Cópias reconferidas (`conferirCopias`):** 8 por rodada, `HEAD` no `url_origem` (Desbravador aceita o site em `gru1`; recusa este ambiente com 403), compara `content-length` com `midias.bytes`; diferente → copia de novo (URL nova no Blob). `fotos_conferidas` só conta as que o Desbravador respondeu. Não testável localmente (sem Blob); **conferir em produção** que `fotos_conferidas` > 0 na rodada seguinte ao deploy — se ficar 0, o Desbravador não responde HEAD e vale trocar por GET com `Range` ou pelo tamanho do download.
- **Topo do Novo:** `HomeNovo.tsx` segue a ordem do Clássico (banner ativo → bloco hero → foto em destaque → imagem de compartilhamento → só então a capa do álbum). O e2e `e2e-modelo-site` (seção 7) insere um banner de teste e confere os dois modelos.
- **Para conferir depois do deploy:** `curl https://www.pousadamarimarilhadomel.com.br/api/cron/sincronizar-fotos` (roda se a última tem mais de 1 h): `suites_lista_antiga` deve ser `[]` na primeira rodada (memória nasce do site), `fotos_conferidas` > 0; a STANDARD FAMILIA continua com 1 foto até o motor devolver as 4 novas (`gt_FAM_681038/220134/557259/638853.jpeg`) — quando devolver, a rodada seguinte mostra `fotos_novas: 4` e, dali em diante, a lista antiga aparece em `suites_lista_antiga` e não entra.
- **Testes a rodar em qualquer mudança nas fotos:** `npm test`, `testes/e2e-fotos-sync.mjs` (servidor com `FOTOS_CARENCIA_REMOCAO_MS=3000`, o teste sobe o próprio motor na 4011 — derrube o simulador antes), `testes/e2e-modelo-site.mjs`.
- **Situação de produção:** PR #93 (squash `c417371`), deploy de produção `Db6py1CwbcHEogefT9esRL9rUy1Z` success às 23:30 UTC. Rodada às 23:30:41 UTC: 10 suítes, 36 fotos, nada mudou, `suites_lista_antiga: []`, `fotos_conferidas: 8` (o `HEAD` funciona a partir da Vercel), `fotos_trocadas: 0`. Páginas públicas no Clássico com as fotos. A STANDARD FAMILIA segue com a foto antiga até o motor devolver as 4 novas. **Não conferido daqui:** o banner no topo do Novo em produção (prévia pelo painel).

## ESTADO ATUAL — 04/11/2026 (parte 13): fase 6 concluída (folha da Marina, chat mais leve, medições)
- **O que entrou:** ver CHANGELOG (parte 13). `src/components/site-novo/FolhaFalar.tsx` (botão único + folha; substitui `PilulaWhatsApp`, apagada), `src/components/site/ChatMarina.tsx` (no Novo sem botão próprio; avisa a folha pelo evento `marimar:marina-estado`), `src/lib/chat-textos.ts` (frases do chat sem nada de servidor).
- **Regra para não repetir o erro de peso:** componente de cliente (`"use client"`) nunca importa arquivo que use módulo do Node (`crypto`, `postgres`, `fs`…), nem indiretamente. Foi isso que fazia o navegador baixar ~100 KB comprimidos a mais em todas as páginas. Antes de importar algo de `src/lib/` num componente de cliente, confira os `import` do arquivo.
- **Eventos entre o chat e a folha:** `marimar:abrir-marina` (qualquer botão da página abre o chat; com o chat desligado ninguém escuta, por isso "Tirar dúvidas com a Marina" só aparece com o chat ligado) e `marimar:marina-estado` (`{aberto, novidade}`, do chat para a folha).
- **Medições (Lighthouse celular, local):** tabela no CHANGELOG (parte 13). Para repetir: build local + `npx lighthouse <url> --extra-headers='{"Cookie":"marimar_previa=…; marimar_ver=novo"}'` (cookie montado como em `testes/e2e-modelo-site.mjs`). Os números variam alguns pontos entre medições.
- **Pendente do proprietário (não de agente):** decidir a abertura em vídeo (suíte 82 com, 91 sem); abrir a prévia pelo painel e conferir no iPhone e no Android, e o mapa de Como chegar com 4G; apertar "Ligar o Novo para todos" quando quiser. Depois que ele ligar: trocar `preload: false` para `true` nas fontes de `LayoutNovo` e, com o Clássico aposentado, apagar o corpo das páginas do Clássico em um PR próprio (só com pedido dele).
- **Situação de produção:** PR #91 (squash `b95fdd5`), deploy de produção `EHtnzwGhq1Zb5nB29hSJxWvx5mFp` success às 21:43 UTC. No domínio público: 15 páginas 200 e no **Clássico** para visitantes; chat com 33 KB e sem o código de criptografia; Lighthouse do Clássico no ar antes → depois: início 74 → 87, suíte 76 → 81, busca 68 → 88, como chegar 72 → 81. Relatório para o proprietário: https://claude.ai/artifact/HTD9gKDZPBGiej7PDqKghN. **Não conferido daqui:** o Novo em produção (prévia pelo painel).

## ESTADO ATUAL — 04/11/2026 (parte 12): fase 6, parte 1 (títulos, dados para o Google, "não encontrada", letras)
- **O que entrou:** ver CHANGELOG (parte 12). Em resumo: `src/lib/seo.ts` (domínio, canônico, metadados da suíte e do pacote), `src/lib/site-novo/dados-estruturados.ts` + `src/components/site-novo/DadosEstruturados.tsx` (JSON-LD só no Novo), `src/components/site-novo/NaoEncontradaNovo.tsx` (despachada em `src/app/not-found.tsx`), Fraunces/Albert Sans em `src/lib/tema.ts`.
- **O que vale para os DOIS modelos (cuidado ao mexer):** o `<head>` — canônico e `og:url` no layout raiz (pelo cabeçalho `x-pathname` do middleware), o layout raiz **não** fixa mais `og:title`/`og:description` (o Next herda os de cada página), `generateMetadata` nas rotas `quartos/[slug]` e `pacotes/[slug]`, `metadata` em `/reservar`, `/contato`, `/pacotes`. O corpo do Clássico não mudou.
- **Detalhe do Next 16 que confunde:** quando a página chama `notFound()` no meio do streaming (suíte desligada, pacote inexistente), a "não encontrada" vem no pacote de dados e é desenhada no navegador; o HTML cru não traz o `class="sn "`. Status 404 e `noindex` continuam certos. O e2e confere esses casos no navegador.
- **Metadados com streaming:** para navegador, o Next manda os metadados da página depois (no corpo); para robôs que não rodam JavaScript (WhatsApp, Facebook) eles vêm no `<head>`. Para conferir a prévia do link, use `curl -A "WhatsApp/2.23.20.0"`.
- **Decisão anotada:** o Novo usa sempre Fraunces + Albert Sans; o seletor do painel vale para o Clássico e o painel. Trocar as letras do Novo pelo painel só com pedido do proprietário (viraria escolha em Site → Modelo do site).
- **Testes a rodar em qualquer mudança:** os da parte 11 + `testes/e2e-site-novo-acabamento.mjs` (precisa de uma suíte ativa com foto e, se houver, uma desligada no banco local).
- **Próximo passo (fase 6, parte 2):** "Falar com a Marina" como folha (chat + WhatsApp + telefone; só no Novo, sem mexer no chat do Clássico), desempenho (Lighthouse celular; meta ≥ 85, mostrar os números ao proprietário se a abertura em vídeo impedir) e relatório antes/depois (capturas + Lighthouse) publicado para ele.
- **Situação de produção:** PR #89 (squash `5d70f96`), deploy de produção `87veyhLrZzruQZeMTxHYDba9rEvJ` success às 21:13 UTC. Pelo domínio público às 21:13 UTC: 15 páginas 200 e no **Clássico** para visitantes (sem JSON-LD); canônico no domínio oficial em todas; título e foto da Suíte Queen na prévia do link (lida com `-A "WhatsApp/2.23.20.0"`); "não encontrada" de sempre para visitantes. **Não conferido daqui:** o Novo em produção (prévia pelo painel).

## ESTADO ATUAL — 04/11/2026 (parte 11): site novo com as 15 páginas prontas; ligar é com o proprietário
- **O que entrou:** as 9 páginas de conteúdo no Novo (`src/components/site-novo/paginas/`). `src/lib/site-novo/paginas.ts` tem as 15 com `pronta: true`. **Consequência:** em Site → Modelo do site aparece "15 de 15 páginas prontas" e, para o perfil Administração (papel `master`), o botão **"Ligar o Novo para todos"**. Visitantes continuam no Clássico até o proprietário apertar. **Nunca aperte por ele.**
- **Se ele ligar:** a troca vale na hora para todos os endereços; "Voltar para o Clássico" desfaz na hora (testado em `testes/e2e-modelo-site.mjs`). Se alguma página do Novo tiver problema, a forma rápida de tirar SÓ aquela página é pôr `pronta: false` nela — mas isso faz o site inteiro voltar ao Clássico para os visitantes (decisão de 04/11: nunca misturar os dois); avise o proprietário.
- **Fase 6 (acabamento) — o que falta:** título/descrição próprios da página de cada suíte e dados estruturados (JSON-LD de hotel) no Novo; página 404 no desenho novo (hoje a `app/not-found.tsx` de sempre); Fraunces e Albert Sans no seletor de fontes do painel; trocar `preload: false` das fontes para `true` quando o Clássico for aposentado; "Falar com a Marina" como folha com chat + WhatsApp + telefone; conferir em iPhone e Android físicos e o mapa de Como chegar com 4G; relatório antes/depois (Lighthouse e capturas).
- **Testes do Novo (rodar em qualquer mudança):** `e2e-modelo-site`, `e2e-site-novo-suites`, `e2e-site-novo-reservar`, `e2e-site-novo-galeria-restaurante`, `e2e-site-novo-conteudo` + os do Clássico (`e2e-erros-classico`, `e2e-cards-reserva`, `e2e-calendario-abertura`, `e2e-abertura`) e `npm test`. Receita do ambiente local no ESTADO ATUAL da parte 7.
- **Situação de produção:** PR #87 (squash `67b6fa1`), deploy de produção `7pkFot1KaKLf5o4fEckEnPxC8ju4` success às 20:47 UTC. Pelo domínio público às 20:48 e 20:50 UTC: as 15 páginas 200 e no **Clássico** para visitantes. **Não conferido daqui:** a tela Site → Modelo do site e a prévia em produção (painel em `admin.`). O botão "Ligar o Novo para todos" existe em produção só para o perfil Administração e **não foi apertado**.

## ESTADO ATUAL — 04/11/2026 (parte 10): site novo, fase 4 (galeria e restaurante) construída
- **O que entrou:** `/galeria` (capítulos curtos, `src/components/site-novo/galeria/`) e `/restaurante` (`src/components/site-novo/restaurante/`) no Novo, `pronta: true` (6 de 15). Visitantes continuam no Clássico.
- **Detalhes:** a galeria usa a mesma consulta do Clássico e `montarCapitulos` (unitário em `testes/unit/galeria-novo.test.ts`); o mosaico mostra no máximo 5 fotos por capítulo (`NO_MOSAICO`) — mudar esse número exige rever as classes de `celula()`. O restaurante reaproveita o `Cardapio` do Clássico; a regra `.sn .sn-cardapio .sticky` (fora da camada, com `!important`) acerta a barra de categorias abaixo do topo do Novo.
- **Situação de produção:** PR #85 (squash `27363e8`), deploy de produção `DVq5XgBk4bfTRNGNvKKQJkhKgrcT` success às 20:27 UTC. Pelo domínio público às ~20:28 UTC: `/galeria`, `/restaurante`, `/`, `/quartos` e `/reservar` 200 e no **Clássico** para visitantes. **Não conferido daqui:** a prévia em produção (painel em `admin.`).
- **Próximo passo (Fase 5):** como chegar/mapa, Ilha do Mel, a pousada, eventos, avaliações, perguntas, políticas, contato e pacotes. Aceite do plano: mapa e rota funcionando (4G de verdade), formulário de contato enviando. Os componentes do mapa (`src/components/site/rota/*`) e o envio do contato (`enviarContato`) devem ser reaproveitados como estão.

## ESTADO ATUAL — 04/11/2026 (parte 9): site novo, fase 3 (a busca) construída
- **O que entrou:** `/reservar` no Novo (`src/components/site-novo/reservar/`), `pronta: true` (4 de 15). Visitantes continuam no Clássico.
- **Para não quebrar:** a busca do Novo repete a do Clássico de propósito (consulta, regra de crianças, sincronização de carona com `after()`, `RolarParaResultados`, "Buscando suas suítes" do `FormularioBuscaDisponibilidade`). Os cartões vêm de `montarResultados` (puro, `reservar/resultados.ts`). O teste `testes/e2e-site-novo-reservar.mjs` compara com o Clássico suíte por suíte (nomes, diária, total, link) em 3 períodos — rode-o em qualquer mudança. Ele segura a sincronização de carona durante o teste (atualiza `integracoes.fotos_sync.atualizado_em` e devolve no fim).
- **"Ver a suíte"** só aparece para suíte ativa com cadastro (`paginaSuite`); sem cadastro, o cartão abre a janela de detalhes de sempre (`CardQuartoModal`) — a causa do 404 de 03/11 não volta.
- **Situação de produção:** PR #83 (squash `88c0ba1`), deploy de produção `HW8G846zEzKeGLVRd8wfebxMUHeA` success às 20:17 UTC. Pelo domínio público às ~20:18 UTC: `/reservar` e `/reservar?check_in=2026-12-09&check_out=2026-12-12&adultos=2&ver_resultados=1` 200 e no **Clássico** para visitantes; preços reais (R$ 390 a R$ 3.000) e sem erro. **Não conferido daqui:** a prévia em produção (painel em `admin.`).
- **Próximo passo (Fase 4):** galeria e restaurante/cardápio no Novo. Aceite do plano: tela cheia com teclado e deslize (o `Lightbox` já faz), cardápio vazio explicado. Depois Fase 5 (como chegar e páginas de conteúdo) e 6 (acabamento: SEO por página, JSON-LD, fontes no seletor do painel, iPhone/Android físicos).

## ESTADO ATUAL — 04/11/2026 (parte 8): site novo, fase 2 (suítes) construída
- **O que entrou:** `/quartos` e `/quartos/[slug]` no Novo (`src/components/site-novo/quartos/`), marcadas `pronta: true` em `src/lib/site-novo/paginas.ts` (3 de 15). Visitantes continuam no Clássico; só a prévia vê.
- **O ponto mais importante para não quebrar:** a página da suíte calcula o preço com a MESMA conta do `/reservar` (`calcularOcupacao` + `fetchTarifas` com `oc.adultosMotor/oc.criancasMotor`, total = `total_geral ?? total` + bebês) e monta o link com `buildDeepLink(..., quartoId)`. O teste `testes/e2e-site-novo-suites.mjs` compara diária, total e link com o cartão do `/reservar` — rode-o em qualquer mudança nessas contas. A lógica de estados está pura em `quartos/preco.ts` (unitários em `testes/unit/suite-novo.test.ts`).
- **Detalhes de comportamento:** datas no endereço (`?check_in&check_out&adultos&criancas&bebes`), formulário manda para `/quartos/<slug>#preco`; a consulta ao motor começa antes de tudo e chega por streaming (`Suspense`); a barra fixa do celular (`BarraReserva`, portal dentro de `.sn`) some quando `#preco` está na tela e avisa o botão da Marina pelo evento `sn:barra-reserva`; "Tirar dúvidas com a Marina" dispara `marimar:abrir-marina` (o `ChatMarina` só escuta no estilo Novo).
- **Margens:** use a classe `sn-margem` (16/24/40 px com área segura) em vez de `px-*` + estilo em linha — o estilo em linha anulava as classes na fase 1 (corrigido nesta entrega em topo, rodapé e home).
- **Situação de produção:** PR #81 (squash `ff0247e`), deploy de produção `AuEC4NA3cSDQiZDAhrHEvcz9NeHR` success às 20:03 UTC. Pelo domínio público às ~20:05 UTC: `/`, `/quartos`, `/quartos/suite-queen` e `/quartos/suite-queen?check_in=2026-12-09&check_out=2026-12-12&adultos=2` 200 e no **Clássico** para visitantes (sem `class="sn "`, sem título do Novo, sem barrinha); com cookie de prévia forjado, Clássico; `/reservar` 09–12/12 com preços reais e sem erro. **Não conferido daqui:** a prévia em produção (precisa do painel em `admin.`, fora da rede deste ambiente).
- **Próximo passo (Fase 3):** `/reservar` no Novo. Aceite do plano: mesmos resultados do Clássico (ids, preços, totais) para 3 períodos; manter rolagem suave, "Buscando suas suítes", janela sem 404, nunca R$ 0. Ideia natural: cartão de resultado leva para a página da suíte com as mesmas datas (`/quartos/<slug>?…`), que já mostra o mesmo preço e o mesmo Reservar.
- **Dados de teste locais:** as fotos "do motor" do banco local apontavam para endereços fictícios do simulador; foram trocadas por fotos de `public/__teste/` com `url_origem` preservada (só o banco local). Uma busca no `/reservar` local pode rodar a sincronização com o simulador e mudar as fotos: o teste conta as fotos na hora.

## ESTADO ATUAL — 04/11/2026 (parte 7): site novo aprovado; chave Clássico/Novo e a página inicial nova construídas
- **Decisões do proprietário (04/11):** proposta aprovada, mas **sem prévia separada em `/site-novo`**: uma chave no painel (Site → Modelo do site) que alterna o site inteiro entre Clássico e Novo nos mesmos endereços. A chave troca **o site inteiro de uma vez** e o Novo só pode ir para todos com as **15 páginas prontas**; até lá **só quem entra no painel vê o Novo** (prévia neste aparelho, com barrinha para comparar). Fraunces + Albert Sans e o céu por hora entram (céu desligável). Os 4 erros do Clássico foram corrigidos e conferidos em produção (PR #78, parte 6).
- **Nunca ligue "o Novo para todos" você mesmo.** É decisão do Vinicios, depois da Fase 6. O botão só aparece com 15/15 e só para o perfil Administração.
- **Leia `docs/plano-site-novo.md` §6 antes de mexer:** peças, quem vê o quê, a receita de cada fase (componente em `src/components/site-novo/<área>/`, **uma linha** de despacho no topo da página do Clássico, `pronta: true` em `src/lib/site-novo/paginas.ts` só depois do aceite). O corpo das páginas do Clássico não muda.
- **Feito nesta entrega (Fase 1):** tela Site → Modelo do site; prévia assinada (link de 15 min → cookie de 30 dias; `AUTH_SECRET`; falha fechada); barrinha "Ver o Clássico / Ver o Novo / Sair da prévia"; `LayoutNovo`, `TopoNovo`, `RodapeNovo`, `BuscaNovo`, botão único "Falar com a Marina" que sai da frente da busca no celular; a página inicial nova (`home/HomeNovo.tsx`) com a linha da travessia. Migration 0023 (`pousada.modelo_site jsonb`), aplicada também pelo próprio site no primeiro salvamento da tela.
- **Evidência local:** `npm test` 148/148; `testes/e2e-modelo-site.mjs` 44/44; Clássico intacto (`e2e-erros-classico` 21/21, `e2e-cards-reserva` 4/4, `e2e-calendario-abertura` 4/4, `e2e-abertura` tudo certo); `tsc` limpo em export; build limpo; Lighthouse celular local da home nova 78–82/100/100/100 (Clássico 67/94/100/100).
- **Situação de produção:** PR #79 (squash `316ad82`), deploy de produção `4Vvgbjkdpyic94vVE4Gwe3XjfZfE` success às 19:29 UTC. Pelo domínio público às ~19:31 UTC: a home dos visitantes continua no **Clássico** (nenhum `class="sn "`, nenhum "Chegue pelo mar", nenhuma barrinha, fontes do Clássico carregando); com cookie de prévia forjado, continua Clássico; `/api/modelo-site/previa?t=<inválido>` → 403 com a página "Este link de prévia venceu"; POST em `/api/modelo-site/ver` sem cookie → 303 para a página pedida, sem cookie novo; `/admin/modelo-site` pelo `www.` → 307 para `admin.`; `/reservar` 09–12/12, 2 adultos, com preços reais (R$ 390 a R$ 3.000) e sem erro; `/quartos`, `/a-pousada`, `/politicas`, `/pacotes`, `/galeria` 200. **Não conferido daqui:** a tela do painel e a prévia em produção (o host `admin.` não é liberado na rede deste ambiente, e a prévia precisa da `AUTH_SECRET` de produção) — é o primeiro passo do proprietário.
- **Como o proprietário vê o Novo:** painel → Site → Modelo do site → "Ver o site novo neste aparelho" (no computador) ou o QR (no celular). O link vence em 15 min; recarregar a tela gera outro. Este ambiente **não** alcança o painel de produção nem tem a `AUTH_SECRET` de produção, então o Claude não consegue abrir a prévia em produção sozinho; localmente, o script `testes/e2e-modelo-site.mjs` mostra como montar o cookie com a `AUTH_SECRET` local.
- **Próximo passo (Fase 2):** `/quartos` e `/quartos/[slug]` no Novo (lista com foto inteira e "a partir de"; página da suíte com galeria, calendário com preço real das datas e Reservar com `roomCode`), aceite no plano §7. Depois Fase 3 (`/reservar`, preservando rolagem suave, "Buscando suas suítes", janela sem 404, nunca R$ 0), 4, 5, 6. Em cada PR: `npm test`, export + `tsc`, build, `e2e-modelo-site` e os e2e do Clássico, capturas do celular e do computador.
- **Ainda não feito (anotado para as fases):** "Falar com a Marina" como folha com chat + WhatsApp + telefone (hoje abre o chat; WhatsApp/telefone no menu e rodapé); Fraunces/Albert Sans no seletor de fontes do painel; trocar `preload: false` das fontes para `true` quando o Clássico for aposentado.
- **Ambiente local (receita):** Postgres 16 na porta 5433 (`su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/marimar-teste -o '-p 5433 -k /var/lib/postgresql' -l /var/lib/postgresql/pg-teste.log start"`), `node testes/motor-simulado.mjs` (4011), `OPENCLAW_GATEWAY_TOKEN=token-teste node testes/gateway-simulado.mjs` (4010), `npm run build && npm start` com `WORKER_BASE_URL=http://localhost:4011 WORKER_SLUG=marimar OPENCLAW_GATEWAY_URL=http://localhost:4010 OPENCLAW_GATEWAY_TOKEN=token-teste` e `DATABASE_URL`/`AUTH_SECRET` locais; Playwright: `ln -sfn "$(npm root -g)/playwright" node_modules/playwright`. Fotos reais de teste ficam fora do git (`public/__teste/`, via `.git/info/exclude`); num ambiente novo o hero do Novo cai na imagem que existir.

## ESTADO ATUAL — 04/11/2026 (parte 5): proposta do site novo publicada; aguardando aprovação do proprietário
- **Leia `docs/plano-site-novo.md` antes de qualquer coisa sobre o site novo.** É o plano completo (achados, direção de design, tokens, módulo a módulo, mecanismo da prévia `/site-novo`, fases com critérios de aceite, lista de proteção do que não muda).
- **O que existe:** a proposta publicada para o Vinicios (https://claude.ai/artifact/TpNqehNji4siweqz5U6Avc), as skills de design em `.claude/skills/` (frontend-design da Anthropic e web-design-guidelines da Vercel), o script `testes/auditoria-site.mjs` (capturas por página/estado para antes-e-depois) e este registro. **Não existe código do site novo**: nenhuma pasta `(site-novo)` foi criada e o site no ar não mudou.
- **O que o proprietário precisa responder (perguntado no chat e na proposta):** aprovar / ajustar / reprovar; se o "céu que muda com a hora" entra; se mantém Fraunces + Albert Sans; se quer os 4 bugs visíveis do site atual corrigidos já (lista no plano §3 — só com pedido explícito, em PR separado, sem mudar comportamento aprovado).
- **Se ele aprovar:** seguir o plano a partir da Fase 1 (base + home em `/site-novo`), uma fase por PR, com `npm test`, `tsc` em export limpo, build, `testes/auditoria-site.mjs` apontado para `http://localhost:3000/site-novo` (receita do ambiente local no HANDOFF de 04/11) e capturas antes/depois no PR. Depois do merge, conferir o deploy de produção e mandar o link `www.pousadamarimarilhadomel.com.br/site-novo` para ele ver no celular. Nunca editar `src/components/site/**` nem `src/app/(site)/**` durante as fases: o site atual fica intocado até a promoção (plano §6).
- **Se ele reprovar:** não há nada a apagar além de registrar a decisão aqui e no CHANGELOG (o plano fica como histórico).
- **Fatos de produção úteis (04/11):** Lighthouse celular home 54 / `/reservar` 77; o motor devolveu por alguns minutos (~17:55 UTC) as 10 suítes "sem tarifa publicada" e às 18:20 UTC voltou a devolver as 10 com tarifa; os hosts do Blob (`*.public.blob.vercel-storage.com`) e das fontes/tiles **não** estão liberados na rede deste ambiente (as capturas mostraram a logo e o mapa sem carregar por isso; não é defeito do site).

## ESTADO ATUAL — 04/11/2026 (parte 4): áudio só da frase curta (pelo site) e suítes pelo motor
- **CONFIRMADO PELO PROPRIETÁRIO (04/11, ~18:00 UTC): "Perfeito. Funcionou perfeitamente."** Áudio curto sem link e link da suíte escolhida funcionando no WhatsApp real. Não reverter `tts.auto: "tagged"` nem as suítes pelo motor.
- **Publicado:** PR #74 (`9816e79`) e PR #75 (`93c416e`, carência antes de apagar fotos), deploys de produção success (último `22Wrpcs9efN2fqv6hN8bqaqgPVXG`, ~17:45 UTC). Próxima rodada devida às 18:35 UTC (busca em /reservar ou chamada sem chave); já com a carência.
- **Pedido do proprietário (depois da reinstalação das skills):** a Marina continuava lendo o link no áudio; e as 3 suítes "desativadas" não são decisão da pousada — o que o Desbravador vende tem que aparecer sozinho.
- **Áudio:** o site aplica `tts.auto: "tagged"` no OpenClaw via RPC (`src/lib/openclaw-audio.ts`), de carona em qualquer chamada a `/api/cron/sincronizar-fotos`; resultado em `audio_whatsapp` na resposta e no Diagnóstico. Só o bloco `[[tts:text]]` vira áudio; sem bloco, só texto. **Efeito colateral conhecido:** o canal WhatsApp reinicia por alguns segundos ao mudar `tts`. Para voltar ao modo anterior: Marina → Voz não tem botão; é `config.patch {tts:{auto:"inbound"}}` ou `openclaw config set tts.auto inbound` na Hostinger, e apagar `integracoes.openclaw_audio_curto` (senão o site reaplica `tagged` em até 6 h).
- **Aplicado em produção às 17:13 UTC:** a primeira chamada a `/api/cron/sincronizar-fotos` depois do deploy (`B8Bn7YSstz27ZvakdQw486QHz5ff`, success) devolveu `audio_whatsapp: {modo: "tagged", aplicado_em: 17:13:41Z, erro: null}` — o site leu a config do OpenClaw, gravou `tts.auto: "tagged"` e releu confirmando. Um minuto depois, `/api/saude/status` mostrava WhatsApp e gateway `online` (o canal reinicia e volta). **Não confirmado pelo proprietário:** um áudio real depois disso.
- **Suítes:** a sincronização liga o que o motor devolve e desliga o que ele não devolve (com 3+ tipos na resposta). O campo Ativo do painel não manda mais. Depois da primeira rodada após o deploy, STANDARD TRIPLO, SUITE REDE e STANDARD QUADRUPLO passam a ter página e fotos para a Marina.
- **Rodada de 17:35 UTC:** as 3 suítes ligadas e no ar (páginas 200, Marina com foto, `/quartos` com 10). **Alerta:** o motor devolveu a STANDARD FAMILIA ora com 4 fotos novas (16:05–16:33), ora só com a antiga (17:35, 3 leituras); a sincronização chegou a apagar as 4 novas. Correção publicada em seguida: carência de 30 min antes de apagar foto que some do motor (`fotos_sync_ausentes`). Se o motor continuar piscando, o site mostra a união e o Diagnóstico diz "N foto(s) sumiram do motor; saem se continuarem ausentes". Vale perguntar à Cecília se ela está mexendo nas fotos da STANDARD FAMILIA no Desbravador.
- **Como conferir:** `curl …/api/cron/sincronizar-fotos` → `audio_whatsapp.modo === "tagged"`, `ultimo_resumo.suites_ativadas`; `/quartos/suite-rede` → 200. Teste real: áudio no WhatsApp pedindo a Suíte Queen → texto com link, áudio curto sem o link (ou sem áudio se a Marina esquecer o bloco).
- **Continua da pousada:** fotos do café da manhã e da praia no painel.

## ESTADO ATUAL — 04/11/2026 (parte 3): fotos do Desbravador conferidas em produção; o que resta é da pousada
- **Fotos das suítes:** sincronização conferida em produção às 16:33 UTC pela rodada síncrona (`GET /api/cron/sincronizar-fotos` sem chave, 200): as 10 suítes do motor têm no site exatamente as fotos do motor, inclusive a STANDARD FAMILIA (1 antiga → 4 novas) e as 3 desativadas. 8 fotos já copiadas para o Blob; 31 ainda apontam para o Desbravador e o espelho atrasado copia 6 por rodada (rodada: busca em `/reservar` ou chamada sem chave, 1×/hora; cron da Vercel 12:00 UTC). PRs #69, #70, #71, #72 (resumo por suíte, erro registrado, orçamento de tempo, rodada síncrona, bytes conferidos antes do espelho), todos publicados na Vercel (último deploy `7UcdhLVtbjxBC2aqYP6jsAcxaswE`, success). **Observação corrigida:** entre 16:00 e 16:25 UTC eu achei que as rodadas morriam; era a regra de 1 hora. A rodada das 15:31 viu a STANDARD FAMILIA com a foto antiga porque o motor ainda devolvia assim naquele momento.
- **Como ver sem chave e sem painel:** `curl https://www.pousadamarimarilhadomel.com.br/api/cron/sincronizar-fotos` → `ultimo_resumo.suites[]` (motor × site por suíte) e `ultimo_erro`. No painel: Admin → Diagnóstico → Agendadores → "Fotos por suíte na última rodada".
- **O que só a pousada decide/faz:** (1) ativar STANDARD TRIPLO, SUITE REDE e STANDARD QUADRUPLO em Hospedagem → Quartos (o motor vende as três; o site e a Marina não as mostram enquanto desativadas; as fotos já estão no banco); (2) subir fotos do **café da manhã** e da **praia** em Admin → Mídias (hoje 404 em `/api/midia-secao/cafe/0` e `/praia/0`; restaurante e pousada têm foto); (3) testar no WhatsApp de testes o áudio curto, o link da suíte e a foto do café depois da reinstalação das skills (~16:00 UTC).
- **Skills na Hostinger:** reinstaladas pelo proprietário às ~16:00 UTC (checkout `0c72d59`). `settings/tts.json` (rede de segurança do áudio) não aplicado; alternativa pelo site (`tts.auto: "tagged"`) só com pedido.
- **Nada pendente de código** para os 10 pontos de 04/11 além do que depende de confirmação no WhatsApp real.


## ESTADO ATUAL — 04/11/2026 (parte 2): tudo automático; o que resta é observar
- **Publicado:** PR #65 (squash `5d0bb7d7`), deploy de produção `3375HnWJZXR7Q1yr3GYLcPMTeBgN` success em 04/11. Daqui para a frente o site faz tudo sozinho; falta só **observar** (abaixo).
- **Verificado em produção às 15:31 UTC (rede do ambiente liberada pelo proprietário):** `GET /api/cron/sincronizar-fotos` sem chave devolveu 202 e, segundos depois, `ultima_em` preenchido — a migration 0022 foi aplicada pelo site e a primeira sincronização rodou; `/galeria` e `/quartos/suite-queen` já servem fotos do Desbravador vindas do banco; `/reservar` (09–12/12, 2 adultos) 200 com 10 suítes e nenhum link para suíte desativada; `/api/agent/fotos`, `/indice` e `/conhecimento` sem chave → 401. **Não verificado daqui** (exige a chave da Marina ou um WhatsApp real): o resumo com o espelho no Blob e o áudio curto.
- **Pedido do proprietário:** "não quero fazer nada manual". Ele não achou a pasta do projeto no computador nem a tela de variáveis na Vercel. Resposta: tirar a necessidade de cada passo manual (ver CHANGELOG, parte 2).
- **O que acontece sozinho depois do deploy:** (1) na primeira busca em `/reservar`, ou às 12:00 UTC pelo agendador da Vercel, o site aplica a migration 0022 se faltar e sincroniza as fotos das suítes com o Desbravador (com espelho no Blob se `BLOB_READ_WRITE_TOKEN` existir); (2) a Marina do WhatsApp, ao reler `/api/agent/conhecimento` (a cada conversa e a cada 15 min, como a skill instalada já manda), passa a seguir as regras novas: bloco `[[tts:text]]` curto, link da suíte escolhida, fotos do café por `/api/agent/fotos?secao=cafe`.
- **Limites deste ambiente:** sem rede para `api.vercel.com`, `www.pousadamarimarilhadomel.com.br`, `marimar-site.vercel.app`, `reservas.desbravador.com.br` e Hostinger. Ter pago a Vercel não dá acesso ao Claude; o que dá é liberar esses hosts em **Network access** do ambiente (menu do ambiente na barra de título da sessão → Edit → Limited → Allowed domains). Sem isso, a verificação em produção é do proprietário.
- **Como verificar (observação, não tarefa):** Admin → Diagnóstico → Agendadores deve mostrar "Colunas das fotos: aplicadas" e "Fotos das suítes sincronizadas…" com data depois de uma busca; Admin → Mídias deve ter fotos com "Do Desbravador"; um áudio no WhatsApp de testes pedindo a Suíte Queen para 10–12/11 deve voltar com texto + link `roomCode=QUEEN` e áudio curto sem o endereço; "manda foto do café da manhã" deve voltar com anexos ou com a frase de que ainda não há fotos cadastradas.
- **Instalado na Hostinger em 04/11/2026 (~16:00 UTC), pelo proprietário, no terminal do OpenClaw 2026.9.4:** `git pull --ff-only` levou o checkout `~/marimar-site` de `a682f21` para `0c72d59` (main de hoje); `openclaw skills install ./agente/skills/consulta-desbravador --force` e `./agente/skills/marimar-pousada --force` responderam "Installed … from path -> /data/.openclaw/workspace/skills/…". Só avisos antigos e não relacionados (device-pair desligado; gateway em loopback). A partir daqui a Marina do WhatsApp tem a skill com o bloco de fala, a regra do link da suíte escolhida (script fail-closed) e as fotos por seção. **Ainda não confirmado pelo proprietário:** áudio curto e link da suíte num WhatsApp real depois da instalação; `settings/tts.json` (rede de segurança) não foi aplicado.
- **Antes da instalação (16:00 UTC) o proprietário testou no WhatsApp e a Marina ainda leu o link inteiro no áudio e mandou o link geral**: era a skill de 26/10 (link completo no texto final, link geral no script) e ela ainda não tinha relido as regras do site. Repetir o teste agora, com a skill nova.
- **Pendente opcional (Hostinger):** `settings/tts.json` com `maxLength: 240` (runbook, "Fala curta no WhatsApp QR"), rede de segurança para o caso de a Marina esquecer o bloco. Alternativa pelo site, só com pedido do proprietário: `tts.auto: "tagged"` via `config.patch` (fala só o bloco; resposta sem bloco fica sem áudio).
- **Se algo quebrar:** Vercel → Deployments → Promote no deployment anterior. A sincronização nunca apaga foto do painel.

## ESTADO ATUAL — 04/11/2026: fotos sincronizadas com o Desbravador, fotos do café, bloco de fala, agendadores
- **O que foi feito (código, testado localmente, PR [#63](https://github.com/viniciosribeiro/marimar-site/pull/63) da branch `claude/sleepy-mccarthy-62jmwj`):** ver entrada de 04/11 no CHANGELOG e `docs/fluxo-fotos-desbravador.md`. Em uma frase: as fotos das suítes passam a vir do Desbravador sozinhas (botão, carona 1×/hora, Vercel 1×/dia), com espelho no Blob e remoção do que sumiu lá; a Marina tem rota de fotos por seção; a skill exige bloco de fala curto; o Diagnóstico mostra os agendadores.
- **Publicado na Vercel:** PR #63 mesclado (squash `21615bf2`) e deploy de produção `Fqh5fqi5H3AjPMvjAA6E1FHMqqfv` com **success** em 04/11 14:58 UTC. O código está no ar; **a migration 0022, a `CRON_SECRET`, as skills e o `tts.json` não** — ver passo a passo abaixo. Nenhum teste em produção foi feito daqui (sem rede).
- **Evidência local:** `npm test` 136/136; `testes/e2e-fotos-sync.mjs` 42/42; `testes/e2e-cards-reserva.mjs` 4/4; `tsc`/`build` limpos. **Nada disso prova produção**: o ambiente não alcança Vercel, Desbravador nem Hostinger.
- **Diferenciar:** *versionado no GitHub* (tudo acima) ≠ *publicado na Vercel* (após merge: conferir deploy READY) ≠ *instalado na Hostinger* (skills e `tts.json`: só com os comandos abaixo) ≠ *confirmado pelo proprietário* (WhatsApp real, celulares).

### Passo a passo manual (ordem recomendada) — **SUPERADO na parte 2 do mesmo dia**: os itens 1, 2, 6 e 7 deixaram de ser necessários (migration pelo site, agendador sem chave, regras lidas do site); 3, 4, 5 e 8 viraram observação/opcional. Mantido para histórico.
1. **Migration 0022** (adiciona 2 colunas em `midias`, não apaga nada): na pasta do projeto, com `.env.local` apontando para produção, `npm run db:migrate`. Sem ela o botão "Sincronizar com o Desbravador" falha com erro de coluna `origem`.
2. **Vercel → Settings → Environment Variables:** criar `CRON_SECRET` (Production) com 16+ caracteres aleatórios (ex.: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`); conferir que `BLOB_READ_WRITE_TOKEN` existe (ele já é usado pela biblioteca de mídias). Depois **Redeploy**. Sem `CRON_SECRET`, a rodada diária é recusada (o botão e a carona funcionam mesmo assim).
3. **Primeira sincronização:** Admin → Mídias → **Sincronizar com o Desbravador**. Ler a mensagem: quantas fotos entraram, se foram copiadas para o Blob, quais suítes estão desativadas. Conferir em Admin → Diagnóstico → Agendadores. Depois abrir `/quartos/suite-queen` (e outras) e `/galeria`.
4. **Suítes desativadas:** Hospedagem → Quartos → as que o aviso listou → Editar → **Ativo**, se a pousada quer vendê-las pelo site (as fotos já estarão lá). Não é obrigatório.
5. **Fotos do café da manhã e do restaurante:** Admin → Mídias → álbum **Café da manhã** (e **Restaurante**) → Enviar fotos; deixar "A Marina pode enviar" ligado. Sem isso a Marina diz, corretamente, que a pousada ainda não cadastrou fotos dessa parte.
6. **Hostinger (terminal do OpenClaw), reinstalar as skills:**
   ```
   cd ~/marimar-site && git pull --ff-only
   openclaw skills install ./agente/skills/consulta-desbravador --force
   openclaw skills install ./agente/skills/marimar-pousada --force
   ```
7. **Hostinger, fala curta:** seguir `docs/runbook.md` → "Fala curta no WhatsApp QR (tts.json)": grava `maxLength: 240` e `summarize: true` em `settings/tts.json` do OpenClaw e reinicia o gateway. Antes, `cat /data/.openclaw/settings/tts.json` (pode não existir — é normal) e anotar no CHANGELOG o que havia.
8. **Teste real no WhatsApp de testes (sem fechar reserva):** (a) áudio perguntando "tem vaga 10 a 12 de novembro para 2 adultos, Suíte Queen?" → espera-se texto com preço e link `roomCode=QUEEN` + **áudio de uma ou duas frases sem o endereço**; (b) "manda foto do café da manhã" → anexos (ou a frase de que ainda não há fotos cadastradas); (c) "fotos da Suíte Queen" → anexos iguais aos do Desbravador. Registrar o resultado (inclusive falhas) no CHANGELOG.
9. **Se algo quebrar em produção:** Vercel → Deployments → *Promote* o deployment anterior; a sincronização não apaga foto do painel, e as fotos do Desbravador voltam na próxima rodada.

### O que NÃO mudou (não "corrigir" de novo)
Preços/consulta ao motor, botão Reservar com `roomCode` (confirmado no iPhone em 28/10), rolagem suave e "Buscando suas suítes", voz curta aprovada em 26/10, memória do OpenClaw, API oficial da Meta, abertura em vídeo.

### Se o próximo agente for continuar
- Rodar `npm test` e, com banco local + `testes/motor-simulado.mjs` + `testes/gateway-simulado.mjs`, `testes/e2e-fotos-sync.mjs` (cabeçalho do arquivo explica).
- Melhorias possíveis, só com pedido: ativar automaticamente suíte que o motor devolve (hoje é decisão da pousada); limitar o espelho por rodada se a Function de 60 s estourar com Blob; mostrar no cartão da suíte do painel que ela existe no motor.

## ESTADO ATUAL — 03/11/2026: PR #61 integrado e disponível nos domínios oficiais
- **Correção do 404 dos cards de busca:** PR #61, SHA de merge `faa3f39756e59839f2955c626b4af9c68142ee0b`, deployment Vercel produção `dpl_BSeERqnhDCnpKKzaUwq5cKeUTGYn` READY. No `src/app/(site)/reservar/page.tsx` foto, título e Detalhes agora são botões que abrem o modal já existente, removendo a navegação antiga para quartos locais inativos.
- **Provas de produção:** 09–12/12/2026 (9 suítes), 10–12/11/2026 (6), 20–23/12/2026 (5), 10–13/01/2027 (6), sempre 2 adultos; todas retornaram suítes sem mensagem de erro e sem links herdados para `/quartos/[slug]` na extração; logs de erro/fatal da nova implantação vazios na janela inspecionada. Build Next.js/TypeScript da Preview aprovado e checagem estática de 12 contratos OK.
- **Não confirmado:** E2E com clique e toque na janela (Chrome/Safari iPhone, Android, desktop) e abertura/fechamento da galeria em dispositivo. Script somente leitura `testes/e2e-cards-reserva.mjs` disponível. Preview sem banco Postgres (conexão recusada 127.0.0.1:5432), NÃO transportar segredos ou banco de produção para Preview.
- **Preservação:** botão Reservar mantém `roomCode`, datas, ocupação; link WhatsApp externo mantém destino; motor Desbravador, API da Marina, dados de mídias, sincronizador e Hostinger OpenClaw não foram alterados. Confirmação do usuário ainda pendente.
- **Se houver regressão em produção:** rollback Vercel para deployment anterior `dpl_G4eoSDB57qx4Rc4vkEHrrxE5pW4y` e reavaliar os eventos. A instalação de skills do OpenClaw PR #60 continua pendente, independente deste incidente.


## ESTADO ATUAL — 03/11/2026: correção 404 nos cards da disponibilidade (PR #61)
- **Incidente:** busca exibia quartos reais de diferentes datas; tocar em foto, nome ou Detalhes de alguns cards desviava para `/quartos/[slug]` que podia retornar 404 se o cadastro local estivesse inativo. O link interno concorria com `CardQuartoModal` lançado no PR #59. Isto é navegação de interface, não a busca de tarifas/estoque.
- **Patch:** `src/app/(site)/reservar/page.tsx` troca 3 `<Link>` internos do card por 3 `<button type="button">`, permitindo ao modal abrir sem redirecionamento. Nenhuma alteração em APIs, filtros do banco, sincronização de fotos, metadados, serviços da Marina, WhatsApp, Hostinger ou geração de deeplink/roomCode. O botão Reservar e o link externo WhatsApp permanecem ancoras normais.
- **Regressão:** `testes/unit/card-reserva.test.mjs` e `testes/e2e-cards-reserva.mjs` (read-only, Nov/Dez, desktop/celular; não clicam Reservar/WhatsApp). Conferência estática de 12 contratos OK e compilação Vercel Preview READY. **E2E de interação ainda não executado**, pois a Preview recebe `ECONNREFUSED 127.0.0.1:5432`; não usar banco de produção no ambiente Preview sem aprovação explícita. Produção atual responde com 9 suítes em 09–12/12/2026 (2 adultos).
- **Próximo passo obrigatório:** confirmar merge PR #61 e deploy da Vercel; executar teste de clique de foto/título/Detalhes em /reservar em diversos períodos, desktop e iPhone/Android reais, sem efetivar reserva, confirmar roomCode e datas dos links, fotos e descrição. Se falha no site oficial, rollback para deploy anterior `dpl_G4eoSDB57qx4Rc4vkEHrrxE5pW4y` e investigar. Registrar observações e aprovação do proprietário.
- **Nota:** a configuração do OpenClaw/Hostinger do PR #60 exige instalação própria das skills; o PR #61 não mexe nesse canal.


## ESTADO ATUAL — 02/11/2026 (Marina WhatsApp: link de suíte e TTS)
- **Relato novo do proprietário:** no WhatsApp o link da suíte indicada voltou a abrir lista geral, e o áudio volta a soletrar links, gastando ElevenLabs. Não invalida o teste do botão Reservar do SITE no iPhone (28/10).
- **Código alterado:** `agente/skills/consulta-desbravador/scripts/consultar-api.mjs` aceita argumento 6 `codigo_ou_nome_da_suite` depois dos 5 argumentos usuais (entrada, saída, adultos, crianças, bebês). Quando informado, `quarto_selecionado`, `quartos` filtrados e `link_reserva` de topo apontam para o `roomCode` correto. Sem escolha, consulta padrão idêntica. Código inexistente/esgotado/ambíguo retorna erro, nunca link genérico. `agente/skills/consulta-desbravador/SKILL.md` e `agente/skills/marimar-pousada/SKILL.md` deixam a regra explícita.
- **TTS QR:** `tts.auto=inbound` do OpenClaw pode narrar a resposta final inteira, mesmo que a skill peça para não ler URL. Agora a skill manda link por ferramenta `message` (texto separado, sem áudio) e deixa resposta final curta sem URL. Provedor e voz não alterados. Necessária validação de entrega com `bestEffort:false` e de um áudio real.
- **Teste:** adicionado em `testes/unit/consulta-desbravador.test.mjs` (código, nome, erro seguro); execução em produção e no OpenClaw/Hostinger PENDENTE. Não afirmar que está corrigido no canal até instalar/retestar.
- **Aplicação:** após merge, no terminal da Hostinger, `cd ~/marimar-site && git pull --ff-only && openclaw skills install ./agente/skills/consulta-desbravador --force && openclaw skills install ./agente/skills/marimar-pousada --force`. Testar com uma escolha de QUEEN (código confirmado antes no iPhone) e depois HIDRO; abrir o link após eventual anti-robô e conferir URL `roomCode`, datas, hóspedes; áudio não pode ler endereço. Não mexer em banco, tarifas nem TTS por configuração sem teste.
- **Privacidade:** apenas sessão do remetente; não registrar chaves, números ou conversas reais.


> **Atualização operacional: 27/10/2026 — leia esta seção PRIMEIRO.**
> O histórico abaixo, datado de **30/09/2026**, é mantido para auditoria,
> **não** é a lista atual de pendências. Algumas tarefas antigas já foram
> realizadas; verifique o estado real antes de executá-las novamente.

## ESTADO ATUAL — 30/10/2026 (abertura em vídeo)

- **O que é:** o vídeo do pôr do sol com a logo e um brilho passando (5 s, enviado pelo Vinicios) virou a abertura do site, no lugar da logo animada. **Decisões do proprietário:** o vídeo inteiro (5 s, não 3,5 s) e manter a escolha no painel para voltar à logo antiga.
- **Arquivos:** `public/abertura/por-do-sol.mp4` (H.264, 446 KB, o que todo celular toca), `por-do-sol.webm` (VP9, 425 KB, reserva para navegador sem H.264) e `por-do-sol.jpg` (capa, 47 KB). `src/components/site/Abertura.tsx` (estilo "video" | "logo"), CSS em `src/app/globals.css` (`.abertura--video`), `src/lib/tema.ts` (`movimento.aberturaEstilo`, padrão "video"; tema sem o campo passa a mostrar o vídeo), `src/components/admin/ThemeEditor.tsx` (Identidade visual → Forma → **Estilo da abertura**), `src/app/(site)/layout.tsx`.
- **Responsivo:** tela mais larga que 4:3 → o vídeo cobre a tela (corta só céu e mar). Mais estreita (celular em pé, tablet) → vídeo a 140% da largura, centralizado, bordas esfumadas sobre a capa desfocada esticada (céu em cima, mar embaixo). A logo fica entre 19–78% da largura e 43–67% da altura do vídeo; os cortes nunca chegam nela. `max-width: none` é necessário (o Tailwind limita todo `<video>` a 100%).
- **Mantido:** uma vez por visita (sessionStorage), some sozinha aos ~5,5 s só com CSS, `pointer-events: none` (correção do iPhone de 27/10), escondida para "reduzir movimento". O vídeo só recebe endereço (e só é baixado) quando a abertura vai aparecer: não na segunda página da visita, não com menos movimento, não com economia de dados. Se o celular bloquear vídeo automático (iPhone em economia de bateria), fica a capa parada. Sem som.
- **Testes:** `npm test` 118/118 (4 novos em `testes/unit/abertura.test.ts`). `testes/e2e-abertura.mjs` 17/17 em Chromium (Playwright): computador, monitor 21:9, tablet, iPhone 13 em pé e deitado, iPhone SE — logo inteira na tela e sem rolagem lateral; vídeo toca sem som; some sozinha; não volta nem baixa na segunda página; menos movimento; "Escolher data" abre o calendário com a abertura na frente; painel com a escolha. `tsc` limpo; nenhum erro novo de lint.
- **Não testado:** Safari e Chrome num iPhone físico, Android físico (o ambiente não tem WebKit). Para trocar o vídeo no futuro, usar **nome de arquivo novo** (a Vercel guarda os arquivos de `public/` em cache).
- **Situação:** implementado, testado localmente e publicado na Vercel com o merge (ver CHANGELOG); **pendente a confirmação do proprietário num celular de verdade.** Não envolve Hostinger nem skills. Não mexer na abertura sem pedido: o proprietário escolheu o vídeo inteiro.

## ESTADO ATUAL — 28/10/2026 (confirmado pelo proprietário)

Teste do Vinicios em produção, em 28/10, depois da revisão do Claude sobre as entregas de 24–27/10 (`main` em `641a253`, `tsc` limpo, `npm test` 114/114):
- **Preço no WhatsApp:** a Marina respondeu com preço real a "10 a 12 de novembro, 2 adultos". Não foi preciso reinstalar skill na Hostinger nesta data.
- **Fotos no WhatsApp:** pedidas à Marina, chegaram como imagem (anexo), não como link.
- **Calendário no iPhone:** "Escolher data" abriu o calendário (falha de primeiro toque de 27/10 não reapareceu no teste do proprietário).
- **Reservar abre a suíte escolhida:** no site, pelo iPhone, o botão Reservar abriu o Desbravador já na suíte do card.
- **Não coberto por este teste:** o link por suíte enviado pela Marina no WhatsApp (mudança de 27/10 na skill; instalação na Hostinger não confirmada), a busca semântica da memória (crédito da API OpenAI esgotado) e o calendário num Android.

Próximo agente: tratar esses quatro itens como **confirmados**; não refazer nem "corrigir" o que funciona. As pendências reais seguem na seção de 27/10 abaixo (link por suíte no WhatsApp, memória, Android).

## ESTADO ATUAL — 27/10/2026 (ChatGPT → Claude e outros agentes)

### 27/10 — Reserva direcionada à suíte escolhida (Issue #52)
- **Solicitação:** ao clicar em Reservar no card de uma suíte, o hóspede caía no Desbravador com todas as acomodações. Os links antigos tinham apenas datas/hóspedes, não `roomCode`. **Confirmação humana:** proprietário validou em iPhone após anti-robô um link experimental `roomCode=QUEEN&rateCode=` e disse que funcionou. Automação foi bloqueada com 403 pelo WAF; não comprova falha para clientes.
- **Mudanças:** `src/lib/deeplink.ts` aceita `quartoId` (opcional); `/reservar`, `/quartos/[slug]`, `/api/disponibilidade` e `/api/agent/disponibilidade` passam código do tipo (`r.id`/`desbravador_room_id`). Sem tipo, link genérico inalterado. Script de consulta da Marina fornece `quartos[].link_reserva` para que opção escolhida mantenha o mesmo tipo. Se há várias opções, link global é genérico. Skills orientam envio do link por suíte e **não narrar URL no áudio**.
- **Validar:** conferir PR, CI, Vercel produção READY; em navegador real conferir QUEEN e HIDRO depois do anti-robô, datas e hóspedes corretos, sem fazer compra. `npm test` cobre links e script com várias opções. Não confundir criação dos testes com execução.
- **Hostinger separada:** merge Vercel NÃO instala skills. Executar `git pull` no checkout correto e depois `openclaw skills install ./agente/skills/consulta-desbravador --force` e `openclaw skills install ./agente/skills/marimar-pousada --force` em ambiente autorizado; testar WhatsApp real e confirmar instalação antes de dizer que foi publicado no canal. Não alterar TTS, tarifas, pagamentos, datas ou regras de hóspedes.


**Preferência explícita do proprietário:** toda mudança, correção, descoberta,
teste, decisão, impedimento e validação humana deve permanecer registrada no
repositório para qualquer agente posterior recuperar **sem depender do histórico
do chat**. Seguir o protocolo em `AGENTS.md` / `CLAUDE.md`; manter este
handoff atualizado em cada entrega. Não confundir **commit/deploy** com
**instalação na Hostinger**, nem **teste técnico** com confirmação de cliente.

### Ambiente e limites

- Código oficial: `viniciosribeiro/marimar-site`, branch `main`.
- Produção: `https://www.pousadamarimarilhadomel.com.br` na Vercel,
  projeto `marimar-site`; funções de disponibilidade em `gru1`.
- Agente Marina: OpenClaw **2026.9.4** na Hostinger; atende via WhatsApp QR
  e pelo gateway integrado ao site. Skill local:
  `/data/.openclaw/workspace/skills/marimar-pousada`.
- Ajustes da **skill** exigem `git pull` e reinstalação no **CLI da
  Hostinger**. Deploy da Vercel não atualiza skill já instalada.
- Nunca modificar preços, regras de reservas, dados, autenticação, canais
  WhatsApp ou configurações de TTS sem necessidade explícita, teste e backup.
  Não registrar neste repositório senha, token, telefone de hóspede, segredo
  de API, transcrições pessoais ou dados de pagamento.

### ALERTA de prioridade — primeiro toque no calendário do iPhone (27/10) — **resolvido para o proprietário em 28/10** (abriu no iPhone dele; ver ESTADO ATUAL 28/10)
O proprietário confirmou falha **real** ao abrir o calendário pelo botão `Escolher data` no Google Chrome de um iPhone. É intermitente, muitas vezes obriga atualizar; **a correção PR #49 era apenas para o caso de o diálogo fechar na troca dos campos e não deve ser dada como solução desta falha.** No Android dele funciona; automação Chromium desktop não reproduziu. Dois pontos de risco no código motivaram uma segunda correção: (1) `.abertura` com z-index 200 sobre todo o site e sem `pointer-events: none`, possivelmente invisível mas interceptando toque após animação WebKit; (2) ausência de fallback `MediaQueryList.addListener` em `useCelular` para navegadores WebKit antigos. Mitigações implementadas no branch `fix/ios-toque-calendario-overlay-20261027`. O script `testes/e2e-calendario-ios.mjs` exercita 4 recarregamentos por rota em WebKit e Chromium móveis/desktop, mas não substitui teste em iPhone físico. **Validar deploy de produção e solicitar reteste específico de fechar/reabrir a aba no iPhone**; não declarar êxito antes da confirmação. Nenhuma alteração na Marina, preços ou consulta de reservas.

### Entregas recentes e evidências

- **27/10 — RESULTADO DA CORREÇÃO DO CALENDÁRIO:** PR #49 mesclado na `main` (`f0cffe9`); deploy Vercel de produção `dpl_8zaq37MN5gyk7Fc2254xjxmUqZNZ` reportou READY. Teste de navegador no endereço público `/reservar` em desktop passou: abriu calendário, selecionou 28/10 a 02/11, confirmou 5 noites e exibiu datas corretas (sem buscar nem reservar). Evidência: `https://agent.tinyfish.ai/runs/55f446f0-4dc9-4b25-b717-7d733c9074bd`. **Mobile físico e execução automática do E2E em CI ainda não foram comprovados.**
- **27/10 — BUG calendário do site (mobile e desktop):** `SeletorDatas.tsx` fechava o modal se o usuário clicasse em check-in ou check-out enquanto estava aberto, em vez de trocar o foco. Corrigido para chamar `abrir(qual)` sempre; a mesma UI aparece na Home e em `/reservar`. O arquivo `testes/e2e-calendario-abertura.mjs` cobre troca de campo, datas e fechamento em ambas as telas e aparelhos. **Distinguir código implementado, teste efetivamente executado, CI, Vercel publicada e aprovação humana.** Nenhuma alteração de motor de reserva, link de reserva, preços ou skill OpenClaw.



| Área | Entregue e verificado | Limites / pendência |
|---|---|---|
| **Tarifas Marina** | OpenClaw passou a consultar o proxy autenticado `/api/agent/disponibilidade` via Vercel/GRU1, evitando Worker diretamente da Hostinger (HTTP 502). PR #37; consulta pública ao motor validada com preços reais. **Confirmado pelo proprietário em 28/10:** preço real numa conversa de WhatsApp. Nunca inventar valor. |
| **Fotos da Marina** | Rota `/api/midia-quarto/[slug]/[indice]`, URLs `url_whatsapp` e instrução de anexar mídia pelo `message`; PRs #38/#40. **Confirmado pelo proprietário em 28/10:** fotos chegaram como anexo no WhatsApp. |
| **/reservas privada** | Painel protegido para Cecília, sessão segura, mapa visual, navegação e logout (PR #42). | **Não há fonte autenticada das reservas confirmadas do PMS/ROL Desbravador.** Calendário desconhecido ≠ livre; não inventar hóspedes/dados. |
| **Busca pública /reservar** | Loading com mensagem **“Buscando suas suítes”**, transição GET confiável, rolagem automática suave às suítes e mensagem com quantidade disponível (PRs #43/#44). | **Preservar rigorosamente** carregamento, mensagem, movimento, consulta e preços quando editar UI. |
| **Cards das suítes** | Interface moderna e compacta; **2 colunas no celular**, 3/4 em telas maiores (PR #45). Testado em viewport móvel com 6 suítes reais, valores, links e sem overflow. | Ajustes visuais somente na apresentação dos cards, sem mudar busca, motor, datas e animação. |
| **/saude** | Painel de saúde com Marina visual/interativa e sondas apenas de leitura; arquivos e limites descritos em `docs/saude-marina.md`. | Não tratar como agente autônoma de reparos; evitar ações automáticas sem aprovação. |
| **Contexto/memória Marina** | PR #46: skill preserva referência do quarto entre foto/áudio/pergunta, oculta diagnóstico interno. Proprietário executou script na Hostinger: backup privado, patch validado, sessão isolada por hóspede, `sources:[memory,sessions]`, `visibility:self`; instalação concluída. | **Busca semântica NÃO funciona plenamente**: `openclaw memory status --deep --agent main` mostrou 1/96 arquivos, 0 chunks, 0/93 sessões, provedor `text-embedding-3-small` respondeu **429 / credit_balance_exhausted**. NÃO alegar memória completa, NÃO rodar indexação até resolver créditos/provedor. `dreaming` off é opcional. |
| **Economia de áudio** | PR #47, commit `a682f21`: URL fica no texto, sem ser enviada ao TTS da Vercel/Meta; limitador de fala antes do provedor; skill orienta voz curta no OpenClaw QR. **Proprietário executou `git pull` + reinstalou skill na Hostinger e confirmou por mensagem: “ficou perfeito”**, após teste do WhatsApp. | **Considerar solução de não narrar links aprovada e funcional para o proprietário. NÃO reverter.** Manter mesmo estilo/voz e evitar gerar áudios longos lendo URL. |

### Logs e diagnósticos preservados em nível seguro (sem dados pessoais)

- OpenClaw CLI: `OpenClaw 2026.9.4 (3a9d69d)`.
- Correção de memória: `config.patch` aceito; `openclaw config validate`
  válido; backup na Hostinger sob `/data/.openclaw/backups-marina/`;
  isolamento `session.dmScope=per-channel-peer` e visibilidade
  `tools.sessions.visibility=self` confirmados no terminal.
- A indexação automática apresentou **aviso**, não sucesso; exame profundo
  encontrou cota esgotada na **API OpenAI** para embeddings. A assinatura do
  ChatGPT não cobre os créditos dessa API. Vector/FTS SQLite disponíveis.
  Não apagar SQLite, WAL, arquivos de sessão ou backups.
- Depois da correção de TTS, OpenClaw recebeu o commit `a682f21` e confirmou
  “Installed marimar-pousada from path -> /data/.openclaw/workspace/skills/marimar-pousada”.
  Dois avisos não relacionados: device-pair não habilitado e Gateway
  `loopback`; não abrir `gateway.bind=lan` sem plano de segurança.
- O teste de áudio curto no WhatsApp foi **aprovado pelo proprietário**
  nesta conversa. Não há benchmark de economia de caracteres/créditos
  medido na ElevenLabs; não inventar percentual.

### Prioridades para a próxima sessão

1. **Preservar o que funciona.** Começar pelo `git status`,
   últimos commits, este handoff e changelog. Antes de qualquer edição
   comparar efeitos nas rotas de reserva, no WhatsApp e no áudio.
2. **Memória OpenClaw:** se houver solicitação, resolver a falta de créditos
   do provedor de embeddings (ou avaliar opção local compatível), depois
   indexar e validar a pesquisa sem misturar hóspedes. Configuração da sessão
   já foi aplicada e **não deve ser resetada desnecessariamente**.
3. **Fotos no WhatsApp:** só classificar como funcionamento confirmado após
   ver anexos reais no canal; checar `message(media=...)`.
4. **Reservas confirmadas:** exigir fonte oficial read-only do PMS Desbravador
   e permissão explícita antes de mostrar dados de hóspedes em `/reservas`.
5. **Voz/link:** após modificações futuras, testar que a Marina ainda envia
   URL clicável no texto, fala **somente o essencial** e não soletra link.
   Exemplo: “Enviei o link de reserva, é só tocar nele”.

### Protocolo obrigatório de continuidade entre agentes

Para **cada** tarefa concluída, atualizar, no mesmo conjunto de commits:
`docs/CHANGELOG.md` (o que mudou e por quê), `docs/ESTADO-DO-PROJETO.md`
(status REAL e pendências), **este documento** (resumo para a próxima
sessão), e documentação técnica específica se mudou comportamento.
Registrar data, caminhos, commits/PRs, teste e evidência, o que não foi
testado, procedimento de instalação separado quando houver, e pendências.
Os arquivos `AGENTS.md` e `CLAUDE.md` orientam a leitura.
Se um agente não tiver autorização/acesso ao servidor, dizer
**“preparado no GitHub; pendente instalar na Hostinger”**, jamais declarar
implantado por suposição.

---


> Atualizado em 30/09/2026, ao fim da sessão que reestruturou o treinamento da
> Marina e redesenhou o painel. Cole a seção **PROMPT** em qualquer ferramenta
> agêntica para retomar.

---

## PROMPT

Você vai continuar o site da Pousada Marimar (Ilha do Mel/PR): Next.js 16 +
Postgres (Neon) + Vercel, com a agente Marina no OpenClaw (WhatsApp e chat do
site). Repositório: `viniciosribeiro/marimar-site`. Pasta local do Vinicios:
`D:\Dev\Marimar Site` (a pasta `D:\Dev\marimar-site`, com hífen, era um
rascunho antigo sem ligação com o GitHub e foi apagada em 29/09).

### 1. Leia antes de mexer

1. `AGENTS.md` (o Next.js 16 tem mudanças; leia `node_modules/next/dist/docs/`)
2. `docs/ESTADO-DO-PROJETO.md` — visão geral e pendências
3. `docs/CHANGELOG.md` — a entrada de 30/09 explica o que mudou e por quê
4. `docs/fluxo-painel-marina.md` — antes de tocar em Marina, `/api/agent/*` ou `/api/chat`
5. `docs/design-system-admin.md` — antes de criar ou mudar tela do painel
5b. `docs/fluxo-midia.md` — antes de mexer em fotos, vídeos, upload ou roteiros
5c. `docs/fluxo-escalonamento.md` — antes de mexer em chamados, equipe, aprendizado ou Cérebro
5d. `docs/fluxo-rota.md` — antes de mexer no mapa/rota de Como chegar (MapLibre 6, worker copiado no prebuild)
6. `git log --oneline -15` e `git status`

### 2. O que ficou pendente do dia 30/09 (fazer primeiro)

Nada disso pôde ser feito do ambiente em que o trabalho foi feito (rede sem
acesso à produção e sem credenciais):

1. **Migrations até a 0019** em produção: `npm run db:migrate` (só acrescentam
   colunas e tabelas; o código antigo continua funcionando sobre elas).
2. **Reinstalar a skill no OpenClaw** (Hostinger), senão o WhatsApp segue com
   a skill antiga, que não lê o treinamento em pergunta de preço:
   ```
   cd marimar-site && git pull
   openclaw skills install ./agente/skills/marimar-pousada --force
   ```
3. **Teste real:** em `/admin/marina` → Visão geral, confirmar que o WhatsApp
   "leu agora há pouco". Ensinar um item de teste, perguntar na aba **Testar**
   e por um número de WhatsApp que nunca falou com a Marina; conferir que a
   resposta usa o item e que preço e vaga continuam vindo do motor. Apagar o
   item de teste depois (Excluir → Lixeira → Apagar de vez).

4. **Mídia em aparelho real** (a nuvem não tem H.264): iPhone e Android —
   foto HEIC, vídeo pela câmera, selo "WhatsApp ok" na biblioteca; um roteiro
   em Marina → Mídias de orientação e "como chego?" no WhatsApp.

5. **Escalonamento no OpenClaw real:** migration 0020; liberar a ferramenta
   `message` no OpenClaw (`tools.alsoAllow`, ver `docs/runbook.md`, "Liberar a
   ferramenta de mensagens" — o perfil padrão `coding` não a inclui e o
   `/tools/invoke` dá 404); reinstalar a skill; "Testar envio" deve mostrar
   "✓ O WhatsApp confirmou a entrega (mensagem <id>)". Depois simular:
   pergunta desconhecida → aviso chega à equipe → resposta → cliente recebe →
   Marina pergunta "posso guardar?" → SIM/NÃO/versão nova. Agendador de 5
   min para `/api/cron/chamados`. O código do OpenClaw pode ser lido sem
   rede de produção: `npm pack openclaw` e procurar em `package/dist`
   (`message-action-runner-*.js`, `tools-invoke-shared-*.js`).

6. **Rota com os serviços reais:** abrir `/como-chegar` num celular com 4G
   (OpenFreeMap, OSRM e Photon só foram testados com `testes/mapa-simulado.mjs`).
   Conferir no console que `/vendor/maplibre/maplibre-gl-worker.mjs` carrega
   (sem ele o mapa fica em branco). Em `/admin/rota`, acertar trapiche e
   terminais e marcar "Conferi os pontos".

### 3. Como testar localmente (sem tocar produção)

```bash
# Postgres local (qualquer um). Banco NOVO: a 0014 falha se aplicada na mesma
# transação que a 0002 (enum). Aplique em duas etapas:
#   1) copie drizzle/ para uma pasta temporária, deixe só as 3 primeiras
#      entradas em meta/_journal.json e rode o migrator nela;
#   2) rode npm run db:migrate normalmente.
npm run db:seed
ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=<12+ caracteres> npm run db:seed:admin

OPENCLAW_GATEWAY_TOKEN=token-teste node testes/gateway-simulado.mjs   # porta 4010
OPENCLAW_GATEWAY_URL=http://localhost:4010 OPENCLAW_GATEWAY_TOKEN=token-teste \
  AGENT_API_KEY=chave-local-teste AUTH_SECRET=... AUTH_URL=http://localhost:3000 \
  AUTH_TRUST_HOST=true DATABASE_URL=... npm run dev

npm test                                  # unitários
EMAIL=... SENHA=... node testes/e2e-marina.mjs   # 12 verificações pela interface
DATABASE_URL=<LOCAL> AGENT_API_KEY=... npm run test:e2e:escalonamento   # 38 verificações (apaga equipe/chamados)
LARGURAS=375,768,1024,1280,1440 SAIDA=capturas node testes/capturas.mjs   # telas + rolagem horizontal
node testes/mapa-simulado.mjs &           # porta 4020; aponte a rota do banco para ele (docs/fluxo-rota.md)
SAIDA=capturas node testes/e2e-rota.mjs   # computador, iPhone com GPS, Android, painel Rota e mapa
```
`testes/*.mjs` usam Playwright (não está no package.json; no ambiente em nuvem
ele vem instalado globalmente — ligue com `ln -s $(npm root -g)/playwright node_modules/`).

### 4. Próximos passos sugeridos (em ordem)

1. **Redesenhar o miolo das telas grandes** que só receberam cores e cabeçalho:
   cardápio, banners, cartões, blocos da home, identidade visual (a de
   fotos já foi refeita como biblioteca de mídia).
   Usar `Cartao`, `Lista`, `JanelaRota`, `useAcao` (ver design system).
2. **Conversas do WhatsApp no painel** — hoje só as do site aparecem. Ver o que
   o gateway do OpenClaw expõe.
3. **Segurança pendente** — limite de tentativas de login por IP e limite de
   envios no formulário de contato (`docs/CHANGELOG-IA.md`, seção 5).
4. **Fonte única para crianças** — a regra existe em Políticas
   (`politicas.criancas_texto`) e pode existir no treinamento. O treinamento
   tem prioridade, mas o ideal é a tela de Políticas avisar quando há item de
   treinamento sobre o mesmo assunto.
5. **Criar/redefinir usuário pelo painel** — hoje só por script.
6. Corrigir a 0014 para banco novo (sem alterar a de produção: nova migration
   idempotente ou documentar o baseline).

### Regras que não mudam

- Nunca commitar segredos; nunca reintroduzir Cloudflare/wrangler; o site não
  fecha reserva; falhe fechado quando faltar env var.
- Toda Server Action do admin começa com `await exigirSessao()`.
- Ao terminar: entrada no topo do `docs/CHANGELOG.md`, pendências e data em
  `docs/ESTADO-DO-PROJETO.md`, commit.
