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

Começa por quatro ações seguras e reversíveis (a lista cresce fácil — ver
"Como acrescentar uma ação"):

| Ação | O que faz |
|---|---|
| **ensinar** | Guarda uma informação, uma pergunta-e-resposta ou um limite novo. Se veio de uma pergunta sem resposta, fecha a pendência junto. |
| **editar_conhecimento** | Muda um item que ela já sabe (texto, nome, ligar/desligar), achado por parte do nome. |
| **ajustar_personalidade** | Muda o jeito dela falar (tom/estilo), substituindo ou acrescentando. |
| **dados_pousada** | Muda WhatsApp, telefone ou e-mail da pousada. |

**De propósito fora da voz:** preço e disponibilidade (são do motor, nunca de
cadastro) e **ativar/desativar suíte** (desde 04/11 a sincronização com o
Desbravador é que liga/desliga suíte; um comando de voz seria desfeito na
rodada seguinte).

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
   └─▶ executarAcaoVoz (Server Action) ── só depois do "sim"
           exigirSessao() → valida de novo → grava assinado → Histórico
```

- **A Marina propõe a ação** devolvendo um bloco no meio da resposta:
  `[[acao]]{"nome":"ensinar","dados":{…},"fala":"… confirma?"}[[/acao]]`.
  O `fala` é o que vira áudio; o resto não é lido. O leitor é tolerante
  (`extrairAcao`, `src/lib/marina-voz-base.ts`): aceita o bloco com marcadores
  e, se faltarem, um objeto JSON solto com `nome`/`dados`.
- **A execução nunca confia no navegador:** `executarAcaoVoz`
  (`src/app/(admin)/admin/marina/voz-acoes.ts`) revalida a ação pelo registro
  e roda a gravação no servidor, com o autor assinado.
- **A sessão** (conversa falada + o que foi feito + custo) fica em
  `marina_voz_sessao`, criada pelo **próprio site** na primeira vez
  (`garantirEsquemaVoz`, igual à 0022 — sem `db:migrate`).

### Arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/marina-voz-base.ts` | puro: leitor do bloco de ação, conta de custo (navegador e servidor) |
| `src/lib/marina-voz-acoes.ts` | o **registro** de ações (validar/descrever/executar) |
| `src/lib/marina-voz.ts` | pedido à Marina (contexto de voz + treino + ações + lacunas), teto de gasto, sessão |
| `src/lib/marina-gateway.ts` | falar com o gateway do OpenClaw (SSE) — compartilhado |
| `src/lib/esquema-voz-treino.ts` | cria `marina_voz_sessao` pelo site |
| `src/app/api/admin/marina/voz/{estado,ouvir,conversar,falar}/route.ts` | as rotas |
| `src/app/api/admin/marina/melhorar/route.ts` | o botão "✨ Melhorar texto" |
| `src/app/(admin)/admin/marina/voz-acoes.ts` | `executarAcaoVoz` (Server Action) |
| `src/components/admin/VozTreino.tsx` | botão flutuante + janela de voz |
| `src/components/admin/BotaoMelhorar.tsx` | o "✨ Melhorar texto" dos campos |

### Como acrescentar uma ação

Em `src/lib/marina-voz-acoes.ts`, acrescente uma entrada em `ACOES` com
`rotulo`, `comoUsar` (a linha que vai no catálogo para a Marina), `validar`
(confere a forma, sem tocar no banco), `descrever` (a frase do cartão, só lê) e
`executar` (grava, assinado). Reaproveite a gravação da tela correspondente.
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

- Unitário: `testes/unit/marina-voz.test.ts` (leitor do bloco de ação, custo).
- Ponta a ponta: `testes/e2e-voz-treino.mjs` (login → estado → conversar com
  proposta de ação → falar → ouvir → sessão gravada), com os simuladores
  `testes/gateway-simulado.mjs` (porta 4010, emite o bloco de ação para
  "anota/ensina/guarda que …") e `testes/voz-simulada.mjs` (porta 4020, agora
  com `/v1/speech-to-text`). Receita do ambiente local no HANDOFF.

## `/melhorar` (Claude Code)

`.claude/skills/melhorar/SKILL.md` — o mesmo espírito do botão "✨ Melhorar
texto", mas para quem desenvolve: melhora um texto/prompt sem inventar fato nem
mudar o sentido.
