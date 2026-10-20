# WhatsApp da Marina: as duas formas (QR e API oficial da Meta)

> Desde 20/10/2026. Tela: **Marina → WhatsApp da Marina** (`/admin/whatsapp`),
> só perfil Administração.

A Marina pode atender o WhatsApp de duas formas. **Só uma responde por vez**, e
a troca é um clique na tela.

| Forma | Como funciona | Cai como em 18/10? | Custo |
|---|---|---|---|
| **WhatsApp Web (QR)** | O OpenClaw entra como aparelho conectado do celular (Baileys) | Sim, se o aparelho for removido | Nenhum |
| **API oficial da Meta** | A Meta entrega cada mensagem ao site (webhook), o site pergunta à Marina e responde pela Graph API | Não | Por mensagem (tabela da Meta) |

A escolha fica em `marina_escalonamento_config.whatsapp_modo` (`"web"` ou
`"oficial"`) — a mesma que os chamados já usavam para a janela de 24 h e os
modelos. Ao trocar, a tela chama no OpenClaw:

- para a oficial: `channels.stop` (pausa o WhatsApp Web; o QR fica guardado);
- para o QR: `channels.start` (religa sem pedir QR, se a sessão ainda vale).

Se o OpenClaw não responder, a troca acontece assim mesmo e a tela avisa para
desconectar o QR à mão — senão a Marina responderia duas vezes.

## Caminho da mensagem (API oficial)

```
cliente ──► Meta ──► POST /api/whatsapp/meta ──► 200 na hora
                         │ (after)
                         ├─ equipe?  ──► responderChamado (como a skill no QR)
                         └─ cliente  ──► Marina (gateway /v1/chat/completions, user "wa:<número>")
                                          └─► Graph API: texto, foto, vídeo, áudio
```

- **Código:** `src/lib/whatsapp-meta-base.ts` (puro: assinatura, leitura do
  aviso, partir a resposta), `src/lib/whatsapp-meta.ts` (Graph API),
  `src/lib/whatsapp-oficial.ts` (atendimento), `src/app/api/whatsapp/meta/route.ts`.
- **Conversa:** `chat_mensagens` com `sessao = "wa:<número>"`. A Marina recebe
  o treinamento (`montarTreinamento(sql, "whatsapp")`) e o histórico, como no
  chat do site. O painel mostra essas conversas em Marina → Conversas
  ("WhatsApp · final 1234").
- **Não responder duas vezes:** o `wamid` vai para `integracoes`
  (`wa_msg:<id>`, chave única). Limpeza automática depois de 3 dias.
- **Equipe citando o aviso:** cada mensagem enviada guarda o texto em
  `integracoes` (`wa_env:<id>`); quando a equipe responde citando, o código do
  chamado vem junto.
- **Áudio:** o áudio do cliente é baixado da Meta e transcrito (ElevenLabs,
  como no site); a resposta vai em texto e também em áudio (até 900 caracteres).
- **Fotos e vídeos:** `![descrição](url)` sozinho na linha, como no chat do site.
- **Lida e "digitando…":** marcadas assim que a mensagem chega.
- **Teto:** 40 mensagens por conversa por hora (dois robôs conversando não
  viram conta aberta).
- **Coexistência (mesmo número no app WhatsApp Business):** o que a Cecília
  manda pelo aplicativo chega como eco (`smb_message_echoes`), entra na
  conversa e **segura a Marina por 30 minutos** naquela conversa. O formato do
  eco foi escrito pela documentação e **não foi testado com a Meta real**.
- **Avisos à equipe e respostas dos chamados:** com a oficial em uso,
  `enviarWhatsapp` vai pela Meta. Fora da janela de 24 h, só com modelo
  aprovado (Equipe → Prazos e WhatsApp → Modelos da Meta).

## Chaves (só na Vercel, nunca no chat nem no git)

