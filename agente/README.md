# Agente Marina — habilidades

A Marina atende no WhatsApp pelo OpenClaw (Hostinger) e, quando o chat do
site entrar no ar, tambem por ele. As habilidades que ela usa vivem aqui,
**versionadas junto com o sistema** — nao soltas no servidor.

O motivo e concreto: quando a politica de pets muda, ela muda no banco, e a
habilidade que ensina a Marina a consultar o banco nao precisa mudar. Mas
quando a REGRA do atendimento muda ("nunca prometa cancelamento gratis"),
isso e codigo, e codigo revisado e versionado.

## `marimar-pousada`

Ensina a Marina a consultar os fatos oficiais pelas rotas `/api/agent/*`:
politicas, quartos, FAQ e pacotes. Complementa a `consulta-desbravador`, que
ja cuida de datas, disponibilidade e tarifas.

### Instalar no OpenClaw

O `openclaw skills install` NAO aceita subdiretorio de um repositorio remoto
(nao existe `--path`). O caminho que funciona e clonar na caixa e instalar da
pasta local. No terminal do OpenClaw (lshell), a partir da home:

```
git clone https://github.com/viniciosribeiro/marimar-site
cd marimar-site
openclaw skills install ./agente/skills/marimar-pousada
```

> O `./` NAO e enfeite. Sem ele o comando falha com
> `Invalid skill slug: agente/skills/marimar-pousada` — o OpenClaw le um
> caminho relativo com barras como se fosse um slug do ClawHub
> (`owner/repo/slug`). O `./` desfaz a ambiguidade.

### Atualizar depois de mexer na skill

> **30/09/2026 (6):** a skill ganhou "Mensagem de alguém da EQUIPE", "Quando
> não souber: pergunte à equipe" e "Quando usar algo que você APRENDEU"
> (escalonamento e aprendizado — `docs/fluxo-escalonamento.md`). Reinstale.
> O envio para a equipe usa o RPC do gateway (método `send`); confirme com
> "Testar envio" em `/admin/equipe`.

> **30/09/2026 (4):** a skill ganhou a seção "Fotos e vídeos: como mandar"
> (vídeos das suítes e roteiros de orientação, limite de 16 MB). Reinstale.

Editar o `SKILL.md` aqui e dar push **nao** muda nada na Hostinger — a caixa
roda uma copia instalada. Toda vez que a skill mudar, repita:

```
cd marimar-site
git pull
openclaw skills install ./agente/skills/marimar-pousada --force
```

Duas coisas obrigatorias nessa linha, e as duas ja custaram tempo:
- **`./`** — sem ele: `Invalid skill slug`. O OpenClaw le caminho relativo
  com barras como slug do ClawHub.
- **`--force`** — sem ele: `Skill already exists`.

