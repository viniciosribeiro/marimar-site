# O link "Reservar" e a página de reservas do Desbravador

> **Verificado em 11/11/2026** com uma gravação do navegador feita pelo
> proprietário (ele mesmo passou pelo "não sou um robô") e uma reprodução
> local com as respostas gravadas. Versão do aplicativo do motor na data:
> `main.f5828971.js`. Se o Desbravador publicar versão nova, confira de novo
> antes de confiar no que está aqui.

Leia antes de mexer em `src/lib/deeplink.ts`, no botão Reservar, no
`deep_link` das rotas de disponibilidade ou no link que a Marina manda.

## O que o link controla

Endereço: `https://reservas.desbravador.com.br/hotel-app/pousada-ilha-do-mel-marimar/reservation?…`

| Parâmetro | O que o motor faz com ele | O que o site manda hoje |
|---|---|---|
| `checkin`, `checkout` | Datas (`AAAA-MM-DD`). Inválidas: a página não busca nada | as datas da busca |
| `adults` | Adultos já selecionados no cartão do quarto (padrão 1) | `adultosMotor` (ver "Como o site monta o link") |
| `child1` | Crianças **de cortesia** ("free"). **Esta pousada não aceita** (limite 0 no Desbravador): com `child1` ≥ 1 o motor esconde TODOS os quartos e mostra "Prezado cliente, para este período, favor entrar em contato com o nosso departamento de reservas. Obrigado" | `criancasMotor`, hoje sempre 0 |
| `child2` | Crianças **pagantes** da faixa que a pousada configurou no Desbravador (hoje 0 a 17 anos, com tarifa de criança própria) | não manda |
| `child3` | Segunda faixa de criança (a pousada não usa) | não manda |
| `roomCode` | Mostra só esse tipo de quarto (maiúsculas e minúsculas tanto faz) | a sigla da suíte (`QUEEN`, `MRFAM`…) |
| `rateCode` | Mostra só essa tarifa; vazio = todas. A pousada tem uma tarifa, de código `WEB` | vazio |
| `voucher` | Cupom de desconto cadastrado no Desbravador (inválido: aviso na tela) | não manda |
| `origin`, `resident`, `package` | Uso do próprio Desbravador (anúncios do Google, tarifa de residente, pacotes) | não manda |

Não existe nenhum outro parâmetro lido do endereço nessa página (lista
completa conferida no código do aplicativo do motor em 11/11).

## O que o link NÃO faz

- **Não coloca o quarto no carrinho e não pula etapas.** O carrinho nasce
  quando o hóspede toca em **Adicionar**: é um registro feito na hora, no
  servidor do Desbravador, ligado a um número de reserva criado dentro da
  própria página. O motor não aceita esse número pelo endereço e não guarda
  o carrinho no navegador.
- Por isso não existe "link do carrinho": o endereço fica igual depois do
  "Adicionar" (conferido pelo proprietário em 08/11/2026).
- **Incorporar a página no nosso site** (janela dentro da página) não deixa
  mudar o desenho nem as etapas, porque a página continua sendo do
  Desbravador. Copiar a página pelo nosso servidor passaria o pagamento dos
  hóspedes por nós: **não fazer**.
- **Do nosso lado não há como apertar "Adicionar" pelo hóspede.** Só o
  Desbravador pode encurtar o caminho (configuração ou versão nova do motor).

## O caminho do hóspede depois do "Reservar"

1. "Por favor, complete a validação 'Não sou um robô'". É uma **opção do
   cadastro da pousada no Desbravador**; eles podem desligar. A etapa de
   pagamento tem a própria verificação, sempre.
2. Cartão do quarto (foto, descrição, tarifa, total das diárias), seletores
   de adultos e crianças e o botão **Adicionar**.
3. Aviso "Adicionado com sucesso!". O **Resumo** ganha os totais e o botão
   **Continuar** (no celular fica abaixo do cartão do quarto; há também uma
   aba flutuante do carrinho com o número de itens).
4. Etapa "Acomodações" (opcionais, observações, horário de chegada) e
   **Continuar**.
5. Dados do hóspede, pagamento e nova verificação "não sou um robô".

## Como o site monta o link

