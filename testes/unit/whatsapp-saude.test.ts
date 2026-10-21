/**
 * Blindagem do WhatsApp: estados da conexão, vigia e disjuntor.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lerSaude, decidirVigia, decidirEnvio, mesmoCelular, emAdaptacao, novoTopico, topicoDe, MEMORIA_VAZIA, VIGIA, DISJUNTOR, ADAPTACAO_DIAS,
  type MemoriaVigia, type EnvioRegistrado,
} from "../../src/lib/whatsapp-saude";

/* channels.status no formato do OpenClaw 2026.9.4. */
const status = (conta: Record<string, unknown>) => ({
  channels: { discord: { configured: false }, whatsapp: { configured: true } },
  channelAccounts: { discord: [{ accountId: "default", running: false, healthState: "stopped" }], whatsapp: [{ accountId: "default", ...conta }] },
});
const MIN = 60_000;

test("saúde: os estados que importam", () => {
  const ok = lerSaude(status({ linked: true, running: true, connected: true, healthState: "healthy", self: { e164: "+5541999990000" }, lastConnectedAt: 1000 }));
  assert.equal(ok?.estado, "conectado");
  assert.equal(ok?.numero, "5541999990000");
  assert.equal(ok?.conectadoDesde, 1000);
  /* 21/10: ligada, rodando, sem conexão, nenhuma tentativa. */
  assert.equal(lerSaude(status({ linked: true, running: true, connected: false, healthState: "disconnected", reconnectAttempts: 0 }))?.estado, "travado");
  assert.equal(lerSaude(status({ linked: true, running: true, connected: false, healthState: "starting" }))?.estado, "travado");
  /* 18/10: aparelho removido. */
  assert.equal(lerSaude(status({ linked: true, running: false, connected: false, healthState: "logged-out", lastError: "status=401 Unauthorized Stream Errored (conflict)" }))?.estado, "caido");
  assert.equal(lerSaude(status({ linked: false, running: false, connected: false }))?.estado, "sem_aparelho");
  assert.equal(lerSaude(status({ linked: true, running: false, connected: false, healthState: "conflict" }))?.estado, "conflito");
  assert.equal(lerSaude(status({ linked: true, running: true, connected: false, healthState: "reconnecting" }))?.estado, "reconectando");
  assert.equal(lerSaude(status({ linked: true, running: false, connected: false, healthState: "stopped" }))?.estado, "parado");
  assert.equal(lerSaude({ channels: { discord: {} } }), null);
});

const leitura = (estado: string, numero: string | null = "5541999990000") =>
  ({ estado, numero, conectadoDesde: null, ultimaEntrada: null, tentativas: 0, erro: null, saude: null }) as Parameters<typeof decidirVigia>[0];

test("vigia: travado só destrava depois da tolerância, e com intervalo entre tentativas", () => {
  const t0 = 10 * 24 * 3600_000;
  let d = decidirVigia(leitura("travado"), MEMORIA_VAZIA, t0, "web");
  assert.equal(d.acao, "nada");
  d = decidirVigia(leitura("travado"), d.memoria, t0 + (VIGIA.travadoMin - 1) * MIN, "web");
  assert.equal(d.acao, "nada", "ainda dentro da tolerância");
  d = decidirVigia(leitura("travado"), d.memoria, t0 + VIGIA.travadoMin * MIN, "web");
  assert.equal(d.acao, "destravar");
  d = decidirVigia(leitura("travado"), d.memoria, t0 + (VIGIA.travadoMin + 5) * MIN, "web");
  assert.equal(d.acao, "nada", "logo depois de destravar, espera");
  d = decidirVigia(leitura("travado"), d.memoria, t0 + (VIGIA.travadoMin + VIGIA.intervaloAcaoMin) * MIN, "web");
  assert.equal(d.acao, "destravar");
});

test("vigia: depois do limite do dia, para de mexer e avisa uma vez só", () => {
  const t0 = 10 * 24 * 3600_000;
  let m: MemoriaVigia = { ...MEMORIA_VAZIA, estado: "travado", desde: t0 - 60 * MIN, acoes: Array.from({ length: VIGIA.acoesPorDia }, (_, i) => t0 - (i + 1) * 30 * MIN) };
  const d = decidirVigia(leitura("travado"), m, t0, "web");
  assert.equal(d.acao, "nada");
  assert.match(d.alerta ?? "", /já tentou/);
  m = d.memoria;
  assert.equal(decidirVigia(leitura("travado"), m, t0 + MIN, "web").alerta, null, "não repete o aviso");
});

test("vigia: aparelho removido avisa uma vez; ao voltar, avisa que voltou", () => {
  const t0 = 10 * 24 * 3600_000;
  const a = decidirVigia(leitura("caido"), MEMORIA_VAZIA, t0, "web");
  assert.equal(a.acao, "nada", "401 não se resolve destravando");
  assert.match(a.alerta ?? "", /401/);
  const b = decidirVigia(leitura("caido"), a.memoria, t0 + 5 * MIN, "web");
  assert.equal(b.alerta, null);
  const c = decidirVigia(leitura("conectado"), b.memoria, t0 + 30 * MIN, "web");
  assert.match(c.alerta ?? "", /voltou/);
  assert.equal(c.memoria.avisado, null);
});

