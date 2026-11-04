/**
 * Fotos das suítes sincronizadas com o Desbravador, de ponta a ponta
 * (docs/fluxo-fotos-desbravador.md), com o motor simulado.
 *
 *   servidor local (npm run build && npm start) com banco LOCAL,
 *     WORKER_BASE_URL=http://localhost:4011, OPENCLAW_GATEWAY_URL=http://localhost:4010
 *   node testes/gateway-simulado.mjs            # porta 4010
 *   DATABASE_URL=<banco LOCAL> AGENT_API_KEY=... SENHA=... node testes/e2e-fotos-sync.mjs
 *
 * O próprio teste sobe o motor simulado (porta 4011) duas vezes: primeiro
 * com as fotos de hoje, depois com uma foto trocada lá (SIM_FOTOS_V2=1),
 * para provar que a troca chega ao site e que o que a pousada subiu no
 * painel fica intacto.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHAVE = process.env.AGENT_API_KEY ?? "chave-local-teste";
const URL_BANCO = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(URL_BANCO)) { console.error("Precisa de DATABASE_URL de um banco LOCAL."); process.exit(2); }

let falhas = 0;
const ok = (cond, nome, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${nome}${cond || !extra ? "" : ` — ${extra}`}`); if (!cond) falhas++; };
const comChave = { headers: { authorization: `Bearer ${CHAVE}` } };
const json = (caminho, init = comChave) => fetch(`${BASE}${caminho}`, init).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => null) }));
/* O HTML traz a URL da foto codificada dentro de /_next/image?url=...: procura das duas formas. */
const temFoto = (html, trecho) => html.includes(trecho) || html.includes(encodeURIComponent(trecho));

