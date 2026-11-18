/**
 * Modo voz — a resposta da pessoa a um "confirma?" (sem banco, sem servidor).
 *   npm test
 *
 * Os casos vêm das reclamações reais: confirmar repetindo o pedido virava
 * outro "confirma?" (loop), e "para" no meio da frase ("pode salvar para
 * mim") era lido como "não".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarResposta, mesmaAcao } from "../../src/lib/marina-voz-base";

const casos: [string, ReturnType<typeof classificarResposta>][] = [
  // sim claro — executa na hora
  ["Sim.", "sim"],
  ["sim", "sim"],
  ["Sim, pode salvar.", "sim"],
  ["Sim, pode salvar para mim.", "sim"],
  ["Pode sim, por favor.", "sim"],
  ["Isso mesmo.", "sim"],
  ["Ok.", "sim"],
  ["Tá bom.", "sim"],
  ["É isso.", "sim"],
  ["Com certeza!", "sim"],
  ["Claro, pode fazer.", "sim"],
  ["Confirmo.", "sim"],
  ["Beleza, Marina.", "sim"],
  ["Salva.", "sim"],
  // não — cancela
  ["Não.", "nao"],
  ["Não, obrigado.", "nao"],
  ["Não, por enquanto não.", "nao"],
  ["Cancela.", "nao"],
  ["Esquece.", "nao"],
  ["Deixa pra lá.", "nao"],
  ["Espera um pouco.", "nao"],
  ["Para!", "nao"],
  ["Agora não.", "nao"],
  // correção — cancela e a Marina propõe de novo
  ["Não, é às 15 horas.", "corrige"],
  ["Não, o certo é 41 99999-0000.", "corrige"],
  ["Sim, mas muda para às 15 horas.", "corrige"],
  ["Ok, mas troca o título.", "corrige"],
  // em dúvida — vai à Marina com a ação no contexto
  ["Isso, salva o check-in às 14 horas.", "outra"],
  ["Guarda que o check-out é ao meio-dia.", "outra"],
  ["Muda para 15 horas.", "outra"],
  ["Pode me explicar melhor?", "outra"],
  ["Pode repetir", "outra"],
  ["Como assim?", "outra"],
  ["Quanto custa o barco?", "outra"],
  ["O que você vai salvar?", "outra"],
  ["", "outra"],
];

for (const [fala, esperado] of casos) {
  test(`"${fala}" → ${esperado}`, () => {
    assert.equal(classificarResposta(fala), esperado);
  });
}

test("'para' no meio da frase não cancela (é preposição)", () => {
  assert.equal(classificarResposta("Pode guardar para mim"), "sim");
  assert.notEqual(classificarResposta("Sim, isso é para o site"), "nao");
});

test("mesmaAcao: ignora acento, caixa, pontuação e campos vazios", () => {
  const a = { nome: "ensinar", dados: { tipo: "fato", titulo: "Horário de check-in", conteudo: "O check-in começa às 14h.", variacoes: [] } };
  const b = { nome: "ensinar", dados: { conteudo: "o check-in comeca as 14h", titulo: "horario de check in", tipo: "fato", variacoes: [], lacuna_id: null } };
  assert.equal(mesmaAcao(a, b), true);
});

test("mesmaAcao: muda o dado → não é a mesma", () => {
  const a = { nome: "ensinar", dados: { titulo: "Check-in", conteudo: "às 14h" } };
  const b = { nome: "ensinar", dados: { titulo: "Check-in", conteudo: "às 15h" } };
  assert.equal(mesmaAcao(a, b), false);
  assert.equal(mesmaAcao({ nome: "faq", dados: {} }, { nome: "ensinar", dados: {} }), false);
  assert.equal(mesmaAcao(null, a), false);
});