`src/lib/deeplink.ts` (`buildDeepLink`), usado pelo botão Reservar dos dois
modelos do site, por `/api/disponibilidade` e por `/api/agent/disponibilidade`
(`deep_link` de cada suíte). A skill `consulta-desbravador` usa o `deep_link`
de cada suíte e monta sozinha o link geral, no mesmo formato
(`agente/skills/consulta-desbravador/scripts/consultar-api.mjs`, `linkFallback`).

- `adults` = `adultosMotor` e `child1` = `criancasMotor`
  (`src/lib/regras-hospedagem-base.ts`, `calcularOcupacao`).
- Com a regra em vigor no painel (Marina → Regras e adicionais: criança a
  partir de 1 ano paga como adulto; bebê de colo não vai ao motor),
  `criancasMotor` é sempre 0 e a criança entra em `adults`. O link de uma
  família de 2 adultos e 1 criança sai com `adults=3&child1=0`.
- **Conferido em 11/11/2026, 10 a 12/12:** em 10 de 10 combinações (2, 3 e 4
  hóspedes; FAMILIA, STANDARD FAMILIA, STANDARD TRIPLO, STANDARD QUADRUPLO,
  KING REDE, SUITE QUEEN) o motor mostrou o mesmo quarto, o mesmo número de
  hóspedes já selecionado e o mesmo total que o site mostra em produção.

### Defeito adormecido (corrigir só com aprovação do proprietário)

Se a regra do painel for desligada, ou "criança paga como adulto" for
desmarcada, `criancasMotor` passa a ser maior que zero e o link levaria
`child1=N`: página do Desbravador **sem nenhum quarto**. Hoje não acontece
com ninguém (a regra está ligada).

Correção proposta: mandar essas crianças em `child2`, manter `child1=0` e só
incluir `child2` quando for maior que zero (assim os links de hoje não mudam
um caractere). Arquivos: `src/lib/deeplink.ts`, `testes/unit/worker.test.ts`,
`agente/skills/consulta-desbravador/scripts/consultar-api.mjs` (`linkFallback`)
e `testes/unit/consulta-desbravador.test.mjs`. A parte da skill só vale no
WhatsApp depois de reinstalada na Hostinger. É mudança numa funcionalidade
aprovada em 28/10/2026: **pedir aprovação antes**. Nesse modo o motor cobra a tarifa de criança dele,
que em alguns quartos é diferente do preço de adulto; conferir site × motor
de novo.

## O que só o Desbravador resolve

Pedido pronto para o suporte (entregue ao proprietário em 11/11/2026):

> Somos a Pousada Marimar (Ilha do Mel), `pousada-ilha-do-mel-marimar` no
> Reservas Online. Nossos hóspedes chegam pelo link do nosso site já com
> datas, hóspedes e quarto escolhidos, e muitos desistem antes de pagar.
> 1. Podem desligar a verificação "Não sou um robô" da etapa de acomodações
>    e tarifas (a que aparece ao abrir o link)? A da etapa de pagamento pode
>    continuar.
> 2. Existe configuração para o hóspede ir do quarto direto para os dados da
>    reserva, sem "Adicionar" e depois "Continuar"?
> Observação: a verificação está devolvendo o aviso "Over Enterprise free
> quota" do Google.

## Como repetir a verificação

1. O proprietário grava no Chrome do computador: F12 → **Network** →
   marcar **Preserve log** e **Disable cache** → abrir o link de reserva →
   passar pelo "não sou um robô" → **Adicionar** → **Export HAR** → anexar o
   arquivo na conversa. Sem digitar nome, documento nem cartão.
2. O arquivo **não entra no repositório** (traz dados do aparelho de quem
   gravou e da conta do hotel). Analise fora da pasta do projeto.
3. Para ver a tela em cada formato de link: sirva em `localhost` os arquivos
   e as respostas gravados, trocando no aplicativo o endereço do motor pelo
   local, e navegue com o Playwright bloqueando qualquer endereço que não
   seja `localhost`. Varie só os parâmetros do link; use as datas que a
   gravação tem.
4. **Limites que não mudam:** nunca automatizar o "não sou um robô" no motor
   de verdade; nunca chamar o serviço interno do motor a partir do site ou
   de scripts; o motor responde 403 a este ambiente de nuvem e isso não é
   para contornar.
