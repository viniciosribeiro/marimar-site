# Runbook — Pousada Marimar

> Atualizado: 18/09/2026. Plataforma de deploy: **Vercel** (Cloudflare Pages foi descontinuado neste projeto).

---

## Deploy

O deploy e automatico por push no GitHub.

```bash
git push origin main      # dispara build de producao na Vercel
```

Deploy manual (quando precisar forcar):

```bash
npx vercel --prod
```

Preview de branch:

```bash
git push origin minha-branch   # gera URL de preview automatica
npx vercel                     # ou manualmente
```

Projeto na Vercel: `marimar-site` (`prj_mdV5765eNJ8n2QENzNyLeP0Kdl8c`).

⚠️ **Nao use `wrangler`.** As dependencias do Cloudflare foram removidas nos commits
`1b72a79` e `f578f12`. Se encontrar `wrangler.toml` ou `.open-next/` na pasta, sao
restos ignorados pelo `.gitignore`.

---

## Variaveis de ambiente

Toda variavel precisa existir em **dois lugares**: `.env.local` (dev) e no painel da
Vercel (Production + Preview). Faltar variavel na Vercel e a causa mais comum de
"funciona local, quebra em producao".

| Variavel | Obrigatoria | Observacao |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon, connection pooling |
| `DATABASE_URL_UNPOOLED` | ✅ | Migrations |
| `AUTH_SECRET` | ✅ | Auth.js v5 |
| `AUTH_URL` | ✅ | URL canonica do admin |
| `AUTH_TRUST_HOST` | ✅ | `true` na Vercel |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL publica |
| `WORKER_BASE_URL` | ✅ | Worker PousadaHub |
| `WORKER_SLUG` | ✅ | `pousada-ilha-do-mel-marimar` |
| `WORKER_TIMEOUT_MS` | — | default 12000 |
| `WORKER_TIMEOUT_BUSCA_MS` | — | default 45000 — busca do hóspede (`/reservar` e rotas de disponibilidade) |
| `TARIFAS_CACHE_TTL` | — | TTL do cache de tarifas |
| `AGENT_API_KEY` | ✅ | **min. 16 chars.** Sem ela as rotas do agente retornam 401 (fail-closed) |
| `CRON_SECRET` | — | min. 16 chars. Chave do agendador de `/api/cron/chamados` (prazos dos chamados). Sem ela, o agendador usa a `AGENT_API_KEY` |
| `OPENCLAW_ENVIO` | — | como o site manda WhatsApp: `auto` (padrão: ferramenta `message` do gateway; a Marina só entra se a ferramenta não existir, e precisa devolver o id da mensagem), `ferramenta`, `agente` ou `rpc:<método>`. Ver `docs/fluxo-escalonamento.md` e "Liberar a ferramenta de mensagens" abaixo |

Sincronizar da Vercel para local:

```bash
npx vercel env pull .env.local
```

---

## Worker offline

O site continua no ar mostrando catalogo sem precos + CTA WhatsApp.

1. Verifique `https://pousadahub.viniciosribeiro.workers.dev/`
2. Admin → Integracoes → card "Worker Desbravador"
3. Slug correto e `pousada-ilha-do-mel-marimar` (**nao** `marimar`) — slug errado
   retorna `quartos: []` sem mensagem de erro, o que parece "sem disponibilidade"

---

## Preco errado

1. Admin → Diagnostico → Testar Worker
2. Compare o JSON com o que o site exibe
3. Se divergir, o cache de tarifas (`cache_tarifas`) esta velho — force atualizacao
4. Contrato completo dos campos: `docs/contrato-api.md`

---

## Reset de senha do admin

```sql
UPDATE usuarios
SET senha_hash = crypt('SenhaTemp123', gen_salt('bf', 12)),
    must_reset = true,
    tentativas_falhas = 0,
    bloqueado_ate = NULL
WHERE email = 'cecilia@...';
```

O usuario e forcado a trocar a senha no proximo login (min. 12 caracteres).

---

## Rotacionar a AGENT_API_KEY

A chave protege as 7 rotas `/api/agent/*` consumidas pela Marina.

```bash
# 1. gerar
node -e "console.log('marina_' + require('crypto').randomBytes(24).toString('base64url'))"
```

2. Atualizar em `.env.local`
3. Atualizar na Vercel: Settings → Environment Variables → `AGENT_API_KEY` → Production **e** Preview
4. Redeploy (a Vercel nao aplica env nova sem novo build)
5. Atualizar o header `Authorization: Bearer <nova>` na Custom API Tool do OpenClaw
6. Conferir em Admin → Integracoes: os 4 endpoints devem voltar a "online"

