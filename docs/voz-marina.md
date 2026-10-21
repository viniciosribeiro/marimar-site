# Voz da Marina

> Desde 21/10/2026. Pedido do Vinicios: "a voz do WhatsApp não condiz com o
> ID configurado no painel" e "mais fácil de configurar e trocar, com OpenAI e
> Google além da ElevenLabs".

Uma voz só, escolhida em **Marina → Voz**, vale nos três lugares onde a Marina
fala: o chat do site, o WhatsApp Web (OpenClaw) e a API oficial da Meta.

## Por que o WhatsApp falava com outra voz

Três defeitos somados, todos do lado do site ou do guia de instalação:

1. **Nomes de campo errados.** O guia `agente/README.md` (e o painel, desde
   28/09) gravava `tts.providers.elevenlabs.speakerVoiceId` e `.model`. O
   OpenClaw 2026.9.4 lê `voiceId` e `modelId` (`speakerVoiceId` é do modo de
   conversa em tempo real, outra coisa). Ele aceita nomes desconhecidos sem
   reclamar e, sem `voiceId`, fala com a voz padrão dele
   (`pMsXgVXv3BLzUgSXRplE`).
2. **Método recusado.** O painel chamava `config.set` com `{ path, value }`;
   na 2026.9.4 o `config.set` só aceita a config inteira (`{ raw, baseHash }`).
   Toda gravação do painel era recusada; a tela avisava "o WhatsApp não
   aceitou", mas o site já tinha a voz nova.
3. **O modelo podia trocar a voz.** De fábrica, `tts.modelOverrides` deixa a
   IA mudar provedor e voz no meio da resposta.

Também podem passar por cima da voz geral: `agents.list[].tts`,
`channels.whatsapp.tts`, `channels.whatsapp.accounts.<id>.tts` e uma persona
ativa (`tts.persona`). O painel lê todas.

## Como funciona agora

- **Salvar** grava a voz para o site e leva a MESMA voz ao OpenClaw:
  `config.get` (lê a config e o `hash`) → `config.patch` (merge patch) com
  `tts.provider`, `tts.providers.<provedor>.*` nos nomes certos e
  `tts.modelOverrides` travado → `config.get` de novo para **conferir**. Se a
  voz estiver redefinida numa camada (agente, canal, conta, persona), essa
  camada recebe a mesma voz. Se a config mudou entre a leitura e a escrita,
  lê de novo e tenta mais uma vez.
- O cartão **"A voz da Marina agora"** mostra, lendo o servidor, se o WhatsApp
  está com a mesma voz do site, e o que difere (com **Levar ao WhatsApp de
  novo**).
- Mudar `tts` faz o OpenClaw **reiniciar os canais**: o WhatsApp reconecta
  sozinho em alguns segundos (o vigia da blindagem acompanha).
- O site gera o áudio com **os mesmos parâmetros** que o OpenClaw usa
  (`src/lib/voz.ts` × `camposDoProvedor` em `src/lib/voz-base.ts`):

| Provedor | Campos no OpenClaw | O que o site manda |
|---|---|---|
| ElevenLabs | `voiceId`, `modelId`, `languageCode: pt`, `applyTextNormalization: on`, `voiceSettings {stability, similarityBoost, style: 0, useSpeakerBoost: true, speed}` | o mesmo em `/v1/text-to-speech/<voz>` |
| OpenAI | `voice`, `model`, `instructions` (só gpt-4o-mini-tts), `speed` (só tts-1/tts-1-hd) | o mesmo em `/v1/audio/speech` |
| Google (Gemini) | `voiceName`, `model`, `audioProfile` (o jeito de falar) | `generateContent` com o jeito de falar antes da fala; PCM → WAV |

As vozes e modelos oferecidos são as listas que o OpenClaw 2026.9.4 aceita
(voz fora da lista deixaria o WhatsApp mudo).

## Contas (chaves): conectar pelo painel

Cada provedor precisa de uma chave de API. Dois jeitos, nesta ordem:

1. **Na Vercel** (`ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` ou
   `GOOGLE_API_KEY`) — continua valendo.
2. **Pelo painel**: Marina → Voz → escolher o provedor → **Abrir a página da
   chave** → criar a chave → colar → **Testar e conectar**. A chave é testada na
   hora, guardada **cifrada** em `integracoes` (`chave_voz:<provedor>`, AES-GCM
   com chave derivada do `AUTH_SECRET`; sem `AUTH_SECRET` o painel recusa) e
   aparece na tela só pelo final (`…abcd`). Só o perfil Administração conecta.

Ao salvar, a chave vai junto para `tts.providers.<provedor>.apiKey` no
OpenClaw (decisão do Vinicios, 21/10): o WhatsApp usa a mesma conta do site —
uma voz clonada só existe na conta que a criou.

**Por que não é "entrar com a conta" (login).** O login da OpenAI que a
Hostinger usa é o do ChatGPT; ele dá acesso aos modelos de conversa, mas a
OpenAI só gera voz pela API, com chave (o OpenClaw 2026.9.4 também só lê
`apiKey`/`OPENAI_API_KEY` para voz). ElevenLabs e Google AI Studio também não
oferecem login para outro site usar a conta. Por isso o caminho mais curto é a
chave criada em um clique e colada no painel.

A **transcrição** (áudio do cliente → texto) continua sempre ElevenLabs
(Scribe), seja qual for a voz que a Marina usa para falar.

## Limites conhecidos

- **API oficial da Meta + Google**: a Meta não aceita WAV e o Gemini só devolve
  PCM; nesse caso a resposta vai só em texto (o WhatsApp Web converte, a API
  oficial não).
- O arquivo de preferências do OpenClaw (`settings/tts.json`, mudado por
  comandos `/tts` no chat) não aparece pelo RPC: se alguém trocou o provedor
  por lá, a conferência do painel não vê.
- **Não testado com o OpenClaw e os provedores de verdade daqui** (a rede desta
  sessão não alcança). O primeiro "Salvar nos dois canais" em produção é a
  prova: o cartão do topo precisa dizer "Mesma voz do site", e um áudio
  mandado ao WhatsApp precisa voltar com a voz escolhida.

## Testes

- `npm test`: `testes/unit/voz.test.ts` (campos certos, o defeito de 21/10
  aparecendo na conferência, camadas, persona, WAV, cifra das chaves).
- `testes/e2e-voz.mjs` com `testes/gateway-simulado.mjs` (config.get /
  config.patch com hash, config.set recusando `{path, value}` como o real) e
  `testes/voz-simulada.mjs` (ElevenLabs, OpenAI e Google de mentira):
  conectar, ouvir, salvar nos três provedores, o pedido do site igual à config
  do WhatsApp, conflito de versão, servidor fora, celular.

## Onde fica

`src/lib/voz-base.ts` (regras, listas, patch, leitura das camadas) ·
`src/lib/voz.ts` (opções, chaves, síntese, aplicar e conferir) ·
`src/lib/segredo.ts` (cifra) · `src/lib/openclaw-config.ts`
(`lerConfigOpenClaw`, `corrigirConfig`) · `src/app/(admin)/admin/marina/AbaVoz.tsx`
e `voz-actions.ts` · `src/app/api/chat/voz`, `src/app/api/admin/voz-teste`.
Gravado em `marina_config` (colunas da ElevenLabs, como antes) e
`integracoes` (`voz_marina`, `chave_voz:*`), sem migration.
