# Rota até a pousada, no próprio site

> Criado em 30/09/2026. Página: `/como-chegar#rota`. Painel: **Admin → Rota e mapa** (`/admin/rota`).

O hóspede traça a rota **de onde estiver até a porta da pousada** sem sair do
site: carro (ou ônibus) até o terminal, barco até o Trapiche de Encantadas e,
por fim, a pé até a pousada. No celular, dá para acompanhar ao vivo, em
tela inteira. O mapa abre em 3D (inclinado, com relevo e prédios); quem
quiser troca para 2D no próprio mapa.

**Desde 19/10/2026 (aprovado pelo Vinicios):** navegação em **tela inteira**,
**prévia do caminho** ("Ver o caminho em 3D", a mesma tela andando sozinha,
para ver em casa) e **Mapbox opcional** (painel → Rota e mapa → Visual e
serviços).

## Serviços (gratuitos e sem chave; o Mapbox é opcional)

| Para quê | Serviço | Onde se troca |
|---|---|---|
| Desenhar o mapa | **MapLibre GL 6** (código aberto, no pacote do site) com estilos do **OpenFreeMap** (`tiles.openfreemap.org/styles/liberty`, `positron`, `bright`) | Painel → Rota e mapa → Visual e serviços |
| Calcular a rota de carro e a pé | **OSRM da FOSSGIS** (`routing.openstreetmap.de/routed-car` e `/routed-foot`), com dados do OpenStreetMap | idem |
| Buscar o endereço digitado | **Photon** (Komoot) | idem |
| QR "abrir no celular" | pacote `qrcode`, gerado no navegador | — |
| Relevo do 3D gratuito | **Terrain Tiles da AWS** (Open Data, formato Terrarium: `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`), com CORS aberto | Painel → Visual e serviços → Endereços |
| Mapa mais bonito (opcional) | **Mapbox GL JS 3.32** (pacote `mapbox-gl`, só baixado quando o Mapbox está ligado) com o estilo **Standard** (prédios, árvores, luz da hora na ilha) e **Standard Satellite**; relevo `mapbox-terrain-dem-v1` | Painel → Visual e serviços → Mapbox (token **público**, `pk.`) |

Esses serviços são comunitários e têm uso justo, sem cota paga. O consumo é
baixo: uma rota por visitante, calculada no navegador dele. Se um deles
sair do ar, troque o endereço no painel. O OSRM tem instâncias públicas
alternativas, e o Photon pode ser trocado por outro servidor Photon; não é
preciso mexer no código.

**Barco:** não existe roteador de barco. O trecho é uma linha reta do terminal
ao trapiche, e a duração é o "Barco (min)" de cada terminal no painel.
**Ônibus:** a estimativa é o tempo de carro × 1,35, e a tela avisa que é
aproximada.

## Por aparelho

- **iPhone:** o GPS pede permissão do Safari. Se a pessoa negar, a tela
  explica o caminho (Ajustes → Privacidade → Serviços de Localização →
  Safari). A bússola precisa de um toque para liberar (`DeviceOrientationEvent.requestPermission`).
  O plano B é o Apple Maps.
- **Android:** a permissão é do Chrome (cadeado → Permissões → Local). A
  bússola funciona sem pedir. Os planos B são o Google Maps e o Waze.
- **Computador:** a pessoa digita de onde vai sair ou usa os atalhos
  (Curitiba, Aeroporto). O botão **Abrir no celular** mostra um QR com a rota
  pronta.
