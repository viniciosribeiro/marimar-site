# Contrato da API — Worker PousadaHub

**Data:** 14/09/2026  
**Endpoint:** `GET https://pousadahub.viniciosribeiro.workers.dev/tarifas`  
**Slug correto:** `pousada-ilha-do-mel-marimar` (⚠️ não é `marimar`)

---

## Resposta (campos de topo)

| Campo | Tipo | Exemplo | Obrigatório | Observação |
|---|---|---|---|---|
| `hotel` | string | `"pousada-ilha-do-mel-marimar"` | ✅ | Slug completo da propriedade |
| `check_in` | string | `"2026-10-15"` | ✅ | ISO 8601 |
| `check_out` | string | `"2026-10-17"` | ✅ | ISO 8601 |
| `adultos` | number | `2` | ✅ | |
| `criancas` | number | `0` | ✅ | |
| `noites` | number | `2` | ✅ | Calculado |
| `quartos[]` | array | `[{...}, ...]` | ✅ | Disponíveis (7 no teste) |
| `indisponiveis[]` | array | `[{...}, ...]` | ✅ | Sem estoque (3 no teste) |
| `politica_crianca` | object | `{...}` | ✅ | Config do motor |
| `aviso_crianca` | string | `"Faixas etarias..."` | ✅ | Vazio se OK |
| `total_disponiveis` | number | `7` | ✅ | Contagem de tipos de quarto |
| `unidades_totais_disponiveis` | number | `19` | ✅ | Soma das unidades |

---

## Schema de cada quarto (dentro de `quartos[]` e `indisponiveis[]`)

| Campo | Tipo | Exemplo | Obrigatório | Observação |
|---|---|---|---|---|
| `id` | string | `"MRFAM"` | ✅ | Sigla do quarto no Desbravador |
| `nome` | string | `"FAMILIA"` | ✅ | Nome curto de exibição |
| `categoria` | string | `"A Suíte Família foi planejada..."` | ✅ | Descrição longa (sim, o campo chama categoria mas é texto) |
| `diaria` | number | `470` | ✅ | Diária em BRL (média do período) |
| `total` | number | `940` | ✅ | Total do período (adultos) |
| `total_criancas` | number | `0` | ✅ | Soma das tarifas de crianças |
| `total_geral` | number | `940` | ✅ | Total geral (adultos + crianças) |
| `noites` | number | `2` | ✅ | Igual ao topo |
| `valor_adulto` | number | `390` | ✅ | Diária por adulto |
| `valor_crianca` | number | `195` | ✅ | Valor base por criança (varia por noite) |
| `valor_crianca_max` | number | `275` | ✅ | Valor máximo por criança |
| `crianca_valor_variavel` | boolean | `true` | ✅ | Se o valor da criança muda por noite |
| `crianca_por_noite` | number[] | `[195,275]` | ✅ | Array com valor de criança por noite |
| `ocupacao_max` | number | `4` | ✅ | Ocupação máxima do quarto |
| `ocupacao_min` | number | `1` | ✅ | Ocupação mínima |
| `cabe_hospedes` | boolean | `true` | ✅ | Se os hóspedes cabem no quarto |
| `pacote` | string | `"Tarifa Online Melhor preço..."` | ✅ | Nome do regime/pacote (string única) |
| `comodidades` | string[] | `["Ar","Wifi","TV",...]` | ✅ | Lista de comodidades reais do motor |
| `fotos` | string[] | `["https://...jpeg",...]` | ✅ | URLs reais das fotos no Desbravador |
| `disponivel` | boolean | `true` | ✅ | |
| `unidades_disponiveis` | number | `1` | ✅ | Quantas unidades deste tipo estão livres |
| `disponibilidade_por_noite` | object | `{"15/10/2026":1,...}` | ✅ | Estoque por data (dd/MM/yyyy) |
| `noites_com_estoque` | number | `2` | ✅ | Em quantas noites há estoque |
| `noites_solicitadas` | number | `2` | ✅ | Noites totais pedidas |
| `estadia_minima` | number | `2` | ✅ | Mínimo de noites exigido |
| `estadia_maxima` | number | `28` | ✅ | Máximo de noites |
| `motivo_indisponivel` | string? | `"esgotado no periodo"` | ❌ | Só presente nos indisponíveis |

---

## Como o Worker sinaliza cada estado

### Disponibilidade normal
```json
{ "total_disponiveis": 7, "quartos": [{ "disponivel": true, ... }] }
```

### Indisponível (esgotado)
```json
{ "indisponiveis": [{ "disponivel": false, "motivo_indisponivel": "esgotado no periodo", ... }] }
```

### Slug errado / hotel não encontrado
Provável: `"quartos": [], "indisponiveis": [], "total_disponiveis": 0` sem mensagem de erro (comportamento observado com slug `marimar`)

### Erro no motor
Provável: HTTP 200 com `"quartos": []` e sem mensagem (degradação silenciosa)

---

## Quartos mapeados (15-17/Out/2026)

| Sigla | Nome | Diária | Ocup. | Disponível |
|---|---|---|---|---|
| MRFAM | FAMILIA | R$ 470 | 4 | ✅ (1 unidade) |
| FAM | STANDARD FAMILIA | R$ 485 | 4 | ✅ (11 unidades) |
| CASAL | CASAL STANDARD | R$ 520 | 2 | ✅ (1 unidade) |
| KING | SUITE KING | R$ 550 | 2 | ✅ (2 unidades) |
| QUEEN | SUITE QUEEN | R$ 550 | 2 | ✅ (2 unidades) |
| KGTR | KING REDE | R$ 595 | 3 | ✅ (1 unidade) |
| HIDRO | SUITE LUA DE MEL | R$ 1.050 | 2 | ✅ (1 unidade) |
| SR | SUITE REDE | R$ 550 | 2 | ❌ (esgotado) |
| QDRPL | STANDARD QUADRUPLO | R$ 470 | 4 | ❌ (esgotado) |
| TRIPL | STANDARD TRIPLO | R$ 485 | 3 | ❌ (esgotado) |

**Total: 10 tipos de quarto, 7 disponíveis, 19 unidades totais.**

---

## Política de crianças

- `faixas_configuradas: false` — motor não tem faixas configuradas
- `tarifa_diferenciada: true` — mas usa valor por criança direto
- Os valores reais vêm em `valor_crianca`, `crianca_por_noite[]` e `valor_crianca_max`
- **Recomendação:** usar os valores que o motor retorna (`crianca_por_noite[]`), não calcular localmente

---

## Comodidades e fotos

⚠️ **Diferente do esperado no spec original:** ambos vêm PREENCHIDOS pelo motor!  
- `comodidades[]`: array de strings ("Ar", "Wifi", "TV", "Smart TV", "Frigobar", etc.)  
- `fotos[]`: array de URLs reais (jpg/jpeg no CDN do Desbravador)

O banco local pode complementar, mas o motor já entrega esses dados.