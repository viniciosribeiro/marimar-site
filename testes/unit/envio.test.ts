/**
 * Envio pelo WhatsApp e confirmação do aprendizado: o que não toca rede.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarRespostaFerramenta } from "../../src/lib/envio-whatsapp";
import { lerConfirmacao, textoPedirConfirmacao, textoConfirmarVersao } from "../../src/lib/escalonamento-base";

/* Formato real do OpenClaw 2026.9: { ok, result: { content: [{type:"text", text}], details } }. */
const resposta = (details: Record<string, unknown>) => ({ ok: true, result: { content: [{ type: "text", text: JSON.stringify(details) }], details } });

test("envio: com id da mensagem no WhatsApp conta como entregue", () => {
  const r = avaliarRespostaFerramenta(resposta({ channel: "whatsapp", to: "+5541999990000", via: "direct", result: { messageId: "3EB0ABC123" } }));
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.id, "3EB0ABC123");
});

test("envio: ok SEM result (melhor esforço que falhou calado) NÃO conta — o bug de 30/09", () => {
  const r = avaliarRespostaFerramenta(resposta({ channel: "whatsapp", to: "+5541999990000", via: "direct" }));
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.erro : "", /não confirmou a entrega/);
});

test("envio: segurado, simulado ou em outro canal não conta", () => {
  assert.equal(avaliarRespostaFerramenta(resposta({ channel: "whatsapp", via: "direct", deliveryStatus: "suppressed", result: {} })).ok, false);
  assert.equal(avaliarRespostaFerramenta(resposta({ channel: "whatsapp", via: "direct", dryRun: true })).ok, false);
  assert.equal(avaliarRespostaFerramenta(resposta({ channel: "internal", status: "ok", deliveryStatus: "sent", target: "current-run" })).ok, false);
  assert.equal(avaliarRespostaFerramenta({ ok: false, error: { message: "Tool not available: message" } }).ok, false);
});

test("envio: id em outros formatos (gateway, resultados em lista) é reconhecido", () => {
  assert.equal(avaliarRespostaFerramenta(resposta({ channel: "whatsapp", via: "gateway", result: { messageId: "wamid.X1" } })).ok, true);
  assert.equal(avaliarRespostaFerramenta({ ok: true, result: { details: { channel: "whatsapp", via: "direct", result: { results: [{ messageId: "M9" }] } } } }).ok, true);
});

test("confirmação: sim e não só quando curtos", () => {
  for (const s of ["sim", "Sim!", "pode", "ok", "👍", "isso mesmo", "Pode guardar."]) assert.equal(lerConfirmacao(s).tipo, "sim", s);
  for (const n of ["não", "Nao.", "n", "descarta", "não precisa"]) assert.equal(lerConfirmacao(n).tipo, "nao", n);
});

test("confirmação: qualquer outra coisa é a versão nova", () => {
  const r = lerConfirmacao("sim, mas o café vai até 10h30 no verão");
  assert.equal(r.tipo, "alterar");
  assert.equal(r.tipo === "alterar" && r.texto, "sim, mas o café vai até 10h30 no verão");
  assert.equal(lerConfirmacao("O berço é gratuito, é só pedir na reserva.").tipo, "alterar");
});

test("confirmação: os textos mostram a resposta, o código e as opções", () => {
  const p = textoPedirConfirmacao("K7Q2", "O berço é gratuito.");
  assert.match(p, /#K7Q2/); assert.match(p, /“O berço é gratuito\.”/); assert.match(p, /SIM/); assert.match(p, /NÃO/);
  assert.match(textoConfirmarVersao("K7Q2", "Nova versão"), /Ficou assim.*\n\n“Nova versão”[\s\S]*Confirma\?/);
});
