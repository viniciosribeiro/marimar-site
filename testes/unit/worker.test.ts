/**
 * Leitura da resposta do Worker (motor Desbravador): um quarto estranho não
 * pode derrubar a busca inteira.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerRespostaTarifas } from "../../src/lib/worker";
import { buildDeepLink } from "../../src/lib/deeplink";

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

/* Link do "Reservar no site oficial" (19/10/2026): o formato do motor novo, o mesmo da Marina. */

test("buildDeepLink: abre a tela de reserva do motor com datas ISO e hóspedes", () => {
  const u = new URL(buildDeepLink({ checkIn: "2026-12-30", checkOut: "2027-01-02", adultos: 3, criancas: 1 }));
  assert.equal(u.origin + u.pathname, "https://reservas.desbravador.com.br/hotel-app/pousada-ilha-do-mel-marimar/reservation");
  assert.equal(u.searchParams.get("checkin"), "2026-12-30");
  assert.equal(u.searchParams.get("checkout"), "2027-01-02");
  assert.equal(u.searchParams.get("adults"), "3");
  assert.equal(u.searchParams.get("child1"), "1");
  assert.equal(new URL(buildDeepLink({ checkIn: "2026-11-20", checkOut: "2026-11-22", adultos: 2 })).searchParams.get("child1"), "0");
});