> Isto ja custou caro uma vez: a regra que proibe afirmar escassez ("e a
> ultima unidade") foi escrita, commitada e empurrada — e a Marina continuou
> dizendo a frase no WhatsApp por estar rodando a copia antiga. O que vale
> para o hospede e o que esta instalado, nao o que esta no git.

### Depois de instalar, duas coisas OBRIGATORIAS

**1. A chave.** Em Ambiente, no painel da Hostinger, crie:

```
MARIMAR_API_KEY = <o mesmo valor de AGENT_API_KEY na Vercel>
```

Sem ela todas as rotas devolvem 401 e a Marina volta a improvisar.

**2. O allowlist.** As habilidades do agente estao restritas a uma lista.
Uma habilidade nova NAO entra sozinha — precisa ser adicionada:

```
openclaw config set agents.defaults.skills '["consulta-desbravador","estilo-resposta","weather","marimar-pousada"]' --strict-json
```

Conferir com `openclaw skills list`: a `marimar-pousada` tem de aparecer
como `ready`.

## Por que a lista e de permissao, e nao de bloqueio

O agente vem com 63 habilidades, varias com poder real: e-mail, API da
Hostinger (DNS, faturamento), execucao de codigo, instalacao de novas
habilidades. Com o WhatsApp aberto ao publico, qualquer pessoa alcanca o que
estiver visivel.

Lista de bloqueio precisaria ser atualizada toda vez que algo novo
aparecesse — e o `clawhub` instala coisas novas. Lista de permissao nao tem
esse problema: o que nao esta nela nao entra, hoje nem depois.


## Voz (audio no WhatsApp)

A Marina transcreve audio que chega e responde falando — so quando a mensagem
que chegou era audio. Quem escreve recebe texto.

Nao e habilidade: e config nativa do OpenClaw. Foi feito assim de proposito,
porque a versao por habilidade (`sag` + `openai-whisper-api`) quebra sempre
que a lista de permissao `agents.defaults.skills` muda — e quebrou exatamente
assim em 19/09/2026.

Config aplicada (terminal do OpenClaw):

```
openclaw config set tts.provider elevenlabs
openclaw config set tts.providers.elevenlabs.speakerVoiceId RGymW84CSmfVugnA5tvA
openclaw config set tts.providers.elevenlabs.model eleven_multilingual_v2
openclaw config set tts.providers.elevenlabs.applyTextNormalization on
openclaw config set tts.providers.elevenlabs.languageCode pt
openclaw config set tts.auto inbound
openclaw config set tools.media.audio.enabled true --strict-json
openclaw config set tools.media.models '[{"provider":"elevenlabs","model":"scribe_v2","capabilities":["audio"]}]' --strict-json
```

| Chave | Por que |
|---|---|
| `tts.auto=inbound` | Responde falando SO a quem mandou audio |
| `applyTextNormalization=on` | Sem isso ela le "26/09" como digito solto, nao como data |
| `languageCode=pt` | Sem isso numero sai com sotaque ingles no meio da frase |
| `tools.media.*` | O lado de ENTENDER o audio. Sem ele o `inbound` nunca dispara |

A chave `ELEVENLABS_API_KEY` fica na aba **Ambiente** do painel da Hostinger,
nunca na config — o OpenClaw le do ambiente sozinho.


## A skill `consulta-desbravador` (preço e vaga)

Até 30/09/2026 ela vivia só no servidor, fora deste repositório — e era a
causa do "Marina pede a idade das crianças": consultava o motor direto e
tinha a instrução de nunca informar valor de criança quando o motor manda
o aviso de faixa etária (ele manda sempre). Agora está versionada em
`agente/skills/consulta-desbravador/` e, antes de consultar o motor,
pergunta ao site como montar a consulta (`/api/agent/regras`, a mesma conta
da busca do site). Sem resposta do site, age como antes.

Instalar (terminal da Hostinger, dentro de `marimar-site`, depois do merge):

```
cp -r /data/.openclaw/workspace/skills/consulta-desbravador ~/backup-consulta-desbravador
git pull
openclaw skills install ./agente/skills/consulta-desbravador --force
openclaw skills install ./agente/skills/marimar-pousada --force
openclaw skills list
```

O `cp` guarda a versão antiga (com os scripts de diagnóstico que só existiam
lá: `probe*.mjs`, `diag*.mjs` etc.). O script usa `MARIMAR_API_KEY`, a mesma
variável da `marimar-pousada`.

## O painel de treinamento (`/admin/marina`)

A Cecilia treina a Marina pelo site, sem abrir a Hostinger. Principais abas:

| Aba | O que faz | Onde vive |
|---|---|---|
| Voz | ID, modelo, estabilidade, semelhanca, velocidade, com botao de prova | `marina_config` |
| Jeito de falar | O tom, em portugues corrido | `marina_config.tom` |
| Conhecimento | Informacoes, perguntas e respostas (com variacoes), por categoria | `marina_conhecimento` (tipos `fato`, `pergunta`) |
| Personalidade e regras | Tom, escalonamento, o que ela nunca diz, quando chamar uma pessoa | `marina_config`, `marina_conhecimento` (tipos `limite`, `escalar`) |
| Testar, Sem resposta, Historico | Area de teste com fontes, lacunas, versoes | `marina_leituras`, `marina_lacunas`, `marina_historico` |
| Conversas | Revisao das conversas do site; corrigir vira ensinamento | `chat_mensagens` |

Desde 30/09/2026 a skill manda ler `/api/agent/conhecimento` no inicio de
TODA conversa — inclusive as de preco e vaga (o caso da crianca de 29/09) —
e registrar em `POST /api/agent/lacuna` o que ela nao souber responder.
**Isso so vale no WhatsApp depois de reinstalar a skill** (comando acima).
Para conferir: em `/admin/marina`, a Visao geral mostra quando o WhatsApp
leu o treinamento pela ultima vez. Se diz "nunca", a skill instalada e a
antiga ou falta a `MARIMAR_API_KEY`.

Fluxo completo e como testar: `docs/fluxo-painel-marina.md`.

Os dois canais leem a MESMA fonte: o chat do site monta a mensagem de
sistema com `lerEnsinamentos()`, e a Marina do WhatsApp le a rota
`/api/agent/conhecimento`. Ensinar uma vez vale nos dois — e e por isso que
a skill manda consultar essa rota antes de responder.

**A voz agora vem do banco**, nao da variavel de ambiente. A
`ELEVENLABS_VOICE_ID` continua como reserva: se ninguem salvou no painel,
ela e usada. Trocar a fonte da verdade nao pode calar a Marina.

> **O que este painel NAO faz.** A Marina nao aprende sozinha com as
> conversas. Nao ha ajuste fino aqui, nao ha evolucao por osmose. O que
> parece aprendizado e a base de conhecimento crescendo porque alguem
> escreveu nela. Prometer o contrario deixaria a Cecilia esperando uma
> melhora que nunca vem — e parando de ensinar, que e a unica coisa que
> de fato melhora as respostas.
