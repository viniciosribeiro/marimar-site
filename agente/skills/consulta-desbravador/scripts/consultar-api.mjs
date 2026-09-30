/**
 * Consulta ao vivo de vaga e preço — skill consulta-desbravador.
 *
 *   node consultar-api.mjs <checkin> <checkout> <adultos> <criancas> [bebes]
 *
 * `criancas` = crianças que NÃO são de colo; `bebes` = de colo.
 *
 * Desde 30/09/2026, antes de ir ao motor, pergunta ao site da pousada
 * (/api/agent/regras) como montar a consulta — a mesma conta que a busca do
 * site faz. Com a regra da pousada ("criança que não é de colo paga como
 * adulto"), as crianças vão ao motor como adultos, o bebê fica fora e o
 * aviso de faixa etária do motor deixa de valer. Se o site não responder, a
 * consulta segue como antes (crianças ao motor, com o aviso dele).
 *
 * Ambiente: MARIMAR_API_KEY (a mesma da skill marimar-pousada) e,
 * opcional, MARIMAR_SITE_URL (padrão https://marimar-site.vercel.app).
 * Versionado em agente/skills/consulta-desbravador no repositório do site.
 */
const API = process.env.DESBRAVADOR_API_URL || 'https://pousadahub.viniciosribeiro.workers.dev/tarifas'; // variável só para teste local
const SLUG = 'pousada-ilha-do-mel-marimar';
const SITE = (process.env.MARIMAR_SITE_URL || 'https://marimar-site.vercel.app').replace(/\/+$/, '');
const CHAVE = process.env.MARIMAR_API_KEY || '';

const [, , checkin, checkout, adArg = '2', chArg = '0', bbArg = '0'] = process.argv;
const adultos = Math.max(1, Number(adArg) || 0);
const criancas = Math.max(0, Number(chArg) || 0);
const bebes = Math.max(0, Number(bbArg) || 0);
const out = (o) => { console.log(JSON.stringify(o)); process.exit(0); };

if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin || '') || !/^\d{4}-\d{2}-\d{2}$/.test(checkout || '')) out({ ok: false, erro: 'Datas invalidas' });
if (new Date(checkout) <= new Date(checkin)) out({ ok: false, erro: 'Saida deve ser depois da entrada' });
const noites = Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000);

/* 1. A regra da pousada: quem vai ao motor como adulto, quanto paga o bebê. */
let regra = null;
if (CHAVE) {
  try {
    const qs = new URLSearchParams({ adultos, criancas, bebes, noites });
    const r = await fetch(`${SITE}/api/agent/regras?${qs}`, {
      headers: { authorization: `Bearer ${CHAVE}` }, signal: AbortSignal.timeout(8000),
    });
    if (r.ok) regra = (await r.json())?.dados?.ocupacao ?? null;
  } catch { /* site fora do ar: segue como antes */ }
}
const aplicada = Boolean(regra?.regraAplicada);
const adMotor = aplicada ? regra.adultosMotor : adultos;
const chMotor = aplicada ? regra.criancasMotor : criancas + bebes;
const valorBebes = aplicada ? Number(regra.valorBebes || 0) : 0;

const link = 'https://reservas.desbravador.com.br/hotel-app/' + SLUG + '/reservation?checkin=' + checkin + '&checkout=' + checkout + '&adults=' + adMotor + '&child1=' + chMotor;

/* 2. O motor, com a consulta já montada pela regra. */
const url = API + '?slug=' + SLUG + '&check_in=' + checkin + '&check_out=' + checkout + '&adultos=' + adMotor + '&criancas=' + chMotor;
let d;
try {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  d = await r.json();
} catch (e) {
  out({ ok: false, erro: 'Falha na consulta: ' + e.message, link });
}

const quartos = (d.quartos || []).map((q) => ({
  codigo: q.id, quarto: q.nome, capacidade: q.ocupacao_max,
  // total_geral já inclui crianças; o bebê pago (quando houver) é somado aqui.
  total: q.total_geral == null ? null : q.total_geral + valorBebes,
  diaria_media: q.diaria, parcelas: null,
  unidades: q.unidades_disponiveis, ultima_unidade: q.unidades_disponiveis === 1,
  estadia_minima: q.estadia_minima, comodidades: q.comodidades,
  fotos: (q.fotos || []).slice(0, 4),
}));

const esgotados = (d.indisponiveis || []).map((q) => ({ quarto: q.nome, motivo: q.motivo_indisponivel }));

out({
  ok: true, pousada: 'Pousada Marimar',
  checkin, checkout, adultos, criancas, bebes, noites: d.noites,
  tem_disponibilidade: quartos.length > 0,
  quartos, esgotados,
  estadia_minima: Math.max(0, ...quartos.map((q) => q.estadia_minima || 0)),
  // Com a regra da pousada aplicada, o aviso de faixa etária do motor não vale.
  aviso_crianca: aplicada ? null : d.aviso_crianca || null,
  regra_criancas: aplicada ? regra.explicacao : null,
  valor_bebes: aplicada ? valorBebes : null,
  link_reserva: link,
  consultado_em: new Date().toISOString(),
  nota: 'Valores ao vivo do motor. Total ja inclui as noites do periodo' + (aplicada ? ' e a regra de criancas da pousada.' : '.'),
});
