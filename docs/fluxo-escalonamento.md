# Escalonamento para a equipe e aprendizado contínuo da Marina

> Escrito em 30/09/2026. Leia antes de mexer em `/admin/equipe`,
> `/admin/cerebro`, Marina → Aprendizado, `src/lib/escalonamento*.ts`,
> `src/lib/aprendizado.ts` ou nas rotas `/api/agent/chamados*`.

## O fluxo em uma tela

```
cliente pergunta algo que não está no treinamento
   │  site: o servidor percebe o "não sei" (pareceSemResposta) e abre o chamado
   │  WhatsApp: a Marina chama POST /api/agent/chamados (regra na skill)
   ▼
abrirChamado()  ── código curto (#K7Q2), setor pelo texto ou pelo "assunto"
   │               escolhe a pessoa: setor → no horário → prioridade
   ▼
WhatsApp da pessoa (via gateway do OpenClaw, RPC "send")
   │  "🙋 Chamado #K7Q2 — pergunta, contexto, canal. Responda esta mensagem."
   │  Se o site não conseguir mandar: a rota devolve `aviso_manual` e a
   │  própria Marina manda.
   ▼
a pessoa responde no WhatsApp (citando a mensagem OU escrevendo #K7Q2)
   │  a mensagem chega à Marina; a skill manda para
   │  POST /api/agent/chamados/resposta { numero, texto, citado }
   ▼
responderChamado()
   ├─ acha o chamado: código no texto/citação; sem código, o único aberto
   │  daquela pessoa; vários abertos → pede o código
   ├─ marca "respondido" (trava contra resposta dupla)
   ├─ formularResposta(): reescreve no tom da Marina (gateway, sem inventar)
   ├─ entregarAoCliente(): site → mensagem na sessão do chat (o widget
   │  consulta /api/chat/chamados); WhatsApp → gateway (janela de 24 h)
   ├─ aprenderDeChamado(): vira aprendizado (ver abaixo)
   └─ apaga o destino (telefone/sessão) do chamado
```

Prazos (`processarPrazos`, a partir de `acoesDePrazo`, função pura):

| Quando | O que acontece |
|---|---|
| `lembrete_min` depois do aviso (padrão 20) | lembrete para a mesma pessoa |
| `proximo_min` depois do aviso (padrão 45) | passa para o próximo da fila (sem repetir quem já foi avisado) |
| `aviso_cliente_min` depois da pergunta (padrão 30) | "ainda estou confirmando" para o cliente |
| `desistir_min` depois da pergunta (padrão 240) | expira; o cliente recebe o WhatsApp/telefone **cadastrado** da recepção (nunca inventado) |

Os prazos rodam: (1) em `GET/POST /api/cron/chamados` com
`Authorization: Bearer <CRON_SECRET ou AGENT_API_KEY>`; (2) de carona no chat do
site e nas rotas de chamado (no máximo 1×/min por instância); (3) no botão
"Conferir prazos agora". **Para garantir, configure um agendador a cada 5 min**
(cron do OpenClaw, cron-job.org, etc.). O plano gratuito da Vercel só roda cron
diário, por isso não foi usado — e o deploy não foi tocado.

## WhatsApp: o que o site precisa e os limites

- O envio (`src/lib/envio-whatsapp.ts`) usa `POST /tools/invoke` do gateway
  com a ferramenta `message` (ação `send`, `channel: "whatsapp"`,
  **`bestEffort: false`**). Só conta como enviado quando volta
  `details.result` com o id da mensagem no canal `whatsapp`. Um resultado
  "suppressed", "dry_run", de outro canal ou sem `result` é falha. Isso vem da
  leitura do código do OpenClaw 2026.9: sem `bestEffort: false`, ele responde
  "ok" mesmo quando o WhatsApp não entrega.
- A ferramenta `message` **não vem liberada no perfil padrão (`coding`)** do
  OpenClaw: sem liberar, o gateway responde 404. Ver `docs/runbook.md`,
  "Liberar a ferramenta de mensagens". Só nesse caso (404) o site pede à
  Marina pelo `/v1/chat/completions`, e aceita apenas "ENVIADO <id da
  mensagem>". A variável `OPENCLAW_ENVIO` força um caminho: `ferramenta`,
  `agente` ou `rpc:<método>`. **O RPC de administração não serve para
  enviar** (o plugin só aceita configuração), mas o "Testar envio" usa o
  `channels.status` dele para avisar quando o WhatsApp está desconectado.
- Plano B sempre existe: quando o site não consegue mandar, as rotas devolvem o
  texto e o destino (`aviso_manual`, `entregar_manual`) e a skill manda a Marina
  enviar ela mesma.
