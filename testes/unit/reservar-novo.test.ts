/**
 * Site novo, /reservar: os resultados montados com as regras do Clássico.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarResultados, ordenar, textoMotivo } from "../../src/components/site-novo/reservar/resultados";
import { calcularOcupacao, REGRAS_PADRAO } from "../../src/lib/regras-hospedagem-base";
import type { WorkerQuarto, WorkerResponse } from "../../src/lib/worker";

const q = (id: string, x: Partial<WorkerQuarto> = {}): WorkerQuarto => ({
  id, nome: `SUITE ${id}`, categoria: "Casal", diaria: 500, total: 1000, total_geral: 1000, valor_adulto: 250,
  valor_crianca: 0, ocupacao_max: 2, estadia_minima: 1, disponivel: true, unidades_disponiveis: 3,
  pacote: "Café da manhã", comodidades: [], fotos: [`https://motor/${id}.jpg`], ...x,
});
const resposta = (quartos: WorkerQuarto[], indisponiveis: WorkerQuarto[] = []): WorkerResponse => ({
  hotel: "Marimar", check_in: "2026-12-09", check_out: "2026-12-11", adultos: 2, criancas: 0, noites: 2,
  quartos, indisponiveis, total_disponiveis: quartos.length,
});
const consulta = { checkIn: "2026-12-09", checkOut: "2026-12-11", adultos: 2, criancas: 0, bebes: 0 };
const local = (id: string, x: Record<string, unknown> = {}) => ({
  id: `l-${id}`, slug: `suite-${id.toLowerCase()}`, nome: `Suíte ${id}`, ativo: true, cat_nome: "Casal",
  descricao: null, descricao_motor: null, cama: "Casal", metragem: 18, vista: null, desbravador_room_id: id, ...x,
});

test("resultados: nome, capa, total e link como no Clássico", () => {
  const oc = { ...calcularOcupacao({ adultos: 2, criancas: 0, noites: 2 }, REGRAS_PADRAO), valorBebes: 80 };
  const [a, b] = montarResultados(resposta([q("QUEEN", { unidades_disponiveis: 1, estadia_minima: 3 }), q("KING")]), {
    consulta, noites: 2, oc,
    locais: [local("QUEEN")],
    fotos: [{ quarto_id: "l-QUEEN", url: "/painel/queen.jpg", alt: null }],
    comodidades: [{ quarto_id: "l-QUEEN", nome: "Wi-Fi" }],
    whatsapp: "5541999999999", query: "check_in=2026-12-09&check_out=2026-12-11&adultos=2&criancas=0",
  });
  assert.equal(a.nome, "Suíte QUEEN", "nome do cadastro local");
  assert.equal(a.fotoCapa, "/painel/queen.jpg", "foto do painel antes da do motor");
  assert.equal(a.totalFinal, 1000 + 80, "total do motor + bebês");
  assert.equal(a.escassez, "Última unidade disponível");
  assert.equal(a.avisoEstadia, 3);
  assert.deepEqual(a.comodidades, ["Wi-Fi"]);
  assert.equal(new URL(a.linkReserva).searchParams.get("roomCode"), "QUEEN");
  assert.equal(a.paginaSuite, "/quartos/suite-queen?check_in=2026-12-09&check_out=2026-12-11&adultos=2&criancas=0");
  assert.ok(a.whatsappUrl?.startsWith("https://wa.me/5541999999999?text="));
  assert.equal(b.nome, "Suíte King", "sem cadastro: nome do motor arrumado (tituloQuarto)");
  assert.equal(b.fotoCapa, "https://motor/KING.jpg");
  assert.equal(b.paginaSuite, null, "sem cadastro: nenhum link para /quartos (nunca 404)");
});

test("resultados: suíte desligada no site não ganha link; sem WhatsApp, sem botão", () => {
  const oc = calcularOcupacao({ adultos: 2, criancas: 0, noites: 2 }, REGRAS_PADRAO);
  const [r] = montarResultados(resposta([q("SR")]), {
    consulta, noites: 2, oc, locais: [local("SR", { ativo: false })], fotos: [], comodidades: [], whatsapp: "", query: "x=1",
  });
  assert.equal(r.paginaSuite, null);
  assert.equal(r.whatsappUrl, null);
});

test("resultados: sem tarifa e esgotados", () => {
  const oc = calcularOcupacao({ adultos: 2, criancas: 0, noites: 2 }, REGRAS_PADRAO);
  const lista = montarResultados(resposta([q("A", { diaria: 0, total: 0, total_geral: 0 })], [q("B", { disponivel: false, motivo_indisponivel: "esgotado no periodo" })]), {
    consulta, noites: 2, oc, locais: [], fotos: [], comodidades: [], whatsapp: "", query: "",
  });
  assert.equal(lista[0].temTarifa, false);
  assert.equal(lista[1].disponivel, false);
  assert.equal(lista[1].escassez, null, "escassez só para quem tem vaga");
  assert.equal(textoMotivo(lista[1].motivo), "Esgotado no periodo");
  assert.equal(textoMotivo(null), "Esgotado no período");
});

test("ordem: menor preço primeiro, sem tarifa no fim; padrão = ordem do motor", () => {
  const oc = calcularOcupacao({ adultos: 2, criancas: 0, noites: 2 }, REGRAS_PADRAO);
  const lista = montarResultados(resposta([q("C", { diaria: 900 }), q("Z", { diaria: 0 }), q("A", { diaria: 400 }), q("B", { diaria: 600 })]), {
    consulta, noites: 2, oc, locais: [], fotos: [], comodidades: [], whatsapp: "", query: "",
  });
  assert.deepEqual(ordenar(lista, "pousada").map((r) => r.codigo), ["C", "Z", "A", "B"]);
  assert.deepEqual(ordenar(lista, "preco").map((r) => r.codigo), ["A", "B", "C", "Z"]);
});
