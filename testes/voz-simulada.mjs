/**
 * ElevenLabs, OpenAI e Google (Gemini) de mentira, para testar a voz da
 * Marina sem gastar crédito (docs/voz-marina.md). Porta 4020.
 *
 *   node testes/voz-simulada.mjs
 *   servidor com VOZ_URL_ELEVENLABS, VOZ_URL_OPENAI e VOZ_URL_GOOGLE = http://localhost:4020
 *
 * Chaves aceitas: começam com sk_teste (ElevenLabs), sk-teste (OpenAI) e
 * AIza-teste (Google); as outras levam 401, como a real.
 * GET /__pedidos lista cada áudio pedido (provedor, voz, modelo, ajustes).
 */
import http from "node:http";

const PORTA = Number(process.env.PORTA ?? 4020);
const pedidos = [];

/* MP3 de silêncio que o navegador toca de verdade: quadros MPEG-1 Layer III
   128 kbps 44,1 kHz (417 bytes cada) com o corpo zerado. */
const quadro = Buffer.alloc(417);
quadro.set([0xff, 0xfb, 0x90, 0x64], 0);
const MP3 = Buffer.concat(Array.from({ length: 24 }, () => quadro));
/* PCM 16 bits 24 kHz de silêncio (0,3 s), como o Gemini devolve. */
const PCM = Buffer.alloc(24_000 * 2 * 0.3);

const VOZES = [
  { voice_id: "MarinaClonada01", name: "Marina (clonada)", category: "cloned", labels: { gender: "female", accent: "brazilian", descriptive: "calorosa" }, preview_url: null },
  { voice_id: "RachelPadrao0002", name: "Rachel", category: "premade", labels: { gender: "female", accent: "american", descriptive: "calm" }, preview_url: `http://localhost:${PORTA}/previa.mp3` },
  { voice_id: "AdamPadrao000003", name: "Adam", category: "premade", labels: { gender: "male", accent: "american" }, preview_url: `http://localhost:${PORTA}/previa.mp3` },
];

const enviar = (res, status, corpo, tipo = "application/json") => {
  res.writeHead(status, { "content-type": tipo, "access-control-allow-origin": "*" });
  res.end(typeof corpo === "string" || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo));
};
const negar = (res) => enviar(res, 401, { error: { message: "invalid api key" }, detail: { status: "invalid_api_key", message: "Invalid API key" } });

http.createServer((req, res) => {
  let bruto = "";
  req.on("data", (c) => (bruto += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const corpo = bruto ? (() => { try { return JSON.parse(bruto); } catch { return {}; } })() : {};
    if (url.pathname === "/__pedidos") return enviar(res, 200, pedidos);
    if (url.pathname === "/previa.mp3") return enviar(res, 200, MP3, "audio/mpeg");

    /* ElevenLabs */
    const xi = String(req.headers["xi-api-key"] ?? "");
    if (url.pathname === "/v1/voices") return xi.startsWith("sk_teste") ? enviar(res, 200, { voices: VOZES }) : negar(res);
    const tts = /^\/v1\/text-to-speech\/([^/]+)$/.exec(url.pathname);
    if (tts) {
      if (!xi.startsWith("sk_teste")) return negar(res);
      if (!VOZES.some((v) => v.voice_id === tts[1])) return enviar(res, 404, { detail: { status: "voice_not_found", message: "voice not found" } });
      pedidos.push({ provedor: "elevenlabs", voz: tts[1], modelo: corpo.model_id, ajustes: corpo.voice_settings, idioma: corpo.language_code, normalizacao: corpo.apply_text_normalization, chave: xi.slice(-4), texto: corpo.text });
      return enviar(res, 200, MP3, "audio/mpeg");
    }

    /* OpenAI */
    const bearer = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (url.pathname === "/v1/models") return bearer.startsWith("sk-teste") ? enviar(res, 200, { data: [{ id: "gpt-4o-mini-tts" }] }) : negar(res);
    if (url.pathname === "/v1/audio/speech") {
      if (!bearer.startsWith("sk-teste")) return negar(res);
      if (corpo.model?.includes("gpt-4o-mini-tts") && corpo.speed !== undefined) return enviar(res, 400, { error: { message: "speed is not supported for this model" } });
      pedidos.push({ provedor: "openai", voz: corpo.voice, modelo: corpo.model, instrucoes: corpo.instructions ?? null, velocidade: corpo.speed ?? null, chave: bearer.slice(-4), texto: corpo.input });
      return enviar(res, 200, MP3, "audio/mpeg");
    }

    /* Google (Gemini) */
    const g = String(req.headers["x-goog-api-key"] ?? "");
    if (url.pathname === "/v1beta/models") return g.startsWith("AIza-teste") ? enviar(res, 200, { models: [] }) : negar(res);
    const gem = /^\/v1beta\/models\/([^:]+):generateContent$/.exec(url.pathname);
    if (gem) {
      if (!g.startsWith("AIza-teste")) return negar(res);
      const texto = corpo.contents?.[0]?.parts?.[0]?.text ?? "";
      pedidos.push({ provedor: "google", voz: corpo.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName, modelo: gem[1], texto, chave: g.slice(-4) });
      return enviar(res, 200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: PCM.toString("base64") } }] } }] });
    }
    enviar(res, 404, { error: "rota simulada desconhecida" });
  });
}).listen(PORTA, () => console.log(`provedores de voz simulados em http://localhost:${PORTA}`));