test("vigia: servidor sem resposta só avisa depois de um tempo; API oficial não mexe no QR", () => {
  const t0 = 10 * 24 * 3600_000;
  const a = decidirVigia(null, MEMORIA_VAZIA, t0, "web");
  assert.equal(a.alerta, null);
  const b = decidirVigia(null, a.memoria, t0 + VIGIA.semRespostaMin * MIN, "web");
  assert.match(b.alerta ?? "", /não responde/);
  const c = decidirVigia(leitura("travado"), { ...MEMORIA_VAZIA, estado: "travado", desde: t0 - 60 * MIN }, t0, "oficial");
  assert.equal(c.acao, "nada");
});

test("vigia: número novo começa o período de adaptação", () => {
  const t0 = 10 * 24 * 3600_000;
  const a = decidirVigia(leitura("conectado", "5541900000001"), { ...MEMORIA_VAZIA, numero: "5541900000000", numeroDesde: 1 }, t0, "web");
  assert.equal(a.memoria.numero, "5541900000001");
  assert.equal(a.memoria.numeroDesde, t0);
  assert.equal(emAdaptacao(a.memoria.numeroDesde, t0 + (ADAPTACAO_DIAS * 24 - 1) * 3600_000), true);
  assert.equal(emAdaptacao(a.memoria.numeroDesde, t0 + ADAPTACAO_DIAS * 24 * 3600_000), false);
  const b = decidirVigia(leitura("conectado", "5541900000001"), a.memoria, t0 + 60 * MIN, "web");
  assert.equal(b.memoria.numeroDesde, t0, "mesmo número não reinicia o período");
});

test("disjuntor: próprio número, repetida, limites e intervalo", () => {
  const agora = 10 * 24 * 3600_000;
  assert.equal(mesmoCelular("5541991494742", "554191494742"), true, "com e sem o 9");
  assert.equal(mesmoCelular("5511991494742", "551191494742"), true);
  assert.equal(mesmoCelular("554191494742", "554191494743"), false);

  assert.equal(decidirEnvio([], "554191494742", "k", agora, "5541991494742").ok, false, "a Marina não manda para si mesma");
  const h: EnvioRegistrado[] = [{ numero: "554191494742", chave: "k", em: agora - 5 * MIN }];
  const rep = decidirEnvio(h, "554191494742", "k", agora, null);
  assert.equal(rep.ok, false);
  assert.match(!rep.ok ? rep.motivo : "", /mesma mensagem/);
  assert.equal(decidirEnvio([{ ...h[0], em: agora - (DISJUNTOR.repetidaMin + 1) * MIN }], "554191494742", "k", agora, null).ok, true);

  const muitas = Array.from({ length: DISJUNTOR.porNumeroHora }, (_, i) => ({ numero: "554191494742", chave: `c${i}`, em: agora - (i + 1) * 2 * MIN }));
  assert.equal(decidirEnvio(muitas, "554191494742", "nova", agora, null).ok, false);
  assert.equal(decidirEnvio(muitas, "554133334444", "nova", agora, null).ok, true, "outro número passa");

  const rajada = Array.from({ length: DISJUNTOR.total10Min }, (_, i) => ({ numero: `55419000000${i}`, chave: `r${i}`, em: agora - i * 20_000 }));
  assert.equal(decidirEnvio(rajada, "554133334444", "x", agora, null).ok, false, "rajada segura");

  const espera = decidirEnvio([{ numero: "554133334444", chave: "a", em: agora - 1000 }], "554191494742", "b", agora, null);
  assert.equal(espera.ok && espera.esperarMs, DISJUNTOR.intervaloMs - 1000);
});

test("disjuntor: no período de adaptação, metade dos limites e o dobro do intervalo", () => {
  const agora = 10 * 24 * 3600_000;
  const metade = Array.from({ length: DISJUNTOR.porNumeroHora / 2 }, (_, i) => ({ numero: "554191494742", chave: `c${i}`, em: agora - (i + 1) * 3 * MIN }));
  assert.equal(decidirEnvio(metade, "554191494742", "nova", agora, null, false).ok, true);
  const r = decidirEnvio(metade, "554191494742", "nova", agora, null, true);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.motivo : "", /adaptação/);
  const e = decidirEnvio([{ numero: "554133334444", chave: "a", em: agora }], "554191494742", "b", agora, null, true);
  assert.equal(e.ok && e.esperarMs, DISJUNTOR.intervaloMs * 2);
});

test("alerta: tópico do ntfy fácil de digitar e difícil de adivinhar", () => {
  const t = novoTopico(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 30, 99, 99]));
  assert.equal(t, "marimar-abcdefghj9");
  assert.match(novoTopico(crypto.getRandomValues(new Uint8Array(10))), /^marimar-[a-hj-km-np-z2-9]{10}$/);
  assert.notEqual(novoTopico(crypto.getRandomValues(new Uint8Array(10))), novoTopico(crypto.getRandomValues(new Uint8Array(10))));
  assert.equal(topicoDe("https://ntfy.sh/marimar-abc"), "marimar-abc");
  assert.equal(topicoDe("https://ntfy.sh/marimar-abc/"), "marimar-abc");
  assert.equal(topicoDe("https://ntfy.sh"), null);
  assert.equal(topicoDe("não é endereço"), null);
  assert.equal(topicoDe(null), null);
});
