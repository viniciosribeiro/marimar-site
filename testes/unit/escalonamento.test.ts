/**
 * Escalonamento e aprendizado: o que não toca banco nem rede.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  similaridade, LIMIAR_MESMA_PERGUNTA, anonimizar, perguntaParaBase, codigosNoTexto, gerarCodigo, normalizarNumero, mesmoNumero,
  dentroDoHorario, escolherContato, janelaAberta, acoesDePrazo, setorPara, pedeValidade, CONFIG_ESCALONAMENTO_PADRAO,
  type ContatoEquipe,
} from "../../src/lib/escalonamento-base";

const mesma = (a: string, b: string) => similaridade(a, b) >= LIMIAR_MESMA_PERGUNTA;

test("similaridade: a mesma pergunta com outras palavras cai no mesmo grupo", () => {
  assert.ok(mesma("Vocês aceitam cartão de débito?", "vcs aceitam debito?"));
  assert.ok(mesma("Aceita cachorro?", "Posso levar meu cachorro, vocês aceitam?"));
  assert.ok(mesma("Tem estacionamento?", "onde eu deixo o carro? tem estacionamento"));
  assert.ok(mesma("Qual o horário do café da manhã?", "que horas é servido o café da manhã?"));
});

test("similaridade: perguntas diferentes não se misturam", () => {
  assert.ok(!mesma("Aceita cachorro?", "Aceita cartão de crédito?"));
  assert.ok(!mesma("Qual o horário do café da manhã?", "Qual o horário do check-out?"));
  assert.ok(!mesma("Tem wi-fi no quarto?", "Tem ar-condicionado no quarto?"));
});

test("anonimizar: tira contato, documento e nome; mantém a pergunta", () => {
  const t = anonimizar("Meu nome é Ana Souza, meu zap é (41) 99999-1234 e email ana@x.com.br, CPF 123.456.789-09. Aceitam pet?");
  assert.doesNotMatch(t, /Ana|Souza|99999|ana@x|123\.456/);
  assert.match(t, /\[nome\]/); assert.match(t, /\[telefone\]/); assert.match(t, /\[e-mail\]/); assert.match(t, /\[documento\]/);
  assert.match(t, /Aceitam pet\?/);
});

test("pergunta para a base: sem a frase que só identificava a pessoa", () => {
  assert.equal(perguntaParaBase("Meu nome é Ana Souza. Vocês têm cofre?"), "Vocês têm cofre?");
  assert.equal(perguntaParaBase("Oi, me chamo João, aceitam pix?"), "Oi, aceitam pix?");
});

test("código: acha só códigos em aberto, com ou sem #, em qualquer caixa", () => {
  const abertos = ["K7Q2", "ZX34"];
  assert.deepEqual(codigosNoTexto("#k7q2 sim, aceitamos", abertos), ["K7Q2"]);
  assert.deepEqual(codigosNoTexto("sobre o ZX34: não", abertos), ["ZX34"]);
  assert.deepEqual(codigosNoTexto("SIM, OBRIGADA", abertos), []);
  assert.match(gerarCodigo(), /^[A-HJ-KM-NP-Z2-9]{4}$/);
});

test("números: DDI 55 e o 9 que o WhatsApp às vezes some", () => {
  assert.equal(normalizarNumero("(41) 99999-1234"), "5541999991234");
  assert.ok(mesmoNumero("+55 41 99999-1234", "554199991234"));
  assert.ok(!mesmoNumero("5541999991234", "5541999995678"));
  assert.equal(normalizarNumero("123"), null);
});

const c = (p: Partial<ContatoEquipe>): ContatoEquipe => ({
  id: p.id ?? "x", nome: p.nome ?? "x", numero: "5541999990000", setores: ["geral"], dias: [0, 1, 2, 3, 4, 5, 6],
  hora_inicio: "08:00", hora_fim: "18:00", ordem: 0, ativo: true, ...p,
});
/* 2026-09-30 é quarta-feira. 13:00 UTC = 10:00 em São Paulo; 23:00 UTC = 20:00. */
const manha = new Date("2026-09-30T13:00:00Z"), noite = new Date("2026-09-30T23:00:00Z");

test("horário: dentro, fora e virada da meia-noite", () => {
  assert.ok(dentroDoHorario(c({}), manha));
  assert.ok(!dentroDoHorario(c({}), noite));
  assert.ok(dentroDoHorario(c({ hora_inicio: "19:00", hora_fim: "07:00" }), noite));
  assert.ok(!dentroDoHorario(c({ dias: [1, 2] }), manha)); // quarta fora dos dias
});

test("escolherContato: setor, depois horário, depois prioridade; pula quem já foi avisado", () => {
  const lista = [
    c({ id: "geral1", setores: ["geral"], ordem: 0 }),
    c({ id: "fin-noite", setores: ["financeiro"], hora_inicio: "19:00", hora_fim: "23:59", ordem: 0 }),
    c({ id: "fin-dia", setores: ["financeiro"], ordem: 1 }),
  ];
  assert.equal(escolherContato(lista, "financeiro", [], manha)?.id, "fin-dia");
  assert.equal(escolherContato(lista, "financeiro", ["fin-dia"], manha)?.id, "fin-noite");
  assert.equal(escolherContato(lista, "passeios", [], manha)?.id, "geral1");
  assert.equal(escolherContato(lista, "financeiro", ["fin-dia", "fin-noite", "geral1"], manha), null);
  assert.equal(escolherContato([c({ ativo: false })], "geral", [], manha), null);
});

test("janela de 24h: só no modo oficial", () => {
  const agora = new Date("2026-09-30T12:00:00Z");
  assert.ok(janelaAberta("2026-09-29T00:00:00Z", agora, "web"));
  assert.ok(janelaAberta("2026-09-29T13:00:00Z", agora, "oficial"));
  assert.ok(!janelaAberta("2026-09-29T11:00:00Z", agora, "oficial"));
});

test("prazos: lembrete, próximo da fila, aviso ao cliente e desistência", () => {
  const cfg = CONFIG_ESCALONAMENTO_PADRAO; // 20 / 45 / 30 / 240 min
  const base = new Date("2026-09-30T12:00:00Z");
  const mais = (m: number) => new Date(base.getTime() + m * 60000);
  const ch = { status: "aguardando", criado_em: base, notificado_em: base, lembrete_em: null, cliente_avisado_em: null };
  assert.deepEqual(acoesDePrazo(ch, cfg, mais(10)), []);
  assert.deepEqual(acoesDePrazo(ch, cfg, mais(25)), ["lembrete"]);
  assert.deepEqual(acoesDePrazo({ ...ch, lembrete_em: mais(25) }, cfg, mais(31)), ["avisar_cliente"]);
  assert.deepEqual(acoesDePrazo({ ...ch, lembrete_em: mais(25), cliente_avisado_em: mais(31) }, cfg, mais(50)), ["proximo"]);
  assert.deepEqual(acoesDePrazo(ch, cfg, mais(300)), ["desistir"]);
  assert.deepEqual(acoesDePrazo({ ...ch, status: "entregue" }, cfg, mais(300)), []);
});

test("setor e validade pelo texto", () => {
  assert.equal(setorPara("Aceitam pix?"), "financeiro");
  assert.equal(setorPara("O chuveiro do quarto quebrou"), "manutencao");
  assert.equal(setorPara("Qual a cor da fachada?"), "geral");
  assert.ok(pedeValidade("Qual o preço do passeio de barco?"));
  assert.ok(!pedeValidade("Aceitam cachorro?"));
});
