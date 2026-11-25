import { test } from "node:test";
import assert from "node:assert/strict";
import { comEnderecoOficial, ehFotoNossa, ehVideoNosso, SITE_OFICIAL } from "../../src/lib/endereco-oficial";
import { blocosDaLinha, semPontuacaoFinal } from "../../src/lib/marcacao-chat";
import { catalogoEmTexto } from "../../src/lib/marina-catalogo";
import { CONTEXTO_CANAL } from "../../src/lib/chat";
import { CONTEXTO_WHATSAPP_OFICIAL } from "../../src/lib/whatsapp-meta-base";
import { REGRAS_CANAL_WHATSAPP } from "../../src/lib/marina-regras-canal";
import { SITE_PADRAO } from "../../src/lib/seo";

const FOTO = `${SITE_OFICIAL}/api/midia-quarto/suite-queen/0`;
const BLOB = "https://abc123.public.blob.vercel-storage.com/suites/queen-Xy9.jpg";
const VIDEO = "https://abc123.public.blob.vercel-storage.com/suites/queen-Xy9.mp4";

test("endereço: o técnico da Vercel vira o oficial; o resto do link não muda", () => {
  assert.equal(SITE_OFICIAL, SITE_PADRAO);
  assert.equal(comEnderecoOficial("Veja: https://marimar-site.vercel.app/quartos/suite-queen"), `Veja: ${SITE_OFICIAL}/quartos/suite-queen`);
  assert.equal(comEnderecoOficial("https://marimar-site.vercel.app/reservar?check_in=2026-12-09&adultos=2#preco"), `${SITE_OFICIAL}/reservar?check_in=2026-12-09&adultos=2#preco`);
  assert.equal(comEnderecoOficial("http://marimar-site.vercel.app"), SITE_OFICIAL);
  assert.equal(comEnderecoOficial("o site é https://marimar-site.vercel.app."), `o site é ${SITE_OFICIAL}.`);
  assert.equal(comEnderecoOficial("[site](https://marimar-site.vercel.app/)"), `[site](${SITE_OFICIAL}/)`);
  /* endereço de uma publicação específica da Vercel e o domínio sem www */
  assert.equal(comEnderecoOficial("https://marimar-site-fa8n2gg6v-viniciosribeiro.vercel.app/galeria"), `${SITE_OFICIAL}/galeria`);
  assert.equal(comEnderecoOficial("https://pousadamarimarilhadomel.com.br/quartos"), `${SITE_OFICIAL}/quartos`);
  assert.equal(comEnderecoOficial("http://www.pousadamarimarilhadomel.com.br/quartos"), `${SITE_OFICIAL}/quartos`);
});

test("endereço: o que não é o nosso site fica como está", () => {
  const reserva = "https://reservas.desbravador.com.br/hotel-app/pousada-ilha-do-mel-marimar/reservation?checkin=2026-12-09&checkout=2026-12-12&adults=2&child1=0&roomCode=QUEEN";
  assert.equal(comEnderecoOficial(reserva), reserva);
  assert.equal(comEnderecoOficial(BLOB), BLOB);
  assert.equal(comEnderecoOficial("https://admin.pousadamarimarilhadomel.com.br/admin"), "https://admin.pousadamarimarilhadomel.com.br/admin");
  assert.equal(comEnderecoOficial("https://outro-site.vercel.app/x"), "https://outro-site.vercel.app/x");
  assert.equal(comEnderecoOficial("https://marimar-site.vercel.app.golpe.com/x"), "https://marimar-site.vercel.app.golpe.com/x");
  assert.equal(comEnderecoOficial("https://wa.me/5541999990000"), "https://wa.me/5541999990000");
  /* duas vezes dá no mesmo */
  assert.equal(comEnderecoOficial(comEnderecoOficial("https://marimar-site.vercel.app/a")), `${SITE_OFICIAL}/a`);
});

test("mídia nossa: só as fotos servidas pelo site, o nosso armazenamento e vídeo do armazenamento", () => {
  assert.ok(ehFotoNossa(FOTO));
  assert.ok(ehFotoNossa(`${SITE_OFICIAL}/api/midia-secao/restaurante/2`));
  assert.ok(ehFotoNossa(BLOB));
  assert.ok(!ehFotoNossa(`${SITE_OFICIAL}/quartos/suite-queen`));
  assert.ok(!ehFotoNossa(`${SITE_OFICIAL}/api/midia-quarto/suite-queen/0/extra`));
  assert.ok(!ehFotoNossa("https://exemplo.com/foto.jpg"));
  assert.ok(!ehFotoNossa(VIDEO));
  assert.ok(ehVideoNosso(VIDEO));
  assert.ok(!ehVideoNosso("https://exemplo.com/video.mp4"));
});

