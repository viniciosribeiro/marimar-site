/**
 * Teste ponta a ponta do caminho painel → Marina, pela interface.
 *
 * Roda contra um site local (npm run dev) com banco local e o gateway
 * simulado (testes/gateway-simulado.mjs). NUNCA aponte para produção: ele
 * cria itens de treinamento.
 *
 *   BASE=http://localhost:3000 EMAIL=... SENHA=... AGENT_API_KEY=... \
 *     node testes/e2e-marina.mjs
 *
 * O que ele prova:
 *   1. Ensinar um item pelo painel grava e aparece na lista.
 *   2. A rota do WhatsApp (/api/agent/conhecimento) devolve o item na hora.
 *   3. O chat do site entrega o item à Marina (o gateway simulado responde
 *      com o que recebeu).
 *   4. A área de teste mostra o item como fonte usada.
 *   5. Desligar tira o item da Marina, e ele CONTINUA visível no painel
 *      (o bug de 29/09: desligado sumia e não dava para religar).
 *   6. Histórico registra e a restauração funciona.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHAVE = process.env.AGENT_API_KEY ?? "chave-local-teste";
const MARCA = `teste-e2e-${Date.now().toString(36)}`;
const TITULO = `Crianças ${MARCA}`;
const TEXTO = `Crianças que não são de colo pagam como adulto, sem desconto (${MARCA}).`;

const falhas = [];
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) falhas.push(msg); };

const agente = async () => (await fetch(`${BASE}/api/agent/conhecimento`, { headers: { authorization: `Bearer ${CHAVE}` } })).json();

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
pag.setDefaultTimeout(30000);

try {
  await pag.goto(`${BASE}/admin/login`);
  await pag.getByLabel("E-mail").fill(process.env.EMAIL ?? "admin@teste.local");
  await pag.getByLabel("Senha", { exact: true }).fill(process.env.SENHA ?? "teste1234567");
  await pag.getByRole("button", { name: "Entrar no painel" }).click();
  await pag.waitForURL(/\/admin(\?|$)/);
  ok(true, "login no painel");

  await pag.goto(`${BASE}/admin/marina?aba=conhecimento`);
  await pag.getByRole("button", { name: "Ensinar" }).first().click();
  await pag.getByRole("button", { name: /^Informação/ }).click();
  await pag.locator('input[name="titulo"]').fill(TITULO);
  await pag.locator('textarea[name="conteudo"]').fill(TEXTO);
  await pag.getByRole("button", { name: "Políticas", exact: true }).click();
  await pag.locator("#form-item").evaluate((f) => f.requestSubmit());
  await pag.getByText(TITULO).first().waitFor();
  ok(true, "item ensinado aparece na lista");

  const r1 = await agente();
  ok(r1.resumo_texto.includes(TEXTO), "rota do WhatsApp devolve o item na hora (sem cache)");
  ok(r1.resumo_texto.includes("PRIORIDADE"), "texto da Marina traz a regra de prioridade do treinamento");

  const chat = await fetch(`${BASE}/api/chat`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessao: MARCA, mensagem: "Criança paga quanto? Tenho criança de 6 anos" }),
  });
  const resposta = await chat.text();
  ok(resposta.includes(MARCA), "chat do site: a Marina recebe o item e responde com ele");

  await pag.goto(`${BASE}/admin/marina?aba=testar`);
  await pag.getByPlaceholder("Escreva como um hóspede…").fill("Criança paga? Tenho criança de 6 anos");
  await pag.getByRole("button", { name: "Enviar" }).click();
  await pag.getByText("Usou:").first().waitFor();
  const usou = await pag.locator("text=Usou:").first().locator("..").innerText();
  ok(usou.includes(MARCA), "área de teste mostra o item como fonte usada");

  await pag.goto(`${BASE}/admin/marina?aba=conhecimento`);
  const cartao = pag.locator("li", { hasText: TITULO }).first();
  await cartao.getByRole("button", { name: "Mais ações" }).click();
  await pag.getByRole("button", { name: "Desligar" }).click();
  await cartao.getByText("Desligado").waitFor();
  ok(true, "desligar funciona e o item continua visível no painel");
  const r2 = await agente();
  ok(!r2.resumo_texto.includes(TEXTO), "desligado sai do que a Marina lê");

  await cartao.getByRole("button", { name: "Mais ações" }).click();
  await pag.getByRole("button", { name: "Ligar" }).click();
  await cartao.getByText(/Salvo · aguardando WhatsApp|Em uso/).waitFor();
  ok((await agente()).resumo_texto.includes(TEXTO), "religar devolve o item à Marina");

  await cartao.getByRole("button", { name: "Mais ações" }).click();
  await pag.getByRole("button", { name: "Histórico" }).click();
  await pag.getByText("Criou").first().waitFor();
  const itensHistorico = await pag.locator("ol > li").count();
  ok(itensHistorico >= 3, `histórico registra as mudanças (${itensHistorico} entradas)`);
  await pag.getByRole("button", { name: "Voltar para esta versão" }).first().click();
  await pag.getByRole("dialog", { name: "Voltar para esta versão?" }).getByRole("button", { name: "Voltar para esta versão" }).click();
  await pag.getByText("Versão restaurada.").waitFor();
  ok(true, "restaurar versão pelo histórico");

  await pag.goto(`${BASE}/admin/marina?aba=conhecimento`);
  const c2 = pag.locator("li", { hasText: TITULO }).first();
  await c2.getByRole("button", { name: "Mais ações" }).click();
  await pag.getByRole("button", { name: "Excluir" }).click();
  await pag.getByRole("dialog", { name: "Mandar para a lixeira?" }).getByRole("button", { name: "Mandar para a lixeira" }).click();
  await pag.getByRole("button", { name: /Lixeira/ }).click();
  await pag.getByText(TITULO).first().waitFor();
  ok(!(await agente()).resumo_texto.includes(TEXTO), "item na lixeira não vale para a Marina");
} catch (e) {
  falhas.push(`erro: ${e.message}`);
  console.error("✗", e.message);
  await pag.screenshot({ path: process.env.FALHA_PNG ?? "e2e-falha.png", fullPage: true }).catch(() => {});
} finally {
  await nav.close();
}

console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
