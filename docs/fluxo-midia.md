# Fluxo de mídia: fotos, vídeos e roteiros da Marina

> Escrito em 30/09/2026. Leia antes de mexer em `/admin/midias`, em upload,
> em `midias`, em `/api/agent/quartos` ou `/api/agent/roteiros`.

## Resumo em uma tela

```
celular / computador
  │  câmera (foto ou vídeo) · galeria · arrastar e soltar
  ▼
navegador  ── src/lib/midia-cliente.ts ─────────────────────────────────
  │  foto:  HEIC→JPEG (heic-to) · maior lado 2400 px · JPEG 85%
  │  vídeo: confere ≤ 5 min · comprime (WebCodecs, lib mediabunny)
  │         site:     MP4 H.264/AAC, maior lado 1280, 1,8 Mbps + 128 kbps
  │         WhatsApp: segunda versão ≤ 15,5 MB, se a do site passar disso
  │         miniatura JPEG (quadro a 1 s)
  ▼
Vercel Blob  (upload direto do navegador; /api/admin/upload só emite o token)
  │  midias/fotos · midias/videos · midias/whatsapp · midias/miniaturas
  ▼
registrarMidia()  → tabela `midias` (uma linha por foto/vídeo)
  ▼
site (galeria, suítes, home) · Marina (/api/agent/quartos, roteiros)
```

## Por que comprimir no navegador

| Opção | Por que não |
|---|---|
| **Servidor (ffmpeg numa função)** | A Vercel limita corpo (~4,5 MB), tempo e memória de função. Um vídeo de 5 min em 4K do iPhone passa de 1 GB. Não cabe. |
| **ffmpeg.wasm no navegador** | ~30 MB de download, precisa de COOP/COEP (quebra o chat e os embeds), lento sem SIMD em celular. |
| **Mux / Cloudinary / serviço de vídeo** | Custo mensal e mais uma conta para a pousada manter. Fica como opção se o volume crescer. |
| **WebCodecs (escolhido)** | Usa o codificador de hardware do próprio aparelho — rápido e sem servidor. Suportado no Safari 16.4+ (iPhone), Chrome/Edge/Samsung Internet (Android e desktop). A lib `mediabunny` (MPL-2.0, ~carregada só quando há vídeo) faz a leitura de MP4/MOV/WebM e a gravação. |

### O que acontece em cada aparelho

| Situação | Resultado |
|---|---|
| iPhone (Safari), Android (Chrome/Samsung), desktop Chrome/Edge | MP4 H.264 comprimido + versão WhatsApp se precisar. **Caminho principal.** |
| Navegador sem H.264 no codificador, mas com VP9 (ex.: Chromium sem codecs proprietários — é o do ambiente de testes em nuvem) | WebM VP9/Opus para o site. **Sem versão WhatsApp**: a Marina manda o link da página. |
| Sem WebCodecs (navegador antigo) ou formato que o navegador não decodifica (HEVC do iPhone no Chrome do Windows) | Sobe o **original** se tiver até 200 MB; aviso na tela. |
| Vídeo com mais de 5 min | Recusado antes de subir, com a instrução de cortar no próprio celular. |

> ⚠️ **O caminho MP4 não pôde ser exercitado no ambiente em que foi escrito**
> (o Chromium de lá não tem codificador H.264). O caminho WebM foi testado:
> 1080p → 1280×720, metade do tamanho, miniatura gerada. **Testar num iPhone e
> num Android reais** é a primeira pendência.

### Formatos aceitos

- Foto: JPG, PNG, WebP, AVIF, **HEIC/HEIF** (iPhone; convertida para JPEG).
  PNG pequeno (< 800 KB, até 2400 px) passa intacto — logos com transparência.
- Vídeo: MP4, **MOV** (iPhone), M4V, WebM, 3GP. HEVC é lido onde o aparelho
  decodifica (iPhone, Mac, Android com hardware).

### Limites (em `LIMITES`, `src/lib/midia-cliente.ts`)

| | |
|---|---|
| Duração do vídeo | 5 min |
| Maior lado do vídeo (site) | 1280 px |
| Versão WhatsApp | ≤ 15,5 MB (o limite do WhatsApp é 16 MB) |
| Original sem compressão | 200 MB (a rota de upload aceita até 210 MB em `midias/`) |
| Foto | maior lado 2400 px |