- **Navegação ao vivo (celular), em tela inteira** (`NavegacaoTelaCheia.tsx`):
  só o mapa na tela — o menu do site e os botões da Marina e do WhatsApp
  somem. Em cima, a próxima manobra (seta, distância, texto e "Depois");
  embaixo, em vidro, a hora de chegada, o que falta, a barra de progresso por
  trecho, as **Etapas** e **Sair**. Ao lado: ver o caminho inteiro, 3D/2D e
  visual do mapa; se a pessoa arrasta o mapa aparece **Recentralizar**.
  A câmera segue a pessoa virada para onde o caminho vai, com o ponto
  "grudado" na rota quando está a menos de 25 m dela; o ponto desliza entre
  as leituras do GPS. A parte andada fica cinza. A tela não apaga (Wake Lock,
  pedido de novo ao voltar para o app). Recalcula quando a pessoa se afasta
  mais de 90 m (no máximo a cada 45 s, nunca no barco). "Você chegou" a menos
  de 35 m da pousada.
  - **Android e computador:** tela cheia de verdade (Fullscreen API; a barra
    do navegador some). Sair da tela cheia (Esc, gesto de voltar) fecha a
    navegação.
  - **iPhone:** o Safari não deixa um site esconder a própria barra; o mapa
    cobre a página inteira e a barrinha do endereço fica embaixo.
  - **Voltar do celular** fecha só a navegação, e a página volta para onde
    estava (há uma entrada no histórico com `history.pushState`, que o Next
    16 aceita).
  - Desenhada no `<body>` (`createPortal`): dentro da página, o movimento do
    site (transform em ancestrais) prendia o `position: fixed`, e o menu
    ficava por cima.
- **Prévia do caminho** ("Ver o caminho em 3D", em todo aparelho): a mesma
  tela, com o ponto andando sozinho em voo baixo (uns 20 a 30 s por trecho;
  câmera mais alta no carro e no barco). Pausar, ver de novo, Sair. Serve
  para conhecer o caminho em casa e para testar a navegação sem estar na ilha.
- **Sinal fraco:** a última rota fica guardada no aparelho por 7 dias
  (`localStorage`, chave `marimar:rota-salva`).
- **Link compartilhável:** `/como-chegar?de=LAT,LNG&terminal=pontal&modo=carro#rota`
  abre com a rota já calculada. O botão "Enviar a rota" usa esse link.
- A animação respeita "reduzir movimento" do sistema.

## Configuração (painel)

Fica guardada em `conteudo_editavel`, na chave `rota`, **sem migration**. O que
não estiver salvo vem de `ROTA_PADRAO` (`src/lib/rota-base.ts`).

- **Pontos:** a pousada, o trapiche e cada terminal podem ser **arrastados no
  mapa** ou ajustados digitando latitude e longitude.
  ⚠️ As coordenadas do trapiche e dos terminais são **aproximadas** (tiradas
  do OpenStreetMap). O painel mostra um aviso até alguém marcar "Conferi os
  pontos no mapa".
- **Terminais:** nome, minutos de barco, observação e qual é o principal
  (até 6).
- **Textos:** título, subtítulo, dica do sinal e mensagem de chegada.
- **Visual e serviços:**
  - **Como o mapa abre:** 3D (padrão) ou 2D;
  - **Mapbox (opcional):** ligar e colar o token **público** (`pk.`). O
    secreto (`sk.`) é recusado na tela e na action. Sem Mapbox ligado, ou se
    ele falhar no aparelho do hóspede (token recusado, cota, sem rede), o
    site volta sozinho para o mapa gratuito (`aoFalharMapbox`). O mapa do
    painel já mostra o Mapbox antes de salvar e avisa se ele recusou o token;
  - o estilo gratuito que abre primeiro e, em "avançado", os endereços dos
    serviços (inclusive o do relevo).
- **Mostrar a rota em Como chegar:** o interruptor geral.

Tudo vale na hora (a página é `force-dynamic`, e a action chama
`revalidatePath("/como-chegar")`).

A Marina recebe o link `…/como-chegar#rota` em `/api/agent/chegar`
(`dados.link_rota` e a última linha do `resumo_texto`), desde que a rota
esteja ligada e `NEXT_PUBLIC_SITE_URL` exista.

## Mapa do código

