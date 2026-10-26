# /saude — Escritorio da Marina (status publico)

**Data:** 26/10/2026
**Escopo:** pagina isolada, publico, somente leitura. Nenhuma modificacao no site atual, banco, reservas, menus, autenticacao, integracoes ou configuracoes.
**Autores:** ChatGPT, com diretrizes de interface aprovadas pelo proprietario; handoff para Claude.

## O que foi implementado

- `src/app/saude/page.tsx`: rota publica independente, no mesmo app Next.js. Fora do grupo `(site)` para isolar interface e impedir acoplamento ao menu, ao rodape e ao chat existente. Continua sob o layout raiz do projeto.
- `src/app/saude/SaudePainel.tsx`: React client-side, robo Marina simples em SVG/CSS, movimento em rondas, escritorio 2.5D responsivo, 20 servicos reais mapeados, filtros, navegacao, detalhes de dependencia, indicadores de leitura e incidentes simulados.
- `src/app/saude/saude.module.css`: estilos CSS Modules exclusivos, sem alterar tokens ou folha global.
- `src/app/api/saude/status/route.ts`: API GET publica, estritamente read-only, sem chaves ou nomes internos na resposta.

## O que e REAL nesta primeira versao

- Site e API: sucesso da propria chamada GET de saude, **nao** teste ponta-a-ponta de todas as paginas.
- Cloudflare Worker PousadaHub: resposta HTTP da raiz, timeout 5 s.
- Desbravador: consulta de disponibilidade/tarifa **somente leitura**, pela funcao `fetchTarifas` existente, para 2 adultos em periodo futuro de 2 noites; timeout de 16 s. Nenhuma reserva ou alteracao de estoque e feita.
- Banco Neon: `SELECT 1` com conexao dedicada, limitada e sempre encerrada. Nenhuma migration, update, delete ou insert.
- Resultado por servico: online, atencao, offline ou nao_verificado. Se falta variavel de ambiente, mostrar NAO VERIFICADO e nao verde.
- Cache de 5 min na CDN + memoria por instancia para limitar consultas em massa. A sondagem e publica e deve ter protecao adicional se ocorrer uso abusivo.

## O que ainda NAO e monitorado de verdade

OpenClaw, estado do WhatsApp, token/voz da ElevenLabs, integracao Meta, fontes de mapas, cron/vigia, autenticação, armazenamento Blob, DNS/SSL (validade e expiracao), reunioes de analytics, pessoas conectadas, geolocalizacao, incidentes de meses anteriores, uptime/SLAs. Esses modulos sao catalogados e aparecem como `Sem sonda` ate integrações seguras estarem disponiveis.

Marina animada e visual (nao e um agente autonomo de observabilidade ainda). Aprovar/rejeitar ações opera apenas no React local: nao chama API, nao executa reparo. Nenhum dado persistente e gravado. Graficos de trafego e latencia sao **ilustrativos**. Sem percentuais ficticios de disponibilidade. Informações de visitantes (idade/genero) nao podem ser inferidas por IP; usar somente agregados legalmente obtidos e autorizados, observando LGPD.

## Limites de seguranca obrigatorios ao evoluir

- Nunca disponibilizar `DATABASE_URL`, `AGENT_API_KEY`, `OPENCLAW_GATEWAY_TOKEN`, outros segredos ou stack traces publicamente.
- Nao tornar `/api/agent/*`, `/api/cron/chamados` ou métodos de administracao publicos.
- Sondas autenticadas e historico de incidentes devem residir em area privada, protegida por sessao de Administracao, com trilha de auditoria e politica de retencao.
- Toda automacao corretiva deve produzir **proposta com evidencia**, exigir autorizacao do administrador, ter politica de menor privilegio, operacao limitada, verificacao pos-acao e plano de reversao.
- Nao misturar queda de servico com inexistencia de vagas: resposta valida do motor com `total_disponiveis = 0` nao indica falha.
- Manter `gru1` em `vercel.json`, pois o motor Desbravador apresentou erros geograficos pela regiao EUA. Nao mexer na regiao neste trabalho.

## Verificacao e aceite

1. Build do branch preview deve estar READY, com `/saude` HTTP 200.
2. `/api/saude/status` responde JSON com timestamps e `servicos`, sem segredos, sem resposta de banco completa, sem dados pessoais.
3. No preview, se `DATABASE_URL` e `WORKER_BASE_URL` nao estiverem configuradas, sondas externas devem aparecer como nao_verificado; nao tentar bancos locais `127.0.0.1`.
4. Conferir `/`, `/reservar` e `/api/disponibilidade` da producao **antes e depois** do deploy. Registrar qualquer regressao.
5. Abrir `/saude` em desktop e celular; clicar em modulos, pausar/reiniciar ronda, simular queda, ver aprovacao DEMO e restaurar, navegar para catalogo e historico.
6. Nao executar tests E2E que escrevem banco, criam reservas, enviam mensagens ou disparam webhooks em producao.

