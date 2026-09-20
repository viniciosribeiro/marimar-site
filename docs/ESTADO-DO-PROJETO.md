# Estado do projeto — Marimar Site

> Atualizado em 19/09/2026.

## Onde estamos

**No ar e funcionando**

- Site na Vercel (`marimar-site.vercel.app`), disponibilidade e tarifas ao
  vivo do motor Desbravador.
- **Chat da Marina no site**, falando com a MESMA agente do WhatsApp pelo
  gateway do OpenClaw. Interruptor em `/admin/integracoes`.
- **Audio nos dois canais**: no site a pessoa grava e recebe resposta falada;
  quem escreve le e decide se quer ouvir. No WhatsApp, `tts.auto: "inbound"`.
- **`/admin/marina`** — a Cecilia treina a agente sem abrir a Hostinger: voz,
  jeito de falar, fatos, limites e revisao das conversas do site.

**O que so existe depois de rodar**

```
npm run db:migrate          # migrations 0009, 0010 e 0011
npm run db:migrar-fotos     # tira as imagens do WordPress antigo
```

## As tres pendencias que importam

1. **Imagens no servidor antigo.** O numero exato esta em
   `/admin/diagnostico`. Enquanto for maior que zero, a virada de DNS derruba
   imagem do site. Resolve com `npm run db:migrar-fotos`.
2. **DNS.** `www.pousadamarimarilhadomel.com.br` ainda serve o WordPress
   5.8.16 de 2021. Nao virar antes do item 1.
3. **3 quartos faltando** — o motor retorna 10 tipos, o banco tem 7 ativos.

## Pendencias menores

- As conversas do **WhatsApp** nao aparecem na revisao do painel: ficam no
  OpenClaw. Falta ver o que o gateway expoe.
- 13 itens em `PENDENTE_CONFIRMACAO`, em `src/lib/conteudo-pousada.ts`.
  **Nao publicar nenhum sem confirmacao da pousada.**
- Design system ainda nao aplicado em `a-pousada`, `ilha-do-mel`, `galeria`,
  `faq`, `politicas`, `contato`, `eventos`, `avaliacoes`.
- Galeria categorizada com lightbox.
- Redesenhar o admin no padrao editorial do site.

## O que este sistema NAO faz

A Marina **nao aprende sozinha** com as conversas. Nao ha ajuste fino. O que
parece aprendizado e a base de conhecimento crescendo porque alguem escreveu
nela pelo painel. Isto esta dito na tela, no `agente/README.md` e aqui de
proposito: prometer o contrario faz quem opera parar de ensinar, que e a
unica coisa que de fato melhora as respostas.

---

