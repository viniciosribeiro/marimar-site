# Changelog — Marimar Site

Historico de mudancas do projeto. **Toda sessao de trabalho (humana ou de IA) adiciona
uma entrada no topo.**

Formato de cada entrada:

```
## AAAA-MM-DD — Titulo curto
**Autor:** quem fez (ex.: Claude Opus 5 / Agent Hermes / Vinicios)
**Commits:** hashes envolvidos

### Adicionado / Corrigido / Alterado / Removido / Seguranca
- descricao objetiva

### Acao necessaria
- o que ainda precisa ser feito fora do codigo (Vercel, OpenClaw, DNS...)
```

---

## 2026-09-19 (8) — A home quebrou no celular: rolagem horizontal

**Autor:** Claude Opus 5 (Cowork)

O Vinicios testou no celular e a página apareceu **mais larga que a tela**: as
seções de baixo preenchiam só a largura da tela e sobrava uma faixa branca à
direita. É a assinatura clássica de rolagem horizontal.

### A causa

A caixa de busca do topo. A fila de abas — "Hospedagem", "Pacotes e ofertas",
"Informações importantes" — somava cerca de 430px de rótulos que não quebram
linha. A caixa cresceu até caber tudo, **passou dos 390px da tela e levou a
página inteira junto**.

`overflow-x-auto` na fila não segurou porque o problema estava um nível acima:
em flex, o filho tem `min-width: auto` e **se recusa a encolher abaixo do
próprio conteúdo**. É o mesmo mecanismo que já tinha estourado a prévia do
editor — e desta vez escapou porque a caixa é nova.

### A correção

- `w-full min-w-0` na caixa e `min-w-0` na coluna de conteúdo do banner, nos
  dois níveis: a caixa passa a obedecer à tela em vez de ao próprio conteúdo.
- As abas agora **dividem a largura** (`flex-1`) e usam rótulos curtos abaixo
  de `sm`: "Datas", "Pacotes", "Informações". Uma fila que rola escondendo a
  terceira aba é uma aba que ninguém acha.

### O teto da marca no celular

O conjunto logo + nome ocupava um quarto da tela antes de a pessoa ver qualquer
conteúdo. A marca pode ser grande numa tela larga sem custo; num celular, não.

Agora há um teto — mas ele exigiu separar as variáveis: o editor escreve
`--logo-altura-base` e `--marca-nome-tam-base`, e o CSS **deriva** as medidas de
uso. A separação é mecânica, não estética: o layout injeta o tema como `style`
inline no `<html>`, e **estilo inline ganha de qualquer media query**. Escrevendo
direto em `--logo-altura`, o limite do celular nunca valeria.

O `min()` respeita a escolha do editor quando ela já é pequena e só segura os
valores altos.

### Verificado

Medido em 320px e 390px: `/` e `/restaurante` sem rolagem horizontal, a caixa de
busca dentro da tela, o cabeçalho condensando ao rolar. A busca continua sendo
o mesmo formulário, com a mesma ação para `/reservar`.

---

## 2026-09-19 (7) — O nome ao lado da logo virou um conjunto configurável

**Autor:** Claude Opus 5 (Cowork)

Não precisa de migration: o tema é `jsonb` e `lerTema()` completa o que falta.

### O problema

"Ao lado" era a única posição, com uma distância fixa no código. Isso funciona
para uma logo e falha para a seguinte: logo alta pede o nome embaixo, logo
larga pede ao lado, e o espaço que parece certo com um brasão fica grande
demais com uma assinatura horizontal — foi exatamente o que aconteceu aqui, o
nome ficou solto da logo.

### Um componente, quatro lugares

`MarcaLockup` desenha o conjunto no topo, no rodapé, na gaveta do celular e na
prévia do editor. Antes cada lugar montava o seu, com alturas e distâncias
próprias — três chances de divergir a cada ajuste.

### A posição não mexe no HTML

`--marca-direcao` vira `flex-direction`: "abaixo" é uma coluna, "esquerda" é
uma linha invertida. Então a ordem no HTML é sempre **imagem → texto**, que é a
ordem em que um leitor de tela precisa ouvir, esteja o texto acima, abaixo ou
dos lados. E, como tudo sai por variável CSS, a prévia do editor reflete cada
mudança na hora.

### Controles novos (aba Marca)

Posição (direita, esquerda, acima, abaixo), texto próprio, **segunda linha**
(como "POUSADA" sob "Marimar"), distância até a logo, tamanho, peso,
espaçamento entre letras e caixa alta.

A segunda linha é **derivada** do tamanho do nome — sempre menor e mais
espaçada. Não virou um segundo controle de propósito: seriam duas medidas para
a mesma coisa, e a primeira vez que alguém mexesse em uma só, as duas linhas
sairiam tortas entre si.

### A barra deixou de ter altura fechada

Passou de `height` para `minHeight`. Com o nome **acima** ou **abaixo** da
logo, o conjunto fica mais alto que a imagem, e uma altura calculada só a
partir dela cortaria o texto. O mínimo continua garantindo a área de toque
quando a logo é pequena.

### Verificado

`tsc --noEmit` limpo. Home conferida pela árvore de acessibilidade (o painel do
navegador estava oculto, e nesse estado os screenshots não são confiáveis): o
conjunto do topo, o do rodapé e o da gaveta renderizam, e a ordem continua
imagem → texto.

---

## 2026-09-19 (6) — Home: ícones de verdade, busca em abas e cartões editáveis

**Autor:** Claude Opus 5 (Cowork)

> ⚠️ **Rode `npm run db:migrate`** (migration `0007_blocos_itens`).

### Emoji não é ícone

Os oito cartões de "O que está incluso" usavam emoji. Cada sistema desenha o
seu: o mesmo 🍤 muda de cor e de forma entre iPhone, Android e Windows, e
nenhum deles aceita a cor da marca. Numa grade de oito, isso vira **oito
estilos gráficos diferentes na mesma tela**.

Agora são 28 ícones de linha em SVG inline (`src/components/site/Icone.tsx`):
herdam `currentColor`, escalam sem borrar e não custam nenhuma requisição.
Cada um vai dentro de um círculo colorido, com uma paleta de oito cores
**fixas, não derivadas da marca** — a graça de uma grade é a variedade, e oito
tons da mesma cor viram oito cartões iguais.

### A busca do topo virou três respostas

O topo recebe três perguntas diferentes e só respondia a uma:

- **Hospedagem** — as datas, exatamente o formulário de antes, mesma ação,
  mesmo motor
- **Pacotes e ofertas** — até três pacotes ativos, direto do banco
- **Informações importantes** — check-in, café, pets e crianças, que a pessoa
  ia procurar rolando a página inteira

O selo diz "direto com a pousada", não "melhor preço garantido": o segundo
seria uma garantia que a pousada não deu, e o briefing proíbe publicar o que
não foi confirmado.

### Seções redesenhadas

- **Cabeçalho de seção** ganhou o rótulo em maiúsculas e a **onda** sob o
  título. Ela aparece sempre no mesmo lugar e no mesmo tamanho — é o que dá
  ritmo à página em vez de títulos soltos.
- **"Um complexo, duas partes"** — cartões com foto, ícone montado na junção
  entre imagem e texto, e link. O conector do meio é informação, não enfeite:
  é ele que diz que os dois são partes do mesmo lugar.
- **Faixa final** — foto, manuscrita "Ilha do Mel", tagline espaçada e os dois
  botões. Reaproveita a foto de destaque que a pousada já escolheu, em vez de
  inventar um degradê.

### Os cartões agora são editáveis (Admin → Cartões das seções)

Eram constantes no código. Dava para editar o **título da seção** pelo admin,
mas não os cartões dentro dela — que é justamente o conteúdo que a pousada
quer mexer.

Uma tabela (`blocos_itens`) serve aos dois blocos, porque a forma é a mesma:
ícone ou foto, título, texto, link. O que muda é como o bloco desenha — e a
tela só oferece foto e link onde o site realmente os usa; oferecer em
"diferenciais" seria prometer uma edição que o site ignora.

**Sem nenhum cartão cadastrado, valem as constantes.** Quem nunca abrir a tela
não perde o que já estava no ar. O primeiro cartão criado substitui os padrões
daquela seção — a tela avisa isso antes.

A ordem de um cartão novo é o fim da fila **da seção**, não da tabela: um
cartão de "O que está incluso" não pode nascer atrás dos cartões de outro
bloco, já que eles nem aparecem juntos.

### Verificado

`tsc --noEmit` limpo. Home conferida com e sem banner: a busca em abas troca
de conteúdo, os cartões caem nas constantes enquanto a migration não roda, e a
consulta dos itens está isolada num `try` próprio para não derrubar o resto.

---

## 2026-09-19 (5) — Banners em camadas: vídeo, texturas, foco e movimento

