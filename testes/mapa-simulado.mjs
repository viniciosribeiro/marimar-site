/**
 * Serviços de mapa simulados, para testar a rota do site sem internet.
 *
 *   node testes/mapa-simulado.mjs        (porta 4020)
 *
 * - GET /estilo/:nome        estilo MapLibre mínimo (fundo + contorno da ilha)
 * - GET /carro|/pe/...       resposta no formato do OSRM, com passos
 * - GET /busca?q=            resposta no formato do Photon
 *
 * Para usar: em Admin → Rota e mapa, aponte estilos e serviços para
 * http://localhost:4020 (o e2e da rota faz isso sozinho no banco local).
 */
import http from "node:http";

const PORTA = Number(process.env.PORTA ?? 4020);
const ILHA = [
  [-48.300, -25.482], [-48.283, -25.500], [-48.282, -25.535], [-48.296, -25.556], [-48.300, -25.575],
  [-48.312, -25.592], [-48.328, -25.588], [-48.330, -25.565], [-48.335, -25.550], [-48.360, -25.548],
  [-48.395, -25.530], [-48.385, -25.510], [-48.345, -25.495], [-48.320, -25.480], [-48.300, -25.482],
];
const cores = { mapa: "#e8e4d8", claro: "#f4f4f2", colorido: "#dff3e4" };

function estilo(nome) {
  return {
    version: 8,
    name: `simulado-${nome}`,
    sources: {
      ilha: { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ILHA] } } },
    },
    layers: [
      { id: "mar", type: "background", paint: { "background-color": "#a9d3e8" } },
      { id: "ilha", type: "fill", source: "ilha", paint: { "fill-color": cores[nome] ?? cores.mapa } },
      { id: "ilha-borda", type: "line", source: "ilha", paint: { "line-color": "#c9b98f", "line-width": 1 } },
    ],
  };
}

/* Rota "curva": três pontos intermediários, para parecer um caminho. */
function rota(coords, perfil) {
  const [[x1, y1], [x2, y2]] = coords;
  const linha = [[x1, y1], [x1 + (x2 - x1) * 0.3, y1 + (y2 - y1) * 0.2], [x1 + (x2 - x1) * 0.6, y1 + (y2 - y1) * 0.7], [x2, y2]];
  const graus = Math.hypot(x2 - x1, y2 - y1);
  const distancia = graus * 111000 * 1.2;
  const velocidade = perfil === "pe" ? 1.3 : 16;
  return {
    code: "Ok",
    routes: [{
      distance: distancia, duration: distancia / velocidade,
      geometry: { type: "LineString", coordinates: linha },
      legs: [{ steps: [
        { maneuver: { type: "depart", location: linha[0] }, name: perfil === "pe" ? "Trilha da praia" : "BR-277", distance: distancia * 0.5 },
        { maneuver: { type: "turn", modifier: "right", location: linha[1] }, name: perfil === "pe" ? "Caminho de Encantadas" : "PR-412", distance: distancia * 0.3 },
        { maneuver: { type: "turn", modifier: "left", location: linha[2] }, name: "", distance: distancia * 0.2 },
        { maneuver: { type: "arrive", location: linha[3] }, name: "", distance: 0 },
      ] }],
    }],
  };
}

const LUGARES = [
  { name: "Curitiba", city: "Curitiba", state: "Paraná", coordinates: [-49.2733, -25.4284] },
  { name: "Pontal do Sul", city: "Pontal do Paraná", state: "Paraná", coordinates: [-48.3524, -25.5813] },
  { name: "Joinville", city: "Joinville", state: "Santa Catarina", coordinates: [-48.8455, -26.3045] },
];

http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORTA}`);
  const json = (s, d) => { res.writeHead(s, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(d)); };
  const m = u.pathname.match(/^\/estilo\/(\w+)/);
  if (m) return json(200, estilo(m[1]));
  const r = u.pathname.match(/^\/(carro|pe)\/route\/v1\/driving\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/);
  if (r) return json(200, rota([[Number(r[2]), Number(r[3])], [Number(r[4]), Number(r[5])]], r[1]));
  if (u.pathname === "/busca") {
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    return json(200, { features: LUGARES.filter((l) => l.name.toLowerCase().includes(q.slice(0, 4))).map((l) => ({
      geometry: { type: "Point", coordinates: l.coordinates }, properties: { name: l.name, city: l.city, state: l.state },
    })) });
  }
  json(404, { erro: "não simulado" });
}).listen(PORTA, () => console.log(`mapas simulados em http://localhost:${PORTA}`));
