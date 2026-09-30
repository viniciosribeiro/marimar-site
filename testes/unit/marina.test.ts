/**
 * Testes das partes puras do treinamento da Marina.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensinamentosEmTexto, separarFontes, pareceSemResposta, codigoItem, CONFIG_PADRAO,
} from "../../src/lib/marina";
import { sugerirCategoria, situacaoItem, categoriaValida, tipoValido } from "../../src/lib/marina-base";
import { buscarNosDocumentos, dividirEmTrechos, palavrasDaBusca } from "../../src/lib/busca-documentos";

const item = (id: string, tipo: string, titulo: string, conteudo: string, extra: object = {}) =>
  ({ id, tipo, titulo, conteudo, categoria: "politicas", variacoes: [], ...extra });

test("o texto da Marina traz a regra de prioridade e agrupa por assunto", () => {
  const t = ensinamentosEmTexto(CONFIG_PADRAO, {
    fatos: [item("11111111-2222", "fato", "Crianças", "Criança que não é de colo paga como adulto.")],
    limites: [], perguntas: [], escalar: [], documentos: [],
  });
  assert.match(t, /PRIORIDADE/);
  assert.match(t, /\[Políticas\]/);
  assert.match(t, /Crianças: Criança que não é de colo paga como adulto/);
  assert.doesNotMatch(t, /#1111/, "sem códigos fora do modo teste");
});

test("perguntas e respostas saem com as variações; códigos só no modo teste", () => {
  const p = item("abcdef12-3456", "pergunta", "Posso chegar cedo?", "Check-in a partir das 14h.", { variacoes: ["Dá para entrar de manhã?"] });
  const t = ensinamentosEmTexto(CONFIG_PADRAO, { fatos: [], limites: [], perguntas: [p], escalar: [] }, { codigos: true });
  assert.match(t, /P: Posso chegar cedo\?/);
  assert.match(t, /Também perguntam: "Dá para entrar de manhã\?"/);
  assert.match(t, /R: Check-in a partir das 14h\./);
  assert.match(t, new RegExp(`\\[${codigoItem(p.id)}\\]`));
});

test("escalonamento entra mesmo sem itens do tipo escalar", () => {
  const t = ensinamentosEmTexto({ ...CONFIG_PADRAO, escalonamento: "Reclamação vai para a recepção." }, { fatos: [], limites: [] });
  assert.match(t, /QUANDO PASSAR PARA UMA PESSOA/);
});

test("sem nada ensinado, o texto fica vazio (a rota diz que não há ensinamentos)", () => {
  assert.equal(ensinamentosEmTexto(CONFIG_PADRAO, { fatos: [], limites: [] }), "");
});

test("separarFontes tira a linha FONTES e devolve os códigos", () => {
  const r = separarFontes("Criança paga como adulto.\nFONTES: #abcdef, #123abc");
  assert.equal(r.resposta, "Criança paga como adulto.");
  assert.deepEqual(r.codigos, ["#abcdef", "#123abc"]);
  assert.deepEqual(separarFontes("Sem fontes").codigos, []);
  assert.deepEqual(separarFontes("Oi\nFONTES: nenhuma").codigos, []);
});

test("detecta resposta de 'não sei'", () => {
  assert.ok(pareceSemResposta("Não tenho essa informação ainda. Vou confirmar com a pousada."));
  assert.ok(pareceSemResposta("Vou verificar com a recepção e te retorno."));
  assert.ok(!pareceSemResposta("O check-in é a partir das 14h."));
});

test("sugere categoria pelo texto", () => {
  assert.equal(sugerirCategoria("Qual o horário do barco em Pontal?"), "barcos");
  assert.equal(sugerirCategoria("Aceitam Pix?"), "pagamentos");
  assert.equal(sugerirCategoria("Criança paga?"), "politicas");
  assert.equal(sugerirCategoria("xyz"), "geral");
  assert.equal(categoriaValida("inexistente"), "geral");
  assert.equal(tipoValido("pergunta"), "pergunta");
  assert.equal(tipoValido("hack"), "fato");
});

test("situação do item: só 'em uso' quando o WhatsApp leu a versão atual", () => {
  const base = { ativo: true, excluido_em: null, verificacao: null, atualizado_em: "2026-09-30T10:00:00Z" };
  assert.equal(situacaoItem(base, {}).id, "aguardando");
  assert.equal(situacaoItem(base, { whatsapp: { canal: "whatsapp", lido_em: "2026-09-30T09:00:00Z", itens: 1, caracteres: 1 } }).id, "aguardando");
  assert.equal(situacaoItem(base, { whatsapp: { canal: "whatsapp", lido_em: "2026-09-30T11:00:00Z", itens: 1, caracteres: 1 } }).id, "em-uso");
  assert.equal(situacaoItem({ ...base, ativo: false }, {}).id, "desligado");
  assert.equal(situacaoItem({ ...base, excluido_em: "2026-09-30T12:00:00Z" }, {}).id, "lixeira");
  assert.equal(situacaoItem({ ...base, verificacao: "falhou" }, {}).id, "falhou");
});

test("busca nos documentos acha o trecho certo, sem acento e sem palavra vazia", () => {
  const texto = "Regras da casa.\n\nO estacionamento fica em Pontal do Sul, antes da travessia.\n\nO café é das 8h às 10h.";
  const achados = buscarNosDocumentos([{ id: "d1", nome: "regras.pdf", assunto: null, texto }], "Onde fica o ESTACIONAMENTO?");
  assert.equal(achados.length, 1);
  assert.match(achados[0].trecho, /estacionamento/);
  assert.deepEqual(palavrasDaBusca("Qual o horário do café?"), ["horario", "cafe"]);
  assert.equal(buscarNosDocumentos([{ id: "d1", nome: "x", assunto: null, texto }], "de o a").length, 0);
});

test("divide documento longo em trechos de tamanho de leitura", () => {
  const t = dividirEmTrechos(("Parágrafo de teste. ".repeat(30) + "\n\n").repeat(6), 800);
  assert.ok(t.length >= 3);
  assert.ok(t.every((x) => x.length <= 800));
});