⚠️ Nunca commitar o valor da chave. Ela vive so em `.env.local` (gitignored) e na Vercel.

---

## Banco de dados

```bash
npm run db:generate    # gerar migration a partir do schema
npm run db:migrate     # aplicar
npm run db:seed        # popular
npm run db:seed:admin  # criar usuario master
npm run db:studio      # Drizzle Studio
```

---

## Checklist pos-deploy

- [ ] `https://www.pousadamarimarilhadomel.com.br` responde 200
- [ ] `https://admin.pousadamarimarilhadomel.com.br/admin` leva ao login
- [ ] `/admin` no dominio publico redireciona para o subdominio admin
- [ ] Busca de disponibilidade na home retorna quartos com preco
- [ ] Admin → Integracoes: 4 cards verdes
- [ ] `curl -H "Authorization: Bearer <chave>" .../api/agent/pousada` → 200
- [ ] `curl .../api/agent/pousada` (sem header) → **401** (nunca 200)


## Liberar a ferramenta de mensagens (WhatsApp da equipe)

O site avisa a equipe pelo `POST /tools/invoke` do gateway, com a ferramenta
`message`. **Na instalação padrão do OpenClaw o perfil de ferramentas é
`coding`, que NÃO inclui `message`** (docs do pacote: `gateway/config-tools.md`).
Aí o gateway responde 404. Até 30/09 o site caía para "pedir à Marina", e ela
podia responder "ENVIADO" sem ter mandado nada: foi o "Testar envio diz que
foi e nada chega". Hoje o site mostra o 404 com este nome.

No terminal da Hostinger:

```bash
openclaw config get tools.profile          # "coding" (ou vazio) = message fora
openclaw config get tools.alsoAllow        # o que já está liberado a mais
openclaw config set tools.alsoAllow '["message"]' --strict-json   # se já houver itens, inclua-os na lista
openclaw gateway restart
openclaw channels status                   # o WhatsApp precisa estar conectado
```

Depois, no painel, **Equipe responsável → Testar envio**. O teste só diz
"✓ O WhatsApp confirmou a entrega" quando o WhatsApp devolve o id da
mensagem. O envio pede entrega obrigatória (`bestEffort: false`): sem isso, o
OpenClaw responde "ok" mesmo quando o WhatsApp não entrega.

O `/tools/invoke` é uma superfície de operador (o token do gateway dá
acesso total): mantenha o gateway atrás de HTTPS e com token forte, como já
está para o chat do site.

## Domínios (registro.br → Vercel)

Situação em 17/10/2026: os dois domínios usam o **DNS do registro.br, modo
avançado** (antes era uma Cloudflare antiga). Cada domínio está numa conta
diferente do registro.br.

Não use `ns1/ns2.vercel-dns.com` no registro.br: ele responde "Pesquisa
recusada". Crie as linhas em **DNS → Configurar zona DNS → Nova entrada**
(só libera quando a mensagem "Domínio em transição" some):

| Domínio | Tipo | Nome | Dados |
|---|---|---|---|
| pousadamarimarilhadomel.com.br | A | *(vazio)* | `76.76.21.21` |
| pousadamarimarilhadomel.com.br | CNAME | www | `cname.vercel-dns.com` |
| pousadamarimarilhadomel.com.br | CNAME | admin | `cname.vercel-dns.com` |
| pousadamarimar.com.br | A | *(vazio)* | `76.76.21.21` |
| pousadamarimar.com.br | CNAME | www | `cname.vercel-dns.com` |

A Vercel sugere CNAME na raiz (`…vercel-dns-017.com`), mas o registro.br não
aceita CNAME na raiz; ela mesma diz que `76.76.21.21` continua valendo.

Na Vercel (projeto → Domains) o `www.pousadamarimarilhadomel.com.br` é o
principal, o `admin.` serve o painel (o `src/middleware.ts` manda `/admin` do
domínio público para lá) e os outros três redirecionam (308) para o www.

**Só depois que todas as linhas ficarem azuis na Vercel**, troque em
Environment Variables e faça Redeploy:

- `NEXT_PUBLIC_SITE_URL` = `https://www.pousadamarimarilhadomel.com.br`
- `AUTH_URL` = `https://admin.pousadamarimarilhadomel.com.br`

Trocar antes quebra o login do painel. A skill da Marina pode continuar em
`marimar-site.vercel.app`, que segue funcionando.

## API oficial do WhatsApp (Meta)

