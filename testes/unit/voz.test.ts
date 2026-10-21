/**
 * Voz da Marina: a mesma no site e no WhatsApp (docs/voz-marina.md).
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OPCOES_PADRAO, camposDaTela, camposDoProvedor, diferencas, normalizarOpcoes, opcoesDeCampos, patchDaVoz, pcmParaWav,
  textoGoogle, vozDoWhatsapp, type OpcoesVoz,
} from "../../src/lib/voz-base";
import { cifrar, decifrar, finalDaChave } from "../../src/lib/segredo";

/** Lê "a.b.c" de um objeto qualquer (o patch e a config são JSON livre). */
const ler = (o: unknown, caminho: string): unknown =>
  caminho.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);

const eleven = { voz_id: "VozDoSite", voz_modelo: "eleven_multilingual_v2", voz_estabilidade: 40, voz_semelhanca: 80, voz_velocidade: 95 };
const comEleven = (voz = "VozDoSite"): OpcoesVoz => normalizarOpcoes({ ...eleven, voz_id: voz }, {});

test("voz: opções inválidas voltam ao padrão (voz inválida deixaria o WhatsApp mudo)", () => {
  const o = normalizarOpcoes({ ...eleven, voz_modelo: "inventado", voz_velocidade: 999 }, { provedor: "azure", openai: { voz: "darth" }, google: { voz: "Kore", modelo: "x" } });
  assert.equal(o.provedor, "elevenlabs");
  assert.equal(o.elevenlabs.modelo, "eleven_multilingual_v2");
  assert.equal(o.elevenlabs.velocidade, 120);
  assert.equal(o.openai.voz, OPCOES_PADRAO.openai.voz);
  assert.equal(o.google.modelo, OPCOES_PADRAO.google.modelo);
});

test("voz: a tela e o servidor montam a mesma voz (ida e volta dos campos)", () => {
  const o = normalizarOpcoes(eleven, { provedor: "openai", openai: { voz: "coral", modelo: "tts-1-hd", instrucoes: "devagar", velocidade: 110 }, google: { voz: "Sulafat", estilo: "calma" } });
  const campos = camposDaTela(o);
  assert.deepEqual(opcoesDeCampos((k) => campos[k]), o);
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, String(v));
  assert.deepEqual(opcoesDeCampos((k) => fd.get(k)), o);
});

test("voz: os campos que o OpenClaw 2026.9.4 lê de fato", () => {
  const e = camposDoProvedor(comEleven(), "sk_x");
  assert.equal(e.voiceId, "VozDoSite");
  assert.equal(e.modelId, "eleven_multilingual_v2");
  assert.equal(e.apiKey, "sk_x");
  assert.deepEqual(e.voiceSettings, { stability: 0.4, similarityBoost: 0.8, style: 0, useSpeakerBoost: true, speed: 0.95 });
  assert.ok(!("speakerVoiceId" in e) && !("model" in e), "os nomes de antes de 21/10 não voltam");

  const mini = camposDoProvedor({ ...comEleven(), provedor: "openai", openai: { voz: "marin", modelo: "gpt-4o-mini-tts", instrucoes: "calma", velocidade: 120 } });
  assert.equal(mini.instructions, "calma");
  assert.equal(mini.speed, null, "gpt-4o-mini-tts não aceita velocidade: apaga a antiga");
  const tts1 = camposDoProvedor({ ...comEleven(), provedor: "openai", openai: { voz: "nova", modelo: "tts-1", instrucoes: "calma", velocidade: 120 } });
  assert.equal(tts1.instructions, null);
  assert.equal(tts1.speed, 1.2);
  assert.ok(!("apiKey" in tts1), "sem chave, não mexe na chave do servidor");

  const g = camposDoProvedor({ ...comEleven(), provedor: "google", google: { voz: "Sulafat", modelo: "gemini-3.1-flash-tts-preview", estilo: "calorosa" } });
  assert.equal(g.voiceName, "Sulafat");
  assert.equal(g.audioProfile, "calorosa");
  assert.equal(textoGoogle("calorosa", "Oi"), "calorosa\n\nOi");
});

/* A config do servidor como estava em 21/10: o painel tinha gravado nomes errados, e uma camada do canal por cima. */
const servidor = {
  tts: { auto: "inbound", provider: "elevenlabs", providers: { elevenlabs: { apiKey: "__OPENCLAW_REDACTED__", voiceId: "VozAntiga", speakerVoiceId: "VozDoSite", model: "eleven_multilingual_v2" } } },
  channels: { whatsapp: { tts: { providers: { elevenlabs: { voiceId: "VozDoCanal" } } } } },
  agents: { list: [{ id: "main", default: true }, { id: "outro", tts: { provider: "openai" } }] },
};

