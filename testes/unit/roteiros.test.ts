/**
 * Roteiros de orientação e o limite de mídia do WhatsApp.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { roteiroPara, roteirosEmTexto, midiaParaWhatsapp, WHATSAPP_MAX_BYTES, type Roteiro } from "../../src/lib/roteiros";

const video = (bytes: number, url_whatsapp: string | null = null) => ({
  id: "v", tipo: "video" as const, url: "https://x.public.blob.vercel-storage.com/v.mp4", titulo: "Trapiche", alt: "Trapiche",
  thumb_url: null, duracao_seg: 60, bytes, url_whatsapp,
});

const chegar: Roteiro = {
  id: "11111111-1111-1111-1111-111111111111", titulo: "Como chegar", descricao: null,
  gatilhos: ["como chegar", "barco", "trapiche"], ativo: true, ordem: 0, atualizado_em: "",
  etapas: [
    { id: "e1", ordem: 0, titulo: "Paranaguá", texto: "Estacione no pátio.", ativo: true, video: video(5_000_000, "https://x.public.blob.vercel-storage.com/leve.mp4"), foto: null },
    { id: "e2", ordem: 1, titulo: "Na ilha", texto: "Vire à direita.", ativo: true, video: video(90_000_000, null), foto: null },
  ],
};
const restaurante: Roteiro = { ...chegar, id: "22222222-2222-2222-2222-222222222222", titulo: "Restaurante", gatilhos: ["restaurante", "almoço"], ordem: 1 };

test("roteiroPara: casa pelas palavras-chave, sem acento e sem caixa", () => {
  assert.equal(roteiroPara([chegar, restaurante], "Oi! Como CHEGO... digo, como chegar aí?")?.titulo, "Como chegar");
  assert.equal(roteiroPara([chegar, restaurante], "onde fica o almoco?")?.titulo, "Restaurante");
});

test("roteiroPara: sem palavra-chave na frase, nenhum roteiro", () => {
  assert.equal(roteiroPara([chegar, restaurante], "qual a senha do wifi?"), null);
});

test("roteiroPara: vence quem casa mais palavras-chave", () => {
  const r = roteiroPara([restaurante, chegar], "restaurante perto do trapiche, onde pego o barco?");
  assert.equal(r?.titulo, "Como chegar");
});

test("midiaParaWhatsapp: versão leve primeiro; MP4 que cabe vai o original; WebM ou grande vira link", () => {
  assert.equal(midiaParaWhatsapp({ tipo: "video", url: "a.mp4", url_whatsapp: "leve.mp4", bytes: 90_000_000 }), "leve.mp4");
  assert.equal(midiaParaWhatsapp({ tipo: "video", url: "a.mp4", url_whatsapp: null, bytes: 1_000_000, formato: "video/mp4" }), "a.mp4");
  assert.equal(midiaParaWhatsapp({ tipo: "video", url: "a.webm", url_whatsapp: null, bytes: 1_000_000, formato: "video/webm" }), null);
  assert.equal(midiaParaWhatsapp({ tipo: "video", url: "a.mp4", url_whatsapp: null, bytes: WHATSAPP_MAX_BYTES + 1, formato: "video/mp4" }), null);
  assert.equal(midiaParaWhatsapp({ tipo: "foto", url: "f.jpg", url_whatsapp: null, bytes: null }), "f.jpg");
});

test("roteirosEmTexto: etapas na ordem, com a mídia certa para cada canal", () => {
  const zap = roteirosEmTexto([chegar], { canal: "whatsapp" });
  assert.ok(zap.indexOf("1. Paranaguá") < zap.indexOf("2. Na ilha"));
  assert.match(zap, /vídeo: https:\/\/x\.public\.blob\.vercel-storage\.com\/leve\.mp4/);
  assert.match(zap, /grande demais para mandar como mídia; mande como link/);
  const site = roteirosEmTexto([chegar], { canal: "site" });
  assert.match(site, /vídeo: https:\/\/x\.public\.blob\.vercel-storage\.com\/v\.mp4/);
  assert.doesNotMatch(site, /grande demais/);
});

test("roteirosEmTexto: roteiro desligado ou sem etapas não aparece; códigos só no teste", () => {
  assert.equal(roteirosEmTexto([{ ...chegar, ativo: false }]), "");
  assert.equal(roteirosEmTexto([{ ...chegar, etapas: [] }]), "");
  assert.doesNotMatch(roteirosEmTexto([chegar]), /#111111/);
  assert.match(roteirosEmTexto([chegar], { codigos: true }), /\[#111111\]/);
});
