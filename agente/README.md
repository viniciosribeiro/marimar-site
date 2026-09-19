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
openclaw skills install agente/skills/marimar-pousada
```

### Atualizar depois de mexer na skill

Editar o `SKILL.md` aqui e dar push **nao** muda nada na Hostinger — a caixa
roda uma copia instalada. Toda vez que a skill mudar, repita:

```
cd marimar-site
git pull
openclaw skills install agente/skills/marimar-pousada --force
```

O `--force` e obrigatorio: sem ele o comando para com "Skill already exists".

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