## O banco: tabela `midias` (migration 0018, só acrescenta)

Colunas novas: `titulo`, `descricao`, `thumb_url`/`thumb_pathname`,
`duracao_seg`, `bytes`, `formato`, `url_whatsapp`/`pathname_whatsapp`/
`bytes_whatsapp`, `visivel_marina`, `atualizado_em`.

- **Álbum** = `secao` + `quarto_id`. `secao:pousada`, `quarto:<uuid>`,
  `secao:orientacao` (só da Marina — nunca aparece no site).
- **Ordem**: fotos e vídeos têm sequências **separadas** dentro do álbum. A
  ordem dos vídeos de uma suíte (entrada, interior, banheiro, vista) é a que o
  site mostra e a Marina envia.
- **Capa** (`destaque`): uma foto por álbum. A primeira foto de uma suíte vira
  capa sozinha.
- **`visivel_marina`**: tirar uma mídia da Marina sem tirar do site.
- Toda consulta do site filtra `tipo = 'foto'` onde espera foto; a galeria
  exclui `orientacao`.

## Roteiros de orientação (migration 0018)

```
marina_roteiros         id, titulo, descricao, gatilhos (jsonb: ["como chegar", …]),
                        ativo, ordem, atualizado_por, criado_em, atualizado_em
marina_roteiro_etapas   id, roteiro_id → cascade, ordem, titulo, texto,
                        video_id → midias (SET NULL), foto_id → midias (SET NULL), ativo
```

- Painel: **Marina → Mídias de orientação** (`AbaRoteiros.tsx`, ações em
  `acoes-roteiros.ts`).
- Escolha do roteiro: `roteiroPara()` em `src/lib/roteiros.ts` — conta quantas
  palavras-chave aparecem na frase (sem acento/caixa). Nenhuma → nenhum
  roteiro (a Marina responde normalmente).
- Excluir roteiro apaga as etapas, **nunca** as mídias.

## Como a Marina recebe e manda

| Canal | De onde vem | O que manda |
|---|---|---|
| WhatsApp | `/api/agent/conhecimento` (roteiros no texto, com `url_whatsapp`), `/api/agent/quartos` (`videos[]`), `/api/agent/roteiros?busca=` | Mídia só por `url_whatsapp`. `null` = grande demais ou WebM → manda o link da página. Regras na skill `marimar-pousada` ("Fotos e vídeos: como mandar"). |
| Site | `montarTreinamento(sql, "site")` (roteiros com `url` original) + `CONTEXTO_CANAL` | Markdown `![descrição](url)`; `.mp4/.webm` do nosso Blob vira player (`src/components/site/Marcacao.tsx`). |
| Área de teste | o mesmo texto do site, com códigos `#xxxxxx` | A resposta aparece com fotos e vídeos; o roteiro usado aparece como fonte. |

`midiaParaWhatsapp()` (`src/lib/roteiros.ts`) decide: versão leve → MP4 original
que cabe → nada.

**Depois de mudar a skill: reinstalar no OpenClaw** (ver `agente/README.md`).

## Testes

- `npm test` — `testes/unit/roteiros.test.ts` (escolha do roteiro, limite do
  WhatsApp, texto por canal).
- `testes/gateway-simulado.mjs` responde roteiros etapa por etapa com a mídia
  em markdown, como uma Marina obediente — para testar o caminho inteiro.

## Próximos passos

1. **Testar em aparelho real**: iPhone (foto HEIC, vídeo MOV/HEVC de 1–5 min,
   gravar pela câmera), Android Samsung/Motorola/Xiaomi, desktop Chrome e
   Safari. Conferir: barra de progresso, versão WhatsApp gerada (selo
   "WhatsApp ok" no detalhe da mídia), miniatura.
2. Mandar um vídeo de roteiro por WhatsApp real e conferir que chega como
   mídia (≤ 16 MB) e na ordem.
3. Se aparecer muito "vai como link": baixar o bitrate da versão WhatsApp, ou
   considerar um serviço de vídeo (Mux) — só se o volume justificar.
4. Reclassificar as fotos antigas que entraram como "A pousada" (filtro
   "Sem uso" e seleção em lote ajudam).
