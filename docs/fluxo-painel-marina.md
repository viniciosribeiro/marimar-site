# Fluxo painel → Marina

> Criado em 30/09/2026. Leia antes de mexer em `src/lib/marina.ts`, nas rotas
> `/api/agent/*`, em `/api/chat` ou na tela `/admin/marina`.

Como o que a Cecília ensina no painel chega à Marina, nos dois canais — e
como provar que chegou.

## O caminho, em uma figura

```
 Painel /admin/marina ──(Server Action, exigirSessao)──► Postgres (Neon)
                                                           │
     marina_conhecimento  (itens: fato, pergunta, limite, escalar)
     marina_config        (voz, tom, escalonamento)
     marina_documentos    (texto extraído dos arquivos)
     marina_historico     (antes/depois de toda mudança)
     marina_leituras      (quando cada canal leu pela última vez)
     marina_lacunas       (perguntas que ela não soube)
                                                           │
             ┌─────────────────────────────────────────────┴───────────────┐
             ▼                                                             ▼
  CHAT DO SITE (/api/chat)                                    WHATSAPP (OpenClaw, Hostinger)
  a cada mensagem:                                            a cada conversa (skill marimar-pousada):
  montarTreinamento(sql,"site")                               GET /api/agent/conhecimento
  → mensagem de sistema                                        → mesmo texto (ensinamentosEmTexto)
  → gateway OpenClaw /v1/chat/completions                      → registra leitura "whatsapp"
  → registra leitura "site"
  → se a resposta for "não sei", grava lacuna                  → se não souber: POST /api/agent/lacuna
```

**Não há cache em nenhum ponto.** As rotas são `force-dynamic`, o texto é
montado a cada leitura. Salvou no painel → a próxima mensagem do site já usa;
o WhatsApp usa a partir da próxima vez que a skill ler a rota (início de cada
conversa, pela instrução da skill).

## O texto que a Marina recebe

Montado por `ensinamentosEmTexto()` em `src/lib/marina.ts`, na ordem:

1. `COMO FALAR` — `marina_config.tom`
2. `PRIORIDADE` — a regra de que o treinamento vale mais que qualquer outra
   fonte (inclusive o que ela já disse na conversa). Preço e vaga continuam
   vindo só do motor, mas instruções de como montar a consulta valem.
3. `O QUE A POUSADA ENSINOU` — itens `fato`, agrupados por categoria
4. `PERGUNTAS E RESPOSTAS OFICIAIS` — itens `pergunta`, com as variações
5. `O QUE VOCÊ NUNCA DIZ` — itens `limite`
6. `QUANDO PASSAR PARA UMA PESSOA` — `marina_config.escalonamento` + itens `escalar`
7. `DOCUMENTOS` — o trecho inicial de cada documento pronto e ativo, com as
   instruções para abrir inteiro (`?id=`) ou buscar (`?busca=`)

Só entra o que está **ativo e fora da lixeira** (`lerEnsinamentos`). O painel
lê por outra função (`lerTreinamento`), que traz tudo — inclusive desligados
e lixeira. Até 29/09 as duas eram a mesma, e desligar um item o fazia sumir
do painel sem jeito de religar.

## Status por item (o que o painel mostra)

`situacaoItem()` em `src/lib/marina-base.ts`:

| Status | Quando |
|---|---|
| **Em uso** | ativo, e a última leitura do WhatsApp é posterior à última alteração |
| **Salvo · aguardando WhatsApp** | ativo, alterado depois da última leitura do WhatsApp (no site já vale) |
| **Revisar** | o teste automático do item falhou |
| **Desligado** | guardado, a Marina não usa |
| **Na lixeira** | idem, restaurável |

"Em uso" é verdade comprovada, não suposição: depende da rota ter sido lida.
Se o WhatsApp **nunca** lê (visão geral avisa), a skill instalada no OpenClaw
está desatualizada ou sem `MARIMAR_API_KEY` — ver `agente/README.md`.

## Provar que funciona

