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
/* SIM_SEM_TARIFA=1 (ou GET /__modo?sem_tarifa=1 com o simulador rodando): o
   motor devolve todas as suítes indisponíveis e com diária 0, como fez de
   verdade em 04/11/2026 por alguns minutos ("sem tarifa publicada"). */
let semTarifa = !!process.env.SIM_SEM_TARIFA;

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__modo") {
    if (u.searchParams.has("sem_tarifa")) semTarifa = u.searchParams.get("sem_tarifa") === "1";
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ semTarifa }));
  }
  if (u.pathname !== "/tarifas") { res.writeHead(404); return res.end(); }
  const adultos = Number(u.searchParams.get("adultos") ?? 2);
  const criancas = Number(u.searchParams.get("criancas") ?? 0);
  const ci = u.searchParams.get("check_in"); const co = u.searchParams.get("check_out");
  const noites = Math.round((Date.parse(co) - Date.parse(ci)) / 86400000);
  /* Fotos como o motor real devolve (servidor do Desbravador). SIM_FOTOS_V2=1
     simula a pousada trocando uma foto lá: a 2ª some e entra uma nova. */
  const fotosDe = (id) => process.env.SIM_FOTOS_V2
    ? [`https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_${id}_1.jpg`, `https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_${id}_3.jpg`]
    : [`https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_${id}_1.jpg`, `https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_${id}_2.jpg`];
  const quarto = (id, nome, max) => {
    if (semTarifa) {
      return {
        id, nome, categoria: "Familia", diaria: 0, total: 0, total_criancas: 0, total_geral: 0, valor_adulto: 0, valor_crianca: 0,
        ocupacao_max: max, estadia_minima: 1, disponivel: false, unidades_disponiveis: 0,
        motivo_indisponivel: "esgotado no período; sem tarifa publicada para o período",
        pacote: null, comodidades: [], fotos: fotosDe(id),
      };
    }
    const cabe = adultos + criancas <= max;
    const total = 275 * adultos * noites;
    const totalCriancas = 150 * criancas * noites;
    return {
      id, nome, categoria: "Familia", diaria: 275 * adultos, total, total_criancas: totalCriancas,
      total_geral: total + totalCriancas, valor_adulto: 275, valor_crianca: 150,
      ocupacao_max: max, estadia_minima: 1, disponivel: cabe, unidades_disponiveis: cabe ? 2 : 0,
      motivo_indisponivel: cabe ? undefined : "não comporta o número de hóspedes",
      pacote: "Café da manhã", comodidades: [], fotos: fotosDe(id),
    };
  };
  /* "SR" existe no site mas desativada (como as 3 de produção); "NOVAMOTOR" só
     existe no motor: a sincronização precisa criá-la desativada no site. */
  /* SIM_SEM_CASAL=1: o motor deixa de vender a CASAL (o site tem que desligá-la sozinho). */
  const todos = [quarto("FAM", "STANDARD FAMILIA", 4), ...(process.env.SIM_SEM_CASAL ? [] : [quarto("CASAL", "CASAL STANDARD", 2)]),
    quarto("SR", "SUITE REDE", 2), quarto("NOVAMOTOR", "SUÍTE NOVA DO MOTOR", 3)];
  const corpo = {
    hotel: "Marimar", check_in: ci, check_out: co, adultos, criancas, noites,
    quartos: todos.filter((q) => q.disponivel), indisponiveis: todos.filter((q) => !q.disponivel),
    total_disponiveis: todos.filter((q) => q.disponivel).length,
    ...(criancas > 0 ? { aviso_crianca: "Faixas etarias de crianca nao configuradas no motor de reservas. Confirmar valor com a recepcao antes de informar ao hospede." } : {}),
  };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(corpo));
}).listen(PORTA, () => console.log(`motor simulado em http://localhost:${PORTA}`));
