---
name: consulta-desbravador
description: Consulta disponibilidade e valores reais ao vivo dos quartos da Pousada Marimar, com link oficial de reserva. Já aplica a regra de crianças e bebês configurada pela pousada.
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

# Consulta ao vivo - Pousada Marimar

Use SEMPRE que o cliente perguntar vaga, disponibilidade, valor, preço,
"tem quarto", "quanto fica", ou quiser reservar. Consulta em tempo real:
disponibilidade E valor, na hora. Nunca use valor de memória ou de conversa
anterior — rode a skill toda vez.

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

A consulta leva de 1 a 3 segundos (cota cada quarto ao vivo).

## Como interpretar
Retorna: quartos (disponíveis), esgotados, noites, estadia_minima,
aviso_crianca, regra_criancas, valor_bebes, link_reserva.

Cada quarto tem: quarto (nome), capacidade, total, diaria_media,
unidades, ultima_unidade, comodidades, fotos.

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
- ultima_unidade true = pode dizer que é a última unidade: o dado veio
  desta consulta, agora.
- esgotados = NUNCA ofereça. Cada um tem "motivo" — use para explicar
  e sugerir alternativa.
- estadia_minima maior que as noites pedidas = avise o hóspede.
- ok:false = não invente; tente 1 vez; persistindo, mande o link.

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
