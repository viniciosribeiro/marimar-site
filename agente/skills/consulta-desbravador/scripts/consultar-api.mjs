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
const [, , checkin, checkout, adArg = '2', chArg = '0', bbArg = '0'] = process.argv;
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
const link = d.dados.find((q) => typeof q.deep_link === 'string' && q.deep_link.startsWith('https://reservas.desbravador.com.br/'))?.deep_link || linkFallback;
const numero = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const disponiveis = d.dados.filter((q) => q.disponivel === true);
const indisponiveis = d.dados.filter((q) => q.disponivel === false);
const quartos = disponiveis.map((q) => ({
  codigo: q.id, quarto: q.nome, capacidade: q.ocupacao_max,
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
  quartos,
  esgotados: indisponiveis.map((q) => ({ quarto: q.nome, motivo: 'Indisponivel no periodo consultado' })),
  estadia_minima: null, aviso_crianca: oc.regraAplicada ? null : (criancas || bebes ? 'Confirme a regra de criancas com a recepcao.' : null),
  regra_criancas: oc.regraAplicada ? (oc.explicacao || null) : null,
  valor_bebes: numero(oc.valorBebes),
  link_reserva: link, fonte: d.fonte || 'worker',
  consultado_em: d.consultado_em || new Date().toISOString(),
  nota: 'Disponibilidade e totais obtidos agora da API autenticada do site Marimar (Vercel/gru1). Nao inventar valores quando total for null.',
});
