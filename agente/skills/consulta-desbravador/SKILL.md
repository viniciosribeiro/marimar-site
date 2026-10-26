---
name: consulta-desbravador
description: Consulta disponibilidade e valores reais ao vivo pela API autenticada da Marimar na Vercel (região São Paulo), com link oficial de reserva e regra de crianças e bebês.
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

# Consulta ao vivo - Pousada Marimar

Use SEMPRE que o cliente perguntar vaga, disponibilidade, valor, preço,
"tem quarto", "quanto fica", ou quiser reservar. Consulte em tempo real
pela rota autenticada `/api/agent/disponibilidade` do site da Marimar, que
encaminha ao motor pela Vercel em São Paulo. NÃO consulte diretamente o Worker
Cloudflare pela Hostinger: este caminho pode retornar HTTP 502. Nunca use valor
de memória ou de conversa anterior — rode a skill toda vez.

## Pré-requisitos
Tenha entrada, saída, adultos, crianças e bebês de colo. Falta algo,
pergunte (uma pergunta por mensagem). Datas em AAAA-MM-DD.

**Crianças: NÃO pergunte a idade exata.** Pergunte quantas crianças e
quantos bebês de colo. A idade que separa um do outro está no treinamento
(`/api/agent/conhecimento`, bloco REGRA DE CRIANÇAS). Se a pousada ainda
não configurou a regra, pergunte só "quantas crianças" e passe bebês = 0.

## Como chamar
    node {baseDir}/scripts/consultar-api.mjs <checkin> <checkout> <adultos> <criancas> <bebes>

`criancas` = crianças que NÃO são de colo; `bebes` = bebês de colo. Passe
os números como o hóspede informou — o script aplica a regra da pousada
sozinho (não some crianças aos adultos você mesma).

A consulta pode demorar, principalmente em datas concorridas. O script precisa
de `MARIMAR_API_KEY` na Hostinger (mesma `AGENT_API_KEY` da Vercel).
`MARIMAR_SITE_URL` é opcional; o padrão é o domínio oficial do site.
Se houver erro 401, confira a chave no servidor — não informe preço sem consulta.

## Como interpretar
Retorna: quartos (disponíveis), esgotados, noites, estadia_minima,
aviso_crianca, regra_criancas, valor_bebes, link_reserva.

Cada quarto disponível tem: quarto (nome), capacidade, total e diaria_media.
A API do agente ainda não devolve quantidade de unidades, fotos, comodidades
nem estadia mínima nesta rota; os campos correspondentes vêm `null` ou vazios.
Não deduza quantidade de quartos restantes nem use esse resultado para mandar fotos.

- total = valor final da estadia inteira, já com crianças e bebês pela
  regra da pousada. É SEMPRE este que se informa.
  "Suíte Queen: R$ 1.100 no total pelas 2 noites, com café da manhã."
- diaria_media = MÉDIA entre as noites. As tarifas mudam por dia da
  semana. NUNCA diga "a diária é R$ X". Se perguntarem o valor por
  noite, explique que varia conforme o dia e ofereça o total.
- regra_criancas preenchido = a regra da pousada foi aplicada. Informe o
  total normalmente e, se ajudar, explique a regra com as palavras dela
  (ex.: "crianças a partir de 3 anos pagam como adulto").
- aviso_crianca preenchido = a pousada ainda não configurou a regra. Aí
  NÃO informe valor de criança. Diga: "Para crianças preciso confirmar a
  idade com a recepção para passar o valor correto."
- ultima_unidade = `null` nesta integração. **Nunca** diga que é a última
  unidade sem uma fonte real e atual de estoque unitário.
- esgotados = NUNCA ofereça. Cada um tem "motivo" — use para explicar
  e sugerir alternativa.
- estadia_minima = `null` nesta rota. Não afirme mínimo de diárias a partir
  dela; se for necessário, confirme em fonte oficial.
- ok:false = não invente; tente 1 vez; persistindo, informe que não foi
  possível confirmar e ofereça o link oficial de reservas ou a recepção.
  HTTP 401 indica falha na chave da Hostinger; HTTP 5xx indica erro na API.
  Não volte a consultar o Worker diretamente.

Máximo 3 quartos por mensagem. Sempre ofereça o link_reserva ao final para
concluir a reserva.

## Regra de ouro do valor
Só informe um número em reais se ele veio no campo total da skill AGORA.
Se veio null, ou a skill falhou, o valor vai pelo link (fonte oficial).
Nunca estime, arredonde, calcule ou reutilize valor de outra consulta.

## Nunca
- Nunca invente ou estime preço.
- Nunca reutilize valor de outras datas ou de conversa anterior.
- Nunca use Booking ou Expedia como fonte.
- Nunca chame a pousada de "Pousada Ilha do Mel Marimar". É "Pousada Marimar".