### No painel (produção)
Aba **Testar** do módulo Marina: conversa com a mesma Marina, pelo mesmo
gateway e o mesmo texto do chat do site. A diferença: os itens vão com um
código (`#a1b2c3`) e a Marina é pedida a listar os que usou (`FONTES:`), o que
o painel mostra como "Usou: …". Cada conversa de teste tem sessão nova — a
Marina guarda memória por conversa, e testar numa conversa antiga mistura o
que ela disse antes do treino com o treino novo.

Botão **Testar** em cada item (ou **Testar lista**): faz a pergunta do item e
grava `verificacao = ok | falhou` no item.

### Local (sem tocar produção)
```bash
# 1. Postgres local e migrations (ver "Banco novo do zero" abaixo)
# 2. gateway simulado — responde com o que recebeu no sistema
OPENCLAW_GATEWAY_TOKEN=token-teste node testes/gateway-simulado.mjs
# 3. site apontando para ele
OPENCLAW_GATEWAY_URL=http://localhost:4010 OPENCLAW_GATEWAY_TOKEN=token-teste \
  AGENT_API_KEY=chave-local-teste DATABASE_URL=... npm run dev
# 4. teste ponta a ponta pela interface (12 verificações)
BASE=http://localhost:3000 EMAIL=... SENHA=... AGENT_API_KEY=chave-local-teste \
  node testes/e2e-marina.mjs
```
Resultado em 30/09/2026: 12/12 (ensinar, rota do WhatsApp sem cache, chat do
site, área de teste com fonte, desligar sem sumir, religar, histórico,
restaurar versão, lixeira fora da Marina).

**Nunca rode o e2e contra produção**: ele cria itens de treinamento.

## Onde cada coisa é gravada

| Ação no painel | Onde | Código |
|---|---|---|
| Ensinar / editar item | `marina_conhecimento` + `marina_historico` | `marina/actions.ts` `salvarItem` |
| Ligar / desligar / lixeira / restaurar | idem | `ligarItem`, `desligarItem`, `excluirItem`, `restaurarItem` |
| Voltar a uma versão | aplica o `depois` da entrada do histórico | `voltarVersao` |
| Jeito de falar, escalonamento | `marina_config` | `salvarPersonalidade` |
| Voz | `marina_config` + `config.set` no OpenClaw (WhatsApp) | `salvarVoz`, `lib/openclaw-config.ts` |
| Documento | Vercel Blob + `marina_documentos` | `/api/admin/marina/documento` |
| Corrigir resposta de conversa | `chat_mensagens.correcao` + item `pergunta` | `corrigirResposta` |
| Responder pergunta sem resposta | item `pergunta` + `marina_lacunas.status='resolvida'` | `salvarItem` com `lacuna_id` |

## Armadilhas conhecidas

- **Mudou a skill (`agente/skills/marimar-pousada/SKILL.md`)? Reinstale no
  OpenClaw.** O que vale para o hóspede é o que está instalado, não o git.
  Comando em `agente/README.md`. A mudança de 30/09 (ler o treinamento em
  toda conversa, inclusive de preço, e registrar lacunas) **só vale no
  WhatsApp depois da reinstalação**.
- **Memória por conversa.** A Marina do WhatsApp lembra o que disse a cada
  número. Depois de ensinar algo que contradiz uma resposta antiga, a
  conversa antiga pode repetir o erro até a Marina reler o treinamento. A
  regra de prioridade manda ela se corrigir; para testar, use um número novo
  ou a aba Testar.
- **Preço é do motor.** Ensinar "criança paga como adulto" não muda o preço
  que o Desbravador calcula; muda como a Marina monta a consulta (conta a
  criança como adulto). Se o motor cobrar diferente, o preço mostrado
  seguirá o motor — alinhar a tarifa no Desbravador é com a pousada.
- **Banco novo do zero:** `npm run db:migrate` falha na 0014 num banco vazio
  (enum `tipo_bloco` ganha valor na 0002 e é usado na 0014 na mesma
  transação). Em produção não acontece (as migrations rodaram em momentos
  diferentes). Para banco local: aplicar até a 0002, depois o resto — ver
  `docs/HANDOFF-PROXIMO-AGENTE.md`.