test("chat: foto numa linha sozinha (o combinado) aparece como foto", () => {
  assert.deepEqual(blocosDaLinha(`![Suíte Queen — foto 1](${FOTO})`), [{ tipo: "imagem", url: FOTO, alt: "Suíte Queen — foto 1" }]);
  assert.deepEqual(blocosDaLinha(`  ![Por dentro](${VIDEO})  `), [{ tipo: "video", url: VIDEO, alt: "Por dentro" }]);
  assert.deepEqual(blocosDaLinha(VIDEO), [{ tipo: "video", url: VIDEO, alt: "" }]);
});

test("chat: a foto aparece mesmo quando a Marina formata fora do combinado", () => {
  /* marcador de lista e numeração */
  assert.deepEqual(blocosDaLinha(`- ![Queen](${FOTO})`), [{ tipo: "imagem", url: FOTO, alt: "Queen" }]);
  assert.deepEqual(blocosDaLinha(`1. ![Queen](${FOTO})`), [{ tipo: "imagem", url: FOTO, alt: "Queen" }]);
  assert.deepEqual(blocosDaLinha(`• ![Queen](${FOTO})`), [{ tipo: "imagem", url: FOTO, alt: "Queen" }]);
  /* legenda na mesma linha */
  assert.deepEqual(blocosDaLinha(`**Suíte Queen** — até 2 pessoas ![Queen](${FOTO})`), [
    { tipo: "texto", texto: "**Suíte Queen** — até 2 pessoas" },
    { tipo: "imagem", url: FOTO, alt: "Queen" },
  ]);
  /* duas fotos na mesma linha */
  assert.deepEqual(blocosDaLinha(`![a](${FOTO}) ![b](${BLOB})`), [
    { tipo: "imagem", url: FOTO, alt: "a" }, { tipo: "imagem", url: BLOB, alt: "b" },
  ]);
  /* endereço da foto solto, como link, e com ponto final grudado */
  assert.deepEqual(blocosDaLinha(FOTO), [{ tipo: "imagem", url: FOTO, alt: "" }]);
  assert.deepEqual(blocosDaLinha(`Foto 1: ${FOTO}.`), [{ tipo: "texto", texto: "Foto 1:" }, { tipo: "imagem", url: FOTO, alt: "" }]);
  assert.deepEqual(blocosDaLinha(`[Ver a foto](${FOTO})`), [{ tipo: "imagem", url: FOTO, alt: "Ver a foto" }]);
  /* o caso de 25/11: a foto escrita com o endereço técnico da Vercel */
  assert.deepEqual(blocosDaLinha("![Queen](https://marimar-site.vercel.app/api/midia-quarto/suite-queen/0)"), [{ tipo: "imagem", url: FOTO, alt: "Queen" }]);
  assert.deepEqual(blocosDaLinha("https://marimar-site.vercel.app/api/midia-quarto/suite-queen/0"), [{ tipo: "imagem", url: FOTO, alt: "" }]);
});

test("chat: o que não é mídia continua texto, com o endereço oficial", () => {
  assert.deepEqual(blocosDaLinha("Veja todas as fotos: https://marimar-site.vercel.app/quartos/suite-queen"),
    [{ tipo: "texto", texto: `Veja todas as fotos: ${SITE_OFICIAL}/quartos/suite-queen` }]);
  assert.deepEqual(blocosDaLinha("- Família: R$ 1.330 no total"), [{ tipo: "texto", texto: "- Família: R$ 1.330 no total" }]);
  assert.deepEqual(blocosDaLinha(""), [{ tipo: "texto", texto: "" }]);
  /* link comum e endereço de fora não viram imagem */
  const reserva = "[site oficial](https://reservas.desbravador.com.br/hotel-app/pousada-ilha-do-mel-marimar/reservation?checkin=2026-12-09)";
  assert.deepEqual(blocosDaLinha(`Reserve pelo ${reserva}.`), [{ tipo: "texto", texto: `Reserve pelo ${reserva}.` }]);
  assert.deepEqual(blocosDaLinha("https://exemplo.com/foto.jpg"), [{ tipo: "texto", texto: "https://exemplo.com/foto.jpg" }]);
});

test("chat: foto ainda chegando (resposta aos poucos) não pisca na tela", () => {
  const parcial = `![Suíte Queen](${FOTO}`;
  assert.deepEqual(blocosDaLinha(parcial), [{ tipo: "texto", texto: parcial }]);
  assert.deepEqual(blocosDaLinha(parcial + ")"), [{ tipo: "imagem", url: FOTO, alt: "Suíte Queen" }]);
});

