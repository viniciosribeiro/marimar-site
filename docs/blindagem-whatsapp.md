# Blindagem do WhatsApp da Marina

> Desde 21/10/2026. Pedido do Vinicios: "algo que realmente não fique caindo".
> Vale para a forma **WhatsApp Web (QR)**, a do OpenClaw. A API oficial da Meta
> (`docs/fluxo-whatsapp-oficial.md`) não cai por aparelho.

Ninguém garante 100%: quem decide desconectar um aparelho é o WhatsApp. O que
dá para fazer é (1) não dar motivo, (2) perceber na hora e (3) voltar sozinho
quando o problema é do servidor.

## O que aconteceu

| Quando | O quê |
|---|---|
| até 17/10 | Marina no celular de testes, estável |
| 17/10 10h30 | Marina passa para o número de atendimento da Cecília (aparelho novo, número movimentado, respondendo todas as conversas) |
| 17/10 10h30–14h | "Testar envio" manda mensagens para um número que **não existe no WhatsApp** (o celular da Cecília com o 9 a mais); corrigido às 14h05 |
| 18/10 ~11h | O WhatsApp remove o aparelho (401, "device removed") |
| 21/10 | Ligada a um celular de testes pelo QR do painel: o celular leu, mas o canal ficou **travado** no servidor até `openclaw gateway restart` |

O 401 vem do WhatsApp: ou alguém removeu o aparelho, ou o WhatsApp do celular
foi reinstalado/trocado, ou o sistema anti-robô do WhatsApp removeu. As três
primeiras horas no número novo tiveram justamente o que esse sistema vigia:
aparelho recém-conectado mandando para número inexistente e respondendo
sozinho todo mundo. Não dá para provar que foi isso; foi o que o site podia
ter feito, e agora não faz mais.

## O que o site faz agora

### 1. Disjuntor de envios (`passarDisjuntor`, antes de todo envio automático)

Avisos à equipe, lembretes, repasses, respostas dos chamados e "Testar envio":

- **nunca para o próprio número da Marina** (lido do OpenClaw: `self.e164`);
- **nada repetido**: a mesma mensagem para o mesmo número, no máximo 1 vez em 30 min;
- **nada em rajada**: até 20 por número por hora, 30 em 10 min, 90 por hora no total;
- **intervalo** de 3 s entre envios (o site espera, não descarta).

**Período de adaptação:** quando o número ligado à Marina muda, por 3 dias os
limites caem pela metade e o intervalo dobra. Os primeiros dias de um aparelho
novo são os mais vigiados (a queda veio 25 h depois da troca).

O que o disjuntor segura aparece em WhatsApp da Marina → Saúde e proteções, e o
chamado mostra o motivo.

### 2. Vigia (`vigiarWhatsapp`)

Lê o `channels.status` do OpenClaw e decide:

| Estado | O que faz |
|---|---|
| conectada | nada; se tinha avisado de problema, avisa que voltou |
| **travada** (ligada ao celular, sem conexão — 21/10) | depois de 4 min, **para e liga o canal** (`channels.stop` + `channels.start`), sem QR. No máximo 1 vez a cada 20 min e 6 por dia; passou disso, só avisa |
| parada (ligada, canal desligado) | igual à travada |
| aparelho removido (401 — 18/10) | **avisa** (só QR novo resolve) |
| sem celular ligado | avisa |
| duas cópias no mesmo número (440) | avisa |
| reconectando há 15 min | avisa |
| servidor da Marina sem responder há 10 min | avisa |

Roda pelo agendador (`/api/cron/chamados`, o mesmo dos prazos) e **de carona**,
no máximo 1 vez por minuto: ao abrir o painel, no chat do site e quando a
Marina lê o treinamento (`/api/agent/conhecimento`, a cada conversa e a cada
15 min). Uma trava no banco impede duas cópias do site de agirem juntas.

**Aviso no celular (ntfy, gratuito), ligado pelo painel, sem mexer na Vercel:**

1. Painel → WhatsApp da Marina → **Aviso no seu celular quando a Marina cair** →
   **Ligar o aviso no meu celular**. O painel cria um tópico com nome sorteado
   (`marimar-` + 10 letras) e guarda o endereço em `integracoes`
   (`alerta_whatsapp_url`).
2. No celular: instalar o app **ntfy**, tocar em **+** e digitar o nome do tópico
   que a tela mostra (servidor padrão, sem "Use another server").
3. **Mandar alerta de teste** na mesma tela: deve chegar em segundos.

No ntfy.sh o nome do tópico funciona como senha: quem souber o nome recebe os
avisos. Por isso o nome é sorteado e o aviso nunca leva dado de cliente.
**Desligar o aviso** apaga o endereço; ligar de novo cria outro tópico.

Alternativa: `ALERTA_WHATSAPP_URL` na Vercel (qualquer endereço que receba POST
de texto) vale por cima do que o painel ligou.

### 3. Prazos dos chamados sem duplicidade

`processarPrazos` só roda em uma cópia do servidor por vez (trava em
`integracoes`, `trava:prazos`). Antes, duas cópias rodando no mesmo minuto
podiam mandar o mesmo lembrete duas vezes.

### 4. QR à prova de erro (tela WhatsApp da Marina)

- O QR **só é gerado** quando o servidor confirma que não há ligação boa a
  perder (o QR novo apaga a ligação atual). Servidor sem responder, ligada mas
  travada ou duas cópias: não gera.
