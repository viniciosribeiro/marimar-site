# Runbook — Pousada Marimar

## Worker offline
O site continua no ar mostrando catalogo sem precos + CTA WhatsApp.
Verifique `https://pousadahub.viniciosribeiro.workers.dev/`.

## Preco errado
Admin → Diagnostic → Testar Worker → compare JSON com site.
Force atualizacao de cache se necessario.

## Reset senha admin
```sql
UPDATE usuarios SET senha_hash = crypt('SenhaTemp123', gen_salt('bf',12)), must_reset = true, tentativas_falhas = 0, bloqueado_ate = NULL WHERE email = 'cecilia@...';
```

## Rotacionar AGENT_API_KEY
Admin → Integracoes → Gerar nova chave. Atualize no OpenClaw.

## Deploy
```bash
npm run build
npx wrangler pages deploy .next
```