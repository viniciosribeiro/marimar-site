/**
 * Simulação completa do escalonamento e do aprendizado, nos dois canais.
 *
 *   OPENCLAW_GATEWAY_TOKEN=token-teste node testes/gateway-simulado.mjs   # porta 4010
 *   (servidor local com OPENCLAW_GATEWAY_URL=http://localhost:4010)
 *   DATABASE_URL=... AGENT_API_KEY=... node testes/e2e-escalonamento.mjs
 *
 * SÓ roda contra banco local (localhost): apaga equipe, chamados e
 * aprendizado para começar do zero. Cobre:
 *   1. painel: ligar o escalonamento, cadastrar a equipe, testar o envio
 *   2. site: pergunta desconhecida → chamado → equipe responde citando a
 *      mensagem → resposta no chat do site → fila de revisão → aprovar →
 *      pergunta parecida respondida sozinha
 *   3. WhatsApp: dois clientes ao mesmo tempo, equipe responde por código,
 *      cada um recebe só a sua resposta
 *   4. modo automático: aprende na hora e aparece no treinamento do WhatsApp
 *   5. prazos: lembrete, próximo da fila, aviso ao cliente, desistência
 *   6. falha de entrega (Marina manda), dados pessoais apagados
 */
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:3000";
const GW = process.env.GW ?? "http://localhost:4010";
const CHAVE = process.env.AGENT_API_KEY;
const URL_BANCO = process.env.DATABASE_URL ?? "";
if (!CHAVE || !/localhost|127\.0\.0\.1/.test(URL_BANCO)) {
  console.error("Precisa de AGENT_API_KEY e de DATABASE_URL apontando para um banco LOCAL.");
  process.exit(2);
}
const sql = postgres(URL_BANCO, { max: 1 });
const falhas = [];
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) falhas.push(msg); };
const agente = (rota, corpo) => fetch(`${BASE}${rota}`, {
  method: corpo ? "POST" : "GET",
  headers: { authorization: `Bearer ${CHAVE}`, "content-type": "application/json" },
  body: corpo ? JSON.stringify(corpo) : undefined,
}).then((r) => r.json());
const enviadas = () => fetch(`${GW}/__enviadas`).then((r) => r.json());
const limparEnviadas = () => fetch(`${GW}/__enviadas`, { method: "DELETE" });
const chat = async (sessao, mensagem) => (await fetch(`${BASE}/api/chat`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao, mensagem }),
})).text();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const GERAL = "5541933334444", FIN = "5541911112222";

