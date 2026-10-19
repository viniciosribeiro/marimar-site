/**
 * Rota até a pousada: o que não depende de rede.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROTA_PADRAO, mesclarRota, distancia, naIlha, distanciaAteLinha, urlOsrm, textoPasso, trechoDoOsrm, trechoReto,
  formatarDistancia, formatarDuracao, detectarAparelho, terminalPadrao,
  montarPercurso, projetar, pontoEm, rumoEm, proximoPasso, restante, linhaAte, trechoEm, setaDoPasso, setaDoTexto,
  zoomPorVelocidade, velocidadePrevia, mapboxDoSite, tokenMapboxValido, luzDaHora, rumo, type Trecho,
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

/* ── percurso (navegação em tela inteira, 19/10/2026) ─────────────── */

/* Um "L" a pé: 0,001° de latitude ≈ 111 m para o norte, depois para o leste. */
const L: Trecho = {
  tipo: "pe", titulo: "A pé", de: { nome: "A", lat: -25.572, lng: -48.316 }, para: { nome: "Pousada Marimar", lat: -25.570, lng: -48.314 },
  distancia: 400, duracao: 300,
  linha: [[-48.316, -25.572], [-48.316, -25.570], [-48.314, -25.570]],
  passos: [
    { texto: "Saia pela Rua A", distancia: 222, local: [-48.316, -25.572], seta: "frente" },
    { texto: "Vire à direita pela Rua B", distancia: 200, local: [-48.316, -25.570] },
    { texto: "Você chegou ao destino deste trecho", distancia: 0, local: [-48.314, -25.570], seta: "chegada" },
  ],
};

test("montarPercurso: soma os metros, acha cada instrução no caminho e marca a chegada", () => {
  const p = montarPercurso([L]);
  assert.equal(p.linha.length, 3);
  assert.ok(Math.abs(p.acum[1] - 222) < 3, `primeiro lado ${p.acum[1]}`);
  assert.ok(p.total > 400 && p.total < 430, `total ${p.total}`);
  assert.equal(p.passos[1].seta, "direita", "sem seta: lida do texto");
  assert.ok(Math.abs(p.passos[1].ao - p.acum[1]) < 1);
  assert.equal(p.passos.at(-1)!.texto, "Chegada: Pousada Marimar");
  assert.equal(p.passos.filter((x) => x.seta === "chegada").length, 1, "não duplica a chegada");
});

test("projetar, pontoEm e rumoEm: posição no caminho e para onde ele vai", () => {
  const p = montarPercurso([L]);
  const r = projetar({ lat: -25.571, lng: -48.31601 }, p);
  assert.ok(Math.abs(r.ao - 111) < 3 && r.distancia < 3, JSON.stringify(r));
  const meio = pontoEm(p, p.acum[1] + 50);
  assert.ok(Math.abs(meio.lat - -25.570) < 1e-6 && meio.lng > -48.316);
  assert.ok(Math.abs(rumoEm(p, 10) - 0) < 2, "primeiro lado vai para o norte");
  assert.ok(Math.abs(rumoEm(p, p.acum[1] + 20) - 90) < 2, "segundo lado vai para o leste");
  assert.ok(Math.abs(rumoEm(p, p.total) - 90) < 2, "no fim, continua olhando para onde vinha");
  assert.ok(Math.abs(rumo({ lat: 0, lng: 0 }, { lat: -1, lng: 0 }) - 180) < 0.01);
});

test("proximoPasso, restante e linhaAte: a instrução muda depois da curva", () => {
  const p = montarPercurso([L]);
  assert.equal(p.passos[proximoPasso(p, 50).atual].texto, "Vire à direita pela Rua B");
  assert.equal(p.passos[proximoPasso(p, p.acum[1] + 20).atual].seta, "chegada");
  const r = restante(p, p.total / 2);
  assert.ok(Math.abs(r.duracao - 150) < 1 && Math.abs(r.distancia - p.total / 2) < 1);
  assert.equal(restante(p, p.total).duracao, 0);
  assert.deepEqual(linhaAte(p, 0), []);
  assert.equal(linhaAte(p, p.acum[1] + 10).length, 3);
  assert.equal(trechoEm(p, 10).tipo, "pe");
});

test("percurso com barco: trechos em sequência, tempo do barco conta inteiro antes de embarcar", () => {
  const barco: Trecho = { ...L, tipo: "barco", titulo: "Barco", linha: [[-48.35, -25.58], [-48.316, -25.572]], duracao: 1800,
    passos: [{ texto: "Embarque para Encantadas", distancia: 3500, local: [-48.35, -25.58], seta: "barco" }] };
  const p = montarPercurso([barco, L]);
  assert.equal(p.trechos.length, 2);
  assert.equal(p.trechos[1].ini, p.trechos[0].fim, "a pé começa onde o barco chega");
  assert.ok(Math.abs(restante(p, 0).duracao - 2100) < 1);
  assert.equal(p.passos[0].seta, "barco");
});

test("setas: OSRM e texto antigo", () => {
  assert.equal(setaDoPasso({ type: "turn", modifier: "sharp left" }), "esquerda");
  assert.equal(setaDoPasso({ type: "roundabout", modifier: "right" }), "rotatoria");
  assert.equal(setaDoPasso({ type: "arrive" }), "chegada");
  assert.equal(setaDoTexto("Vire levemente à direita pela Rua X"), "leve-direita");
  assert.equal(setaDoTexto("Faça o retorno"), "retorno");
});

test("prévia: velocidade e zoom da câmera", () => {
  assert.equal(velocidadePrevia("pe", 420), 14);
  assert.ok(velocidadePrevia("carro", 100000) > 4000);
  assert.equal(zoomPorVelocidade(1.3), 17.6);
  assert.equal(zoomPorVelocidade(100000), 11.5);
  assert.ok(zoomPorVelocidade(150) < zoomPorVelocidade(14));
});

test("Mapbox: só com token público e ligado; secreto nunca", () => {
  const pk = "pk.eyJ1IjoidGVzdGUiLCJhIjoiYWJjIn0.abcdefghijklmnop";
  assert.ok(tokenMapboxValido(pk));
  assert.ok(!tokenMapboxValido(pk.replace("pk.", "sk.")));
  assert.equal(mapboxDoSite({ mapa: { provedor: "mapbox", mapboxToken: pk, vista: "3d" } }), pk);
  assert.equal(mapboxDoSite({ mapa: { provedor: "livre", mapboxToken: pk, vista: "3d" } }), null);
  assert.equal(mapboxDoSite({ mapa: { provedor: "mapbox", mapboxToken: "", vista: "3d" } }), null);
  const c = mesclarRota({ mapa: { provedor: "x", vista: "2d" } });
  assert.deepEqual(c.mapa, { provedor: "livre", mapboxToken: "", vista: "2d" });
  assert.equal(mesclarRota(null).mapa.vista, "3d", "abre em 3D por padrão");
  assert.equal(luzDaHora(12), "day");
  assert.equal(luzDaHora(18), "dusk");
  assert.equal(luzDaHora(23), "night");
});
