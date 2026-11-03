import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regressao: a busca recebe suites e tarifas reais do motor, inclusive suites
// cujo cadastro nao pode ser aberto em /quartos/[slug]. Nenhum clique para
// inspecionar o card pode sair de /reservar por essa rota.
const pagina = readFileSync(resolve("src/app/(site)/reservar/page.tsx"), "utf8");
const card = pagina.slice(pagina.indexOf("function CardQuarto({"));

test("cards de resultados nao navegam para paginas individuais que retornam 404", () => {
  assert.ok(card.length > 100, "componente CardQuarto encontrado");
  assert.doesNotMatch(card, /<Link\b|href=\{`\/quartos\//);
  assert.match(card, /<button type="button"[\s\S]*?Ver fotos e detalhes/);
  assert.match(card, /<button type="button" className="text-left[\s\S]*?\{r\.nomeLocal\}/);
  assert.match(card, /<button type="button" aria-label=\{`Ver detalhes do quarto/);
});

test("reservas e WhatsApp continuam destinos externos independentes do modal", () => {
  assert.match(card, /<a href=\{r\.deepLink\} target="_blank"/);
  assert.match(card, /<a href=\{r\.whatsappUrl\} target="_blank"/);
  assert.match(pagina, /quartoId: r\.id/);
  assert.match(pagina, /checkIn: ci, checkOut: co/);
});

test("dados do modal preservam fotos, tarifas e ocupacao vindas da busca", () => {
  assert.match(pagina, /fotos: r\.fotosGaleria \|\| \[\]/);
  assert.match(pagina, /diaria: Number\(r\.diaria\)/);
  assert.match(pagina, /total: Number\(r\.totalFinal\)/);
  assert.match(pagina, /ocupacao: Number\(r\.ocupacao_max\)/);
  assert.match(pagina, /reservaUrl: r\.deepLink/);
});