- Depois da leitura, **confere a conexão de verdade**. Travou (21/10)? Destrava
  sozinha e confere de novo. Só então diz "Conectada!", com o número ligado.
- Ligada mas travada ao abrir a tela: botão **Destravar a conexão**, sem QR.

### 5. Equipe

O número ligado à Marina não pode ser cadastrado em Equipe responsável (ela
mandaria os avisos para si mesma).

## O que fazer no servidor (uma vez, no terminal da Hostinger)

```bash
# 1. A Marina não age em grupos (grupo é onde mais denunciam robô)
openclaw config set channels.whatsapp.groupPolicy '"disabled"' --strict-json

# 2. Mensagem do próprio número nunca vira conversa (evita a Marina falar sozinha)
openclaw config set channels.whatsapp.selfChatMode false --strict-json

# 3. Reiniciar e conferir
openclaw gateway restart
openclaw channels status        # "linked, running, connected"
```

**Feito em 21/10/2026:** 1, 2 e 3 aplicados; depois do reinício,
`linked, running, connected, health:healthy`.

### Cópia de segurança e atualização (não deram certo em 21/10)

- **`openclaw backup create` falha** na 2026.9.4 com
  `Archive symbolic link target must be relative: …/.venv-transcribe/bin/python3 -> /usr/bin/python3`.
  É um defeito conhecido do OpenClaw com atalhos absolutos (o ambiente Python
  da transcrição de áudio), corrigido depois no projeto (openclaw/openclaw
  #141923). Enquanto isso, a cópia vai pelo `tar`, que guarda atalhos como estão:

  ```bash
  ls -d /data/.openclaw            # confirma onde mora o OpenClaw (o erro mostrou /data/.openclaw)
  tar -czf /data/copia-openclaw-2026-10-21.tar.gz -C /data .openclaw
  ls -lh /data/copia-openclaw-2026-10-21.tar.gz
  ```

  A cópia leva a sessão do WhatsApp da Marina: não mandar esse arquivo para
  ninguém.
- **`openclaw update` responde "Update from command line is not allowed"**: a
  instalação da Hostinger (modelo de 1 clique, em Docker) não se atualiza pelo
  terminal. Pela documentação do OpenClaw para a Hostinger, a atualização é no
  hPanel → VPS → **Docker Manager** → **Update** (baixa a imagem nova; a imagem
  da Hostinger pode chegar alguns dias depois da versão oficial). Não é urgente:
  a 2026.10.5 corrige mensagens que chegam ilegíveis logo depois de religar, mas
  a Marina funciona sem ela. Fazer em horário calmo, depois da cópia acima, e
  conferir `openclaw channels status` e um "oi" de outro celular.

## Ao ligar o número real da pousada

1. Painel → WhatsApp da Marina → **Desconectar** o celular de testes.
2. Em horário calmo, **Conectar a Marina** com o celular da pousada (o painel no computador).
3. Esperar "Conectada!" com o número certo.
4. **Dados da pousada → WhatsApp**: o número do botão do site.
5. Equipe responsável: celulares **pessoais**, nunca o da Marina (o painel recusa).
6. Os 3 primeiros dias rodam em período de adaptação, sozinhos.
7. Combinar com quem usa o celular: não remover "openclaw", não reinstalar nem
   trocar o WhatsApp sem avisar, abrir o WhatsApp ao menos a cada 14 dias.

## Agendador

Para o vigia rodar mesmo sem ninguém usando o site, um agendador chamando a
cada 5 min (cron-job.org, por exemplo):

```
GET https://marimar-site.vercel.app/api/cron/chamados
Authorization: Bearer <CRON_SECRET ou AGENT_API_KEY>
```

## Testes

- `npm test`: `testes/unit/whatsapp-saude.test.ts` (estados, vigia, disjuntor, adaptação).
- `testes/e2e-blindagem.mjs` com `SIM_WHATSAPP_DESCONECTADO=1 SIM_TRAVA_DEPOIS_DO_QR=1 node testes/gateway-simulado.mjs`
  e `ALERTA_WHATSAPP_URL=http://localhost:4010/__alerta` no servidor: reproduz
  21/10, 18/10, servidor fora, repetição e número da Marina na Equipe.
- `testes/e2e-alerta.mjs`: servidor **sem** `ALERTA_WHATSAPP_URL` e com
  `ALERTA_NTFY_URL=http://localhost:4010/__ntfy` (o "ntfy" do simulador): liga
  pelo painel, manda o teste, o vigia avisa no tópico (401 e "voltou"), desliga.
- **Não testado com o OpenClaw de verdade:** se `channels.stop` + `channels.start`
  destravam como o `gateway restart` destravou em 21/10. Se não destravarem, o
  vigia avisa depois de 6 tentativas e o caminho é o terminal.

## Onde fica

`src/lib/whatsapp-saude.ts` (regras) · `src/lib/whatsapp-vigia.ts` (vigia,
disjuntor, travas, alerta) · `src/lib/envio-whatsapp.ts` (disjuntor no envio) ·
`src/lib/escalonamento.ts` (trava dos prazos) ·
`src/app/(admin)/admin/whatsapp/` (tela; `AlertaCelular.tsx`, o aviso no celular) ·
tudo guardado em `integracoes` (`wa_vigia`, `wa_out:*`, `wa_blq:*`, `trava:*`,
`alerta_whatsapp_url`), sem migration.
