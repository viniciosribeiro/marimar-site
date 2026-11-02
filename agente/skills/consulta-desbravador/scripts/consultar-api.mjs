/**
 * Consulta de tarifas da Marina via API autenticada do site.
 * A Vercel executa o acesso ao Worker Desbravador em gru1 (Sao Paulo).
 * NAO chamar o Worker direto da Hostinger: requisicoes externas podem receber 502.
 *
 * node consultar-api.mjs <checkin> <checkout> <adultos> <criancas> [bebes]
 * MARIMAR_API_KEY deve corresponder a AGENT_API_KEY da Vercel.
 * MARIMAR_SITE_URL e opcional (padrao: dominio publico da Marimar).
 */
const SITE = (process.env.MARIMAR_SITE_URL || 'https://www.pousadamarimarilhadomel.com.br').replace(/\/+$/, '');
const CHAVE = process.env.MARIMAR_API_KEY || '';
const SLUG = 'pousada-ilha-do-mel-marimar';
const [, , checkin, checkout, adArg = '2', chArg = '0', bbArg = '0', quartoArg = ''] = process.argv;
const inteiro = (s, minimo, maximo) => {
  const n = Number(s);
  return Number.isInteger(n) ? Math.min(maximo, Math.max(minimo, n)) : minimo;
};
const adultos = inteiro(adArg, 1, 20);
const criancas = inteiro(chArg, 0, 20);
const bebes = inteiro(bbArg, 0, 10);
const out = (dados) => { console.log(JSON.stringify(dados)); process.exit(0); };
const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
if (!dataValida(checkin) || !dataValida(checkout) || checkout <= checkin) out({ ok: false, erro: 'Datas invalidas ou periodo invertido' });
if (!CHAVE) out({ ok: false, erro: 'MARIMAR_API_KEY ausente na Hostinger. Configure a mesma AGENT_API_KEY da Vercel.' });

const qs = new URLSearchParams({ check_in: checkin, check_out: checkout, adultos: String(adultos), criancas: String(criancas), bebes: String(bebes) });
let d;
try {
  const r = await fetch(`${SITE}/api/agent/disponibilidade?${qs}`, {
    headers: { Authorization: `Bearer ${CHAVE}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(65000),
    cache: 'no-store',
  });
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) throw new Error(`API autenticada recusou acesso (HTTP ${r.status}); confira MARIMAR_API_KEY`);
    throw new Error(`API de disponibilidade retornou HTTP ${r.status}`);
  }
  d = await r.json();
  if (d?.ok !== true || !Array.isArray(d.dados)) throw new Error('API nao retornou dados de disponibilidade validos');
} catch (e) {
  out({ ok: false, erro: `Falha na consulta: ${e.message}` });
}

const oc = d.ocupacao || {};
const adultoMotor = Number.isInteger(oc.adultosMotor) ? oc.adultosMotor : adultos;
const criancaMotor = Number.isInteger(oc.criancasMotor) ? oc.criancasMotor : criancas + bebes;
const linkFallback = 'https://reservas.desbravador.com.br/hotel-app/' + SLUG + '/reservation?' + new URLSearchParams({
  checkin, checkout, adults: String(adultoMotor), child1: String(criancaMotor),
});
// Preferir o deep_link individual da API; com versões antigas, a sigla
// da suíte ainda permite completar a URL sem alterar preços e ocupação.
const linkDaSuite = (q) => {
  const base = typeof q.deep_link === 'string' && q.deep_link.startsWith('https://reservas.desbravador.com.br/')
    ? q.deep_link : linkFallback;
  const url = new URL(base);
  if (typeof q.id === 'string' && q.id.trim()) {
    url.searchParams.set('roomCode', q.id.trim());
    url.searchParams.set('rateCode', '');
  }
  return url.toString();
};
const numero = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const disponiveis = d.dados.filter((q) => q.disponivel === true);
// Sem escolha entre várias suítes, conservar a pesquisa geral.
// A Marina pode solicitar uma suite pelo ID real (QUEEN, HIDRO...) ou pelo nome.
// Assim o link principal NUNCA volta a ser generico depois de uma escolha.
// Falha fechado se a suite nao existe, esta esgotada ou o nome e ambiguo.
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ').trim();
const selecao = normalizar(quartoArg);
let escolhida = null;
if (selecao) {
  const porCodigo = d.dados.filter((q) => normalizar(q.id) === selecao);
  const porNomeExato = d.dados.filter((q) => normalizar(q.nome) === selecao);
  const porNomeParcial = selecao.length >= 3
    ? d.dados.filter((q) => normalizar(q.nome).includes(selecao)) : [];
  const candidatas = porCodigo.length ? porCodigo : porNomeExato.length ? porNomeExato : porNomeParcial;
  if (candidatas.length !== 1 || candidatas[0].disponivel !== true ||
      typeof candidatas[0].id !== 'string' || !candidatas[0].id.trim()) {
    out({ ok: false, erro: 'A suite solicitada nao foi identificada de forma unica ou esta indisponivel nessas datas. Nao envie link geral como se fosse o quarto escolhido.', quarto_solicitado: quartoArg });
  }
  escolhida = candidatas[0];
}
const quartosFiltrados = escolhida ? [escolhida] : disponiveis;
const link = escolhida ? linkDaSuite(escolhida) : (disponiveis.length === 1 ? linkDaSuite(disponiveis[0]) : linkFallback);
const indisponiveis = d.dados.filter((q) => q.disponivel === false);
const quartos = quartosFiltrados.map((q) => ({
  codigo: q.id, quarto: q.nome, capacidade: q.ocupacao_max,
  link_reserva: linkDaSuite(q),
  total: numero(q.total), diaria_media: numero(q.diaria),
  // A rota do agente ainda nao devolve estoque unitario nem imagens.
  // Nunca deduzir que e a ultima unidade.
  unidades: null, ultima_unidade: null, estadia_minima: null,
  comodidades: [], fotos: [],
}));
const noites = Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000);
out({
  ok: true, pousada: 'Pousada Marimar', checkin, checkout, adultos, criancas, bebes, noites,
  tem_disponibilidade: quartos.length > 0,
  quarto_selecionado: escolhida ? { codigo: escolhida.id, quarto: escolhida.nome } : null,
  quartos,
  esgotados: indisponiveis.map((q) => ({ quarto: q.nome, motivo: 'Indisponivel no periodo consultado' })),
  estadia_minima: null, aviso_crianca: oc.regraAplicada ? null : (criancas || bebes ? 'Confirme a regra de criancas com a recepcao.' : null),
  regra_criancas: oc.regraAplicada ? (oc.explicacao || null) : null,
  valor_bebes: numero(oc.valorBebes),
  link_reserva: link, fonte: d.fonte || 'worker',
  consultado_em: d.consultado_em || new Date().toISOString(),
  nota: 'Disponibilidade e totais obtidos agora da API autenticada do site Marimar (Vercel/gru1). Nao inventar valores quando total for null.',
});