**Autor:** Claude Opus 5 (Cowork)

> ⚠️ **Rode `npm run db:migrate`** (migration `0006_banners_camadas`).

A primeira versão tinha imagem + título + chamada + um botão. Isso monta um
aviso, não um topo de site: não dava para escolher onde o texto fica, que parte
da foto sobrevive ao corte no celular, nem usar vídeo.

### Quatro camadas

1. **Mídia** — foto ou vídeo (MP4/WebM, até 50 MB), com ponto focal
2. **Véu** — escurece de cima para baixo, por igual, clareia da esquerda ou
   vinheta, com intensidade regulável
3. **Textura** — grão de filme, pontos ou linhas diagonais, **desenhadas em
   CSS**: nenhum arquivo baixado. O grão usa `feTurbulence` num SVG embutido,
   que é o único jeito de ter ruído real sem uma imagem.
4. **Conteúdo** — rótulo, título, chamada, texto de apoio e dois botões

### O controle que mais muda a responsividade

**Ponto focal**, escolhido clicando na própria foto. Uma foto horizontal
cortada para a tela vertical do celular perde as laterais — e sem isso perde
justamente o assunto. É o controle mais barato de usar e o que mais salva
banner no celular.

Junto: **posição do texto** numa grade de nove, **centralizar no celular**
(numa coluna estreita, texto encostado num canto parece erro de layout, não
intenção), altura em quatro níveis e largura do bloco de texto.

`100svh` no "tela cheia", não `100vh`: no celular o `vh` conta a barra do
navegador que aparece e some, e o banner ficava mais alto que a tela,
empurrando a busca de disponibilidade para fora.

### Vídeo, com parcimônia

Toca só quando faz sentido gastar a banda de quem está vendo: slide visível,
animações ligadas, fora da prévia do editor e — no celular — **só se quem
cadastrou pediu**. Em qualquer outro caso fica a imagem de cartaz, que já
estava carregada de qualquer jeito. Sem som, porque vídeo de fundo com áudio é
bloqueado pelos navegadores e incomoda quem está no escritório.

### Movimento

Entrada do texto (sobe, aparece, aproxima) e Ken Burns na foto — 28 segundos,
ida e volta. Rápido demais enjoa, e o `alternate` evita o salto seco do fim
para o começo. Tudo desligado para quem pediu menos animação no aparelho, e
para quem desligou animações na Identidade visual.

### A prévia não pode mentir

O editor renderiza o banner com o **mesmo componente do site**, em três larguras
(celular, tablet, desktop). Não existe um segundo renderizador para divergir —
o que aparece na prévia é literalmente o que vai ao ar.

### Dois bugs encontrados no caminho

1. **`banners/` não estava na lista de pastas permitidas** da rota de upload.
   O primeiro upload de banner teria falhado com "Destino de upload inválido".
2. `lerBanner()` completa a linha do banco com os padrões. Entre o deploy e a
   migration as colunas não existem, e sem esse merge `ALTURAS[undefined]`
   devolveria classe vazia: o banner apareceria com **altura zero** — invisível,
   sem nada no log para explicar.

### Também

Vídeo só é aceito em `banners/`, e com limite próprio (50 MB contra 12 MB). Não
é generosidade: um MP4 de fundo passa de 12 MB com facilidade, enquanto uma foto
de cardápio que chegue perto disso quase sempre é um arquivo que ninguém
otimizou.

Os enums são validados contra a lista antes de gravar. Um valor inválido viraria
um banner que não renderiza, e o erro só apareceria no site — longe de quem
salvou.

### Verificado

`tsc --noEmit` limpo. Home conferida sem banners: cai no comportamento antigo
sem quebrar nada.

---

## 2026-09-19 (4) — A tela de banners aparecia sem login

**Autor:** Claude Opus 5 (Cowork)

Conferindo o módulo recém-publicado em produção, `/admin/banners` **renderizou
a lista inteira sem sessão** — sidebar, banners e tudo. A tela seguinte
(`/admin/identidade-visual`) pediu login normalmente, e foi esse contraste que
denunciou o problema.

**Por quê:** no admin deste projeto, o `layout.tsx` desenha a moldura mas não
protege nada — **cada página faz a própria checagem**. Todas fazem; a de
banners, criada agora, não fazia.

O estrago real era limitado: as server actions chamam `auth()` antes de tocar
no banco, então ninguém sem sessão criava, editava ou excluía nada. Mas a
**leitura** passava: dava para ver os banners cadastrados, inclusive os
desligados e os ainda não publicados — exatamente o tipo de coisa que uma
pousada agenda com antecedência e não quer mostrar.

Corrigido com as duas linhas que as outras quatorze telas já tinham. Varri as
demais páginas do admin para garantir que essa era a única: era. A única sem
guarda agora é `/admin/login`, que é o esperado.

Também conferido no mesmo passo, já que a sessão estava válida: a rota de
upload (`/api/admin/upload`) valida a sessão dentro de `onBeforeGenerateToken`,
antes de emitir o token do Blob — essa estava certa.

### Verificado nesta passada (produção)

- Módulo de banners no ar, com o estado vazio correto — o que confirma que a
  migration `0005_banners` rodou e a tabela existe
- Logo grande e título do topo em branco, as duas correções da sessão
- `tsc --noEmit` limpo

---

## 2026-09-19 (3) — Banners do topo, e um título que nunca ficou branco

**Autor:** Claude Opus 5 (Cowork)

> ⚠️ **Precisa rodar `npm run db:migrate`** (migration `0005_banners`) antes de
> o módulo funcionar. Até lá o topo segue com o comportamento antigo — a
> consulta está isolada num `try` próprio justamente para isso.

### O que existia, e por que ninguém achava

Havia **uma** foto de topo, escolhida por uma regra implícita dentro do módulo
Fotos: a mídia com `destaque = true` e sem quarto vinculado. Quem procurava
"banner" no admin não encontrava nada — porque não havia nada com esse nome. E
trocar a foto do topo exigia conhecer a regra.

### Agora: Admin → Conteúdo do site → Banners do topo

Registros próprios, com imagem, título, chamada, botão (texto + link), ordem,
ligar/desligar e **janela de exibição**.

A janela existe porque a pousada anuncia por temporada: um banner de feriado
tem de sair do ar sozinho, sem depender de alguém lembrar de desligar. A
comparação de datas é feita **no banco**, com `now()` — fazer a conta no Node
daria a hora do data center, não a que foi cadastrada, e o banner entraria ou
sairia na hora errada.

