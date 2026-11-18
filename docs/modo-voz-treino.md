# Modo voz do treinamento da Marina

> Conversar com a Marina **por voz** no painel: você fala, ela responde em
> áudio, vai puxando o que falta aprender e — quando você pede — **faz mudanças
> no painel**, sempre confirmando antes. Entregue em 17/11/2026.

## Para quem opera (como usar)

1. Entre no painel. Em qualquer tela aparece um **botão redondo de microfone**
   no canto inferior direito. Toque nele.
2. Escolha o modo no topo da janela:
   - **Viva voz** (padrão): toque em "Começar a falar" e fale normalmente; a
     Marina percebe quando você parou, responde em áudio e continua a conversa.
     É uma ligação.
   - **Apertar**: segure o botão enquanto fala e solte no fim. Bom para lugar
     barulhento.
3. Para **ensinar**: diga o que ela precisa saber ("anota que o check-in é às
   14 horas"). Ela confirma em voz ("vou guardar que o check-in é às 14 horas,
   confirma?") e só guarda depois do seu **sim**.
4. Para **ela te ajudar a preencher o que falta**: ela puxa, uma de cada vez,
   as perguntas que não soube responder (a lista "Sem resposta" do painel).
   Responda e ela guarda.
5. Para **mudar algo no painel**: peça ("muda o jeito dela falar para mais
   curto", "troca o WhatsApp para 41 99999-0000", "muda o item sobre
   check-in"). Ela **propõe** a mudança e **confirma antes**; é só dizer "sim"
   (ou tocar em **Confirmar**). Nada muda sem o seu sim.
6. Sempre dá para **escrever** em vez de falar (campo embaixo) — e é o caminho
   se a voz estiver pausada por limite de gasto.

Tudo o que ela faz passa pelas **mesmas gravações das telas do painel**, com o
seu login e registrado no Histórico — dá para voltar atrás.

## O que ela consegue fazer por voz (hoje)

Desde 18/11 (parte 7) ela age no **painel inteiro**, não só no treinamento.
Toda ação é confirmada antes ("confirma?") e é **reversível** (desligar ou
lixeira — nunca apagar de vez). A lista cresce fácil — ver "Como acrescentar
uma ação".

| Área | Ação | O que faz |
|---|---|---|
| Treino | **ensinar** | Guarda uma informação, uma pergunta-e-resposta ou um limite novo. Se veio de uma pergunta sem resposta, fecha a pendência junto. |
| Treino | **editar_conhecimento** | Muda um item que ela já sabe (texto, nome, ligar/desligar), achado por parte do nome. |
| Treino | **excluir_item / restaurar_item** | Manda para a lixeira / tira da lixeira. |
| Treino | **ajustar_personalidade** | Muda o jeito dela falar (substitui ou acrescenta). |
| Hospedagem | **regra_criancas** | Idade de colo, criança paga como adulto, cobrança de bebê. |
| Hospedagem | **adicional** | Cria um adicional (berço, café no quarto…). |
| Pousada | **dados_pousada** | WhatsApp, telefone, e-mail, endereço, horário da recepção, descrição, como chegar. |
| Site | **politicas** | Check-in, check-out, cancelamento, pets, crianças, regras gerais, formas de pagamento, estadia mínima. |
| Site | **faq / faq_editar** | Cria pergunta frequente; muda ou tira do site (reversível). |
| Restaurante | **cardapio_item** | Cria prato numa seção ou muda preço/descrição/porção/destaque. |
| Restaurante | **cardapio_disponivel** | "Acabou a moqueca hoje" / "voltou". |
| Site | **pacote** | Cria pacote (Réveillon, Carnaval…) ou muda/liga/desliga. Sem preço (vem do motor). |
| Site | **banner** | Liga/desliga ou troca os textos de um banner (a imagem só pela tela). |
| Ilha | **atracao** | Cria ou muda uma atração da Ilha do Mel. |
| Ilha | **travessia** | Preço da passagem (ida, volta, ida e volta), duração, operadora, estacionamento — a data "consultado em" muda sozinha. |
| Site | **eventos** | Tipos de evento, espaços, capacidade. |
| Site | **depoimento** | Põe no site um depoimento **real que a pessoa ditar** (a Marina é instruída a nunca inventar). |

**De propósito fora da voz** (a Marina diz onde fica, sem prometer): preço e
vaga das suítes e **ligar/desligar suíte** (vêm do Desbravador; a sincronização
desfaria na rodada seguinte); fotos, vídeos e imagem de banner (precisam de
arquivo); Clássico/Novo do site, usuários, senhas, chaves e conexões; apagar de
vez.

## Como funciona (para quem desenvolve)

O cérebro e a voz são **os mesmos da Marina de sempre** — nada de reinstalar
skill na Hostinger:

```
navegador (painel, sessão de admin)
   │  grava e detecta o silêncio (viva voz) ou segura o botão (apertar)
   ├─▶ /api/admin/marina/voz/ouvir    áudio → texto   (ElevenLabs Scribe)
   ├─▶ /api/admin/marina/voz/conversar texto → Marina  (gateway OpenClaw)
   │       monta o pedido: contexto de voz + MESMO treinamento do chat
   │       + catálogo de AÇÕES + as lacunas abertas; lê o bloco de ação
   ├─▶ /api/admin/marina/voz/falar     texto → áudio   (mesma voz do WhatsApp)
   └─▶ /api/admin/marina/voz/acao      ── só depois do "sim"
           login → mesma origem → valida de novo → grava assinado → responde
           (a conversa e o "feito" vão para a sessão DEPOIS da resposta, `after()`)
```

- **A Marina propõe a ação** devolvendo um bloco no meio da resposta:
  `[[acao]]{"nome":"ensinar","dados":{…},"fala":"… confirma?"}[[/acao]]`.
  O `fala` é o que vira áudio; o resto não é lido. O leitor é tolerante
  (`extrairAcao`, `src/lib/marina-voz-base.ts`): aceita o bloco com marcadores
  e, se faltarem, um objeto JSON solto com `nome`/`dados`.
- **A execução nunca confia no navegador:** a rota `acao` revalida a ação
  pelo registro e roda a gravação no servidor, com o autor assinado.
- **Por que rota e não Server Action (18/11, parte 7):** Server Action com
  `revalidatePath` re-renderiza no servidor a página do painel aberta ANTES de
  responder, e as Server Actions do navegador andam em fila (doc do Next 16,
  "Sequential dispatch" e "A single response carries data and UI"). Era isso
  que deixava o "Confirmar" pensando. A rota responde assim que grava (69 ms no
  teste local) e o painel chama `router.refresh()` em segundo plano.

### Não trava (regras do `VozTreino.tsx`)

- **Época:** Parar/Fechar avança um contador; tudo o que começou antes não fala
  nem mexe na tela, e nunca ficam dois ciclos de escuta juntos (antes, Parar
  com a Marina falando + Começar de novo criava dois ciclos).
- **Prazos em tudo** (`buscar()` lê o corpo dentro do prazo — o áudio que nunca
  terminava de baixar era um travamento) e **teto de reprodução** pelo tamanho
  do texto. Parar também **cala** a Marina na hora.
- **Estado sempre volta:** Confirmar/Agora não/Enviar texto rodam como
  "operação"; fora do viva voz terminam em "Pronta", dentro dele o ciclo espera
  a operação e volta a ouvir. Tocar num botão durante o viva voz descarta o que
  o microfone estava gravando (não grava a própria Marina).
- **Escuta:** o teto de 30 s conta de quando a pessoa **começa** a falar (antes
  contava do início da escuta e cortava frases); 45 s sem ninguém falar pausa o
  viva voz com aviso; o gravador recomeça a cada 8 s de silêncio (o áudio
  enviado não carrega silêncio longo).
- **"Confirma?":** `classificarResposta()` (`marina-voz-base.ts`) decide
  sim/não claros **sem ir à Marina** ("para" no meio da frase não é "não");
  correção cancela e a Marina repropõe; o que fica em dúvida vai a ela **com a
  ação pendente no contexto**, e se ela repropõe a MESMA ação (`mesmaAcao()`)
  vale como sim — fim do loop "confirma?" → "sim" → "confirma?".
- **iPhone:** um único elemento de áudio, liberado no primeiro toque.
- **Histórico:** a fala atual não vai mais duplicada (estava no histórico E
  como mensagem); a retomada junta as 3 últimas sessões.
- **A sessão** (conversa falada + o que foi feito + custo) fica em
  `marina_voz_sessao`, criada pelo **próprio site** na primeira vez
  (`garantirEsquemaVoz`, igual à 0022 — sem `db:migrate`).

### Arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/marina-voz-base.ts` | puro: leitor do bloco de ação, conta de custo (navegador e servidor) |
| `src/lib/marina-voz-acoes.ts` | o **registro**: ações do treinamento + junta as do painel (`ACOES`) |
| `src/lib/marina-voz-acoes-painel.ts` | ações do resto do painel (políticas, FAQ, cardápio, pacotes, banners, atrações, travessia, eventos, depoimentos) |
| `src/lib/marina-voz-util.ts` | limpeza (texto, dinheiro, horário, data, sim/não) e `acharUm` (busca por nome, lista fechada de tabelas) |
| `src/lib/marina-voz.ts` | pedido à Marina (contexto de voz + treino + ações + lacunas), teto de gasto, sessão |
| `src/lib/marina-gateway.ts` | falar com o gateway do OpenClaw (SSE) — compartilhado |
| `src/lib/esquema-voz-treino.ts` | cria `marina_voz_sessao` pelo site |
| `src/app/api/admin/marina/voz/{estado,ouvir,conversar,falar,acao}/route.ts` | as rotas (`acao` executa ou registra a recusa) |
| `src/app/api/admin/marina/melhorar/route.ts` | o botão "✨ Melhorar texto" |
| `src/components/admin/VozTreino.tsx` | botão flutuante + janela de voz |
| `src/components/admin/BotaoMelhorar.tsx` | o "✨ Melhorar texto" dos campos |

### Como acrescentar uma ação

Em `src/lib/marina-voz-acoes-painel.ts` (ou `marina-voz-acoes.ts`, se for do
treinamento), acrescente uma entrada com `rotulo`, `comoUsar` (a linha que vai
no catálogo para a Marina), `caminhos` (telas e páginas a marcar como
atualizadas), `validar` (confere a forma, sem tocar no banco), `descrever` (a
frase do cartão, só lê) e `executar` (grava, assinado). Grave **do mesmo jeito
que a tela correspondente** (mesmas colunas, mesma regra) e prefira desligar a
apagar. Busca por nome: `acharUm` (acrescente a tabela à lista fechada).
Marque `tecnico: true` para ações que só o perfil Administração pode. Pronto —
a Marina passa a poder propô-la, e o resto (confirmação, execução, registro) já
funciona.

## Teto de gasto (estimativa)

A voz é o único custo por fora (ElevenLabs cobra TTS por caractere e STT por
minuto; o OpenClaw é à parte). O site **estima** o gasto do mês e:

- mostra uma barrinha com o quanto já foi usado;
- **avisa** ao passar de 80% do teto;
- **pausa a voz** ao atingir 100% — e o treino **continua por texto**.

Os valores (preço por 1000 caracteres, por minuto, teto do mês e % de aviso)
ficam em `integracoes.voz_treino_config`; sem nada gravado valem os padrões
(`PRECOS_VOZ_PADRAO`: ~R$ 1,10/1000 car., ~R$ 0,04/min, teto R$ 30/mês, aviso em
80%). São **estimativa** para evitar susto na fatura, não contabilidade.
> Ainda não há tela para mudar esses valores — hoje só pelo banco. É o próximo
> passo natural (uma caixinha em Marina → Voz).

## Limites conhecidos / pendências

- **Microfone precisa de permissão** do navegador; sem ela, só texto.
- **A proposta de ação depende do modelo** (a Marina do OpenClaw precisa
  emitir o bloco). O leitor é tolerante e o pedido é bem explícito, mas num
  uso real pode precisar de ajuste fino do texto do pedido
  (`montarSistemaVoz`). Se ela não propuser a ação, o treino por texto e o
  "ensinar" pela tela seguem funcionando.
- **Conferir em iPhone e Android de verdade** (microfone, viva voz, tocar o
  áudio) — testado localmente e em e2e com simuladores, não em aparelho real.
- Sem tela para o teto de gasto (ver acima).

## Testes

- Unitário: `testes/unit/marina-voz.test.ts` (leitor do bloco de ação, custo) e
  `testes/unit/voz-confirmacao.test.ts` (39 casos de sim/não/corrige/outra,
  `mesmaAcao`).
- No banco local: `testes/unit/voz-acoes-painel.test.ts` (executa as ações do
  painel e confere o que foi gravado; limpa tudo no fim) —
  `DATABASE_URL=postgres://postgres@localhost:5433/marimar npm test`.
- Ponta a ponta: `testes/e2e-voz-treino.mjs` (25 verificações: login → estado →
  conversar com proposta de ação → falar → ouvir → sessão gravada → rota `acao`
  rápida → fim do loop → **pela tela**: Confirmar volta a "Pronta", "sim, pode
  salvar para mim" grava sem nova ida à Marina, "não" cancela), com os simuladores
  `testes/gateway-simulado.mjs` (porta 4010, emite o bloco de ação para
  "anota/ensina/guarda que …") e `testes/voz-simulada.mjs` (porta 4020, agora
  com `/v1/speech-to-text`). Receita do ambiente local no HANDOFF.

## `/melhorar` (Claude Code)

`.claude/skills/melhorar/SKILL.md` — o mesmo espírito do botão "✨ Melhorar
texto", mas para quem desenvolve: melhora um texto/prompt sem inventar fato nem
mudar o sentido.
