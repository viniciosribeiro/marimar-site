/**
 * Leitura da resposta do Worker (motor Desbravador): um quarto estranho não
 * pode derrubar a busca inteira.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerRespostaTarifas } from "../../src/lib/worker";

const pedido = { checkIn: "2026-12-28", checkOut: "2027-01-01", adultos: 2, criancas: 0 };

const quarto = (extra: Record<string, unknown> = {}) => ({
  id: "101", nome: "Suíte Casal", categoria: "Suíte", diaria: 900, total: 3600, valor_adulto: 450, valor_crianca: 0,
  ocupacao_max: 2, estadia_minima: 4, disponivel: true, unidades_disponiveis: 1, pacote: "Réveillon",
  comodidades: [], fotos: [], ...extra,
});

test("resposta normal passa inteira", () => {
  const r = lerRespostaTarifas({
    hotel: "Marimar", check_in: pedido.checkIn, check_out: pedido.checkOut, adultos: 2, criancas: 0, noites: 4,
    quartos: [quarto()], indisponiveis: [], total_disponiveis: 1,
  }, pedido);
  assert.equal(r.quartos.length, 1);
  assert.equal(r.quartos[0].total, 3600);
});

test("null, texto no lugar de número e campos faltando não derrubam a busca", () => {
  const r = lerRespostaTarifas({
    quartos: [
      quarto({ categoria: null, pacote: null, total_geral: null, comodidades: null, diaria: "900", total: "3600" }),
      quarto({ id: "102", diaria: null, total: null }), // disponível sem preço: fica de fora
    ],
    indisponiveis: [{ id: "103", nome: "Família", disponivel: false, diaria: null }],
  }, pedido);
  assert.equal(r.quartos.length, 1);
  assert.equal(r.quartos[0].diaria, 900);
  assert.equal(r.quartos[0].categoria, "");
  assert.equal(r.indisponiveis.length, 1);
  assert.equal(r.indisponiveis[0].disponivel, false);
  assert.equal(r.noites, 4);
  assert.equal(r.total_disponiveis, 1);
});

test("resposta sem quartos é erro claro", () => {
  assert.throws(() => lerRespostaTarifas({ erro: "motor fora do ar" }, pedido), /motor fora do ar/);
  assert.throws(() => lerRespostaTarifas(null, pedido), /vazia/);
});
