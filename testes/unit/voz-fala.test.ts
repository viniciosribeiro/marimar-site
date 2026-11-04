import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararFalaDaMarina } from "../../src/lib/voz-fala";

test("voz: link longo nunca e enviado para sintese", () => {
  const link = "https://reservas.desbravador.com.br/hotel-app/marimar/reservation?checkin=2026-11-10&checkout=2026-11-12&adults=2&child1=0&token=ABCD1234";
  const origem = "Família: R$ 780 para as duas noites. Para reservar, abra: " + link;
  const fala = prepararFalaDaMarina(origem);
  assert.match(fala, /Família: R\$ 780/);
  assert.doesNotMatch(fala, /https|desbravador|checkin|ABCD1234|www\./i);
  assert.ok(fala.length < origem.length);
  assert.equal(origem.includes(link), true, "a mensagem clicavel fica intacta");
});

test("voz: fallback quando o texto e so uma URL", () => {
  const fala = prepararFalaDaMarina("https://www.pousadamarimarilhadomel.com.br/quartos/familia");
  assert.equal(fala, "Enviei o link na mensagem. É só tocar nele para abrir.");
});

test("voz: remove URL de markdown mantendo so o rotulo", () => {
  const t = "Veja [os detalhes da suíte](https://www.pousadamarimarilhadomel.com.br/quartos/familia) e confira as fotos.";
  assert.equal(prepararFalaDaMarina(t), "Veja os detalhes da suíte e confira as fotos.");
});

test("voz: ignora links de fotos em markdown e mantém orientacao", () => {
  const t = "Aqui está a suíte: ![Foto](https://example.org/quarto.jpg) Enviei as imagens.";
  const voz = prepararFalaDaMarina(t);
  assert.equal(voz, "Aqui está a suíte: Enviei as imagens.");
});

test("voz: respostas com links sao curtas, sem truncar no meio de palavra", () => {
  const t = ("Encontrei quartos disponíveis. O valor pode mudar conforme o período. ").repeat(9) +
    "https://www.pousadamarimarilhadomel.com.br/reservar";
  const voz = prepararFalaDaMarina(t);
  assert.ok(voz.length <= 235);
  assert.doesNotMatch(voz, /https|marimarilhadomel/);
  assert.match(voz, /[.!?]$/);
});

test("voz: sem link nao altera respostas e valores existentes", () => {
  const t = "Para duas noites são R$ 780. O café da manhã está incluso.";
  assert.equal(prepararFalaDaMarina(t), t);
});

/* ── bloco de fala [[tts:text]] (skill de 04/11/2026) ───────────────── */
import { separarFalaDaMarina, textoSemBlocoDeFala } from "../../src/lib/voz-fala";

test("bloco de fala: a pessoa le a resposta sem o bloco e o audio fala so o bloco", () => {
  const resposta = "Suíte Queen, 10 a 12/11: R$ 780.\nReserve aqui: https://reservas.desbravador.com.br/x?roomCode=QUEEN\n\n[[tts:text]]Encontrei a Suíte Queen, setecentos e oitenta reais. O link está na conversa.[[/tts:text]]";
  const { texto, fala } = separarFalaDaMarina(resposta);
  assert.equal(texto, "Suíte Queen, 10 a 12/11: R$ 780.\nReserve aqui: https://reservas.desbravador.com.br/x?roomCode=QUEEN");
  assert.equal(fala, "Encontrei a Suíte Queen, setecentos e oitenta reais. O link está na conversa.");
  assert.equal(prepararFalaDaMarina(resposta), fala);
  assert.equal(textoSemBlocoDeFala(resposta), texto);
});

test("bloco de fala: URL escorregada dentro do bloco nao e narrada", () => {
  const fala = prepararFalaDaMarina("Texto. [[tts:text]]Toque em https://reservas.desbravador.com.br/x para reservar.[[/tts:text]]");
  assert.doesNotMatch(fala, /https|desbravador/);
  assert.match(fala, /reservar/);
});

test("bloco de fala: bloco aberto no meio do streaming nao aparece na tela", () => {
  assert.equal(textoSemBlocoDeFala("Encontrei opções. [[tts:text]]Encontrei op"), "Encontrei opções.");
  assert.equal(textoSemBlocoDeFala("Encontrei opções. [[tts:te"), "Encontrei opções.");
  assert.equal(textoSemBlocoDeFala("Encontrei opções. [[tts:text]]"), "Encontrei opções.");
});

test("bloco de fala: sem bloco, nada muda", () => {
  const t = "Check-in às 14h e check-out às 12h.";
  assert.deepEqual(separarFalaDaMarina(t), { texto: t, fala: null });
  assert.equal(prepararFalaDaMarina(t), t);
});
