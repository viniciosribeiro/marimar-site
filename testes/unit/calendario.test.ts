/**
 * Calendário de estadia: as contas de data, sem tela.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataIso, isoValido, noitesEntre, somarDias, somarMeses, mesDe, mesmoMes, mesAntes, gradeDoMes,
  dataCurta, dataBarra, dataPorExtenso, tituloMes, noitesTexto, pascoa, feriadosDoAno, diaSemana,
} from "../../src/lib/calendario";

test("virada do ano: 28/12 → 01/01 são 4 noites", () => {
  assert.equal(noitesEntre("2026-12-28", "2027-01-01"), 4);
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(dataIso(2026, 11, 32), "2027-01-01");
  assert.deepEqual(somarMeses({ ano: 2026, mes: 11 }, 1), { ano: 2027, mes: 0 });
});

test("meses: comparar e achar o mês de uma data", () => {
  assert.deepEqual(mesDe("2026-12-28"), { ano: 2026, mes: 11 });
  assert.ok(mesmoMes(mesDe("2026-12-01"), { ano: 2026, mes: 11 }));
  assert.ok(mesAntes({ ano: 2026, mes: 9 }, { ano: 2026, mes: 11 }));
  assert.ok(!mesAntes({ ano: 2027, mes: 0 }, { ano: 2026, mes: 11 }));
});

test("grade: dezembro de 2026 começa numa terça (2 casas vazias) e tem 31 dias", () => {
  const g = gradeDoMes({ ano: 2026, mes: 11 });
  assert.equal(g.filter((d) => d === null).length, 2);
  assert.equal(g.filter(Boolean).length, 31);
  assert.equal(g[2], "2026-12-01");
  assert.equal(diaSemana("2026-12-01"), 2);
});

test("validação: só data real em AAAA-MM-DD", () => {
  assert.ok(isoValido("2026-12-28"));
  assert.ok(isoValido("2028-02-29"));
  assert.ok(!isoValido("2027-02-29"));
  assert.ok(!isoValido("28/12/2026"));
  assert.ok(!isoValido(undefined));
});

test("textos em português", () => {
  assert.equal(dataCurta("2026-12-28"), "28 dez");
  assert.equal(dataBarra("2027-01-01"), "01/01/2027");
  assert.equal(dataPorExtenso("2026-12-28"), "28 de dezembro de 2026, segunda-feira");
  assert.equal(tituloMes({ ano: 2027, mes: 0 }), "Janeiro 2027");
  assert.equal(noitesTexto(1), "1 noite");
  assert.equal(noitesTexto(4), "4 noites");
});

test("feriados: Páscoa e datas móveis", () => {
  assert.equal(pascoa(2026), "2026-04-05");
  assert.equal(pascoa(2027), "2027-03-28");
  const f = feriadosDoAno(2027);
  assert.equal(f["2027-02-08"], "Carnaval");
  assert.equal(f["2027-02-09"], "Carnaval");
  assert.equal(f["2027-03-26"], "Sexta-feira Santa");
  assert.equal(f["2027-05-27"], "Corpus Christi");
  assert.equal(feriadosDoAno(2026)["2026-12-25"], "Natal");
});
