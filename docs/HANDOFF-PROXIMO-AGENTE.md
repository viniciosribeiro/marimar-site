# Handoff — continuar de onde paramos

> **Atualização operacional: 27/10/2026 — leia esta seção PRIMEIRO.**
> O histórico abaixo, datado de **30/09/2026**, é mantido para auditoria,
> **não** é a lista atual de pendências. Algumas tarefas antigas já foram
> realizadas; verifique o estado real antes de executá-las novamente.

## ESTADO ATUAL — 27/10/2026 (ChatGPT → Claude e outros agentes)

**Preferência explícita do proprietário:** toda mudança, correção, descoberta,
teste, decisão, impedimento e validação humana deve permanecer registrada no
repositório para qualquer agente posterior recuperar **sem depender do histórico
do chat**. Seguir o protocolo em `AGENTS.md` / `CLAUDE.md`; manter este
handoff atualizado em cada entrega. Não confundir **commit/deploy** com
**instalação na Hostinger**, nem **teste técnico** com confirmação de cliente.

### Ambiente e limites

- Código oficial: `viniciosribeiro/marimar-site`, branch `main`.
- Produção: `https://www.pousadamarimarilhadomel.com.br` na Vercel,
  projeto `marimar-site`; funções de disponibilidade em `gru1`.
- Agente Marina: OpenClaw **2026.9.4** na Hostinger; atende via WhatsApp QR
  e pelo gateway integrado ao site. Skill local:
  `/data/.openclaw/workspace/skills/marimar-pousada`.
- Ajustes da **skill** exigem `git pull` e reinstalação no **CLI da
  Hostinger**. Deploy da Vercel não atualiza skill já instalada.
- Nunca modificar preços, regras de reservas, dados, autenticação, canais
  WhatsApp ou configurações de TTS sem necessidade explícita, teste e backup.
  Não registrar neste repositório senha, token, telefone de hóspede, segredo
  de API, transcrições pessoais ou dados de pagamento.

### ALERTA de prioridade — primeiro toque no calendário do iPhone (27/10)
O proprietário confirmou falha **real** ao abrir o calendário pelo botão `Escolher data` no Google Chrome de um iPhone. É intermitente, muitas vezes obriga atualizar; **a correção PR #49 era apenas para o caso de o diálogo fechar na troca dos campos e não deve ser dada como solução desta falha.** No Android dele funciona; automação Chromium desktop não reproduziu. Dois pontos de risco no código motivaram uma segunda correção: (1) `.abertura` com z-index 200 sobre todo o site e sem `pointer-events: none`, possivelmente invisível mas interceptando toque após animação WebKit; (2) ausência de fallback `MediaQueryList.addListener` em `useCelular` para navegadores WebKit antigos. Mitigações implementadas no branch `fix/ios-toque-calendario-overlay-20261027`. O script `testes/e2e-calendario-ios.mjs` exercita 4 recarregamentos por rota em WebKit e Chromium móveis/desktop, mas não substitui teste em iPhone físico. **Validar deploy de produção e solicitar reteste específico de fechar/reabrir a aba no iPhone**; não declarar êxito antes da confirmação. Nenhuma alteração na Marina, preços ou consulta de reservas.

### Entregas recentes e evidências

- **27/10 — RESULTADO DA CORREÇÃO DO CALENDÁRIO:** PR #49 mesclado na `main` (`f0cffe9`); deploy Vercel de produção `dpl_8zaq37MN5gyk7Fc2254xjxmUqZNZ` reportou READY. Teste de navegador no endereço público `/reservar` em desktop passou: abriu calendário, selecionou 28/10 a 02/11, confirmou 5 noites e exibiu datas corretas (sem buscar nem reservar). Evidência: `https://agent.tinyfish.ai/runs/55f446f0-4dc9-4b25-b717-7d733c9074bd`. **Mobile físico e execução automática do E2E em CI ainda não foram comprovados.**
- **27/10 — BUG calendário do site (mobile e desktop):** `SeletorDatas.tsx` fechava o modal se o usuário clicasse em check-in ou check-out enquanto estava aberto, em vez de trocar o foco. Corrigido para chamar `abrir(qual)` sempre; a mesma UI aparece na Home e em `/reservar`. O arquivo `testes/e2e-calendario-abertura.mjs` cobre troca de campo, datas e fechamento em ambas as telas e aparelhos. **Distinguir código implementado, teste efetivamente executado, CI, Vercel publicada e aprovação humana.** Nenhuma alteração de motor de reserva, link de reserva, preços ou skill OpenClaw.



