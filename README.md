# Pousada Ilha do Mel Marimar — Site + Admin + API

Site oficial com painel administrativo e API para agente de IA (Marina).

## Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS v4
- **Banco:** Neon PostgreSQL + Drizzle ORM
- **Auth:** Auth.js v5 (Credentials + bcrypt)
- **Deploy:** Vercel

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL, AUTH_SECRET, etc
npm run db:migrate
npm run db:seed
npm run db:seed:admin        # defina ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD antes
npm run dev
```

- Site: http://localhost:3000
- Admin: http://admin.localhost:3000/admin

## Scripts

| Comando | Descricao |
|---|---|
| `npm run dev` | Servidor dev |
| `npm run build` | Build prod |
| `npm run db:generate` | Gerar migrations |
| `npm run db:migrate` | Aplicar migrations |
| `npm run db:seed` | Popular banco |
| `npm run db:seed:admin` | Criar usuario master |
| `npm run db:studio` | Drizzle Studio |

## Estrutura

```
src/
  app/(site)/         # Site publico (11 paginas)
  app/(admin)/admin/  # Painel admin (14 CRUDs)
  app/api/            # API (disponibilidade + 7 rotas agente)
  components/admin/   # Componentes reutilizaveis
  db/                 # Schema Drizzle + seed
  lib/                # auth, worker, deeplink, admin-actions
```

## Variaveis de ambiente

Ver `.env.example`. Essenciais: `DATABASE_URL`, `AUTH_SECRET`, `WORKER_BASE_URL`, `WORKER_SLUG`, `AGENT_API_KEY`.

## Documentacao

| Arquivo | Conteudo |
|---|---|
| `docs/ESTADO-DO-PROJETO.md` | **Comece por aqui** — estado, arquitetura, convencoes, pendencias |
| `docs/CHANGELOG.md` | Historico datado de mudancas |
| `docs/runbook.md` | Deploy, env vars, incidentes, rotacao de chave |
| `docs/contrato-api.md` | Contrato do Worker PousadaHub |
| `docs/padrao-crud.md` | Convencoes das telas de admin |
| `docs/openclaw-integracao.md` | Como a Marina consome a API |
| `docs/manual-admin.md` | Manual de uso para a operacao |

> Projeto mantido por multiplas ferramentas de IA agentica. Ao terminar qualquer
> trabalho, registre em `docs/CHANGELOG.md`. Protocolo completo em `AGENTS.md`.