test("voz: o defeito de 21/10 aparece na conferência", () => {
  const w = vozDoWhatsapp(servidor);
  assert.equal(w.provedor, "elevenlabs");
  assert.equal(w.voz, "VozDoCanal", "o canal passa por cima da geral");
  assert.deepEqual(w.camadas, ["geral", "canal WhatsApp"]);
  const dif = diferencas(comEleven(), w);
  assert.ok(dif.some((d) => d.includes("VozDoCanal") && d.includes("VozDoSite")));
  assert.ok(dif.some((d) => d.includes("trocar a voz")), "o modelo ainda podia trocar a voz");
});

test("voz: o patch leva a voz a toda camada que a redefine, e a conferência fecha", () => {
  const o = comEleven();
  const patch = patchDaVoz(o, servidor, "sk_x");
  assert.equal(ler(patch, "tts.provider"), "elevenlabs");
  assert.equal(ler(patch, "tts.providers.elevenlabs.voiceId"), "VozDoSite");
  assert.deepEqual(ler(patch, "tts.modelOverrides"), { allowProvider: false, allowVoice: false, allowModelId: false, allowVoiceSettings: false });
  assert.equal(ler(patch, "channels.whatsapp.tts.providers.elevenlabs.voiceId"), "VozDoSite");
  assert.deepEqual((ler(patch, "agents.list") as { id: string }[]).map((a) => a.id), ["outro"], "só o agente que mexe na voz");

  /* aplica como merge patch (RFC 7386, listas por id) e lê de novo */
  type Obj = Record<string, unknown>;
  const aplicar = (alvo: unknown, p: unknown): unknown => {
    if (Array.isArray(p) && Array.isArray(alvo)) {
      const r = alvo.map((x) => ({ ...(x as Obj) }));
      for (const item of p as Obj[]) { const i = r.findIndex((x) => x.id === item.id); if (i >= 0) r[i] = aplicar(r[i], item) as Obj; else r.push(item); }
      return r;
    }
    if (!p || typeof p !== "object" || Array.isArray(p)) return p;
    const r: Obj = { ...(alvo && typeof alvo === "object" ? (alvo as Obj) : {}) };
    for (const [k, v] of Object.entries(p)) { if (v === null) delete r[k]; else r[k] = aplicar(r[k], v); }
    return r;
  };
  const depois = aplicar(servidor, patch);
  const w = vozDoWhatsapp(depois);
  assert.equal(w.voz, "VozDoSite");
  assert.equal(w.travado, true);
  assert.deepEqual(diferencas(o, w), []);
});

test("voz: persona ativa com a própria voz também recebe a voz do painel", () => {
  const cfg = { tts: { provider: "elevenlabs", persona: "recepcao", personas: { recepcao: { provider: "elevenlabs", providers: { elevenlabs: { voiceId: "VozDaPersona" } } } } } };
  assert.equal(vozDoWhatsapp(cfg).voz, "VozDaPersona");
  assert.equal(ler(patchDaVoz(comEleven(), cfg), "tts.personas.recepcao.providers.elevenlabs.voiceId"), "VozDoSite");
});

test("voz: cada provedor lê o seu campo de voz", () => {
  assert.equal(vozDoWhatsapp({ tts: { provider: "google", providers: { google: { voice: "Puck", voiceName: "Kore" } } } }).voz, "Kore");
  assert.equal(vozDoWhatsapp({ tts: { provider: "openai", providers: { openai: { voice: "coral", model: "gpt-4o-mini-tts" } } } }).modelo, "gpt-4o-mini-tts");
  const o: OpcoesVoz = { ...comEleven(), provedor: "openai", openai: { ...OPCOES_PADRAO.openai, voz: "coral" } };
  assert.ok(diferencas(o, vozDoWhatsapp({ tts: { provider: "elevenlabs" } }))[0].startsWith("provedor"));
});

test("voz: WAV do Google com o cabeçalho certo", () => {
  const wav = pcmParaWav(new Uint8Array(480), 24_000);
  const v = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(v.getUint32(24, true), 24_000);
  assert.equal(v.getUint32(40, true), 480);
  assert.equal(wav.length, 44 + 480);
});

test("chaves: cifradas com o AUTH_SECRET e fechadas sem ele", () => {
  const antes = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "segredo-de-teste";
  const guardado = cifrar("sk_minha_chave_1234");
  assert.ok(guardado.startsWith("v1:") && !guardado.includes("sk_minha"));
  assert.equal(decifrar(guardado), "sk_minha_chave_1234");
  assert.notEqual(cifrar("sk_minha_chave_1234"), guardado, "cada gravação com um iv novo");
  process.env.AUTH_SECRET = "outro-segredo";
  assert.equal(decifrar(guardado), null);
  delete process.env.AUTH_SECRET;
  assert.throws(() => cifrar("x"));
  assert.equal(finalDaChave("sk_minha_chave_1234"), "…1234");
  if (antes !== undefined) process.env.AUTH_SECRET = antes;
});