| Área | Entregue e verificado | Limites / pendência |
|---|---|---|
| **Tarifas Marina** | OpenClaw passou a consultar o proxy autenticado `/api/agent/disponibilidade` via Vercel/GRU1, evitando Worker diretamente da Hostinger (HTTP 502). PR #37; consulta pública ao motor validada com preços reais. | Validar sempre a chamada autenticada e preço na conversa real; nunca inventar valor. |
| **Fotos da Marina** | Rota `/api/midia-quarto/[slug]/[indice]`, URLs `url_whatsapp` e instrução de anexar mídia pelo `message`; PRs #38/#40. | Não declarar entrega real de foto confirmada sem observar anexo no WhatsApp. |
| **/reservas privada** | Painel protegido para Cecília, sessão segura, mapa visual, navegação e logout (PR #42). | **Não há fonte autenticada das reservas confirmadas do PMS/ROL Desbravador.** Calendário desconhecido ≠ livre; não inventar hóspedes/dados. |
| **Busca pública /reservar** | Loading com mensagem **“Buscando suas suítes”**, transição GET confiável, rolagem automática suave às suítes e mensagem com quantidade disponível (PRs #43/#44). | **Preservar rigorosamente** carregamento, mensagem, movimento, consulta e preços quando editar UI. |
| **Cards das suítes** | Interface moderna e compacta; **2 colunas no celular**, 3/4 em telas maiores (PR #45). Testado em viewport móvel com 6 suítes reais, valores, links e sem overflow. | Ajustes visuais somente na apresentação dos cards, sem mudar busca, motor, datas e animação. |
| **/saude** | Painel de saúde com Marina visual/interativa e sondas apenas de leitura; arquivos e limites descritos em `docs/saude-marina.md`. | Não tratar como agente autônoma de reparos; evitar ações automáticas sem aprovação. |
| **Contexto/memória Marina** | PR #46: skill preserva referência do quarto entre foto/áudio/pergunta, oculta diagnóstico interno. Proprietário executou script na Hostinger: backup privado, patch validado, sessão isolada por hóspede, `sources:[memory,sessions]`, `visibility:self`; instalação concluída. | **Busca semântica NÃO funciona plenamente**: `openclaw memory status --deep --agent main` mostrou 1/96 arquivos, 0 chunks, 0/93 sessões, provedor `text-embedding-3-small` respondeu **429 / credit_balance_exhausted**. NÃO alegar memória completa, NÃO rodar indexação até resolver créditos/provedor. `dreaming` off é opcional. |
| **Economia de áudio** | PR #47, commit `a682f21`: URL fica no texto, sem ser enviada ao TTS da Vercel/Meta; limitador de fala antes do provedor; skill orienta voz curta no OpenClaw QR. **Proprietário executou `git pull` + reinstalou skill na Hostinger e confirmou por mensagem: “ficou perfeito”**, após teste do WhatsApp. | **Considerar solução de não narrar links aprovada e funcional para o proprietário. NÃO reverter.** Manter mesmo estilo/voz e evitar gerar áudios longos lendo URL. |

### Logs e diagnósticos preservados em nível seguro (sem dados pessoais)

- OpenClaw CLI: `OpenClaw 2026.9.4 (3a9d69d)`.
- Correção de memória: `config.patch` aceito; `openclaw config validate`
  válido; backup na Hostinger sob `/data/.openclaw/backups-marina/`;
  isolamento `session.dmScope=per-channel-peer` e visibilidade
  `tools.sessions.visibility=self` confirmados no terminal.
- A indexação automática apresentou **aviso**, não sucesso; exame profundo
  encontrou cota esgotada na **API OpenAI** para embeddings. A assinatura do
  ChatGPT não cobre os créditos dessa API. Vector/FTS SQLite disponíveis.
  Não apagar SQLite, WAL, arquivos de sessão ou backups.
- Depois da correção de TTS, OpenClaw recebeu o commit `a682f21` e confirmou
  “Installed marimar-pousada from path -> /data/.openclaw/workspace/skills/marimar-pousada”.
  Dois avisos não relacionados: device-pair não habilitado e Gateway
  `loopback`; não abrir `gateway.bind=lan` sem plano de segurança.
- O teste de áudio curto no WhatsApp foi **aprovado pelo proprietário**
  nesta conversa. Não há benchmark de economia de caracteres/créditos
  medido na ElevenLabs; não inventar percentual.

### Prioridades para a próxima sessão

1. **Preservar o que funciona.** Começar pelo `git status`,
   últimos commits, este handoff e changelog. Antes de qualquer edição
   comparar efeitos nas rotas de reserva, no WhatsApp e no áudio.
2. **Memória OpenClaw:** se houver solicitação, resolver a falta de créditos
   do provedor de embeddings (ou avaliar opção local compatível), depois
   indexar e validar a pesquisa sem misturar hóspedes. Configuração da sessão
   já foi aplicada e **não deve ser resetada desnecessariamente**.
3. **Fotos no WhatsApp:** só classificar como funcionamento confirmado após
   ver anexos reais no canal; checar `message(media=...)`.
4. **Reservas confirmadas:** exigir fonte oficial read-only do PMS Desbravador
   e permissão explícita antes de mostrar dados de hóspedes em `/reservas`.
5. **Voz/link:** após modificações futuras, testar que a Marina ainda envia
   URL clicável no texto, fala **somente o essencial** e não soletra link.
   Exemplo: “Enviei o link de reserva, é só tocar nele”.

### Protocolo obrigatório de continuidade entre agentes

Para **cada** tarefa concluída, atualizar, no mesmo conjunto de commits:
`docs/CHANGELOG.md` (o que mudou e por quê), `docs/ESTADO-DO-PROJETO.md`
(status REAL e pendências), **este documento** (resumo para a próxima
sessão), e documentação técnica específica se mudou comportamento.
Registrar data, caminhos, commits/PRs, teste e evidência, o que não foi
testado, procedimento de instalação separado quando houver, e pendências.
Os arquivos `AGENTS.md` e `CLAUDE.md` orientam a leitura.
Se um agente não tiver autorização/acesso ao servidor, dizer
**“preparado no GitHub; pendente instalar na Hostinger”**, jamais declarar
implantado por suposição.

---


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

5. **Escalonamento no OpenClaw real:** migration 0020; liberar a ferramenta
   `message` no OpenClaw (`tools.alsoAllow`, ver `docs/runbook.md`, "Liberar a
   ferramenta de mensagens" — o perfil padrão `coding` não a inclui e o
   `/tools/invoke` dá 404); reinstalar a skill; "Testar envio" deve mostrar
   "✓ O WhatsApp confirmou a entrega (mensagem <id>)". Depois simular:
   pergunta desconhecida → aviso chega à equipe → resposta → cliente recebe →
   Marina pergunta "posso guardar?" → SIM/NÃO/versão nova. Agendador de 5
   min para `/api/cron/chamados`. O código do OpenClaw pode ser lido sem
   rede de produção: `npm pack openclaw` e procurar em `package/dist`
   (`message-action-runner-*.js`, `tools-invoke-shared-*.js`).

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