Pronta desde 20/10/2026 e desligada. A forma em uso (QR ou oficial) é escolhida
em Marina → WhatsApp da Marina. Chaves (`WHATSAPP_META_TOKEN`,
`WHATSAPP_META_PHONE_ID`, `WHATSAPP_META_APP_SECRET`,
`WHATSAPP_META_VERIFY_TOKEN`), webhook (`/api/whatsapp/meta`, campo
`messages`), modelos e passo a passo: `docs/fluxo-whatsapp-oficial.md`.

- Webhook responde 503: faltam chaves na Vercel (falha fechado).
- 401 no POST: assinatura inválida (o `APP_SECRET` não é o do app que manda).
- Chega e ninguém responde: a forma em uso é o QR (as mensagens são ignoradas
  de propósito) ou o gateway do OpenClaw está fora (o cliente recebe "a equipe
  vai te responder").
- "Passaram mais de 24 h": a Meta só aceita modelo aprovado; cadastre os nomes
  em Equipe → Prazos e WhatsApp.

## WhatsApp caiu (a Marina parou de responder)

> Desde 21/10 o site vigia e destrava sozinho quando a conexão trava, e avisa
> no celular (`ALERTA_WHATSAPP_URL`) quando o problema pede gente: ver
> `docs/blindagem-whatsapp.md`. A tela WhatsApp da Marina mostra o estado e o
> histórico em "Saúde e proteções".

A tela **Hoje** do painel avisa no topo ("A Marina está fora do WhatsApp") e
diz o motivo. **Religar pelo painel (desde 20/10):** Marina → WhatsApp da
Marina → Conectar a Marina, com a tela aberta no computador e o celular da
pousada lendo o QR (perfil Administração). A tela usa `web.login.start`,
`web.login.wait` e `channels.logout` do plugin `admin-http-rpc`, o mesmo do
"Testar envio": se ele estiver desligado, a tela diz que não falou com o
servidor. Pelo terminal da Hostinger, como antes:

```bash
openclaw channels status
```

| O que aparece | O que é | O que fazer |
|---|---|---|
| `health:logged-out`, `status=401 … (conflict)` | o **WhatsApp tirou o aparelho conectado** (removido no celular, WhatsApp reinstalado/trocado, ou derrubado pelo WhatsApp) | ler o QR de novo (abaixo) |
| `health:conflict`, `status=440` | **duas cópias** do OpenClaw no mesmo número | deixar uma só, `openclaw gateway restart` |
| `health:stale` | conectada, mas sem receber | `openclaw gateway restart` |
| `reconnecting` | caiu a internet do servidor | esperar; se não voltar, `openclaw gateway restart` |

**Descobrir a causa de um 401 antes de religar:**

1. No celular da pousada: WhatsApp → **Aparelhos conectados**. Se "openclaw"
   sumiu da lista, perguntar a quem usa o celular se alguém removeu, trocou
   de aparelho ou reinstalou o WhatsApp.
2. No servidor, o log do dia (troque a data):
   ```bash
   grep -n -i "stream errored\|logged out\|device_removed" /tmp/openclaw/openclaw-2026-10-18.log | head -20
   ```
   `type":"device_removed"` = removido (pelo celular ou pelo WhatsApp).

**Religar (um 401 nunca volta sozinho):**

```bash
openclaw channels logout --channel whatsapp
openclaw channels login --channel whatsapp    # QR expira em ~1 min
# celular da pousada: WhatsApp → Aparelhos conectados → Conectar um aparelho
openclaw channels status                      # "linked, running, connected, health:healthy"
```

Depois, de outro celular, mandar "oi" para o número da pousada: ela deve
responder em até 1 minuto. Se o 401 voltar sem ninguém mexer no celular, o
WhatsApp está barrando a conexão não oficial: o caminho é a API oficial do
WhatsApp (Meta), que não cai assim.

## Trocar o número do WhatsApp da Marina

O OpenClaw usa o WhatsApp como aparelho conectado (WhatsApp Web). Desde
17/10/2026 é o número de atendimento da Cecília. No terminal da Hostinger:

```bash
openclaw channels logout --channel whatsapp   # solta o número atual
openclaw channels login --channel whatsapp    # mostra o QR (expira em ~1 min)
# no celular novo: WhatsApp → Aparelhos conectados → Conectar um aparelho
openclaw channels status                      # "linked, running, connected"
```

O aviso "code 515" logo depois de ler o QR é normal. Depois:

- **Dados da pousada → WhatsApp**: o número do botão do site;
- **Equipe responsável**: nenhum contato com o número da Marina (ela mandaria
  o aviso para si mesma). Use "Testar envio" para conferir.

A Marina responde a todas as conversas do número conectado: ele deve ser só
de atendimento.
