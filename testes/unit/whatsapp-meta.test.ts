/**
 * API oficial do WhatsApp (Meta): o que não toca rede nem banco.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  assinaturaValida, lerEntrada, partirResposta, paraWhatsapp, paraVariavel, erroDaMeta, faltandoMeta, LIMITE_TEXTO,
} from "../../src/lib/whatsapp-meta-base";

const assinar = (corpo: string, segredo: string) => "sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex");

test("meta: assinatura certa passa; errada, ausente ou sem segredo não", () => {
  const corpo = JSON.stringify({ object: "whatsapp_business_account" });
  assert.equal(assinaturaValida(corpo, assinar(corpo, "segredo"), "segredo"), true);
  assert.equal(assinaturaValida(corpo, assinar(corpo, "outro"), "segredo"), false);
  assert.equal(assinaturaValida(corpo + " ", assinar(corpo, "segredo"), "segredo"), false);
  assert.equal(assinaturaValida(corpo, null, "segredo"), false);
  assert.equal(assinaturaValida(corpo, assinar(corpo, "segredo"), undefined), false);
  assert.equal(assinaturaValida(corpo, "sha256=zz", "segredo"), false);
});

/* Formato do aviso de mensagem da Cloud API. */
const aviso = (mensagens: unknown[], phoneId = "PHONE1", campo = "messages") => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: campo, value: {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "5541995012920", phone_number_id: phoneId },
    contacts: [{ wa_id: "5541988887777", profile: { name: "Ana" } }],
    ...(campo === "messages" ? { messages: mensagens } : { message_echoes: mensagens }),
  } }] }],
});

test("meta: lê texto, áudio, localização e botão; ignora reação e status", () => {
  const lidas = lerEntrada(aviso([
    { from: "5541988887777", id: "wamid.1", timestamp: "1", type: "text", text: { body: "Tem vaga?" } },
    { from: "5541988887777", id: "wamid.2", type: "audio", audio: { id: "MID", mime_type: "audio/ogg; codecs=opus", voice: true } },
    { from: "5541988887777", id: "wamid.3", type: "location", location: { latitude: -25.56, longitude: -48.31, name: "Pontal do Sul" } },
    { from: "5541988887777", id: "wamid.4", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "b1", title: "Sim" } } },
    { from: "5541988887777", id: "wamid.5", type: "reaction", reaction: { emoji: "👍", message_id: "wamid.1" } },
    { from: "5541988887777", id: "wamid.6", type: "text", text: { body: "respondendo" }, context: { from: "x", id: "wamid.MEU" } },
  ]), "PHONE1");
  assert.deepEqual(lidas.map((m) => m.id), ["wamid.1", "wamid.2", "wamid.3", "wamid.4", "wamid.6"]);
  assert.equal(lidas[0].texto, "Tem vaga?");
  assert.equal(lidas[0].nome, "Ana");
  assert.equal(lidas[0].de, "5541988887777");
  assert.deepEqual(lidas[1].midia, { id: "MID", mime: "audio/ogg; codecs=opus" });
  assert.match(lidas[2].texto ?? "", /-25.56, -48.31 — Pontal do Sul/);
  assert.equal(lidas[3].texto, "Sim");
  assert.equal(lidas[4].citadoId, "wamid.MEU");
  assert.equal(lidas.every((m) => !m.eco), true);
});

test("meta: aviso de outro número da conta é ignorado; eco da pousada vira eco", () => {
  assert.equal(lerEntrada(aviso([{ from: "1", id: "w", type: "text", text: { body: "x" } }], "OUTRO"), "PHONE1").length, 0);
  const eco = lerEntrada(aviso([{ from: "5541995012920", to: "5541988887777", id: "wamid.E", type: "text", text: { body: "Oi, é a Cecília" } }], "PHONE1", "smb_message_echoes"), "PHONE1");
  assert.equal(eco.length, 1);
  assert.equal(eco[0].eco, true);
  assert.equal(eco[0].de, "5541988887777");
  assert.equal(lerEntrada({ object: "x" }).length, 0);
  assert.equal(lerEntrada(null).length, 0);
});

test("meta: resposta vira texto, foto e vídeo na ordem; markdown no jeito do WhatsApp", () => {
  const partes = partirResposta([
    "Olha a **Suíte Mar**:",
    "![Suíte Mar](https://blob.example.com/suite.jpg)",
    "E o vídeo:",
    "![Por dentro](https://blob.example.com/suite.mp4)",
    "Reserve em [nosso site](https://marimar-site.vercel.app/reservar).",
  ].join("\n"));
  assert.deepEqual(partes, [
    { tipo: "texto", texto: "Olha a *Suíte Mar*:" },
    { tipo: "imagem", url: "https://blob.example.com/suite.jpg", legenda: "Suíte Mar" },
    { tipo: "texto", texto: "E o vídeo:" },
    { tipo: "video", url: "https://blob.example.com/suite.mp4", legenda: "Por dentro" },
    { tipo: "texto", texto: "Reserve em nosso site: https://marimar-site.vercel.app/reservar." },
  ]);
  assert.equal(paraWhatsapp("## Título\n\n\n\nfim"), "Título\n\nfim");
});

test("meta: texto longo é partido abaixo do limite, sem perder nada", () => {
  const paragrafo = "Linha de teste da Marina. ".repeat(60);
  const longo = Array.from({ length: 8 }, () => paragrafo).join("\n\n");
  const partes = partirResposta(longo);
  assert.ok(partes.length > 1);
  assert.ok(partes.every((p) => p.tipo === "texto" && p.texto.length <= LIMITE_TEXTO));
  assert.equal(partes.map((p) => (p.tipo === "texto" ? p.texto : "")).join(" ").replace(/\s+/g, " ").trim(), longo.replace(/\s+/g, " ").trim());
});

test("meta: variável de modelo sem quebra de linha; erros traduzidos; chaves que faltam", () => {
  assert.equal(paraVariavel("Oi\n\nTudo bem?\tsim     ok"), "Oi · Tudo bem? sim   ok");
  assert.match(erroDaMeta({ error: { code: 131047, message: "Re-engagement message" } }, 400), /24 h/);
  assert.match(erroDaMeta({ error: { code: 190 } }, 401), /token/);
  assert.match(erroDaMeta({ error: { code: 999, message: "boom" } }, 500), /boom/);
  assert.deepEqual(faltandoMeta({ WHATSAPP_META_TOKEN: "t", WHATSAPP_META_PHONE_ID: " " }), ["WHATSAPP_META_PHONE_ID", "WHATSAPP_META_APP_SECRET", "WHATSAPP_META_VERIFY_TOKEN"]);
});