## Continuacao recomendada para Claude

Implantar coletores em job agendado com credenciais somente de leitura, armazenamento de serie temporal e calculo de incidentes (inicio/fim, duracao e impacto) antes de chamar indicadores de uptime de "reais". Vincular analiticos agregados a provedor autorizado sem identificar clientes. Criar /admin/saude protegido se houver funcoes de administracao, mantendo /saude publica sanitizada.

## Revisão V2 — 26/10/2026: painel organizado, Marina expressiva e sondas reais

**Objetivo:** pedido explícito do proprietário para ATUALIZAR /saude no site, não gerar imagem. Página anterior preservada em `SaudePainel.tsx` (não mais utilizada); nova versão `SaudeV2.tsx` com estilos isolados em `saude-v2.module.css`. Apenas `src/app/saude/page.tsx` passa a renderizar o novo componente. Nada foi modificado em `(site)`, reservas, gateway, autenticação, regras comerciais ou migrations.

### Navegação e visual

- Cabeçalho sintético, cinco indicadores calculados das leituras reais, central organizada com quatro telas (Visão geral, Sondas, Incidentes desta sessão, Dependências) e atalhos explícitos por serviço.
- Escritório visual 2.5D em CSS: 12 nós clicáveis e catalogação de 20 serviços; filtro pesquisável e modal de detalhes da sonda.
- Robô Marina criado em SVG com cabeça móvel, olhos e boca variáveis (sorriso, preocupação e curiosidade), braços, pernas e caminhada; pausa da ronda, reação ao status e acessibilidade de teclado.
- Removedores de confusão: **sem** contadores inventados de usuários online, disponibilidade de 30 dias, CPU, memória, incidentes históricos ou sucesso de backup.
- **Nenhum botão de ação corretiva**. Sem envios, reinícios, alterações, pagamentos, reservas ou scripts. O usuário só consulta e navega.

### Operações de leitura agregadas em /api/saude/status

1. Site: GET / no domínio principal; API: GET /api/saude/status respondendo.
2. Cloudflare Worker: GET na raiz configurada de PousadaHub; Desbravador: chamada existente de consulta de tarifas futuras, apenas leitura, dois adultos, duas noites, timeout 16 s. Zero quartos disponíveis NÃO é falha.
3. Neon: SQL `SELECT 1`; regras `SELECT id FROM regras_hospedagem LIMIT 1`; treinamento Marina `SELECT id FROM marina_config LIMIT 1`; mídias `SELECT id FROM midias LIMIT 1`; chat ativo `SELECT chat_ativo FROM pousada LIMIT 1`.
4. Vigia do WhatsApp: leitura de `integracoes.wa_vigia`, checando `ultimaVez` para recência de 25 minutos; **não** invoca `vigiarWhatsapp` (mutável).
5. Gateway OpenClaw: somente método **`channels.status`** do RPC autenticado. WhatsApp: parse de `lerSaude()`, sem mostrar número, QR, token ou mensagem. Não chamar métodos de reconexão.
6. ElevenLabs: GET autenticado `/v1/user` (não sintetiza voz, não consome créditos de TTS); responde apenas estado, sem conta ou dados privados.
7. Vercel Blob: `list({limit:1})` (sem escrita); mapa: GET do estilo padrão OpenFreeMap.
8. DNS: `lookup` do hostname oficial; HTTPS/TLS: GET protegido do domínio; autenticação: apenas carregamento da página pública de login, NÃO teste de login ou permissão.

Todos os demais serviços sem método que prove o status de forma segura permanecem como **não verificados**. Particularmente avisos externos e webhooks não podem ser provados sem enviar mensagens/eventos. SSL verde prova o handshake HTTPS, não a data de vencimento de cada certificado. Login verde prova carregamento do formulário, não autenticação com credenciais. Marina no site verde prova flag de chat ativa no banco, **não** uma resposta real da IA.

### Robustez e limites

- GET endpoint público com CDN cache de 300s e cache in-memory por instância. Respostas não incluem segredos nem payloads brutos. As sondas limitam cada chamada, e erro isolado não deve derrubar o painel.
- Sondas externas autenticadas usam variáveis presentes apenas no servidor, jamais enviadas ao browser.
- Preview Vercel não tem `DATABASE_URL`, `WORKER_BASE_URL` ou `WORKER_SLUG` de produção: estado deve ser `não verificado`, não vermelho fictício.
- O histórico de incidentes é **somente desta aba aberta**, calculado a partir das mudanças observadas a cada nova sondagem; não representa uptime de 30 dias. Para histórico verdadeiro usar agendador separado com persistência, proteção da API e retenção definida.
- Monitoria automática não é agente autônomo: Marina na tela é um assistente visual de navegação e resumo. Qualquer futuro reparo precisa de rota administrativa autenticada, aprovação explícita e auditoria.
- Em caso de telemetria externa indisponível, evitar expor IDs, IPs, telefones, chaves, stack traces, configuração do servidor ou logs de clientes.