- **Janela de 24 h:** só existe na API oficial da Meta. Em Equipe responsável →
  Prazos e WhatsApp, modo "API oficial": fora das 24 h desde a última mensagem
  do cliente, só vai com o template configurado (1 variável = o texto); sem
  template, a entrega falha com erro claro e o chamado aparece em "Com problema"
  para a equipe responder o cliente manualmente. O modo padrão ("pelo
  aparelho", que é o do OpenClaw hoje) não tem janela.

## Vários clientes ao mesmo tempo

Cada chamado tem código próprio. A resposta só vai para o chamado do código
encontrado (texto ou mensagem citada). Sem código e com mais de um chamado
aberto para aquela pessoa, o site responde listando os códigos e não entrega
nada. Duas respostas simultâneas ao mesmo chamado: o `UPDATE ... WHERE status =
'aguardando'` deixa passar só a primeira. Coberto no e2e.

## Base de aprendizado (`marina_aprendizado`)

| Campo | Para quê |
|---|---|
| `pergunta`, `variacoes` | o grupo de perguntas com o mesmo sentido |
| `resposta` | a resposta da equipe (anonimizada) |
| `categoria` | área de conhecimento (mesmas categorias do treinamento) |
| `status` | `pendente` (não usa) · `ativo` (usa) · `rejeitado` · `oficial` (virou item de Conhecimento) |
| `revisado` | alguém do painel olhou |
| `confianca` | 0,6 ao nascer; +0,1 quando a equipe confirma a mesma resposta; 0,5 se a equipe mudar a resposta; ≥ 0,9 ao aprovar |
| `origem`, `origem_canal`, `chamado_id`, `respondido_por`, `criado_em` | de onde veio |
| `usos`, `ultimo_uso_em` | quantas vezes ela respondeu sozinha com isto |
| `valido_ate` | validade opcional; sugerida (`validade_dias`, padrão 30) quando o texto fala de preço, horário, evento, data |
| `conflito_id` | item MANUAL parecido: o aprendido fica parado até alguém decidir |

**Agrupar por significado** (`similaridade()` em `escalonamento-base.ts`):
palavras-raiz em português + sinônimos do dia a dia da pousada + trigramas;
limiar `LIMIAR_MESMA_PERGUNTA = 0,62`. Não é entendimento de verdade — os casos
que precisa acertar estão em `testes/unit/escalonamento.test.ts`. Próximo passo
natural: embeddings (ver "Próximos passos").

**Modos** (Marina → Aprendizado): "Só depois de aprovado" (padrão) ou "Na hora
(automático)". Em qualquer modo, em uso é só `status = 'ativo'`, sem conflito e
dentro da validade (`emUso()`).

**Onde entra:** `ensinamentosEmTexto()` põe a seção "APRENDIDO COM A EQUIPE"
**depois** de tudo o que foi cadastrado, dizendo que vale menos, que o jeito de
falar e o "nunca dizer" continuam valendo e que preço/vaga só vêm do motor.
Vale no site e no WhatsApp (a skill relê a cada 15 min).

**Uso contado:** no site, o servidor compara a pergunta do visitante com os
aprendidos em uso; no WhatsApp, a skill chama `POST /api/agent/aprendizado/uso`.

## Regras de segurança

- **Dados pessoais:** `anonimizar()` tira e-mail, telefone, CPF, cartão e "meu
  nome é Fulano" de tudo o que vai para a equipe e para a base;
  `perguntaParaBase()` ainda apaga a frase que só identificava a pessoa. O
  destino (telefone/sessão) fica no chamado só até ele fechar (entregue,
  expirado ou cancelado) — depois vira `null`. Os eventos (`marina_eventos`)
  não guardam texto.
- **Nunca sobrescreve o manual:** aprendido e manual ficam em tabelas
  separadas. "Tornar oficial" CRIA um item novo em Conhecimento (com
  histórico). Aprendido parecido com um manual nasce parado (`conflito_id`).
- **Rotas:** as do agente exigem `AGENT_API_KEY` (falha fechada); o cron aceita
  `CRON_SECRET` (≥ 16 caracteres) ou a mesma chave; `/api/chat/chamados` é
  pública como o chat, mas só devolve mensagens da sessão (UUID aleatório que
  só o navegador do visitante conhece). Todas as Server Actions novas começam
  com `exigirSessao()`.
- **Risco residual:** quem diz à rota que a mensagem é da equipe é a Marina,
  pelo número de quem escreveu. Um hóspede não consegue passar pela equipe a
  não ser que convença a Marina a mentir o número. Mitigações: a skill manda
  usar só o número real do remetente; o modo aprovação (padrão) segura o que
  entra na base. Melhor ainda: rotear os números da equipe no próprio OpenClaw
  (próximos passos).

## Telas

| Tela | O quê |
|---|---|
| `/admin/equipe` → Equipe | pessoas, setores, dias/horário, prioridade (arrastar), ligar/desligar, testar envio |
| `/admin/equipe` → Chamados | aguardando / com problema / entregues; linha do tempo de quem foi avisado; responder pelo painel; tentar entregar de novo; cancelar |
| `/admin/equipe` → Prazos e WhatsApp | liga/desliga, os 4 prazos, modo do WhatsApp e templates |
| `/admin/marina?aba=aprendizado` | modo, fila de revisão, aprovar/editar/rejeitar/tornar oficial/excluir, busca e filtros |
| `/admin/cerebro` | indicadores, mapa do conhecimento (`MapaConhecimento.tsx`: Marina no centro, áreas em anel, Mapa/Lista, busca, filtro de origem, zoom/arrastar/tela cheia, equipes de apoio, painel "Assunto selecionado" com links para `/admin/marina?aba=conhecimento&categoria=<id>[&novo=1]`), áreas, taxa de resolução sozinha no tempo, aprendidos recentes, frequentes, temas escalados; filtros de período e canal |
| `/admin` | resumo do Cérebro e avisos de clientes esperando / aprovações |

"Resolveu sozinha" = das perguntas que não estavam no cadastro (eventos
`aprendido_usado`, `escalada`, `lacuna`), a fração respondida com o aprendido.

## Testes

- `npm test` — `testes/unit/escalonamento.test.ts`: similaridade (agrupa e não
  mistura), anonimização, códigos, números, horário (incl. madrugada), escolha
  da pessoa, janela de 24 h, prazos, setor e validade.
- `npm run test:e2e:escalonamento` — 38 verificações, **só em banco local**
  (apaga equipe/chamados/aprendizado): painel, site, WhatsApp com dois clientes
  simultâneos, modo automático, prazos, falha de entrega, Cérebro. Precisa do
  `testes/gateway-simulado.mjs` rodando (ele guarda o que foi "enviado" em
  `GET /__enviadas`; número terminado em 0000 simula falha).

## Próximos passos

1. **Validar com o OpenClaw real** o método de envio (`send`) e a chegada das
   mensagens da equipe à Marina (inclusive o texto da mensagem citada).
2. **Agendador dos prazos** a cada 5 min chamando `/api/cron/chamados`.
3. **Roteamento no OpenClaw:** números da equipe numa regra própria (sem
   depender do LLM para reconhecer a equipe).
4. **Embeddings** para agrupar por significado (ex.: um modelo de embeddings
   chamado no `aprenderDeChamado`), mantendo a similaridade atual como plano B.
5. **Cliente do site que fechou a aba:** hoje a resposta espera na sessão;
   oferecer "quer receber no WhatsApp?" quando o chamado abrir.
6. Conversas do WhatsApp no painel (depende do que o gateway expõe).


## Confirmação do aprendizado pelo WhatsApp (0020)

Quando a equipe responde **pelo WhatsApp**:
1. `responderChamado` entrega ao cliente, **não** guarda nada e marca o
   chamado com `confirmacao_etapa = 'pergunta'`.
2. O `resumo_texto` que a skill repassa termina com "📚 Posso guardar esta
   resposta…? SIM / NÃO / como prefere".
3. A próxima mensagem da pessoa, se não tiver o código de um chamado aberto,
   é a resposta à confirmação (`lerConfirmacao` em `escalonamento-base.ts`):
   - SIM (resposta curta) → `aprenderDeChamado` com o texto (vale o modo:
     automático = ativo; aprovação = fila);
   - NÃO → não guarda;
   - outro texto → vira a versão nova: `confirmacao_etapa = 'final'`, e a
     Marina mostra "Ficou assim: … Confirma?".
4. Se ninguém responder em 24 h (`processarPrazos`), ou se a mesma pessoa
   receber um chamado novo (`notificar`), a resposta vai para a fila do
   painel como "para aprovar". Assim a próxima mensagem dela não é lida como
   alteração da resposta anterior.

Pelo painel ("Responder pelo painel") não há confirmação: quem responde já é
a administração.

## "Sem resposta" junto com os chamados (0020)

Toda pergunta que a Marina não soube entra em `marina_lacunas`, agora com
`chamado_id` (o chamado aberto) ou `aviso_erro` (por que a equipe não foi
avisada: escalonamento desligado, nenhum contato, WhatsApp falhou). A aba
Marina → Sem resposta mostra essa situação e tem "Avisar a equipe" / "Avisar
de novo" (`avisarEquipeDaLacuna`). A pergunta sai da lista quando o chamado é
respondido (`chamado_id`) ou quando alguém ensina a resposta. Pergunta com
chamado não conta de novo como "lacuna" no Cérebro: já contou como "escalada".
