/**
 * Conectar o WhatsApp pelo painel: leitura das respostas do OpenClaw.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerPassoQr, faseDoPasso } from "../../src/lib/whatsapp-conexao";

const QR = "data:image/png;base64,iVBORw0KGgo=";

test("qr: acha o QR e a sessão dentro do envelope { ok, payload } do gateway", () => {
  const p = lerPassoQr({ ok: true, payload: { qrDataUrl: QR, sessionKey: "s-1", message: "Scan this QR in WhatsApp → Linked Devices." } });
  assert.equal(p.qr, QR);
  assert.equal(p.sessao, "s-1");
  assert.equal(faseDoPasso(p).fase, "qr");
});

test("qr: lido no celular vira conectado; QR novo continua em qr", () => {
  assert.equal(faseDoPasso(lerPassoQr({ ok: true, payload: { connected: true, message: "✅ Linked! WhatsApp is ready." } })).fase, "conectado");
  assert.equal(faseDoPasso(lerPassoQr({ connected: false, qrDataUrl: QR, message: "QR refreshed. Scan the latest code in WhatsApp → Linked Devices." })).fase, "qr");
});

test("qr: espera, vencimento e erro desconhecido", () => {
  assert.equal(faseDoPasso(lerPassoQr({ connected: false, message: "Still waiting for the QR scan. Let me know when you’ve scanned it." })).fase, "esperando");
  assert.equal(faseDoPasso(lerPassoQr({ connected: false, message: "The login QR expired. Ask me to generate a new one." })).fase, "venceu");
  assert.equal(faseDoPasso(lerPassoQr({ connected: false, message: "No active WhatsApp login in progress." })).fase, "venceu");
  const desconhecido = faseDoPasso(lerPassoQr({ message: "WhatsApp login failed: boom" }));
  assert.equal(desconhecido.fase, "erro");
  assert.match(desconhecido.texto, /boom/);
});

test("qr: texto que não é imagem não passa por QR", () => {
  assert.equal(lerPassoQr({ qrDataUrl: "javascript:alert(1)" }).qr, null);
});
