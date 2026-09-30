/**
 * A regra de crianças: a mesma conta para o site e para a Marina.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularOcupacao, textoCriancas, textoRegrasMarina, precoAdicional, REGRAS_PADRAO, type Regras,
} from "../../src/lib/regras-hospedagem-base";

const regra: Regras = { idadeColoMax: 2, criancaPagaComoAdulto: true, bebeCobranca: "gratis", bebeValor: null, observacao: null };

test("sem regra: tudo vai ao motor como antes (bebês somam às crianças)", () => {
  const o = calcularOcupacao({ adultos: 2, criancas: 2, bebes: 1, noites: 2 }, REGRAS_PADRAO);
  assert.equal(o.adultosMotor, 2);
  assert.equal(o.criancasMotor, 3);
  assert.equal(o.regraAplicada, false);
  assert.equal(o.valorBebes, null);
  assert.equal(textoCriancas(REGRAS_PADRAO), null);
});

test("criança que não é de colo vai ao motor como adulto; bebê grátis fica fora", () => {
  const o = calcularOcupacao({ adultos: 2, criancas: 2, bebes: 1, noites: 2 }, regra);
  assert.equal(o.adultosMotor, 4);
  assert.equal(o.criancasMotor, 0);
  assert.equal(o.valorBebes, 0);
  assert.equal(o.regraAplicada, true);
  assert.match(o.explicacao!, /2 crianças a partir de 3 anos pagam como adulto/);
  assert.match(o.explicacao!, /1 bebê de colo não paga/);
});

test("bebê pago por noite e por estadia", () => {
  const noite = calcularOcupacao({ adultos: 2, criancas: 0, bebes: 2, noites: 3 }, { ...regra, bebeCobranca: "por_noite", bebeValor: 20 });
  assert.equal(noite.valorBebes, 120);
  const estadia = calcularOcupacao({ adultos: 2, criancas: 0, bebes: 1, noites: 3 }, { ...regra, bebeCobranca: "por_estadia", bebeValor: 50 });
  assert.equal(estadia.valorBebes, 50);
});

test("criança sem pagar como adulto vai ao motor como criança", () => {
  const o = calcularOcupacao({ adultos: 2, criancas: 1, noites: 1 }, { ...regra, criancaPagaComoAdulto: false });
  assert.equal(o.adultosMotor, 2);
  assert.equal(o.criancasMotor, 1);
});

test("textos da regra e dos adicionais", () => {
  assert.equal(textoCriancas(regra), "Crianças a partir de 3 anos pagam como adulto, sem desconto. Bebês de colo (até 2 anos) não pagam.");
  const t = textoRegrasMarina(regra, [
    { id: "1", nome: "Berço", descricao: null, preco: null, cobranca: "por_estadia", categoria: "bebe", precisaPedir: true, visivelSite: true, visivelMarina: true, ativo: true },
    { id: "2", nome: "Oculto", descricao: null, preco: 10, cobranca: "por_noite", categoria: "quarto", precisaPedir: false, visivelSite: true, visivelMarina: false, ativo: true },
  ]);
  assert.match(t, /NÃO peça a idade exata/);
  assert.match(t, /Berço — sob consulta \(pedir com antecedência\)/);
  assert.doesNotMatch(t, /Oculto/);
  assert.match(precoAdicional({ preco: 35.5, cobranca: "por_noite" }), /R\$\s?35,50 por noite/);
});