/* O motor simulado, ligado e desligado pelo teste. */
let motor = null;
async function ligarMotor(env = {}) {
  if (motor) { motor.kill(); await new Promise((r) => setTimeout(r, 300)); }
  motor = spawn(process.execPath, ["testes/motor-simulado.mjs"], { env: { ...process.env, PORTA: "4011", ...env }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { await fetch("http://localhost:4011/tarifas?check_in=2026-12-01&check_out=2026-12-03&adultos=2"); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("motor simulado não subiu");
}

const sql = postgres(URL_BANCO, { max: 1 });
try {
  /* Estado limpo: nada do Desbravador, a suíte que só existe no motor fora,
     e uma foto do café subida "pelo painel" (que a sincronização não pode tocar). */
  await sql`DELETE FROM midias WHERE origem = 'desbravador'`;
  await sql`DELETE FROM quartos WHERE desbravador_room_id = 'NOVAMOTOR'`;
  await sql`DELETE FROM integracoes WHERE chave = 'fotos_sync'`;
  await sql`DELETE FROM midias WHERE alt = 'Café da manhã (teste e2e)'`;
  await sql`DELETE FROM chat_mensagens WHERE conteudo LIKE '%[teste-tts]%'`.catch(() => {});
  await sql`INSERT INTO midias (url, alt, tipo, secao, ordem, visivel_marina, titulo)
    VALUES ('https://teste.public.blob.vercel-storage.com/cafe-e2e.jpg', 'Café da manhã (teste e2e)', 'foto', 'cafe', 0, true, 'Mesa do café')`;
  const [{ n: doPainelAntes }] = await sql`SELECT COUNT(*)::int AS n FROM midias WHERE origem = 'painel'`;

  await ligarMotor();

  /* 1. Sem chave (como a Vercel chama sem CRON_SECRET), o agendador roda em
     segundo plano, uma vez por hora — igual a uma busca no site. */
  const semChave = await json("/api/cron/sincronizar-fotos", {});
  ok(semChave.status === 202 && semChave.corpo?.modo === "carona" && semChave.corpo?.ultima_em === null, "agendador sem chave: 202, rodada em segundo plano", JSON.stringify(semChave.corpo));
  let gravado = null;
  for (let i = 0; i < 60 && !gravado; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    [gravado] = await sql`SELECT valor FROM integracoes WHERE chave = 'fotos_sync'`;
  }
  ok(Boolean(gravado), "a rodada em segundo plano concluiu e ficou registrada");
  const r1 = { status: 200, corpo: gravado ? { ok: true, ...JSON.parse(gravado.valor) } : null };
  const publico = await json("/api/cron/sincronizar-fotos", {});
  ok(publico.corpo?.ultima_em !== null, "sem chave de novo: só informa a hora da última rodada (e não roda antes de 1 h)");
  const porSuite = Object.fromEntries((publico.corpo?.ultimo_resumo?.suites ?? []).map((d) => [d.codigo, d]));
  ok(porSuite.FAM?.motor === 2 && porSuite.FAM?.site_depois === 2 && porSuite.FAM?.novas === 2 && porSuite.FAM?.ativo === true, "resumo público diz, por suíte, quantas fotos o motor tem e quantas o site tem (FAM)", JSON.stringify(porSuite.FAM));
  ok(porSuite.SR?.nota === "desativada no site" && porSuite.NOVAMOTOR?.nota === "cadastro criado desativado", "resumo público marca a suíte desativada e a criada", JSON.stringify([porSuite.SR, porSuite.NOVAMOTOR]));
  ok(publico.corpo?.ultimo_erro === null, "sem erro registrado quando a rodada concluiu");
  ok(r1.corpo?.suites_motor === 4, "4 suítes vistas no motor", String(r1.corpo?.suites_motor));
  ok(r1.corpo?.fotos_novas === 8 && r1.corpo?.fotos_removidas === 0, "8 fotos novas (2 por suíte), nenhuma removida", `${r1.corpo?.fotos_novas}/${r1.corpo?.fotos_removidas}`);
  ok(r1.corpo?.espelho === "sem_blob", "sem BLOB_READ_WRITE_TOKEN: fotos apontam para o Desbravador (e o resumo diz isso)");
  ok(r1.corpo?.suites_criadas?.length === 1 && r1.corpo.suites_criadas[0] === "SUÍTE NOVA DO MOTOR", "a suíte que só existe no motor foi criada", JSON.stringify(r1.corpo?.suites_criadas));
  ok(r1.corpo?.suites_inativas?.includes("SUITE REDE"), "a suíte desativada no site é apontada no aviso", JSON.stringify(r1.corpo?.suites_inativas));
  ok(r1.corpo?.avisos?.some((a) => /desativadas no site/.test(a)) && r1.corpo?.avisos?.some((a) => /nova\(s\) criada/.test(a)), "avisos dizem onde ativar e o que revisar");

  const [nova] = await sql`SELECT slug, ativo, ordem, ocupacao_max FROM quartos WHERE desbravador_room_id = 'NOVAMOTOR'`;
  ok(nova && nova.ativo === false && nova.ordem >= 100 && nova.slug === "suite-nova-do-motor", "suíte nova entra desativada, no fim da lista, com slug limpo", JSON.stringify(nova));
  const [{ n: desb }] = await sql`SELECT COUNT(*)::int AS n FROM midias WHERE origem = 'desbravador' AND url_origem IS NOT NULL AND secao = 'quarto'`;
  ok(desb === 8, "8 fotos marcadas como do Desbravador, com a URL de origem guardada", String(desb));
  const [{ n: daRede }] = await sql`SELECT COUNT(*)::int AS n FROM midias m JOIN quartos q ON q.id = m.quarto_id WHERE q.desbravador_room_id = 'SR' AND m.origem = 'desbravador'`;
  ok(daRede === 2, "a suíte desativada também recebe as fotos (prontas para quando for ativada)", String(daRede));

  /* 2. Com a chave da Marina roda na hora, devolve o resumo e não duplica. */
  const r2 = await json("/api/cron/sincronizar-fotos");
  ok(r2.status === 200 && r2.corpo?.modo === "imediato", "agendador com a chave da Marina roda na hora e devolve o resumo", JSON.stringify(r2.corpo));
  ok(r2.corpo?.fotos_novas === 0 && r2.corpo?.fotos_ja_presentes === 8 && r2.corpo?.fotos_removidas === 0, "segunda rodada: nada novo, nada removido, nada duplicado", JSON.stringify(r2.corpo));

  /* 3. O site mostra as fotos: página da suíte (ativa), galeria sem link para inativa. */
  const paginaCasal = await fetch(`${BASE}/quartos/casal-standard`).then(async (r) => ({ status: r.status, html: await r.text() }));
  ok(paginaCasal.status === 200 && temFoto(paginaCasal.html, "gt_CASAL_1.jpg"), "página da suíte mostra a foto que veio do Desbravador");
  ok((await fetch(`${BASE}/quartos/suite-nova-do-motor`)).status === 404, "a suíte nova (desativada) não tem página pública ainda");
  const galeria = await fetch(`${BASE}/galeria`).then((r) => r.text());
  ok(!galeria.includes("/quartos/suite-rede") && !galeria.includes("/quartos/suite-nova-do-motor"), "galeria não leva a página de suíte desativada (sem 404)");
  ok(temFoto(galeria, "gt_CASAL_1.jpg"), "galeria mostra as fotos sincronizadas da suíte ativa");
  const home = await fetch(`${BASE}/`).then((r) => r.text());
  const quartos = await fetch(`${BASE}/quartos`).then((r) => r.text());
  ok(!home.includes("/quartos/suite-rede") && !quartos.includes("/quartos/suite-nova-do-motor"), "home e /quartos só linkam suítes ativas");
  const busca = await fetch(`${BASE}/reservar?check_in=2026-12-01&check_out=2026-12-03&adultos=2`).then((r) => r.text());
  ok(busca.includes("Ver fotos e detalhes de") && !busca.includes('href="/quartos/suite-nova-do-motor"'), "busca lista as suítes do motor sem link antigo para /quartos");

  /* 4. Fotos por seção para a Marina. */
  ok((await json("/api/agent/fotos", {})).status === 401, "/api/agent/fotos exige a chave");
  const fotos = await json("/api/agent/fotos");
  ok(fotos.status === 200 && fotos.corpo?.dados?.length === 5, "todas as seções (pousada, restaurante, café, praia, eventos)", String(fotos.corpo?.dados?.length));
  const cafe = await json("/api/agent/fotos?secao=cafe");
  ok(cafe.corpo?.dados?.[0]?.secao === "cafe" && cafe.corpo.dados[0].total >= 1 && /\/api\/midia-secao\/cafe\/0$/.test(cafe.corpo.dados[0].fotos[0]?.url_whatsapp ?? ""), "café da manhã vem com url_whatsapp servida pelo site", JSON.stringify(cafe.corpo?.dados?.[0]));
  ok(/Café da manhã: 1 foto/.test(cafe.corpo?.resumo_texto ?? ""), "resumo_texto diz quantas fotos a seção tem");
  ok((await json("/api/agent/fotos?secao=piscina")).status === 400, "seção desconhecida: 400 com a lista das válidas");
  ok((await fetch(`${BASE}/api/midia-secao/praia/0`)).status === 404, "seção sem foto: 404, sem inventar imagem");
  ok((await fetch(`${BASE}/api/midia-secao/quarto/0`)).status === 400, "fotos de quarto não saem pela rota de seção");
  const indice = await json("/api/agent/indice");
  ok(indice.corpo?.resumo_texto?.includes("/api/agent/fotos"), "o índice de fontes da Marina lista a rota de fotos");
  const openapi = await fetch(`${BASE}/api/agent/openapi`).then((r) => r.json());
  ok(Boolean(openapi?.paths?.["/api/agent/fotos"]), "OpenAPI descreve /api/agent/fotos");
  const conhecimento = await json("/api/agent/conhecimento");
  ok(/REGRAS DO CANAL WHATSAPP/.test(conhecimento.corpo?.resumo_texto ?? "") && /\[\[tts:text\]\]/.test(conhecimento.corpo?.resumo_texto ?? "") && /secao=cafe/.test(conhecimento.corpo?.resumo_texto ?? ""), "o WhatsApp lê as regras novas (bloco de fala, fotos por seção, link da suíte) pelo treinamento do site");
  const restaurante = await json("/api/agent/restaurante");
  ok(/api\/agent\/fotos\?secao=cafe/.test(JSON.stringify(restaurante.corpo ?? {})), "rota do restaurante aponta para as fotos do café");

  /* 4b. Motor fora do ar: a rodada falha, o erro fica visível e some na próxima que conclui. */
  motor.kill(); await new Promise((r) => setTimeout(r, 500));
  const falha = await json("/api/cron/sincronizar-fotos");
  ok(falha.status === 503 && falha.corpo?.ok === false, "motor fora: a rodada com chave devolve 503 e não altera nada", JSON.stringify(falha.corpo));
  const comErro = await json("/api/cron/sincronizar-fotos", {});
  ok(typeof comErro.corpo?.ultimo_erro?.erro === "string" && comErro.corpo.ultimo_erro.erro.length > 0, "o erro da rodada fica registrado e visível sem chave", JSON.stringify(comErro.corpo?.ultimo_erro));

  /* 5. A troca de foto no Desbravador chega ao site; o que é do painel fica. */
  await ligarMotor({ SIM_FOTOS_V2: "1" });
  const r3 = await json("/api/cron/sincronizar-fotos");
  ok(r3.corpo?.fotos_novas === 4 && r3.corpo?.fotos_removidas === 4, "foto trocada no Desbravador: 4 saem, 4 entram", JSON.stringify({ ...r3.corpo, suites: undefined }));
  ok((await json("/api/cron/sincronizar-fotos", {})).corpo?.ultimo_erro === null, "rodada que concluiu limpa o erro anterior");
  ok(r3.corpo?.suites?.every((d) => d.site_depois === d.motor), "depois da troca, cada suíte tem no site exatamente as fotos do motor", JSON.stringify(r3.corpo?.suites?.map((d) => [d.codigo, d.motor, d.site_depois])));
  const [{ n: v2 }] = await sql`SELECT COUNT(*)::int AS n FROM midias WHERE origem = 'desbravador'`;
  const [{ n: antigas }] = await sql`SELECT COUNT(*)::int AS n FROM midias WHERE origem = 'desbravador' AND url LIKE '%\\_2.jpg'`;
  ok(v2 === 8 && antigas === 0, "continuam 8 fotos do Desbravador, nenhuma das que sumiram lá", `${v2}/${antigas}`);
  const [{ n: doPainelDepois }] = await sql`SELECT COUNT(*)::int AS n FROM midias WHERE origem = 'painel'`;
  ok(doPainelDepois === doPainelAntes, "as fotos subidas pelo painel não foram tocadas", `${doPainelAntes} → ${doPainelDepois}`);
  const [sync] = await sql`SELECT valor FROM integracoes WHERE chave = 'fotos_sync'`;
  ok(sync && JSON.parse(sync.valor).fotos_removidas === 4, "a última rodada fica registrada para o painel");

  /* 6. Painel: botão em Mídias, selo, Diagnóstico com os agendadores; chat sem o bloco de fala. */
  const nav = await chromium.launch();
  try {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    const pag = await ctx.newPage();
    const errosPagina = [];
    pag.on("pageerror", (e) => errosPagina.push(e.message));
    await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(800);
    await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
    await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste-local-123456");
    await pag.getByRole("button", { name: "Entrar no painel" }).click();
    await pag.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 });

    await pag.goto(`${BASE}/admin/midias`);
    const botao = pag.getByRole("button", { name: "Sincronizar com o Desbravador" });
    await botao.waitFor({ timeout: 15000 }).catch(() => {});
    ok(await botao.isVisible(), "Mídias tem o botão “Sincronizar com o Desbravador”");
    await botao.click();
    const aviso = pag.getByText(/Sincronizado com o Desbravador \(4 suítes no motor\)/);
    await aviso.waitFor({ timeout: 60000 }).catch(() => {});
    ok(await aviso.isVisible(), "o botão roda e mostra o resumo em palavras", await pag.getByRole("status").allTextContents().then((t) => t.join(" | ")).catch(() => ""));
    await pag.goto(`${BASE}/admin/midias?album=quarto:${(await sql`SELECT id FROM quartos WHERE desbravador_room_id = 'CASAL'`)[0].id}`).catch(() => {});
    const selos = pag.getByText("Do Desbravador", { exact: true });
    ok((await selos.count()) >= 1, "as fotos do motor levam o selo “Do Desbravador”", String(await selos.count()));

    await pag.goto(`${BASE}/admin/diagnostico`);
    const diag = await pag.content();
    ok(diag.includes("Agendadores") && diag.includes("Fotos das suítes sincronizadas com o Desbravador"), "Diagnóstico mostra os agendadores e a última sincronização");
    ok(diag.includes("Agendador da Vercel (CRON_SECRET)") && (process.env.CRON_SECRET ? diag.includes("configurado") : diag.includes("opcional")), "Diagnóstico diz se a CRON_SECRET existe (sem mostrar o valor) e que ela é opcional");
    ok(diag.includes("Colunas das fotos (migration 0022)") && diag.includes("aplicadas"), "Diagnóstico mostra as colunas da 0022 como aplicadas");
    ok(diag.includes("4 suítes no motor"), "Diagnóstico resume a última rodada");

    /* Chat do site: a Marina responde com link + bloco de fala; a pessoa lê sem o bloco. */
    await pag.goto(`${BASE}/`);
    await pag.getByRole("button", { name: /Abrir atendimento/ }).first().click();
    const campo = pag.getByPlaceholder(/Pergunte|Escreva|mensagem/i).first();
    await campo.waitFor({ timeout: 15000 });
    await campo.fill("Qual o horário do check-in? [teste-tts]");
    await campo.press("Enter");
    await pag.getByText(/reservas\.desbravador\.com\.br|Para reservar/).first().waitFor({ timeout: 30000 }).catch(() => {});
    await pag.waitForTimeout(800);
    const conversa = await pag.locator("body").innerText();
    ok(!conversa.includes("[[tts:text]]") && !conversa.includes("[[/tts:text]]"), "o bloco de fala nunca aparece na tela do chat");
    ok(/Para reservar/.test(conversa), "o resto da resposta (com o link) aparece normalmente");
    const [ultima] = await sql`SELECT conteudo FROM chat_mensagens WHERE papel = 'marina' ORDER BY criado_em DESC LIMIT 1`;
    ok(ultima && !ultima.conteudo.includes("[[tts:text]]") && /Para reservar/.test(ultima.conteudo), "a revisão do painel grava a resposta sem o bloco");
    const ultimaDoGateway = await fetch("http://localhost:4010/__ultima").then((r) => r.text()).catch(() => "");
    ok(ultimaDoGateway.length > 0 && !ultimaDoGateway.includes("REGRAS DO CANAL WHATSAPP"), "o chat do site não recebe as regras do WhatsApp");
    ok(errosPagina.length === 0, "sem erro de script nas páginas", errosPagina.join(" | "));
    await ctx.close();
  } finally { await nav.close(); }
} finally {
  if (motor) motor.kill();
  await sql`DELETE FROM midias WHERE alt = 'Café da manhã (teste e2e)'`.catch(() => {});
  await sql.end();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
