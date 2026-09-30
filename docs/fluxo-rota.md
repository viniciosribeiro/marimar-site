# Rota até a pousada, no próprio site

> Criado em 30/09/2026. Página: `/como-chegar#rota`. Painel: **Admin → Rota e mapa** (`/admin/rota`).

O hóspede traça a rota **de onde estiver até a porta da pousada** sem sair do
site: carro (ou ônibus) até o terminal, barco até o Trapiche de Encantadas e,
por fim, a pé até a pousada. No celular, dá para acompanhar ao vivo.

## Serviços (todos gratuitos e sem chave)

| Para quê | Serviço | Onde se troca |
|---|---|---|
| Desenhar o mapa | **MapLibre GL 6** (código aberto, no pacote do site) com estilos do **OpenFreeMap** (`tiles.openfreemap.org/styles/liberty`, `positron`, `bright`) | Painel → Rota e mapa → Visual e serviços |
| Calcular a rota de carro e a pé | **OSRM da FOSSGIS** (`routing.openstreetmap.de/routed-car` e `/routed-foot`), com dados do OpenStreetMap | idem |
| Buscar o endereço digitado | **Photon** (Komoot) | idem |
| QR "abrir no celular" | pacote `qrcode`, gerado no navegador | — |

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
- **Navegação ao vivo (celular):** tela cheia, a tela não apaga (Wake Lock),
  próximo passo a menos de 25 m, recálculo quando a pessoa se afasta mais de
  90 m da rota (no máximo a cada 45 s, e nunca no trecho de barco), "Você
  chegou" a menos de 35 m da pousada.
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
- **Visual e serviços:** o estilo que abre primeiro e, em "avançado", os
  endereços dos serviços.
- **Mostrar a rota em Como chegar:** o interruptor geral.

Tudo vale na hora (a página é `force-dynamic`, e a action chama
`revalidatePath("/como-chegar")`).

A Marina recebe o link `…/como-chegar#rota` em `/api/agent/chegar`
(`dados.link_rota` e a última linha do `resumo_texto`), desde que a rota
esteja ligada e `NEXT_PUBLIC_SITE_URL` exista.

## Mapa do código

| Arquivo | O quê |
|---|---|
| `src/lib/rota-base.ts` | tipos, padrão, geometria (haversine, ponto na ilha, distância até a linha), OSRM → trechos, instruções em português, links externos. Sem banco e sem rede. |
| `src/lib/rota.ts` | ler e salvar no banco |
| `src/components/site/rota/MapaRota.tsx` | o mapa (MapLibre): linhas, pinos, "você", estilos, 3D |
| `src/components/site/rota/PlanejadorRota.tsx` | a tela do hóspede: origem, modo, terminal, linha do tempo, navegação |
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

- **Nada disto foi testado contra os serviços reais**: o ambiente em nuvem
  bloqueia hosts externos, e todo teste foi feito com o simulador. Primeiro
  teste de verdade: abrir `/como-chegar` no celular, com o 4G ligado.
- As coordenadas do trapiche e dos terminais são aproximadas. Confira-as no
  painel.
- Horários de barco não entram na rota. O link oficial da travessia continua
  na página.
- O trecho de barco é uma linha reta, e o de ônibus é uma estimativa.