test("chat: pontuação grudada no fim do endereço não entra no link", () => {
  assert.deepEqual(semPontuacaoFinal(`${SITE_OFICIAL}/quartos/suite-queen.`), { url: `${SITE_OFICIAL}/quartos/suite-queen`, resto: "." });
  assert.deepEqual(semPontuacaoFinal(`${SITE_OFICIAL}/reservar)`), { url: `${SITE_OFICIAL}/reservar`, resto: ")" });
  assert.deepEqual(semPontuacaoFinal("https://pt.wikipedia.org/wiki/Ilha_do_Mel_(Paraná)"), { url: "https://pt.wikipedia.org/wiki/Ilha_do_Mel_(Paraná)", resto: "" });
  assert.deepEqual(semPontuacaoFinal(`${SITE_OFICIAL}/reservar?adultos=2`), { url: `${SITE_OFICIAL}/reservar?adultos=2`, resto: "" });
});

test("catálogo: as fotos vão no pedido com os endereços do domínio oficial", () => {
  const texto = catalogoEmTexto({
    suites: [
      { nome: "Suíte Queen", slug: "suite-queen", ocupacao: 2, fotos: 4, videos: [{ titulo: "Por dentro", url: VIDEO }] },
      { nome: "Família", slug: "familia", ocupacao: 4, fotos: 0, videos: [] },
      { nome: "Suíte King", slug: "suite-king", ocupacao: null, fotos: 9, videos: [] },
    ],
    secoes: [{ chave: "restaurante", nome: "Restaurante", fotos: 2 }, { chave: "cafe", nome: "Café da manhã", fotos: 0 }],
  });
  assert.match(texto, /FOTOS E VÍDEOS DISPONÍVEIS AGORA/);
  assert.match(texto, /• Suíte Queen \(até 2 pessoas\)\n {2}página: https:\/\/www\.pousadamarimarilhadomel\.com\.br\/quartos\/suite-queen\n {2}fotos \(4\): /);
  for (const i of [0, 1, 2, 3]) assert.ok(texto.includes(`${SITE_OFICIAL}/api/midia-quarto/suite-queen/${i}`));
  assert.ok(!texto.includes("suite-queen/4"));
  assert.ok(texto.includes(`vídeo "Por dentro": ${VIDEO}`));
  assert.match(texto, /• Família \(até 4 pessoas\)\n.*\n {2}fotos: nenhuma cadastrada/);
  /* no máximo 6 por suíte: é o que a rota da foto serve */
  assert.ok(texto.includes("suite-king/5") && !texto.includes("suite-king/6"));
  assert.match(texto, /• Suíte King\n/);
  assert.ok(texto.includes(`• Restaurante (2): ${SITE_OFICIAL}/api/midia-secao/restaurante/0 ${SITE_OFICIAL}/api/midia-secao/restaurante/1`));
  assert.ok(texto.includes("• Café da manhã: nenhuma foto cadastrada"));
  assert.ok(!texto.includes("vercel.app/quartos") && !texto.includes("marimar-site.vercel.app"));
  /* todo endereço de foto da lista é reconhecido pela tela do chat */
  for (const url of texto.match(/https:\/\/\S+\/api\/midia-\S+/g) ?? []) assert.ok(ehFotoNossa(url), url);
  assert.equal(catalogoEmTexto({ suites: [], secoes: [{ chave: "cafe", nome: "Café da manhã", fotos: 0 }] }), "");
});

test("regras da Marina: o endereço do hóspede é o oficial nos três canais", () => {
  for (const regra of [CONTEXTO_CANAL, CONTEXTO_WHATSAPP_OFICIAL, REGRAS_CANAL_WHATSAPP]) {
    assert.ok(regra.includes(SITE_OFICIAL), "cita o endereço oficial");
    /* a regra antiga, que mandava o contrário, não pode voltar */
    assert.ok(!/NUNCA aponte para pousadamarimarilhadomel|Nunca aponte para pousadamarimarilhadomel/i.test(regra));
    assert.ok(!/NOSSO site\s*\(marimar-site\.vercel\.app\)/i.test(regra.replace(/\n/g, " ")));
    assert.match(regra.replace(/\n\s*/g, " "), /nunca escreva marimar-site\.vercel\.app/i);
  }
  assert.match(CONTEXTO_CANAL, /FOTOS E VÍDEOS DISPONÍVEIS AGORA/);
  assert.match(CONTEXTO_CANAL.replace(/\n/g, " "), /Nunca responda "não consigo exibir as fotos aqui"/);
});