| Variável | O que é |
|---|---|
| `WHATSAPP_META_TOKEN` | Token permanente de um usuário do sistema, com permissão `whatsapp_business_messaging` |
| `WHATSAPP_META_PHONE_ID` | ID do número de telefone na Meta (não é o número) |
| `WHATSAPP_META_APP_SECRET` | Chave secreta do app (Configurações do app → Básico); confere a assinatura de cada aviso |
| `WHATSAPP_META_VERIFY_TOKEN` | Uma palavra combinada qualquer; a mesma vai no campo "Token de verificação" do webhook na Meta |
| `WHATSAPP_META_API_VERSION` | Opcional. Padrão `v23.0` |
| `WHATSAPP_META_GRAPH_URL` | Só para teste local (aponta para `testes/meta-simulada.mjs`). Em produção, vazia |

Sem as quatro primeiras, a tela não deixa escolher a oficial e o webhook
responde 503 (falha fechado). Depois de pôr na Vercel, **Redeploy**.

## Passo a passo na Meta

**Número novo só da Marina (caminho A):**

1. business.facebook.com: portfólio empresarial da pousada.
2. developers.facebook.com → Criar app → tipo Empresa → adicionar o produto WhatsApp.
3. WhatsApp → Configuração da API → adicionar o número (recebe SMS ou ligação;
   não pode estar em nenhum WhatsApp). Anotar o **ID do número**.
4. Nome de exibição para aprovação; verificação da empresa, se a Meta pedir.
5. Configurações do negócio → Usuários do sistema → criar (administrador) →
   atribuir o app e a conta do WhatsApp → gerar token com
   `whatsapp_business_messaging` e `whatsapp_business_management`, sem validade.
6. Forma de pagamento no Gerenciador do WhatsApp.
7. Vercel → Settings → Environment Variables: as quatro chaves → Redeploy.
8. WhatsApp → Configuração → Webhook: o endereço que a tela mostra
   (`https://<site>/api/whatsapp/meta`) e o token de verificação → Verificar →
   assinar o campo **messages**.
9. Modelos de mensagem (Gerenciador do WhatsApp → Modelos): um para o cliente e
   um para a equipe, categoria Utilidade, com **uma variável** no corpo
   (`{{1}}`). Pôr os nomes em Equipe → Prazos e WhatsApp.
10. Painel → WhatsApp da Marina → **Testar a ligação com a Meta** → **Usar a API oficial**.
11. De outro celular, mandar "oi" para o número. Resposta em até 1 minuto.

**Mesmo número, com parceiro (caminho B, coexistência):** o parceiro oficial da
Meta conduz os passos 2 a 8 (cadastro dele); a Cecília lê um QR dentro do
WhatsApp Business. Assinar também o campo **smb_message_echoes**. Ao entrar,
a Meta desconecta os aparelhos conectados, inclusive a Marina do QR — é o
esperado.

## Testes

- `npm test`: `testes/unit/whatsapp-meta.test.ts` (assinatura, leitura do aviso,
  partir a resposta, variáveis de modelo, erros).
- `testes/e2e-whatsapp-oficial.mjs` com `testes/gateway-simulado.mjs` e
  `testes/meta-simulada.mjs`: validação do webhook, assinatura, modo QR
  ignorando, troca pelo painel (`channels.stop`/`start`), resposta pela Meta,
  aviso repetido, conversa no painel, Hoje sem alarme falso.
- **Não testado com a Meta real** (sem conta daqui): formato exato do eco da
  coexistência, aprovação de modelos, áudio de verdade.

## Limites conhecidos

- Três mensagens seguidas do cliente geram três respostas (o WhatsApp Web do
  OpenClaw junta; aqui ainda não).
- A pausa de 30 minutos só funciona na coexistência (precisa do eco).
- A Marina continua rodando no servidor da Hostinger nas duas formas.
- Prazo da rota: 60 s, como as outras do projeto. A Marina tem até 40 s para
  responder (transcrição de áudio até 15 s); passando disso, o cliente recebe
  "a equipe da pousada vai te responder por aqui". O texto sai antes da voz.
