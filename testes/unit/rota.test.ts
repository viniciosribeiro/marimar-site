/**
 * Rota até a pousada: o que não depende de rede.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROTA_PADRAO, mesclarRota, distancia, naIlha, distanciaAteLinha, urlOsrm, textoPasso, trechoDoOsrm, trechoReto,
  formatarDistancia, formatarDuracao, detectarAparelho, terminalPadrao,
} from "../../src/lib/rota-base";

test("distância: pousada ↔ trapiche é curta; Curitiba ↔ pousada é longe", () => {
  const d = distancia(ROTA_PADRAO.pousada, ROTA_PADRAO.trapiche);
  assert.ok(d > 200 && d < 800, `trapiche a ${d} m`);
  assert.ok(distancia({ lat: -25.4284, lng: -49.2733 }, ROTA_PADRAO.pousada) > 90000);
});

test("naIlha: Encantadas sim, Pontal do Sul e Curitiba não", () => {
  assert.ok(naIlha(ROTA_PADRAO.pousada, ROTA_PADRAO));
  assert.ok(naIlha({ lat: -25.505, lng: -48.325 }, ROTA_PADRAO)); // Nova Brasília
  assert.ok(!naIlha(ROTA_PADRAO.terminais[0], ROTA_PADRAO));
  assert.ok(!naIlha({ lat: -25.4284, lng: -49.2733 }, ROTA_PADRAO));
});

test("mesclarRota: o salvo vence, o que falta vem do padrão, número inválido não passa", () => {
  const c = mesclarRota({ trapiche: { lat: -25.57, lng: "x" }, textos: { titulo: "Venha!" }, estiloPadrao: "inexistente" });
  assert.equal(c.trapiche.lat, -25.57);
  assert.equal(c.trapiche.lng, ROTA_PADRAO.trapiche.lng);
  assert.equal(c.textos.titulo, "Venha!");
  assert.equal(c.textos.chegada, ROTA_PADRAO.textos.chegada);
  assert.equal(c.estiloPadrao, "mapa");
  assert.equal(mesclarRota(null).terminais.length, 2);
  assert.equal(terminalPadrao(c).id, "pontal");
  assert.equal(terminalPadrao(c, "paranagua").id, "paranagua");
});

test("distanciaAteLinha: perto da linha é pouco, longe é muito", () => {
  const linha: [number, number][] = [[-48.3157, -25.5719], [-48.3152, -25.5684]];
  assert.ok(distanciaAteLinha({ lat: -25.5700, lng: -48.3155 }, linha) < 15);
  assert.ok(distanciaAteLinha({ lat: -25.5700, lng: -48.3100 }, linha) > 400);
});

test("OSRM: URL com lng,lat e passos em português", () => {
  assert.match(urlOsrm("https://x/route/v1/driving/", { lat: -25.5, lng: -48.3 }, { lat: -25.6, lng: -48.4 }),
    /^https:\/\/x\/route\/v1\/driving\/-48\.300000,-25\.500000;-48\.400000,-25\.600000\?overview=full&geometries=geojson&steps=true$/);
  assert.equal(textoPasso({ maneuver: { type: "turn", modifier: "left", location: [0, 0] }, name: "Rua das Flores", distance: 50 }), "Vire à esquerda pela Rua das Flores");
  assert.equal(textoPasso({ maneuver: { type: "roundabout", exit: 2, location: [0, 0] }, name: "", distance: 50 }), "Na rotatória, pegue a 2ª saída");
  assert.equal(textoPasso({ maneuver: { type: "depart", location: [0, 0] }, name: "BR-277", distance: 50 }), "Saia pela BR-277");
  assert.equal(textoPasso({ maneuver: { type: "turn", modifier: "right", location: [0, 0] }, name: "Caminho de Encantadas", distance: 50 }), "Vire à direita pelo Caminho de Encantadas");
});

test("trecho: resposta do OSRM vira trecho; sem resposta, linha reta aproximada", () => {
  const resp = { routes: [{ distance: 420, duration: 330, geometry: { coordinates: [[-48.3157, -25.5719], [-48.3152, -25.5684]] },
    legs: [{ steps: [{ maneuver: { type: "depart", location: [-48.3157, -25.5719] }, name: "", distance: 420 }, { maneuver: { type: "arrive", location: [-48.3152, -25.5684] }, distance: 0 }] }] }] };
  const t = trechoDoOsrm("pe", "A pé", ROTA_PADRAO.trapiche, ROTA_PADRAO.pousada, resp);
  assert.equal(t.distancia, 420); assert.equal(t.passos.length, 2); assert.ok(!t.aproximado);
  const r = trechoDoOsrm("pe", "A pé", ROTA_PADRAO.trapiche, ROTA_PADRAO.pousada, { code: "NoRoute" });
  assert.ok(r.aproximado); assert.equal(r.linha.length, 2);
  assert.equal(trechoReto("barco", "Barco", ROTA_PADRAO.terminais[0], ROTA_PADRAO.trapiche, 30).duracao, 1800);
});

test("formatos e aparelho", () => {
  assert.equal(formatarDistancia(420), "420 m");
  assert.equal(formatarDistancia(12345), "12 km");
  assert.equal(formatarDistancia(2450), "2,5 km");
  assert.equal(formatarDuracao(330), "6 min");
  assert.equal(formatarDuracao(7500), "2 h 05");
  assert.equal(detectarAparelho("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "ios");
  assert.equal(detectarAparelho("Mozilla/5.0 (Linux; Android 14; SM-S911B)"), "android");
  assert.equal(detectarAparelho("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
});