A listagem avisa quando um banner está ligado mas fora da janela ("encerrado
em 06/01", "começa em 24/12"). Sem isso a tela diria "ativo" e o site não
mostraria nada — e ninguém entenderia por quê.

O formulário mostra a prévia **com o véu escuro do site por cima**, não uma
miniatura limpa: é olhando o texto sobre a foto que se percebe se a imagem
serve.

### O carrossel

- **Um banner só não vira carrossel** — sem setas, sem bolinhas, sem
  temporizador. Controle para navegar entre um item só é ruído.
- **Para sozinho** com o mouse em cima, com o foco dentro ou com a aba em
  segundo plano. Trocar a imagem por baixo de quem está lendo é a forma mais
  rápida de irritar; girar numa aba escondida só gasta bateria.
- **Respeita o botão de animações** do editor e o `prefers-reduced-motion`: com
  eles desligados ele simplesmente não gira.
- **Só a primeira imagem tem `priority`** — ela é o LCP da home; marcar todas
  faria o navegador disputar banda consigo mesmo.
- Arrasta com o dedo no celular.

A busca de disponibilidade é a **mesma** nos dois caminhos, montada uma vez:
duplicá-la acabaria com dois formulários divergentes, e esse é justamente o
componente que não pode divergir.

### Excluir apaga o arquivo também

`imagem_pathname` é gravado no upload porque é ele que o Vercel Blob usa para
apagar. Sem guardar, excluir o banner deixaria a imagem órfã pagando
armazenamento para sempre. O arquivo sai **depois** do registro, e a falha dele
não derruba a exclusão: banner fantasma no site é pior que imagem órfã no
storage.

### O título que nunca ficou branco

"Pousada Marimar" aparecia **azul-escuro sobre a foto escura do farol**, apesar
do `text-white` na seção. A regra base `h1…h6 { color: var(--tinta) }` define
`color` no próprio elemento, e **declaração própria sempre ganha de herança** —
o `text-white` do `<section>` nunca chegava ao `<h1>`.

Corrigido nos títulos sobre fundo escuro (topo da home, carrossel e o CTA), com
a cor no próprio elemento. A regra base foi para dentro de `@layer base`, que é
onde ela deveria estar desde o começo.

### Verificado

`tsc --noEmit` limpo. Home conferida antes e depois: com a tabela ainda
inexistente ela cai no topo antigo sem quebrar nada, e o título do topo agora
sai branco.

---

## 2026-09-19 (2) — Alinhamento: topo, títulos, hero e justificado

**Autor:** Claude Opus 5 (Cowork)

Quatro controles novos na aba **Alinhamento** do editor visual.

### Uma intenção, várias consequências

O tema guarda a **intenção** (`"centro"`), não o CSS (`"center"`). O mesmo
"centro" precisa virar `text-align`, `justify-content`, `margin-inline` e ainda
mostrar um segundo traço decorativo. Derivar tudo em `temaParaCss()` é o que
mantém essas quatro consequências coerentes — espalhá-las pelos componentes
garantiria que uma ficasse para trás.

### Barra do topo — três arranjos

- **À esquerda** (atual): logo na ponta, menu à direita
- **Centralizado**: logo no meio, menu numa segunda linha centrada
- **Dividido**: metade do menu de cada lado da logo

Os três usam as **mesmas peças** (`marca`, `acoes`, `grupos()`), montadas uma
vez e recompostas por arranjo — duplicá-las deixaria um arranjo para trás na
próxima mudança do menu.

Abaixo de `lg` os três viram o mesmo: logo + botão Menu. É o único arranjo que
cabe, e fingir o contrário quebraria a responsividade que acabamos de arrumar.

Este é o único controle que a prévia só mostra **depois de publicar** — ele muda
a estrutura da página, não um token. O editor avisa isso na própria aba.

### Títulos — e o traço torto

Com os títulos centralizados aparece um segundo traço, à esquerda. Um traço só
de um lado, com o título no meio, fica visivelmente torto. Ele entra por
variável CSS (`--titulo-linha-esq`), não por prop, para a prévia refletir na hora.

### Hero — e o véu que acompanha

O véu que clareia a foto sob o texto agora segue o alinhamento. Antes era
sempre `from-white/95` à esquerda: com o texto centralizado, o título cairia
sobre a parte escura da foto. Centralizado, o véu clareia o meio.

### Justificado

`text-align: justify` + `hyphens: auto`, **só a partir de `md`**. Na coluna
estreita do celular o justificado abre rios de espaço entre as palavras e fica
pior que o alinhado à esquerda. A hifenização funciona porque o `<html>` já
declara `lang="pt-BR"`.

### Descoberto no caminho

Os controles chegam às páginas que já usam o design system — home, restaurante
e como chegar. **As demais (`a-pousada`, `ilha-do-mel`, `galeria`, `faq`,
`politicas`, `contato`, `eventos`, `avaliacoes`) têm marcação própria**, com
`text-gray-900` em vez dos componentes e tokens. É a mesma razão pela qual o
visual editorial não chegou nelas. Está no backlog como "aplicar o novo visual
nas demais páginas" — e agora tem uma segunda razão para sair.

### Verificado

`tsc --noEmit` limpo. Os três arranjos do topo conferidos no site com o padrão
trocado temporariamente, e revertidos depois: centralizado põe a logo no meio
com o menu embaixo; dividido reparte o menu nos dois lados; à esquerda ficou
idêntico ao que era.

---

## 2026-09-19 — Tamanho da logo vira controle do admin

**Autor:** Claude Opus 5 (Cowork)

A logo saía pequena ao lado do nome. A causa não era a imagem: a altura estava
**fixa no código** (`h-9 lg:h-11`), escolhida para um arquivo de logo que não é
o que a pousada usa.

Nenhum arquivo de logo se parece com o outro. Um brasão quadrado e uma
assinatura horizontal com a mesma altura em pixels ocupam pesos visuais
completamente diferentes no topo — por isso essa altura não é decisão de quem
escreve o código, é de quem olha a marca.

### O que entrou no editor (aba Marca)

- **Altura no topo** — 24 a 88px
- **Altura no rodapé** — 20 a 72px
- **Escrever o nome ao lado** — desligável, para logo que já traz o nome
  desenhado, onde repetir fica pior do que só a imagem
- **Prévia do conjunto** — logo, nome e barra juntos, na proporção real. Um
  número solto num campo não diz nada sobre como a marca vai aparecer.

### A barra do topo agora segue a logo

`height: max(4rem, calc(var(--logo-altura) + 1.25rem))`. Antes a logo tinha de
caber numa barra de altura travada — era esse o aperto. Agora a barra cresce
junto, e o `max()` mantém o mínimo de 64px de área de toque mesmo com logo
pequena.

### Uma altura, não duas

A versão compacta (depois de rolar, e na gaveta do celular) é **derivada** da
altura escolhida, em CSS:

```css
--logo-altura-compacta: max(22px, calc(var(--logo-altura) * 0.78));
```

Não virou um segundo campo de propósito. Dois números para a mesma coisa
acabariam incoerentes entre si na primeira vez que alguém mexesse em um só. O
piso de 22px existe porque abaixo disso nenhuma logo com texto continua legível.

Como sai por variável CSS via `temaParaCss()`, a prévia dentro do iframe do
editor mostra o tamanho real enquanto o controle é arrastado.

### Padrão novo

52px no topo (era 44 em tela larga e 36 no celular) e 36px no rodapé. Quem
quiser outro tamanho arrasta — o ponto da mudança é esse.

### Verificado

`tsc --noEmit` limpo. Topo conferido no site: a logo cresceu e a barra cresceu
junto, sem espremer o menu nem o botão Reservar. **A aba Marca não foi conferida
visualmente** — a sessão do admin estava no login.

---

## 2026-09-19 (deploy 2) — Deploy da correção de rolagem horizontal no celular + teto da marca

**Autor:** Agent Hermes (OpenRouter)
**Commits:** `d8d54f2` `bf765b1`

A home estourava a largura da tela em 390px — as abas da busca somavam ~430px, a caixa
crescia e levava a página inteira. Corrigido com `min-w-0` nos dois níveis, abas
dividindo a largura e rótulos curtos no celular. Teto do conjunto logo+nome também
entrou.

### Verificado em produção

- API do agente: 401 sem header, 200 com
- `/admin/banners` e `/admin/cartoes`: 307 → login
- Build: zero erros, todas `ƒ`

### Pendências (sem alteração)

- `AGENT_API_KEY`: chave antiga ainda responde
- DNS: domínio oficial é WordPress 5.8.16
- 56 fotos do WordPress no servidor antigo

---

**Autor:** Agent Hermes (OpenRouter)
**Commits:** `b68bc97` `e27713d` `4172c64` `07663bc` `7a988bb` `24dd160` `f220b21`

Os 7 commits da terceira sessão com Claude (Cowork) foram revisados, a migration
0007 aplicada, e o deploy enviado para produção. Nenhuma alteração de código.

### Migration aplicada

- `0007_blocos_itens` — cartões editáveis das seções da home

### Verificado em produção

- API do agente: 401 sem header, 200 com — bypass corrigido mantido
- `/admin/banners` e `/admin/cartoes` redirecionam para login (307)
- Build: zero erros TypeScript, todas as páginas `ƒ` (dinâmicas)

### Pendências (sem alteração)

- `AGENT_API_KEY` antiga ainda responde — rotacionar
- DNS: domínio oficial ainda é WordPress 5.8.16
- 56 fotos do WordPress ainda no servidor antigo — vão sumir na virada de DNS

---

**Autor:** Agent Hermes (OpenRouter)
**Commits:** `3f4c51d` `2fc0f28` `2e3e159` `55c794a` `68ad63b` `bdf882d`

Os 6 commits da segunda sessão com Claude (Cowork) foram revisados, validados
e enviados para produção. Nenhuma alteração de código foi feita — apenas
análise, build e deploy.

### Verificado em produção

- Build compila limpo, zero erros TypeScript, 42+ rotas geradas
- Todas as páginas do site como `ƒ` (dinâmicas) — nenhuma `○` estática
- API do agente sem header retorna **401** (fail-closed mantido)
- `/cardapio` redireciona (308) para `/restaurante#cardapio`
- `/quartos` e `/reservar` com dados do motor
- Home com hero aéreo e busca de disponibilidade funcional

### Pendências (sem alteração)

- `AGENT_API_KEY` antiga (`marina-agent-key-marimar-2026`) ainda responde na
  Vercel — precisa ser rotacionada e atualizada no OpenClaw
- DNS: `www.pousadamarimarilhadomel.com.br` ainda é WordPress 5.8.16
- `BLOB_READ_WRITE_TOKEN` não verificado (upload de cardápio)
- 3 quartos que o motor retorna e o banco não tem

---

## 2026-09-18 (11) — Menu de verdade, e 102 classes que nunca pintaram nada

**Autor:** Claude Opus 5 (Cowork)

### O achado antes do menu

Os tokens da paleta editorial (`--areia`, `--areia-forte`, `--tinta`,
`--tinta-suave`, `--linha`) estavam declarados no `:root`, mas **nunca foram
registrados no `@theme inline`**. No Tailwind v4 e o `@theme` que gera as
utilities — declarar no `:root` nao basta.

Resultado: `text-tinta`, `bg-areia` e `border-linha` eram classes que nao
existiam. **102 usos em 7 arquivos** silenciosamente sem efeito: os titulos
caiam no cinza do `body` em vez do azul-petroleo, as superficies de areia
ficavam transparentes e os traços decorativos, invisiveis. O redesenho estava
no codigo mas nao na tela — era parte da sensacao de "basico demais".

Cinco linhas no `@theme` acenderam tudo de uma vez.

### O menu

Antes: seis links chapados no topo, sem estado ativo, e quinze links no rodape
que nao existiam no topo. Politicas, FAQ, Pacotes, Avaliacoes e Eventos —
paginas que respondem exatamente o que a pessoa quer saber antes de reservar —
so eram alcancaveis rolando ate o fim.

Agora existe `src/lib/navegacao.ts`: **uma arvore, tres consumidores** (topo,
gaveta do celular, rodape). Pagina nova entra em um arquivo so.

**No desktop**, cada grupo abre um painel com o nome e uma linha dizendo o que
a pessoa vai encontrar ali — a parte mais util do menu e essa, poupa o clique
de descoberta. As descricoes nao citam numero, preco nem nada que dependa do
que o admin cadastrou: o cardapio muda, o menu nao pode mentir enquanto isso.

O gatilho e um **link**, nao um botao: "Restaurante" leva a `/restaurante`.
Quem tem mouse ve o painel ao passar por cima e escolhe entre a pagina inteira
ou um item. Em ponteiro sem hover, o primeiro toque so abre o painel e o
segundo navega — senao o painel nunca apareceria no celular.

O item fica marcado quando a pessoa esta nele **ou em qualquer pagina abaixo
dele**: quem esta em `/pacotes` ve "Acomodacoes" aceso. A ancora e cortada na
comparacao, senao `/restaurante#cardapio` e `/restaurante` disputariam.

**Entre 768px e 1024px o menu nao cabia.** Seis rotulos, a marca e o botao
Reservar na mesma linha se atropelavam — era o "nada responsivo". O menu do
desktop agora so aparece a partir de `lg`; ate la, a gaveta.

**Na gaveta**, os grupos viraram sanfona: quatro toques de 56px em vez de uma
lista de dezessete links para rolar ate achar "Contato". Ganhou o WhatsApp, o
Instagram e um CTA fixo no rodape — a acao que a pousada quer de qualquer
ponto da lista, sem obrigar a rolar de volta.

O cabecalho condensa depois do primeiro rolar: altura maior no topo da pagina,
mais tela enquanto a pessoa le.

### Dois bugs de posicionamento no caminho

**A gaveta aparecia recortada na faixa do topo**, com os links cortados e o
fundo escuro cobrindo so o cabecalho. Causa: `backdrop-filter` cria bloco
contentor. A gaveta era filha do `<header>`, que usa `backdrop-blur`, entao o
`fixed inset-0` dela se media pelos 64px do cabecalho em vez da janela.
Resolvido tirando a gaveta de dentro do `<header>`.

**Fechar no hover e traicoeiro:** o painel sumia quando o mouse atravessava o
vao entre o botao e o painel. Agora ha 140ms de folga antes de fechar.

### Acessibilidade

`Esc` fecha o que estiver aberto, na ordem esperada. `Tab` abre o painel do
grupo focado e `ArrowDown` tambem. Clique fora fecha. O fundo so trava o
scroll com a gaveta aberta — no desktop, rolar e um jeito legitimo de fechar.

### Verificado

`tsc --noEmit` limpo. Medido em 390, 820 e 1440px em `/`, `/quartos`,
`/restaurante` e `/reservar`: painel abre e fecha, sanfona abre, cabecalho
condensa ao rolar, nenhuma rolagem horizontal. A busca de disponibilidade
continua trazendo os quartos do motor.

---

## 2026-09-18 (10) — Responsividade: correções em cascata

**Autor:** Claude Opus 5 (Cowork)

A prévia do editor estourou o layout e cobriu os controles. Investigando, apareceram
problemas de responsividade que iam além dela.

### A causa raiz: `min-width: auto`
Em grid e flex, o filho tem `min-width: auto` por padrão e **se recusa a encolher
abaixo do próprio conteúdo**. O iframe de 1280px da prévia forçava a coluna inteira a
ter 1280px, estourando a página e jogando a prévia por cima dos controles.

Corrigido com `minmax(0, …)` nas colunas do grid e `min-w-0` nos filhos.

### E um erro de conta
A caixa da prévia usava `height: 560 / escala`. Dividir pela escala deixa a caixa
**maior** quando a prévia encolhe — era o contrário. `transform: scale` também não
reduz o espaço que o elemento ocupa no layout, então a caixa externa precisa ter a
altura já multiplicada e recortar o resto.

Aproveitando: a medição passou a usar `ResizeObserver` em vez de `window.resize`. A
largura útil muda quando o grid troca de uma para duas colunas, sem a janela mudar
de tamanho — o listener antigo não percebia.

### `TituloSecao` criava rolagem horizontal no celular
Usava `whitespace-nowrap`. Um título como "Ponto de referência no mapa" não quebrava
e empurrava o traço decorativo para fora da tela em 375px. Agora o título quebra, e
o traço só aparece a partir de `sm` — é ornamento, não informação.

O mesmo valia para os títulos de seção do cardápio. Selos e legendas que ficam ao
lado de um título ganharam `shrink-0`, para não empurrar o vizinho.

### Admin
- **Todas as tabelas rolam** no celular (`overflow-x-auto` + largura mínima), em vez
  de espremer as colunas até cada palavra virar uma coluna de letras: leads, quartos,
  usuários e o `CrudPage` genérico.
- `CrudForm` empilha os campos no celular e só vira linha a partir de `lg`.
- Padding das páginas passou de `p-6` fixo para `p-5 sm:p-8` em 8 telas.
- Abas do editor rolam horizontalmente em vez de quebrar em três linhas.

### Verificado
Medido em 375px: `/`, `/quartos`, `/restaurante`, `/como-chegar`, `/a-pousada`,
`/galeria` e `/reservar` — nenhuma com rolagem horizontal, nenhum elemento
ultrapassando a viewport. A busca de disponibilidade continua trazendo os quartos do
motor normalmente.

---

## 2026-09-18 (9) — Restaurante+Cardápio fundidos e Identidade Visual reconstruída

**Autor:** Claude Opus 5 (Cowork)

### Três páginas viraram uma
`/restaurante`, `/cardapio` e `/cafe-da-manha` diziam a mesma coisa para o hóspede —
ele não separa "restaurante" de "cardápio" na cabeça. Agora é uma página só, com
âncoras. As rotas antigas viraram **redirecionamento 301** no `next.config.ts`: QR
code impresso na mesa não quebra, link já enviado no WhatsApp continua abrindo e o
ranking de busca é transferido em vez de perdido.

### Identidade Visual: de 3 para um módulo de verdade
O módulo configurava aparência mas não tinha prévia real, não fazia upload, não
controlava tipografia nem espaçamento, e a "prévia" era um cartão desenhado à mão.

**Prévia do site real.** `PreviaSite.tsx` carrega a página de verdade num iframe e
injeta os tokens do rascunho dentro dele. Seletor de celular/tablet/computador (com
redução proporcional para caber) e de qual página ver. Usa a **mesma função**
`temaParaCss()` que o layout raiz — duas implementações divergiriam e a prévia
passaria a mentir.

**Rascunho vs publicado.** Mexer não altera o site. Um selo "não publicado" avisa, e
"Descartar mudanças" volta ao estado salvo.

**Upload de logo, favicon e imagem de compartilhamento**, agora que o Blob existe.
Era campo de URL, inconsistente com o cardápio.

**Extração de paleta a partir da logo.** Lê a imagem num canvas, agrupa em caixas de
32 níveis por canal (senão devolveria 40 variações do mesmo tom) e descarta quase-branco,
quase-preto e cinza sem identidade — numa logo isso costuma ser fundo e contorno.

**Escala tipográfica modular.** Tamanho base, razão entre níveis (1.125 a 1.414),
altura de linha e peso dos títulos. Os tamanhos são derivados por `calc()`: mudar a
razão reescala o site inteiro de forma coerente, sem ajustar título por título.

**Densidade.** Multiplicador do respiro vertical das seções. Site com muita foto pede
mais ar; site com muito texto pede menos.

**Relatório de acessibilidade.** Seis combinações reais do site verificadas pela WCAG,
não só duas cores. Avisa também quando o texto base cai abaixo de 15px.

**Exportar e importar tema** em JSON — serve para repetir a identidade em outra
propriedade e para guardar um estado antes de experimentar.

### Novo: `src/lib/tema.ts`
Formato do tema num lugar só, com `lerTema()` tolerante a campo faltando e
`temaParaCss()` compartilhada entre site e prévia. É o que torna export, import e
conjuntos possíveis — não existiriam se cada opção fosse uma coluna solta.

### Corrigido
- Indicador de desenvolvimento do Next (`devIndicators: false`) — o círculo com "N"
  cobria o botão de WhatsApp e atrapalhava avaliar as telas. Só existia em
  desenvolvimento; erros de compilação continuam aparecendo.
- Rota de upload passou a aceitar as pastas `marca/` e `quartos/`, e os tipos de
  favicon (SVG e ICO).

---

## 2026-09-18 (8) — Upload real de fotos no cardápio

**Autor:** Claude Opus 5 (Cowork)

O cardápio pedia o **endereço** da imagem. Isso não é upload: exige que a foto já
esteja hospedada em algum lugar, o que ninguém da operação vai fazer. Agora o envio
é de arquivo mesmo, e cada item tem galeria própria.

### Armazenamento: Vercel Blob
- `@vercel/blob` 2.8.0 (API conferida antes de escrever, instalando no container).
- **O arquivo não passa pela função serverless.** O navegador envia direto para o
  storage; a rota `/api/admin/upload` só emite o token. Isso contorna o limite de
  ~4,5 MB de corpo de requisição — uma foto de celular passa disso com folga.
- A checagem de sessão acontece **dentro** de `onBeforeGenerateToken`, antes de
  qualquer token existir. Sem ela, a rota seria um upload aberto na internet.
- O caminho vindo do cliente é validado (`cardapio/` ou `galeria/`), tipos limitados
  a JPG/PNG/WebP/AVIF e tamanho a 12 MB.

### Nova tabela `cardapio_fotos` (migration 0004)
Guarda `pathname` além da `url`: é ele que o Blob usa para **apagar** o arquivo.
Sem isso, excluir um item deixaria a imagem órfã no storage, sendo cobrada para
sempre. Ao excluir uma foto, o arquivo sai junto; se a remoção no storage falhar, a
linha sai mesmo assim — melhor um arquivo órfão do que foto fantasma no site.

### Detalhe que evitaria um bug silencioso
Não usei o callback `onUploadCompleted` do Vercel Blob para gravar no banco: a
Vercel não consegue chamar de volta um `localhost`, então em desenvolvimento ele
**nunca dispararia** e a foto sumiria. Quem grava é o cliente, chamando a server
action com a URL devolvida pelo upload — funciona igual em dev e produção.

### Admin
- Arrastar-e-soltar, colar com Ctrl+V, selecionar vários de uma vez.
- **Barra de progresso por arquivo** — no 4G da ilha um envio de 8 MB demora, e sem
  barra parece travado.
- Grade com definir capa, reordenar, legenda por foto e excluir. A primeira foto
  vira capa sozinha; ao excluir a capa, a próxima é promovida.
- A grade é server component: cada ação é um form com server action, então funciona
  sem JavaScript e não há estado duplicado entre cliente e banco.
- Quando falta `BLOB_READ_WRITE_TOKEN`, a tela explica como configurar em vez de
  mostrar um botão que sempre falha.

### Site
- Miniatura abre um **lightbox** com a galeria do item. No celular: deslizar troca
  de foto, arrastar para baixo fecha. No computador: setas e Esc. O scroll do fundo
  é travado enquanto aberto — sem isso o toque rolava a página atrás.
- Contador "N fotos" sobre a miniatura quando há mais de uma.
- O lightbox vive no componente pai, não em cada card: um só por vez, e o card não
  carrega o visualizador inteiro para mostrar uma miniatura.

### Ação necessária
```
npm install                     # instala @vercel/blob
npm run db:migrate              # migrations 0003 (cardápio) e 0004 (fotos)
```
E na Vercel: aba **Storage** → criar um Blob store → conectar ao projeto →
`npx vercel env pull .env.local` para trazer o `BLOB_READ_WRITE_TOKEN`.

---

## 2026-09-18 (7) — Segunda rodada de correções após execução real

**Autor:** Claude Opus 5 (Cowork)

`db:baseline` e `db:migrate` funcionaram. As 56 fotos do WordPress entraram e o
hero trocou do beliche para uma foto real. Quatro problemas apareceram no caminho.

### 1. `db:corrigir` abortou no meio e deixou o banco pela metade
`column "pets" of relation "politicas" does not exist` — a coluna é **`pet`**
(boolean) + `pet_texto`. Erro meu de nome.

O problema maior era estrutural: uma falha derrubava **todos os passos seguintes**.
Políticas, depoimentos, subtítulo do topo e seções da home não chegaram a rodar.
Cada passo agora é isolado — falha, reporta, e o script segue. No fim lista o que
falhou e lembra que pode rodar de novo.

### 2. O `--dry` não era dry-run
`npm run db:migrar-wp --dry` **gravou de verdade**. O npm expande `--dry` para
`--dry-run`, consome o argumento e define `npm_config_dry_run` no ambiente — o
script nunca viu o flag. Foram 56 fotos inseridas no que deveria ser uma simulação.
Sorte que era o resultado desejado.

Agora o script lê `--dry`, `--dry-run` **e** `npm_config_dry_run`, e quando está
gravando de verdade avisa na primeira linha e ensina a forma correta
(`npm run db:migrar-wp -- --dry`).

### 3. `cached plan must not change result type`
Apareceu no site logo após a migration. O postgres.js guarda prepared statements
por conexão; adicionar a coluna `pousada.tema` invalidou os planos das conexões já
abertas do dev server.

Corrigido na raiz, em **51 arquivos**: todas as chamadas `postgres()` passam
`prepare: false`. Isso importa além deste episódio — `DATABASE_URL` aponta para o
**pooler do Neon** (PgBouncer em modo transaction), onde prepared statements não
sobrevivem à troca de conexão. O motivo está documentado em `src/db/index.ts`.

### 4. A foto do topo foi escolhida por acaso
O script do WordPress marcou uma aérea como destaque, mas dava `ordem` por
categoria — várias fotos ficaram com `ordem = 1`. Como a home escolhe o topo com
`ORDER BY ordem`, venceu uma foto qualquer (acabou sendo o Farol das Conchas, que
por sorte é boa) e não a aérea de drone.

Novo passo no `db:corrigir`: escolhe deterministicamente — aérea de drone primeiro,
depois panorâmicas por largura — marca `ordem = 0` e **limpa o destaque das demais**
fotos sem quarto vinculado, para existir um único topo.

### Ação necessária
```
npm run db:corrigir          # roda de novo: aplica o que faltou + escolhe o topo
```
Reinicie o dev server uma vez (`Ctrl+C`, `npm run dev`) para as conexões antigas
com plano em cache serem descartadas.

---

## 2026-09-18 (6) — Correção dos scripts de banco (3 falhas reportadas)

**Autor:** Claude Opus 5 (Cowork)
**Commits:** _(pendente de commit)_

Os três scripts falharam na primeira execução real. Duas causas, ambas erro meu.

### 1. `db:corrigir` e `db:migrar-wp` liam o arquivo de ambiente errado
`migrate.ts` (que já existia) usa `config({ path: ".env.local" })`. Eu escrevi os
scripts novos com `import "dotenv/config"`, que carrega **`.env`** — arquivo que não
existe neste projeto. Resultado: `DATABASE_URL` ficava `undefined`, o postgres.js
tentava `localhost:5432` e o erro não dizia nada (`❌ Falhou:` com mensagem vazia).

- Novo `src/db/env.ts`: carrega `.env.local` e `.env` nessa ordem, valida a variável
  e explica onde ela deveria estar. `migrate.ts` também passou a usá-lo.
- `explicarErro()` monta a mensagem a partir de `message`, `detail`, `hint`, `code`
  e `cause` — um `PostgresError` costuma ter o útil fora de `.message`, que foi
  exatamente o caso do erro vazio.

### 2. Crash do Node no Windows
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c`

Consequência da mesma falha: o `catch` chamava `process.exit(1)` com a conexão
ainda abrindo. Os três scripts agora guardam o cliente num escopo que o `catch`
alcança e fecham antes de sair.

### 3. `db:migrate` tentava reaplicar a migration 0000
```
CREATE TYPE "public"."escopo_comodidade" → type already exists
```
O banco foi criado com `drizzle-kit push`, que aplica o schema e **não registra
nada** em `drizzle.__drizzle_migrations`. Quando o projeto passou a usar
`db:migrate`, o migrator viu zero migrations registradas e tentou rodar a 0000
inteira.

Novo **`npm run db:baseline`**: confere que o schema realmente existe (procura as
tabelas principais), registra a 0000 como aplicada **sem executá-la**, e deixa as
demais para o `db:migrate`. Não cria, não altera e não apaga tabela nenhuma — só
escreve na tabela de controle. Rodar duas vezes não faz nada na segunda.

Lendo o código do drizzle em `node_modules` para escrever isso, confirmei que o
migrator **não compara hash**: ele lê o `created_at` mais recente e aplica toda
migration cujo `when` seja maior. Por isso o baseline registra a 0000 com o `when`
original dela — gravar "agora" faria o drizzle pular a 0001 e a 0002. Timestamps
do journal conferidos: 14/09 21:26 → 18/09 07:50 → 18/09 08:37, crescentes.

### Ordem corrigida
```
npm run db:baseline    # uma vez só, resolve o histórico do push
npm run db:migrate     # aplica 0001 (tema) e 0002 (tipos de bloco)
npm run db:corrigir
npm run db:migrar-wp --dry
npm run db:migrar-wp
```

---

## 2026-09-18 (5) — A home passa a ser editável pela administração

**Autor:** Claude Opus 5 (Cowork)
**Commits:** _(pendente de commit)_

### A tabela `blocos_home` estava morta
Existiam 10 seções semeadas e uma tela no admin para editá-las — e **o site
ignorava tudo**. A Cecília trocava o título, desativava uma seção, reordenava, e
nada acontecia na home, que era JSX fixo.

Agora a home é montada a partir de `blocos_home`:
- `src/components/site/BlocosHome.tsx` — cada seção virou um bloco, escolhido pelo
  `tipo`. Título e subtítulo vêm do banco, com o texto atual como padrão quando o
  campo está vazio. **Os dados continuam vindo de onde devem**: quartos do
  motor/banco, fatos do conteúdo canônico. Só a apresentação é configurável.
- Migration `0002` adiciona os tipos criados no redesign (`complexo`,
  `diferenciais`, `restaurante`, `avaliacoes`) ao enum `tipo_bloco`.

**Mescla em vez de substituir.** No primeiro teste a home ficou pior: o banco tinha
só os blocos antigos, então perdeu justamente as seções novas. A regra agora
distingue dois estados diferentes — tipo **sem linha** no banco é "ainda não
configurado" e entra pelo padrão; tipo **com linha inativa** é "escondido de
propósito" e é respeitado. Enquanto o banco não tiver todas as seções, vale a ordem
padrão; depois de sincronizado, a ordem do admin manda.

### Tela de seções reconstruída
Era um CRUD genérico que mal editava título (e com o link `/amin` quebrado).
Agora: ligar/desligar cada seção, **reordenar com setas**, editar título e texto de
apoio inline, e uma explicação do que cada seção mostra em linguagem de operação
("Topo do site — foto grande, nome da pousada e a busca de disponibilidade").

A reordenação **troca a `ordem` com a vizinha** em vez de renumerar tudo, para duas
pessoas editando ao mesmo tempo não embaralharem a home inteira. Há desempate por
índice, porque o seed gravou ordens que podiam colidir.

### Verificação de contraste (WCAG 2.1)
`src/lib/contraste.ts` calcula razão de contraste e a cor de texto legível sobre
qualquer fundo. Validado contra valores de referência: preto/branco dá 21:1 exato,
que é o máximo teórico.

O editor agora mostra o diagnóstico ao lado de cada cor, com um botão de amostra.
**E já pegou um erro meu**: o destaque `#F59E0B` pede texto escuro (8,3:1), mas eu
tinha usado `bg-acento text-white` no rodapé e na faixa de aviso — branco sobre
âmbar não se lê no celular ao sol.

Correção estrutural: `--marca-texto` e `--acento-texto` são calculados no servidor
e expostos como token, então `text-marca-texto` e `text-acento-texto` se adaptam
sozinhos a qualquer cor que a administração escolher. 14 arquivos convertidos; não
restou texto branco fixo sobre cor de marca.

### Corrigido
- O bloco `hero` tinha **"Seu refúgio pé na areia em Encantadas"** semeado — o mesmo
  erro factual, agora vindo do banco. Limpo no seed e no script de produção.
- No script, a limpeza do hero foi movida para **antes** da sincronização das seções:
  ela não depende da migration 0002, e estava dentro do mesmo `try` — sem a
  migration, o bloco inteiro falhava e o texto errado continuava no ar.

### Ação necessária (ordem importa)
```
npm run db:migrate    # migrations 0001 (tema) e 0002 (tipos de bloco)
npm run db:corrigir   # dados + sincroniza as seções da home
npm run db:migrar-wp  # as 68 fotos, com o hero aéreo
```

---

## 2026-09-18 (4) — Admin reorganizado, editor visual funcional e migração do WordPress

**Autor:** Claude Opus 5 (Cowork)
**Commits:** _(pendente de commit)_

### Corrigido: /quartos nunca mostrou foto nenhuma
A página de acomodações **não consultava a tabela `midias`**. O card tinha
`<span className="text-5xl">🏨</span>` fixo no lugar da imagem. Agora a query traz
a mídia em destaque do quarto (com fallback para a primeira por ordem), renderiza
com `next/image` e mostra o contador de fotos. Verificado: 7 de 7 cards com foto
real do motor.

Os selos de categoria também não passavam por `tituloQuarto()` — apareciam como
"Familia" e "Suite" sem acento em `/quartos`, na home e em `/reservar`. Corrigido
nos três.

### Novo: `npm run db:migrar-wp`
Script que traz as 68 imagens e os textos do WordPress legado (a API REST dele
está aberta). Idempotente, não apaga nada, aceita `--dry` e `--textos`.

- **Classifica por slug** e descarta 7 imagens que são do tema/demo do WordPress
  (`macbook-png`, `woocommerce-placeholder`, `about-jpg`…), além de logos e favicons.
- **Gera `alt` para todas.** Nenhuma imagem do WP tem `alt_text` preenchido, e a
  coluna é `NOT NULL` — além de ser barreira de acessibilidade.
- **Encontrou 6 fotos aéreas de drone** (`created-by-dji-camera`, 1600×750). A
  primeira é marcada como `destaque = true` **sem** `quarto_id`, que é exatamente o
  que a home procura para o hero. Resolve a foto de beliche no topo do site.

### Admin reorganizado
- **Sidebar agrupada em 6 módulos** (Visão geral, Acomodações, Conteúdo do site,
  Aparência, Hóspedes, Sistema). Eram 15 itens chapados numa lista única.
- **Passou a funcionar no celular.** Era `w-56` fixa dentro de um `flex h-screen`,
  sem nenhuma alternativa mobile — o painel ficava inutilizável. Agora tem barra
  superior, drawer, trava de scroll e marca a página ativa.
- Rótulos reescritos para a operação ("Fotos" em vez de "Mídias", "Contatos
  recebidos" em vez de "Leads").

### Dashboard real
Eram 3 cartões, um deles com `Status Worker: "—"` hardcoded. Agora:
- **Testa o motor de verdade** com `fetchTarifas()` para daqui a 7 dias e mostra
  latência e quantos tipos voltaram (medido: 1380ms, 6 tipos).
- **Avisos acionáveis**: sem foto de topo, quartos sem foto, motor fora do ar,
  contatos não lidos — cada um com link direto para resolver.
- Últimos contatos recebidos e a lista de pendências do briefing.

### Editor visual: agora salva o que mostra
- **Abas "Banner" e "Forma" passaram a persistir** em `pousada.tema` (jsonb). Antes
  eram `useState` que nunca chegava no `salvarTema` — a Cecília editava, via
  "Tema aplicado ao site" e nada acontecia.
- **A faixa de aviso é renderizada no site.** Salvar sem renderizar seria repetir o
  mesmo bug de outra forma.
- **Upload base64 bloqueado.** O editor antigo lia o arquivo com `FileReader` e
  gravava a imagem inteira em base64 na coluna `logo_url`; como o layout do site faz
  `SELECT *` em toda página, a logo trafegava inteira a cada request. A server action
  agora rejeita `data:` URL e a tela explica o porquê quando encontra uma já gravada.
- **Prévia ao vivo** refletindo cor, fonte, arredondamento, sombra, logo e faixa.
- A server action valida sessão, trata erro e diz para rodar a migration quando a
  coluna `tema` não existe. A tela detecta isso sozinha e avisa no topo.
- Nova aba **SEO** com prévia do resultado no Google e contador de caracteres.

### Pendência nova descoberta
O banco local tem **7 quartos ativos**, o motor Desbravador retorna **10** tipos.
O briefing já apontava divergência (histórico 24 · agregador 18 · site 11 categorias
· Expedia 13 opções) e isso confirma: o cadastro local está incompleto. Um tipo que
o motor tem e o banco não some do site, mesmo aparecendo em `/reservar`.

### Ação necessária
1. `npm run db:migrate` — cria a coluna `tema` (sem ela, Forma e Banner não salvam)
2. `npm run db:migrar-wp --dry` para conferir, depois sem `--dry` para importar
3. `npm run db:corrigir`
4. Conferir os 3 quartos que existem no motor e não no banco local

---

## 2026-09-18 (3) — Design tokens, redesign do site e conteúdo real da pousada

**Autor:** Claude Opus 5 (Cowork) — sessão ao vivo com dev server + briefing da administração
**Commits:** _(pendente de commit)_

### ERRO FACTUAL CORRIGIDO
O site afirmava **"Sua pousada pé na areia na Ilha do Mel"**. Pelo briefing da
administração, quem está pé na areia é o **Marimar Café Bistrô Bar**, na parte da
frente do complexo. As acomodações ficam **anexadas aos fundos** e não devem ser
apresentadas como se estivessem sobre a areia. Corrigido no código, no seed e no
script de produção. A frase canônica passa a aparecer na home, no rodapé, no FAQ,
em "A Pousada", no restaurante, em eventos e em como chegar.

**Coordenadas também estavam erradas:** o banco tinha `-25.5117, -48.3389`.
O correto é `-25.5684375, -48.3151875` (Plus Code CMJM+JW), que é o ponto do
restaurante, usado como referência para acessar a pousada aos fundos.

### O editor visual nunca esteve ligado ao site
Descoberto ao subir o dev server: o banco já tinha `cor_primaria = #B45309`
(paleta Âmbar) e `fonte_titulo = Montserrat` salvos, e o site **ignorava os dois** —
pintava `bg-teal-600` hardcoded em 11 arquivos e tinha `font-family: Arial` fixo
no `body`, por cima do Geist que era carregado e nunca usado.

Sistema de tokens instalado:
- `src/app/globals.css` — `--marca` e `--acento` viram uma escala completa via
  `color-mix(in oklab, ...)`: hover, ativa, escura, suave, borda, sutil. Uma cor
  de entrada gera o tom inteiro. Mapeados em `@theme inline`, então `bg-marca`,
  `text-marca`, `from-marca` respondem ao banco em tempo real, sem rebuild.
- `src/app/layout.tsx` — lê a pousada com `to_jsonb` (funciona antes e depois da
  migration), emite os tokens, e busca no Google Fonts **apenas** a fonte que o
  admin escolheu. Tokens de raio, sombra e duração de animação também saem daqui.
- 11 arquivos convertidos. Zero cor de marca hardcoded restante.

### Novo: coluna `tema jsonb` + migration `0001_tema_jsonb.sql`
As abas "Banner" e "Avançado" do editor tinham controles que **não salvavam nada** —
`useState` que nunca chegava no `salvarTema`. Não havia onde gravar. A coluna
`tema` resolve isso sem exigir migration a cada opção nova.

### Novo: `src/lib/conteudo-pousada.ts`
Fonte canônica do conteúdo da pousada, com separação explícita entre o que está
**confirmado** e o que está **pendente de confirmação** interna. O que não está
confirmado não renderiza (`RESTAURANTE.horarios = null`, `EVENTOS.capacidade = null`,
`CONTATO.telefoneRestaurante = null`). Guarda também os telefones históricos e o
CNPJ baixado, marcados para que ninguém os reintroduza por engano.

### Páginas novas
`/restaurante` · `/cafe-da-manha` · `/eventos` · `/como-chegar` · `/avaliacoes` · `/galeria`

Reescritas: `/` (home), `/a-pousada`, `/ilha-do-mel`, `/faq`, `/politicas`.

- **Home** — o complexo explicado visualmente (restaurante na frente ↔ pousada aos
  fundos), busca com campo de crianças, diferenciais, avaliações reais com barra por
  critério, localização e atrações.
- **Como chegar** — as 3 etapas do briefing, terminais, valores da travessia com
  data de consulta e link da ABALINE, aviso destacado sobre Encantadas ≠ Nova
  Brasília, Plus Code e links para Google Maps e OpenStreetMap.
- **Avaliações** — notas reais das 5 plataformas (1.691 avaliações somadas), com
  data de consulta e link para a origem. Inclui as subnotas baixas do Booking
  (Wi-Fi 6,0; custo-benefício 7,4) de propósito.
- **FAQ** — conjunto canônico agrupado em 4 temas cobrindo o que o briefing exige,
  mesclado sem duplicar com o que a administração cadastrar no admin.

### Corrigido
- **Menu mobile não existia.** O header era `hidden md:flex` sem alternativa: no
  celular não havia navegação nenhuma. Novo `MobileNav` com drawer, trava de
  scroll, fecha ao navegar e marca a página ativa.
- **Hover do menu era código morto.** `style={{ ":hover": {...} } as any}` — React
  não aplica pseudo-seletor em style inline, e o `as any` silenciava o TypeScript.
- **Header com fundo sólido**, conforme o briefing pede (era `bg-white/85` translúcido).
- `tituloQuarto()` agora repõe acento também em capitalização mista ("Familia" →
  "Família"), não só em CAIXA ALTA. 10 casos validados.
- Rodapé com a frase estrutural obrigatória e a arquitetura completa de navegação.

### Impacto do schema Zod corrigido (sessão anterior), agora visível
Com os campos do contrato deixando de ser descartados, a página de reserva passou
a exibir o `aviso_crianca` vindo do próprio motor ("Faixas etárias de criança não
configuradas...") e o selo de escassez a partir de `unidades_disponiveis`.

### Ação necessária
1. `npm run db:migrate` — cria a coluna `tema`
2. `npm run db:corrigir` — agora também aplica descrição correta do complexo,
   coordenadas, endereço, Instagram, políticas (check-in 14h, check-out 11h,
   **pets NÃO aceitos**) e **desativa os depoimentos do seed**, que não
   identificam plataforma de origem — o briefing proíbe depoimento sem atribuição
3. Cadastrar foto do hero (mídia com `destaque = true` e **sem** quarto vinculado).
   Hoje o hero cai numa foto de beliche
4. Migrar as 68 fotos e os textos do WordPress (API REST aberta)

### Pendente de confirmação da administração
Ver `PENDENTE_CONFIRMACAO` em `src/lib/conteudo-pousada.ts` — 13 itens, incluindo
razão social e CNPJ vigentes, número físico de suítes, horários do restaurante,
telefone próprio do restaurante e capacidade para eventos.

---

## 2026-09-18 (2) — Camada de apresentação, imagens e limpeza de conteúdo

**Autor:** Claude Opus 5 (Cowork) — revisão ao vivo do site publicado
**Commits:** _(pendente de commit)_

### Contexto: o domínio ainda é o WordPress antigo
`www.pousadamarimarilhadomel.com.br` serve **WordPress 5.8.16** (tema Consulting,
WooCommerce 4.7.4, Revolution Slider 5.4.8.3, Visual Composer 6.0.3). O Next.js
está publicado apenas em `marimar-site.vercel.app`. O DNS nunca foi apontado.
**Apontar o DNS é ação manual do Vinicios** — ver "Ação necessária".

### Adicionado
- `src/lib/format.ts` — camada de apresentação sobre os dados crus do motor:
  - `tituloQuarto()` — "SUITE KING" → "Suíte King" (com dicionário de acentos;
    respeita nomes que já vêm formatados do admin)
  - `resumir()` — corta no limite de palavra + reticências, em vez de `.slice(0,N)`
    que cortava no meio ("...viaja em grupo ou com cria")
  - `brl()` — `Intl.NumberFormat` pt-BR: 1040 → "R$ 1.040", 350.5 → "R$ 350,50"
  - `pluralizar()` — "2 noites" em vez de "2 noite(s)"
  - `escassez()` — mensagem só quando o estoque real do motor justifica
    (1 ou 2 unidades); nunca inventa urgência
  - `dataBR()`
- `src/db/corrigir-producao.ts` + script `npm run db:corrigir` — corrige os dados
  já gravados no Neon (idempotente, não destrutivo)

### Corrigido
- **Telefone placeholder em produção.** `src/db/seed.ts` semeava `(41) 99999-9999`,
  que estava no rodapé do site publicado. Real: **(41) 99501-2920** (confirmado no
  site WordPress). Corrigido no seed e no script de produção.
- Removidos todos os fallbacks `|| "5541999999999"` de `layout.tsx`, `page.tsx`,
  `quartos/[slug]/page.tsx` e `ChatWidget.tsx`. Sem número configurado, o botão
  de WhatsApp simplesmente não é renderizado — melhor que mandar o hóspede para
  um número inexistente.
- **Acentuação do texto visível ao hóspede.** A convenção "português sem acento"
  vale para código/colunas/rotas e tinha vazado para a UI: "Diaria", "Ate 4
  pessoas", "Esgotado no periodo", "pousada pe na areia", "Conheca nossas opcoes",
  "Localizacao", "Experiencias", "Paranagua".
- **Zod descartava campos do contrato.** `workerResponseSchema` declarava só um
  subconjunto e o Zod descarta chaves não declaradas por padrão — então
  `estadia_minima`, `unidades_disponiveis`, `disponibilidade_por_noite`,
  `total_geral`, `motivo_indisponivel`, `politica_crianca` e `aviso_crianca`
  chegavam do Worker e eram jogados fora antes da UI. Schema completo agora,
  com campos novos `.optional()` para não quebrar em payload degradado.
- `WORKER_TIMEOUT_MS` passou a ser respeitado (estava fixo em 12000).

### Alterado
- **Imagens via `next/image`.** As 12 fotos eram hotlink cru de
  `reservas.desbravador.com.br` (534–921ms cada, `load` medido em **6192ms**).
  `next.config.ts` ganhou `remotePatterns` + `minimumCacheTTL` de 7 dias, e os
  `<img>` viraram `<Image fill sizes=...>` na home e na busca.
- **Hero com foto.** Era um gradiente liso. Agora usa a primeira mídia em destaque
  **sem `quarto_id`** (foto da pousada/praia), com fallback para `og_image_url` e,
  por último, o gradiente. Overlay escuro garante legibilidade sobre qualquer foto.
- **Página `/reservar` reescrita.** Disponíveis e esgotados agora em blocos
  separados; card extraído para o componente `CardQuarto`; exibe estadia mínima,
  selo de escassez, valor de criança com faixa quando variável, aviso de política
  de criança do motor, e mensagem de erro com saída para o WhatsApp.
- Header: nome da pousada não some mais no mobile; logo de h-8 para h-9/h-10.

### Corrigido (build verificado no container, apos a revisao ao vivo)
- **O `next build` estava quebrando o deploy inteiro se o banco piscasse.**
  `src/app/(site)/layout.tsx` consulta a tabela `pousada` e nao declarava
  `force-dynamic`. O Next entao tentava PRERENDERIZAR as paginas cujo proprio
  `page.tsx` tambem nao declarava (`/contato`, `/faq`, `/politicas`,
  `/a-pousada`) e batia no Neon durante o build. Duas consequencias:
  1. Neon fora do ar ou lento na hora do deploy = **build falha por inteiro**
     (reproduzido: `Error occurred prerendering page "/contato"` →
     `ECONNREFUSED 127.0.0.1:5432` → `build worker exited with code: 1`)
  2. Quando passava, telefone, cores e textos ficavam **congelados no HTML
     estatico** — edicoes no admin so apareceriam no deploy seguinte
  Agora o layout declara `force-dynamic` e envolve a consulta em try/catch com
  defaults, entao uma queda do banco degrada a pagina em vez de derrubar o site.
- Build validado de ponta a ponta no container (`npx next build`): compila,
  TypeScript limpo, 42 rotas, todas as paginas do site como `ƒ` (dinamicas).

### Ação necessária (só o Vinicios pode fazer)
1. **`npm run db:corrigir`** — aplica telefone real, acentos e desativa o passeio
   de teste ("Vinicios / VR / R$ 350") que está público na home. O ambiente desta
   sessão não tem rota de rede até o Neon.
2. **Cadastrar a foto do hero** — Admin → Mídias → imagem com `destaque = true` e
   **sem quarto vinculado**. Sem isso o hero continua no gradiente.
3. **Apontar o DNS** para a Vercel e aposentar o WordPress.
4. Verificar se o otimizador de imagem da Vercel consegue buscar de
   `reservas.desbravador.com.br` (se o motor bloquear hotlink do datacenter, o
   plano B é espelhar as fotos em Vercel Blob).
5. Pendente da sessão anterior: `AGENT_API_KEY` na Vercel + OpenClaw.

---

## 2026-09-18 — Correcoes pos-migracao Vercel + hardening da API do agente

**Autor:** Claude Opus 5 (Cowork)
**Commits:** _(pendente de commit)_

### Seguranca
- **Bypass de autenticacao nas 7 rotas `/api/agent/*` corrigido.** As rotas comparavam
  `key !== process.env.AGENT_API_KEY` diretamente. Com a env var ausente no ambiente,
  os dois lados eram `undefined`, a comparacao passava e **qualquer request sem header
  de Authorization era autorizado** — expondo dados da pousada, catalogo, precos e o
  endpoint de criacao de leads.
- Criado `src/lib/agent-auth.ts` com `checkAgentAuth()`: fail-closed (nega se a env var
  faltar ou tiver menos de 16 chars), parsing estrito do header `Bearer`, comparacao em
  tempo constante contra timing attack. As 6 rotas com auth foram migradas para ele.
- Removido o fallback hardcoded `"marina-agent-key-marimar-2026"` de
  `src/app/(admin)/admin/integracoes/page.tsx`. A tela agora mostra
  "⚠️ AGENT_API_KEY nao configurada" em vez de vazar uma chave que funcionava.
- Removido o valor da `AGENT_API_KEY` em texto claro de `docs/openclaw-integracao.md`
  (arquivo versionado no GitHub).
- `AGENT_API_KEY` rotacionada em `.env.local`. A chave antiga
  `marina-agent-key-marimar-2026` esta **revogada**.

### Corrigido
- `src/app/(admin)/admin/blocos-home/page.tsx`: link de "Editar" apontava para
  `/amin/blocos-home` (typo) — botao dava 404. Corrigido para `/admin/blocos-home`.
- Criado `.gitattributes` com `* text=auto eol=lf` + `git config core.autocrlf input`
  + `git add --renormalize .`. Isso eliminou 15 arquivos que apareciam como
  "modificados" no `git status` com 537 insercoes / 537 delecoes que eram **apenas
  CRLF vs LF**, sem uma unica mudanca real de codigo.

### Alterado
- `docs/runbook.md` reescrito: removidas as instrucoes de deploy via
  `wrangler pages deploy` (Cloudflare foi abandonado nos commits `1b72a79` e `f578f12`).
  Agora documenta deploy Vercel, tabela completa de env vars, procedimento de rotacao
  da chave e checklist pos-deploy.
- `docs/openclaw-integracao.md`: nova secao documentando o comportamento fail-closed
  da autenticacao.

### Adicionado
- `docs/ESTADO-DO-PROJETO.md` — documento de handoff: stack, arquitetura de dados,
  mapa do codigo, convencoes, pendencias e protocolo para agentes de IA.
- `docs/CHANGELOG.md` — este arquivo.
- Ponteiros em `CLAUDE.md` e `AGENTS.md` para que qualquer agente leia as docs na entrada.

### Acao necessaria (fora do codigo)
1. **Vercel** → Settings → Environment Variables → atualizar `AGENT_API_KEY` com a nova
   chave (Production **e** Preview) → **redeploy** (env nova so vale com novo build)
2. **OpenClaw** → Custom API Tool `consultar-pousada-marimar` → atualizar o header
   `Authorization: Bearer <nova chave>`
3. Validar em producao:
   - `curl -i .../api/agent/pousada` (sem header) → deve dar **401**
   - `curl -i -H "Authorization: Bearer <nova>" .../api/agent/pousada` → deve dar **200**
4. Considerar revisar os logs do Worker/Vercel para trafego suspeito nas rotas
   `/api/agent/*` no periodo em que o bypass esteve ativo

---

## 2026-09-17 — Migracao Cloudflare Pages → Vercel

**Autor:** Vinicios (sessao anterior)
**Commits:** `41dd238` `1b72a79` `a6d1065` `f578f12` `aa7eae3` `a0c097e` `0f8cb73` `ba5c794`

### Alterado
- `41dd238` — Marimar Site v1.0 (commit inicial do projeto completo)
- `1b72a79` — removidas dependencias do Cloudflare, adicionadas deps de client faltantes
  para a Vercel
- `a6d1065` — `.gitignore` passa a ignorar artefatos de build
- `f578f12` — removido `open-next.config.ts`
- `aa7eae3` — server action de contato movida para arquivo separado
- `a0c097e` — ajuste de deps no `package.json`, rota de API nao usada removida
- `0f8cb73` — corrigido loop de redirect do middleware em `*.vercel.app`: o split de
  hostname `admin.*` agora so se aplica nos dominios de producao reais
- `ba5c794` — monitor de integracoes passa a resolver a URL base pelo host real da
  requisicao (em vez de `localhost`); spec OpenAPI gerada dinamicamente

---

## 2026-09-14 — v1.0 construida

**Autor:** Vinicios

### Adicionado
- Site publico completo: 11 paginas
- Painel admin: 14 CRUDs + login, troca de senha, diagnostico, integracoes
- API do agente: 7 rotas + OpenAPI 3.1
- Schema Drizzle com 18 tabelas + seeds
- Integracao com o Worker PousadaHub (scraping do motor Desbravador)
- Docs: `contrato-api.md`, `padrao-crud.md`, `manual-admin.md`, `runbook.md`,
  `openclaw-integracao.md`