| Arquivo | O quê |
|---|---|
| `src/lib/rota-base.ts` | tipos, padrão, geometria (haversine, ponto na ilha, distância até a linha), OSRM → trechos (com a seta de cada manobra), instruções em português, links externos, Mapbox (`mapboxDoSite`, `tokenMapboxValido`, `luzDaHora`) e o **percurso** da navegação (`montarPercurso`, `projetar`, `pontoEm`, `rumoEm`, `proximoPasso`, `restante`, `linhaAte`, velocidade e zoom da prévia). Sem banco e sem rede. |
| `src/lib/rota.ts` | ler e salvar no banco |
| `src/components/site/rota/MapaRota.tsx` | o mapa, com dois motores (MapLibre gratuito ou Mapbox): linhas com brilho, parte andada, pinos, "você" (ponto ou seta deitada no chão), estilos, 3D (relevo, céu, prédios), voo de abertura, câmera da navegação |
| `src/components/site/rota/NavegacaoTelaCheia.tsx` | navegação e prévia em tela inteira (GPS, câmera, instruções, etapas, tela cheia, voltar) |
| `src/components/site/rota/PlanejadorRota.tsx` | a tela do hóspede: origem, modo, terminal, linha do tempo, botões de navegação e prévia, 3D/2D |
| `src/app/(admin)/admin/rota/` | o painel |
| `scripts/copiar-maplibre.mjs` | copia o worker do MapLibre 6 para `public/vendor/maplibre/` (roda no `predev` e no `prebuild`; a pasta é ignorada pelo git) |

**Por que copiar o worker:** o MapLibre 6 carrega o worker como módulo
separado, e o bundler do Next não o empacota. Sem a cópia, o mapa fica em
branco em produção. Na Vercel, o `npm run build` roda o `prebuild`
automaticamente.

**Pinos:** o MapLibre posiciona o elemento externo do marcador com
`transform` inline. Por isso o desenho (a gota girada) fica num filho
(`.rota-pino > .rota-marcador`). Se o desenho for posto no elemento externo,
o pino sai do lugar e deixa de arrastar.

**Versão:** use MapLibre **6.x**. A 5.x tinha um XSS crítico
(GHSA-jrc7-96c5-q579, corrigido a partir da 6.4.1).

## Testar localmente (sem internet)

```bash
node testes/mapa-simulado.mjs     # porta 4020: estilos, OSRM e Photon falsos
```

Aponte a configuração do banco local para o simulador (uma vez):

```sql
UPDATE conteudo_editavel SET dados = jsonb_set(jsonb_set(jsonb_set(jsonb_set(dados::jsonb,
  '{servicos}', '{"rotaCarro":"http://localhost:4020/carro/route/v1/driving","rotaPe":"http://localhost:4020/pe/route/v1/driving","busca":"http://localhost:4020/busca"}'),
  '{estilos,0,url}', '"http://localhost:4020/estilo/mapa"'),
  '{estilos,1,url}', '"http://localhost:4020/estilo/claro"'),
  '{estilos,2,url}', '"http://localhost:4020/estilo/colorido"')
WHERE chave = 'rota';
```

(Se a linha não existir, salve uma vez pelo painel antes.)

```bash
npx tsx --test testes/unit/rota.test.ts
SAIDA=capturas node testes/e2e-rota.mjs   # computador, iPhone com GPS, Android, painel
```

O Chromium sem tela precisa de `--use-gl=swiftshader --enable-unsafe-swiftshader`
para o WebGL (o e2e já passa esses flags).

## Limites conhecidos

- **O Mapbox não foi aberto daqui** (o ambiente em nuvem não alcança
  `api.mapbox.com`). Foi testado que o pacote carrega, tenta o Mapbox e, sem
  ele, volta para o gratuito. Conferir no aparelho de verdade com o token.
- O 3D pesa mais que o 2D em celular antigo; o hóspede troca no mapa, e o
  painel define como abre.
- No iPhone a barra do Safari não some (limite do próprio iPhone para sites).

- **Nada disto foi testado contra os serviços reais**: o ambiente em nuvem
  bloqueia hosts externos, e todo teste foi feito com o simulador. Primeiro
  teste de verdade: abrir `/como-chegar` no celular, com o 4G ligado.
- As coordenadas do trapiche e dos terminais são aproximadas. Confira-as no
  painel.
- Horários de barco não entram na rota. O link oficial da travessia continua
  na página.
- O trecho de barco é uma linha reta, e o de ônibus é uma estimativa.
