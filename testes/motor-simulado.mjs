/**
 * Motor Desbravador (Worker PousadaHub) simulado, para testar a busca sem o
 * motor real. Cobra R$ 275 por adulto/noite e R$ 150 por criança/noite, e
 * manda o mesmo aviso de faixa etária que o motor real manda quando há
 * criança — é o cenário do print de 30/09/2026.
 *
 *   node testes/motor-simulado.mjs     (porta 4011; WORKER_BASE_URL=http://localhost:4011)
 */
import http from "node:http";

const PORTA = Number(process.env.PORTA ?? 4011);

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname !== "/tarifas") { res.writeHead(404); return res.end(); }
  const adultos = Number(u.searchParams.get("adultos") ?? 2);
  const criancas = Number(u.searchParams.get("criancas") ?? 0);
  const ci = u.searchParams.get("check_in"); const co = u.searchParams.get("check_out");
  const noites = Math.round((Date.parse(co) - Date.parse(ci)) / 86400000);
  const quarto = (id, nome, max) => {
    const cabe = adultos + criancas <= max;
    const total = 275 * adultos * noites;
    const totalCriancas = 150 * criancas * noites;
    return {
      id, nome, categoria: "Familia", diaria: 275 * adultos, total, total_criancas: totalCriancas,
      total_geral: total + totalCriancas, valor_adulto: 275, valor_crianca: 150,
      ocupacao_max: max, estadia_minima: 1, disponivel: cabe, unidades_disponiveis: cabe ? 2 : 0,
      motivo_indisponivel: cabe ? undefined : "não comporta o número de hóspedes",
      pacote: "Café da manhã", comodidades: [], fotos: [],
    };
  };
  const todos = [quarto("FAM", "STANDARD FAMILIA", 4), quarto("CASAL", "CASAL STANDARD", 2)];
  const corpo = {
    hotel: "Marimar", check_in: ci, check_out: co, adultos, criancas, noites,
    quartos: todos.filter((q) => q.disponivel), indisponiveis: todos.filter((q) => !q.disponivel),
    total_disponiveis: todos.filter((q) => q.disponivel).length,
    ...(criancas > 0 ? { aviso_crianca: "Faixas etarias de crianca nao configuradas no motor de reservas. Confirmar valor com a recepcao antes de informar ao hospede." } : {}),
  };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(corpo));
}).listen(PORTA, () => console.log(`motor simulado em http://localhost:${PORTA}`));