try {
  /* ── zera o que o teste usa ─────────────────────────────────── */
  await sql`DELETE FROM marina_chamados`; await sql`DELETE FROM marina_aprendizado`;
  await sql`DELETE FROM equipe_contatos`; await sql`DELETE FROM marina_eventos`;
  await sql`UPDATE pousada SET chat_ativo = true`;
  await limparEnviadas();

  /* ── 1. painel ──────────────────────────────────────────────── */
  const nav = await chromium.launch();
  const pag = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await pag.goto(`${BASE}/admin/login`); await pag.waitForTimeout(1500);
  await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/, { timeout: 30000 });

  await pag.goto(`${BASE}/admin/equipe?aba=config`); await pag.waitForTimeout(1500);
  const liga = pag.locator('input[type="checkbox"]').first();
  if (!(await liga.isChecked())) await liga.check();
  await pag.getByRole("button", { name: "Salvar configuração" }).click(); await pag.waitForTimeout(1500);
  const [cfg] = await sql`SELECT ativo FROM marina_escalonamento_config WHERE id = 1`;
  ok(cfg?.ativo === true, "painel: escalonamento ligado pela tela");

  for (const [nome, numero, setor] of [["Geral e2e", "(41) 93333-4444", "Qualquer assunto"], ["Financeiro e2e", "41 91111-2222", "Financeiro"]]) {
    await pag.goto(`${BASE}/admin/equipe?aba=equipe`); await pag.waitForTimeout(1200);
    await pag.getByRole("button", { name: /Adicionar pessoa|Cadastrar a primeira/ }).first().click();
    await pag.getByLabel("Nome").fill(nome);
    await pag.getByLabel("WhatsApp").fill(numero);
    const caixaGeral = pag.getByLabel("Qualquer assunto");
    if (setor !== "Qualquer assunto") { await caixaGeral.uncheck(); await pag.getByLabel(setor).check(); }
    await pag.getByRole("button", { name: "Salvar", exact: true }).click(); await pag.waitForTimeout(1500);
  }
  const equipe = await sql`SELECT nome, numero, setores FROM equipe_contatos ORDER BY ordem`;
  ok(equipe.length === 2 && equipe[0].numero === GERAL && equipe[1].numero === FIN, "painel: equipe cadastrada, número com 55 normalizado");

  await pag.getByRole("button", { name: "Testar envio" }).first().click(); await pag.waitForTimeout(2000);
  ok((await enviadas()).some((m) => m.para === `+${GERAL}` && /Teste da Marina/.test(m.texto)), "painel: “Testar envio” chegou ao WhatsApp da pessoa");

  await pag.goto(`${BASE}/admin/marina?aba=aprendizado`); await pag.waitForTimeout(1500);
  await pag.getByRole("button", { name: /Só depois de aprovado/ }).click(); await pag.waitForTimeout(1200);
  await limparEnviadas();

  /* ── 2. site ────────────────────────────────────────────────── */
  const sessao = `e2e-site-${Date.now()}`;
  const r1 = await chat(sessao, "Meu nome é Ana Souza. Vocês têm cofre?");
  ok(/confirmar/i.test(r1), "site: Marina diz que vai confirmar");
  await espera(1500);
  const [ch1] = await sql`SELECT * FROM marina_chamados WHERE canal = 'site' ORDER BY criado_em DESC LIMIT 1`;
  ok(!!ch1 && ch1.status === "aguardando", "site: chamado aberto");
  ok(ch1 && !/Ana|Souza/.test(ch1.pergunta), "site: nome do cliente não foi guardado na pergunta");
  const aviso1 = (await enviadas()).find((m) => m.para === `+${GERAL}`);
  ok(aviso1 && aviso1.texto.includes(`#${ch1.codigo}`) && /chat do site/.test(aviso1.texto), "site: equipe avisada com código e canal");

  const resp1 = await agente("/api/agent/chamados/resposta", { numero: "+55 (41) 93333-4444", texto: "Sim, todas as suítes têm cofre digital.", citado: aviso1?.texto });
  ok(resp1.dados?.respondido && resp1.dados?.entregue, "site: resposta da equipe (citando a mensagem, sem digitar código) entregue");
  ok(resp1.dados?.aprendizado === "pendente", "site: modo aprovação — aprendizado foi para a fila");
  const poll = await (await fetch(`${BASE}/api/chat/chamados?sessao=${sessao}&depois=2020-01-01`)).json();
  ok(poll.mensagens.some((m) => /cofre digital/.test(m.texto)) && poll.pendentes === 0, "site: o chat do cliente recebe a resposta, no tom da Marina");
  const [ch1b] = await sql`SELECT destino, status FROM marina_chamados WHERE id = ${ch1.id}`;
  ok(ch1b.status === "entregue" && ch1b.destino === null, "site: entregue e sessão do cliente apagada do chamado");

  /* antes de aprovar, uma pergunta parecida ainda vai para a equipe */
  const r2 = await chat(`e2e-site-b-${Date.now()}`, "tem cofre aí?");
  ok(/confirmar/i.test(r2), "site: sem aprovação, a Marina ainda não usa o aprendido");
  await espera(1200);
  await pag.goto(`${BASE}/admin/equipe?aba=chamados`); await pag.waitForTimeout(1500);
  await pag.getByRole("button", { name: "Cancelar" }).first().click();
  await pag.getByRole("dialog").getByRole("button", { name: "Cancelar chamado" }).click(); await pag.waitForTimeout(1500);
  ok((await sql`SELECT count(*)::int AS n FROM marina_chamados WHERE status = 'aguardando'`)[0].n === 0, "painel: chamado cancelado pela tela");

  await pag.goto(`${BASE}/admin/marina?aba=aprendizado`); await pag.waitForTimeout(1500);
  await pag.getByRole("button", { name: "Aprovar", exact: true }).first().click(); await pag.waitForTimeout(1500);
  ok((await sql`SELECT status FROM marina_aprendizado`)[0]?.status === "ativo", "painel: aprendizado aprovado na fila de revisão");

  const r3 = await chat(`e2e-site-c-${Date.now()}`, "vocês tem cofre?");
  ok(/cofre digital/i.test(r3), "site: pergunta parecida respondida SOZINHA com o aprendido");
  await espera(1200);
  ok((await sql`SELECT usos FROM marina_aprendizado`)[0]?.usos === 1, "site: uso do aprendido contado");
  ok((await sql`SELECT count(*)::int AS n FROM marina_chamados WHERE status = 'aguardando'`)[0].n === 0, "site: nenhum chamado novo");

  /* ── 3. WhatsApp: dois clientes ao mesmo tempo ─────────────── */
  await limparEnviadas();
  const a = await agente("/api/agent/chamados", { pergunta: "Tem ferro de passar roupa?", cliente: "41977770001" });
  const b = await agente("/api/agent/chamados", { pergunta: "O restaurante abre na segunda?", cliente: "41977770002" });
  ok(a.dados?.codigo && b.dados?.codigo && a.dados.codigo !== b.dados.codigo, "whatsapp: dois chamados, dois códigos");
  ok(!!a.dados?.mensagem_cliente, "whatsapp: frase para o cliente devolvida à Marina");
  const semCodigo = await agente("/api/agent/chamados/resposta", { numero: GERAL, texto: "Sim, temos." });
  ok(semCodigo.dados?.respondido === false && semCodigo.dados?.codigos?.length === 2, "whatsapp: resposta sem código com 2 abertos → pede o código");
  const rb = await agente("/api/agent/chamados/resposta", { numero: GERAL, texto: `#${b.dados.codigo} Abre sim, das 12h às 22h.` });
  const ra = await agente("/api/agent/chamados/resposta", { numero: GERAL, texto: `${a.dados.codigo.toLowerCase()}: temos ferro na recepção, é só pedir.` });
  ok(rb.dados?.entregue && ra.dados?.entregue, "whatsapp: as duas respostas entregues");
  const env = await enviadas();
  const para1 = env.filter((m) => m.para === "+5541977770001").map((m) => m.texto).join(" ");
  const para2 = env.filter((m) => m.para === "+5541977770002").map((m) => m.texto).join(" ");
  ok(/ferro/.test(para1) && !/12h/.test(para1), "whatsapp: cliente 1 recebeu só a resposta dele");
  ok(/12h às 22h/.test(para2) && !/ferro/.test(para2), "whatsapp: cliente 2 recebeu só a resposta dele");
  ok(!/#?[A-Z0-9]{4}\b/.test(para2.replace(/12h|22h/g, "")) || !para2.includes(b.dados.codigo), "whatsapp: o código não vai para o cliente");
  const naoEquipe = await agente("/api/agent/chamados/resposta", { numero: "5541900000001", texto: "oi" });
  ok(naoEquipe.dados?.equipe === false, "whatsapp: hóspede comum não é tratado como equipe");

  /* ── 4. modo automático ─────────────────────────────────────── */
  await pag.goto(`${BASE}/admin/marina?aba=aprendizado`); await pag.waitForTimeout(1500);
  await pag.getByRole("button", { name: /Na hora \(automático\)/ }).click(); await pag.waitForTimeout(1200);
  const c = await agente("/api/agent/chamados", { pergunta: "Tem secador de cabelo no quarto?", cliente: "41977770003" });
  const rc = await agente("/api/agent/chamados/resposta", { numero: GERAL, texto: `#${c.dados.codigo} Sim, todo banheiro tem secador.` });
  ok(rc.dados?.aprendizado === "ativo", "automático: aprendeu na hora");
  const treino = await agente("/api/agent/conhecimento");
  ok(/APRENDIDO COM A EQUIPE/.test(treino.resumo_texto) && /secador/.test(treino.resumo_texto), "automático: já está no treinamento que o WhatsApp lê");
  const uso = await agente("/api/agent/aprendizado/uso", { pergunta: "vcs tem secador de cabelo?", canal: "whatsapp" });
  ok(uso.dados?.contado === true, "whatsapp: uso do aprendido registrado");
  const repetida = await agente("/api/agent/chamados", { pergunta: "Tem secador de cabelo no quarto?", cliente: "41977770003" });
  ok(repetida.dados?.codigo, "whatsapp: nova pergunta do mesmo cliente abre chamado (a anterior já fechou)");
  await sql`UPDATE marina_chamados SET status = 'cancelado' WHERE codigo = ${repetida.dados.codigo}`;

  /* ── 5. prazos ──────────────────────────────────────────────── */
  await limparEnviadas();
  const d = await agente("/api/agent/chamados", { pergunta: "Posso fazer check-in às 6h da manhã?", cliente: "41977770004" });
  const cron = () => fetch(`${BASE}/api/cron/chamados`, { headers: { authorization: `Bearer ${CHAVE}` } }).then((r) => r.json());
  ok((await fetch(`${BASE}/api/cron/chamados`)).status === 401, "prazos: rota de prazos fechada sem chave");
  await sql`UPDATE marina_chamados SET notificado_em = now() - interval '25 minutes', criado_em = now() - interval '25 minutes' WHERE codigo = ${d.dados.codigo}`;
  const p1 = await cron();
  ok(p1.dados?.lembretes === 1 && (await enviadas()).some((m) => m.para === `+${GERAL}` && /Lembrete/.test(m.texto)), "prazos: lembrete para a mesma pessoa");
  await sql`UPDATE marina_chamados SET notificado_em = now() - interval '50 minutes', criado_em = now() - interval '50 minutes' WHERE codigo = ${d.dados.codigo}`;
  const p2 = await cron();
  const env2 = await enviadas();
  ok(p2.dados?.repasses === 1 && env2.some((m) => m.para === `+${FIN}` && /veio para você/.test(m.texto)), "prazos: sem resposta, passou para o próximo da fila");
  ok(p2.dados?.avisos === 1 && env2.some((m) => m.para === "+5541977770004" && /ainda estou confirmando/i.test(m.texto)), "prazos: cliente avisado que ainda está confirmando");
  await sql`UPDATE marina_chamados SET criado_em = now() - interval '5 hours' WHERE codigo = ${d.dados.codigo}`;
  const p3 = await cron();
  const [dx] = await sql`SELECT status, destino FROM marina_chamados WHERE codigo = ${d.dados.codigo}`;
  ok(p3.dados?.expirados === 1 && dx.status === "expirado" && dx.destino === null, "prazos: desistiu, avisou o cliente e apagou o número");

  /* ── 6. falha de entrega ────────────────────────────────────── */
  const e = await agente("/api/agent/chamados", { pergunta: "Tem guarda-sol para a praia?", cliente: "41977770000" });
  const re = await agente("/api/agent/chamados/resposta", { numero: GERAL, texto: `#${e.dados.codigo} Emprestamos guarda-sol e cadeira.` });
  ok(re.dados?.entregue === false && re.dados?.entregar_manual?.para === "5541977770000", "falha: site não entregou → Marina recebe o texto para mandar ela mesma");
  await pag.goto(`${BASE}/admin/equipe?aba=chamados`); await pag.waitForTimeout(1500);
  await pag.getByRole("button", { name: "Com problema" }).click();
  ok(await pag.getByText("Respondido · não entregue").first().isVisible(), "falha: painel mostra o chamado com problema");

  /* ── painel: Cérebro ────────────────────────────────────────── */
  await pag.goto(`${BASE}/admin/cerebro?dias=30&canal=todos`); await pag.waitForTimeout(2000);
  ok(await pag.getByText("Resolveu sozinha (30 dias)").isVisible(), "cérebro: abre com os indicadores");
  const [taxa] = await sql`SELECT count(*) FILTER (WHERE tipo = 'aprendido_usado')::int AS s, count(*) FILTER (WHERE tipo = 'escalada')::int AS e FROM marina_eventos`;
  ok(taxa.s === 2 && taxa.e >= 6, `cérebro: eventos contados (${taxa.s} sozinha, ${taxa.e} escaladas)`);
  await nav.close();
} catch (e) {
  falhas.push(e.message);
  console.error("✗", e.message);
} finally {
  await sql.end();
}
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
