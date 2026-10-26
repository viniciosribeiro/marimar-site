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

**Desde 21/10/2026 a voz se escolhe no painel (Marina → Voz)**, que grava
isto sozinho no OpenClaw e confere: ver `docs/voz-marina.md`. Até 21/10 este
guia mandava `speakerVoiceId` e `model` — nomes que o OpenClaw não lê; o
WhatsApp falava com a voz padrão do OpenClaw, não com a do painel.

Config (terminal do OpenClaw), se precisar fazer à mão:

```
openclaw config set tts.provider elevenlabs
openclaw config set tts.providers.elevenlabs.voiceId RGymW84CSmfVugnA5tvA
openclaw config set tts.providers.elevenlabs.modelId eleven_multilingual_v2
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

A chave `ELEVENLABS_API_KEY` ficava na aba **Ambiente** do painel da
Hostinger. Desde 21/10, ao salvar a voz, o painel grava a chave da conta do
site em `tts.providers.<provedor>.apiKey` (decisão do Vinicios): ela vale por
cima do ambiente, e o WhatsApp usa a mesma conta do site.


## Correção de 26/10/2026 — Fotos como anexos no WhatsApp

O OpenClaw da Hostinger recebia HTTP 403 ao baixar as imagens diretamente
do Desbravador, embora o site exibisse fotos na galeria com cache da Vercel.
Agora `GET /api/agent/quartos` informa `fotos[].url_whatsapp`, um caminho
de bytes de imagem do próprio site: `/api/midia-quarto/<slug>/<indice>`.
A rota pública só permite fotos de quartos ativos, visíveis para a Marina,
registradas no banco, origens aprovadas e MIME JPEG/PNG/WebP, até 10 MB.
Executa na Vercel/gru1 e tem fallback no otimizador/cache da própria Marimar.

A skill `marimar-pousada` exige enviar a foto como mídia com
`message(action=send, channel=whatsapp, media=url_whatsapp)`, nunca
abrir o Browser/Desbravador nem colar links diretos do motor. Em erro,
avisa e oferece o endereço oficial da suíte.

**Instalação real na Hostinger (depois do merge PR #38):**

```bash
cd ~/marimar-site
git pull --ff-only
openclaw skills install ./agente/skills/marimar-pousada --force
openclaw skills list
```

A skill precisa estar `ready`. Peça pelo WhatsApp de teste "Mande 2 fotos
da Suíte Família", confirme que chegaram como **imagens anexadas**, e não
somente como links. Se houver falha, abra os detalhes do uso da ferramenta
`Message` para ver o erro de download/entrega. **A Vercel não consegue
instalar essa cópia da skill automaticamente na Hostinger.**

## A skill `consulta-desbravador` (preço e vaga)

**Correção de 26/10/2026:** o Worker Desbravador passou a retornar HTTP 502
quando consultado diretamente de fora da região correta. O site já foi
corrigido para executar na Vercel em São Paulo (`gru1`). Por isso a skill
`consulta-desbravador` agora chama **somente** a rota autenticada
`/api/agent/disponibilidade` no site da Marimar, que calcula ocupação, consulta
o Worker em `gru1` e devolve valores e disponibilidade reais. A Hostinger
não deve mais chamar `pousadahub.*.workers.dev/tarifas` diretamente.

A skill depende de `MARIMAR_API_KEY` no ambiente do OpenClaw (igual à
`AGENT_API_KEY` da Vercel). A ausência ou uma chave errada retorna erro claro
sem preço inventado. `MARIMAR_SITE_URL` é opcional: o padrão agora é
`https://www.pousadamarimarilhadomel.com.br`.

O script mantém o JSON esperado pela Marina, mas não afirma quantas unidades
restam, fotos ou estadia mínima: esses campos não vêm na rota autenticada.
Testes de regressão: `node --test testes/unit/consulta-desbravador.test.mjs`.

**Atenção:** publicar no GitHub não atualiza a cópia instalada na Hostinger.
Depois do merge, um operador autorizado precisa executar os comandos abaixo
no servidor da Marina e fazer uma consulta real pelo WhatsApp.

Instalar (terminal da Hostinger, dentro de `marimar-site`, depois do merge):

```
cp -r /data/.openclaw/workspace/skills/consulta-desbravador ~/backup-consulta-desbravador-20261026
# No clone do repositorio marimar-site na Hostinger:
git pull --ff-only
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
| Voz | Provedor (ElevenLabs, OpenAI, Google), voz da lista com ▶, jeito de falar; leva ao WhatsApp e confere | `marina_config` + `integracoes` (`voz_marina`, `chave_voz:*`) |
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
ela e usada. Trocar a fonte da verdade nao pode calar a Marina. O WhatsApp
recebe a mesma voz quando o painel salva (`docs/voz-marina.md`).

> **O que este painel NAO faz.** A Marina nao aprende sozinha com as
> conversas. Nao ha ajuste fino aqui, nao ha evolucao por osmose. O que
> parece aprendizado e a base de conhecimento crescendo porque alguem
> escreveu nela. Prometer o contrario deixaria a Cecilia esperando uma
> melhora que nunca vem — e parando de ensinar, que e a unica coisa que
> de fato melhora as respostas.
