# Integração com OpenClaw — Agente Marina

## Visão Geral

A Marina é o agente de IA que atende no WhatsApp e Instagram da pousada. Ela roda no OpenClaw (Hostinger) e consome a API deste projeto para responder perguntas.

## URLs da API

Base: `https://www.pousadamarimarilhadomel.com.br`

Todas as rotas exigem header:
```
Authorization: Bearer marina-agent-key-marimar-2026
```

## Rotas disponíveis

| Rota | Descrição | Exemplo |
|---|---|---|
| `GET /api/agent/pousada` | Dados da pousada, contatos, politicas | `curl -H "Authorization: Bearer ..." /api/agent/pousada` |
| `GET /api/agent/quartos` | Catálogo completo de quartos | Lista com nomes, descrições, ocupação |
| `GET /api/agent/disponibilidade?check_in=...&check_out=...&adultos=2` | Disponibilidade em tempo real | Retorna preços do motor Desbravador |
| `GET /api/agent/pacotes` | Pacotes ativos | Lista de pacotes vigentes |
| `GET /api/agent/faq` | FAQ visível para o agente | Perguntas marcadas "visivel_agente=true" |
| `POST /api/agent/lead` | Registrar lead do WhatsApp | `{ "nome": "...", "telefone": "...", "email": "...", "mensagem": "..." }` |
| `GET /api/agent/openapi` | Especificação OpenAPI 3.1 | Documentação completa para o OpenClaw |

## Resposta padrão

```json
{
  "ok": true,
  "dados": { ... },
  "resumo_texto": "Texto pronto para WhatsApp com emojis e formatação",
  "fonte": "worker | local",
  "consultado_em": "2026-09-17T10:00:00-03:00"
}
```

## Mapeamento de intenções

| Pergunta do hóspede | Rota |
|---|---|
| "Tem vaga pro feriado?" | `/api/agent/disponibilidade` |
| "Quanto custa a Suíte King?" | `/api/agent/quartos` + `/api/agent/disponibilidade` |
| "Aceita pet?" | `/api/agent/pousada` (campo politicas.pet) |
| "Como chegar?" | `/api/agent/pousada` (campo como_chegar) |
| "Tem pacote romantico?" | `/api/agent/pacotes` |
| "Qual o horario de checkout?" | `/api/agent/faq` ou `/api/agent/pousada` |

## Configuração no OpenClaw

No painel do OpenClaw, configure uma **Custom API Tool**:

1. **Nome:** `consultar-pousada-marimar`
2. **URL Base:** `https://www.pousadamarimarilhadomel.com.br/api/agent`
3. **Header:** `Authorization: Bearer marina-agent-key-marimar-2026`
4. **Endpoints:**
   - `GET /pousada` → dados gerais
   - `GET /quartos` → catálogo
   - `GET /disponibilidade?check_in={data}&check_out={data}&adultos={n}` → preços
   - `GET /faq` → perguntas frequentes
   - `POST /lead` → registrar contato

5. **Prompt do agente:**
```
Você é a Marina, assistente virtual da Pousada Marimar na Ilha do Mel (PR).
Use as ferramentas da API para consultar preços, disponibilidade e informações.
NUNCA invente preços ou quartos — sempre consulte a API.
Se a API falhar, diga "Vou consultar a disponibilidade com a equipe e retorno em instantes".
```

## Chave da API

**Atual:** `marina-agent-key-marimar-2026`

Para rotacionar: Admin → Integrações → AGENT_API_KEY → Gerar nova.