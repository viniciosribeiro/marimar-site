/**
 * Site novo, página da suíte: o estado do preço a partir da resposta do
 * motor e os textos curtos (capacidade, hóspedes, período).
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estadoDoPreco, hospedes, iconeDaComodidade, lerPessoas, linhaCapacidade, periodo,
} from "../../src/components/site-novo/quartos/preco";
import type { WorkerQuarto } from "../../src/lib/worker";

const quarto = (q: Partial<WorkerQuarto> = {}): WorkerQuarto => ({
  id: "FAM", nome: "STANDARD FAMILIA", categoria: "Familia", diaria: 550, total: 1650, total_geral: 1650,
  valor_adulto: 275, valor_crianca: 150, ocupacao_max: 4, estadia_minima: 1, disponivel: true,
  unidades_disponiveis: 3, pacote: "Café da manhã", comodidades: [], fotos: [], ...q,
});
const ctx = { noites: 3, hospedesNoMotor: 2, valorBebes: 0 };

test("preço: disponível com tarifa → diária, total do motor e o que vale avisar", () => {
  const e = estadoDoPreco(quarto({ unidades_disponiveis: 1, estadia_minima: 4 }), { ...ctx, valorBebes: 120 });
  assert.equal(e.tipo, "ok");
  if (e.tipo !== "ok") return;
  assert.equal(e.diaria, 550);
  assert.equal(e.total, 1650 + 120, "total = total_geral do motor + bebês à parte (a conta do /reservar)");
  assert.equal(e.valorBebes, 120);
  assert.equal(e.escassez, "Última unidade disponível");
  assert.equal(e.estadiaMinima, 4);
  assert.equal(e.pacote, "Café da manhã");
});

test("preço: sem total_geral, usa o total", () => {
  const e = estadoDoPreco(quarto({ total_geral: undefined, total: 999 }), ctx);
  assert.equal(e.tipo === "ok" && e.total, 999);
});

test("preço: nunca R$ 0 — diária 0 vira 'sem tarifa', disponível ou não", () => {
  assert.equal(estadoDoPreco(quarto({ diaria: 0 }), ctx).tipo, "sem_tarifa");
  assert.equal(estadoDoPreco(quarto({ diaria: 0, disponivel: false, motivo_indisponivel: "esgotado no período; sem tarifa publicada para o período" }), ctx).tipo, "sem_tarifa");
});

test("preço: esgotada, não acomoda, fora do motor e erro", () => {
  assert.equal(estadoDoPreco(quarto({ disponivel: false, motivo_indisponivel: "esgotado no periodo" }), ctx).tipo, "esgotada");
  const cheia = estadoDoPreco(quarto({ disponivel: false, ocupacao_max: 2 }), { ...ctx, hospedesNoMotor: 4 });
  assert.deepEqual(cheia, { tipo: "nao_comporta", capacidade: 2 });
  assert.equal(estadoDoPreco(quarto({ disponivel: false, cabe_hospedes: false }), ctx).tipo, "nao_comporta");
  assert.equal(estadoDoPreco(quarto({ disponivel: false, motivo_indisponivel: "não comporta o número de hóspedes" }), ctx).tipo, "nao_comporta");
  assert.equal(estadoDoPreco(null, ctx).tipo, "fora_do_motor");
  assert.equal(estadoDoPreco(quarto(), { ...ctx, falhou: true }).tipo, "erro");
});

test("textos: capacidade, hóspedes e período", () => {
  assert.equal(linhaCapacidade({ ocupacao_max: 4, cama: "Casal + 2 Solteiro", metragem: 18 }), "Até 4 pessoas, casal + 2 solteiro, 18 m²");
  assert.equal(linhaCapacidade({ ocupacao_max: 1, cama: null, metragem: null }), "Até 1 pessoa");
  assert.equal(hospedes({ adultos: 2, criancas: 1, bebes: 0 }), "2 adultos, 1 criança");
  assert.equal(hospedes({ adultos: 1, criancas: 0, bebes: 2 }), "1 adulto, 2 bebês");
  assert.equal(periodo("2026-12-09", "2026-12-12", 2026), "9 a 12 de dezembro");
  assert.equal(periodo("2026-11-28", "2026-12-02", 2026), "28 de novembro a 2 de dezembro");
  assert.equal(periodo("2026-12-28", "2027-01-02", 2026), "28 de dezembro de 2026 a 2 de janeiro de 2027");
  assert.equal(periodo("2027-01-10", "2027-01-13", 2026), "10 a 13 de janeiro de 2027");
});

test("filtro de pessoas e ícones das comodidades", () => {
  assert.equal(lerPessoas("3", 4), 3);
  assert.equal(lerPessoas("9", 4), 0, "acima da maior suíte: todas");
  assert.equal(lerPessoas("abc", 4), 0);
  assert.equal(lerPessoas(undefined, 4), 0);
  assert.equal(iconeDaComodidade("Wi-Fi Free"), "wifi");
  assert.equal(iconeDaComodidade("Ar-condicionado"), "ar");
  assert.equal(iconeDaComodidade("Smart TV"), "tv");
  assert.equal(iconeDaComodidade("Frigobar"), "check");
});
