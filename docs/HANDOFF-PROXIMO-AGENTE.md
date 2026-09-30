# Handoff — continuar de onde paramos

> Atualizado em 30/09/2026, ao fim da sessão que reestruturou o treinamento da
> Marina e redesenhou o painel. Cole a seção **PROMPT** em qualquer ferramenta
> agêntica para retomar.

---

## PROMPT

Você vai continuar o site da Pousada Marimar (Ilha do Mel/PR): Next.js 16 +
Postgres (Neon) + Vercel, com a agente Marina no OpenClaw (WhatsApp e chat do
site). Repositório: `viniciosribeiro/marimar-site`. Pasta local do Vinicios:
`D:\Dev\Marimar Site` (a pasta `D:\Dev\marimar-site`, com hífen, era um
rascunho antigo sem ligação com o GitHub e foi apagada em 29/09).

### 1. Leia antes de mexer

1. `AGENTS.md` (o Next.js 16 tem mudanças; leia `node_modules/next/dist/docs/`)
2. `docs/ESTADO-DO-PROJETO.md` — visão geral e pendências
3. `docs/CHANGELOG.md` — a entrada de 30/09 explica o que mudou e por quê
4. `docs/fluxo-painel-marina.md` — antes de tocar em Marina, `/api/agent/*` ou `/api/chat`
5. `docs/design-system-admin.md` — antes de criar ou mudar tela do painel
5b. `docs/fluxo-midia.md` — antes de mexer em fotos, vídeos, upload ou roteiros
5c. `docs/fluxo-escalonamento.md` — antes de mexer em chamados, equipe, aprendizado ou Cérebro
5d. `docs/fluxo-rota.md` — antes de mexer no mapa/rota de Como chegar (MapLibre 6, worker copiado no prebuild)
6. `git log --oneline -15` e `git status`

### 2. O que ficou pendente do dia 30/09 (fazer primeiro)

Nada disso pôde ser feito do ambiente em que o trabalho foi feito (rede sem
acesso à produção e sem credenciais):

1. **Migrations até a 0019** em produção: `npm run db:migrate` (só acrescentam
   colunas e tabelas; o código antigo continua funcionando sobre elas).
2. **Reinstalar a skill no OpenClaw** (Hostinger), senão o WhatsApp segue com
   a skill antiga, que não lê o treinamento em pergunta de preço:
   ```
   cd marimar-site && git pull
   openclaw skills install ./agente/skills/marimar-pousada --force
   ```
3. **Teste real:** em `/admin/marina` → Visão geral, confirmar que o WhatsApp
   "leu agora há pouco". Ensinar um item de teste, perguntar na aba **Testar**
   e por um número de WhatsApp que nunca falou com a Marina; conferir que a
   resposta usa o item e que preço e vaga continuam vindo do motor. Apagar o
   item de teste depois (Excluir → Lixeira → Apagar de vez).

4. **Mídia em aparelho real** (a nuvem não tem H.264): iPhone e Android —
   foto HEIC, vídeo pela câmera, selo "WhatsApp ok" na biblioteca; um roteiro
   em Marina → Mídias de orientação e "como chego?" no WhatsApp.

5. **Escalonamento no OpenClaw real:** cadastrar a equipe em `/admin/equipe`,
   "Testar envio" (confirma o método `send` do RPC; se falhar, ajustar
   `OPENCLAW_ENVIO`; o RPC de administração não aceita `send`), ligar, e simular: pergunta desconhecida no
   WhatsApp → mensagem chega à equipe → resposta citando → cliente recebe.
   Agendador de 5 min para `/api/cron/chamados`.

6. **Rota com os serviços reais:** abrir `/como-chegar` num celular com 4G
   (OpenFreeMap, OSRM e Photon só foram testados com `testes/mapa-simulado.mjs`).
   Conferir no console que `/vendor/maplibre/maplibre-gl-worker.mjs` carrega
   (sem ele o mapa fica em branco). Em `/admin/rota`, acertar trapiche e
   terminais e marcar "Conferi os pontos".

### 3. Como testar localmente (sem tocar produção)

```bash
# Postgres local (qualquer um). Banco NOVO: a 0014 falha se aplicada na mesma
# transação que a 0002 (enum). Aplique em duas etapas:
#   1) copie drizzle/ para uma pasta temporária, deixe só as 3 primeiras
#      entradas em meta/_journal.json e rode o migrator nela;
#   2) rode npm run db:migrate normalmente.
npm run db:seed
ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=<12+ caracteres> npm run db:seed:admin

OPENCLAW_GATEWAY_TOKEN=token-teste node testes/gateway-simulado.mjs   # porta 4010
OPENCLAW_GATEWAY_URL=http://localhost:4010 OPENCLAW_GATEWAY_TOKEN=token-teste \
  AGENT_API_KEY=chave-local-teste AUTH_SECRET=... AUTH_URL=http://localhost:3000 \
  AUTH_TRUST_HOST=true DATABASE_URL=... npm run dev

npm test                                  # unitários
EMAIL=... SENHA=... node testes/e2e-marina.mjs   # 12 verificações pela interface
DATABASE_URL=<LOCAL> AGENT_API_KEY=... npm run test:e2e:escalonamento   # 38 verificações (apaga equipe/chamados)
LARGURAS=375,768,1024,1280,1440 SAIDA=capturas node testes/capturas.mjs   # telas + rolagem horizontal
node testes/mapa-simulado.mjs &           # porta 4020; aponte a rota do banco para ele (docs/fluxo-rota.md)
SAIDA=capturas node testes/e2e-rota.mjs   # computador, iPhone com GPS, Android, painel Rota e mapa
```
`testes/*.mjs` usam Playwright (não está no package.json; no ambiente em nuvem
ele vem instalado globalmente — ligue com `ln -s $(npm root -g)/playwright node_modules/`).

### 4. Próximos passos sugeridos (em ordem)

1. **Redesenhar o miolo das telas grandes** que só receberam cores e cabeçalho:
   cardápio, banners, cartões, blocos da home, identidade visual (a de
   fotos já foi refeita como biblioteca de mídia).
   Usar `Cartao`, `Lista`, `JanelaRota`, `useAcao` (ver design system).
2. **Conversas do WhatsApp no painel** — hoje só as do site aparecem. Ver o que
   o gateway do OpenClaw expõe.
3. **Segurança pendente** — limite de tentativas de login por IP e limite de
   envios no formulário de contato (`docs/CHANGELOG-IA.md`, seção 5).
4. **Fonte única para crianças** — a regra existe em Políticas
   (`politicas.criancas_texto`) e pode existir no treinamento. O treinamento
   tem prioridade, mas o ideal é a tela de Políticas avisar quando há item de
   treinamento sobre o mesmo assunto.
5. **Criar/redefinir usuário pelo painel** — hoje só por script.
6. Corrigir a 0014 para banco novo (sem alterar a de produção: nova migration
   idempotente ou documentar o baseline).

### Regras que não mudam

- Nunca commitar segredos; nunca reintroduzir Cloudflare/wrangler; o site não
  fecha reserva; falhe fechado quando faltar env var.
- Toda Server Action do admin começa com `await exigirSessao()`.
- Ao terminar: entrada no topo do `docs/CHANGELOG.md`, pendências e data em
  `docs/ESTADO-DO-PROJETO.md`, commit.
