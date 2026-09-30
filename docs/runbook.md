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
