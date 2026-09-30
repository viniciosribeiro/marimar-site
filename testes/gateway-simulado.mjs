/**
 * Gateway do OpenClaw simulado, para testar o caminho painel → Marina sem
 * gastar crédito nem tocar a Marina de produção.
 *
 * Responde no mesmo formato do gateway real (SSE de /v1/chat/completions) e
 * age como uma Marina "obediente": procura no que recebeu como sistema as
 * linhas que casam com a pergunta e responde com elas. Se o ensinamento não
 * chegou, a resposta diz isso — é o que o teste confere.
 *
 * Também guarda a última requisição em GET /__ultima, para o teste ver o
 * texto exato que a Marina teria lido.
 *
 *   node testes/gateway-simulado.mjs            (porta 4010)
 */
import http from "node:http";

const PORTA = Number(process.env.PORTA ?? 4010);
let ultima = null;
/* Mensagens de WhatsApp que o site mandou pelo RPC (método "send"). */
const enviadas = [];

const normal = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palavras = (s) => normal(s).split(/[^a-z0-9]+/).filter((p) => p.length > 3);

function responder(corpo) {
  const pedido = [...corpo.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  /* A resposta da equipe reescrita no tom da Marina (formularResposta). */
  const daEquipe = pedido.match(/Resposta da equipe: ([\s\S]*)$/);
  if (daEquipe) return `Oi! Voltei com a confirmação da pousada: ${daEquipe[1].trim()} 😊`;
  const sistema = corpo.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const pergunta = [...corpo.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const chaves = palavras(pergunta);
  const linhas = sistema.split("\n").filter((l) => {
    const n = normal(l);
    return chaves.some((c) => n.includes(c));
  });
  let achou = linhas.filter((l) => /^\s*(•|-|P:|R:|\[)/.test(l)).slice(0, 4);
  /* Pergunta e resposta: a linha "R:" logo abaixo vem junto. */
  const todasLinhas = sistema.split("\n");
  achou = achou.flatMap((l) => {
    const i = todasLinhas.indexOf(l);
    const extra = [];
    for (let j = i + 1; j < i + 4 && j < todasLinhas.length; j++) if (/^\s+R:/.test(todasLinhas[j])) extra.push(todasLinhas[j]);
    return [l, ...extra.filter((x) => !linhas.includes(x))];
  });
  /* Roteiro de orientação: como uma Marina obediente, manda as etapas na
     ordem, com o vídeo e a foto de cada uma em markdown. */
  const todas = sistema.split("\n");
  const etapas = [];
  for (const l of achou) {
    const i = todas.indexOf(l);
    if (i < 0 || !/Quando usar:/.test(todas[i + 1] ?? "")) continue;
    for (const e of todas.slice(i + 2)) {
      if (!/^\s{2,}/.test(e)) break;
      const m = e.match(/^\s*(vídeo|foto)[^:]*:\s*(\S+)/);
      etapas.push(m ? `![${m[1]}](${m[2]})` : e.trim());
    }
  }
  let texto = achou.length
    ? "Pelo que a pousada me ensinou: " + achou.map((l) => l.trim()).join(" ") + (etapas.length ? "\n" + etapas.join("\n") : "")
    : "Não tenho essa informação ainda. Vou confirmar com a pousada.";
  // Modo teste do painel: devolve as fontes no formato que o painel espera.
  const codigos = [...new Set(achou.join(" ").match(/#[a-z0-9]{4,}/g) ?? [])];
  if (/FONTES:/.test(sistema)) texto += `\nFONTES: ${codigos.join(", ") || "nenhuma"}`;
  return texto;
}

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__enviadas") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(enviadas));
  }
  if (req.method === "DELETE" && req.url === "/__enviadas") {
    enviadas.length = 0;
    res.writeHead(204); return res.end();
  }
  if (req.method === "GET" && req.url === "/__ultima") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(ultima));
  }
  let bruto = "";
  req.on("data", (c) => (bruto += c));
  req.on("end", () => {
    /* Ferramenta de mensagens (POST /tools/invoke), no formato real do
       OpenClaw 2026.9: { ok, result: { content: [{type:"text"}], details } }.
       - número terminado em 0000: o WhatsApp não entrega. Com bestEffort
         false vira erro 500 (como o real); sem ele, "ok" sem result — o
         falso sucesso que o site passou a recusar.
       - SIM_WHATSAPP_DESCONECTADO=1: channels.status diz desconectado. */
    if (req.url === "/tools/invoke") {
      const pedido = JSON.parse(bruto || "{}");
      const para = String(pedido.args?.target ?? pedido.args?.to ?? "");
      const detalhes = (d) => ({ ok: true, result: { content: [{ type: "text", text: JSON.stringify(d) }], details: d } });
      if (para.endsWith("0000") || process.env.SIM_WHATSAPP_DESCONECTADO) {
        if (pedido.args?.bestEffort === false) {
          res.writeHead(500, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: { type: "tool_error", message: "tool execution failed" } }));
        }
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify(detalhes({ channel: "whatsapp", to: para, via: "direct" })));
      }
      enviadas.push({ para, texto: pedido.args?.message, em: new Date().toISOString() });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(detalhes({ channel: "whatsapp", to: para, via: "direct", result: { messageId: "3EB0SIM" + enviadas.length } })));
    }
    if (req.url === "/api/v1/admin/rpc") {
      const pedido = JSON.parse(bruto || "{}");
      if (pedido.method === "channels.status") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: true, payload: { channels: [{ id: "whatsapp", accounts: [{ accountId: "default", connected: !process.env.SIM_WHATSAPP_DESCONECTADO, linked: true }] }] } }));
      }
      if (pedido.method === "send") {
        /* Número terminado em 0000 simula aparelho fora do ar. */
        if (String(pedido.params?.to).endsWith("0000")) {
          res.writeHead(502, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: { message: "whatsapp: número inacessível" } }));
        }
        enviadas.push({ para: pedido.params?.to, texto: pedido.params?.message, em: new Date().toISOString() });
      }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (req.url !== "/v1/chat/completions") { res.writeHead(404); return res.end(); }
    if (req.headers.authorization !== `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN ?? "token-teste"}`) {
      res.writeHead(401); return res.end("token recusado");
    }
    const corpo = JSON.parse(bruto);
    ultima = corpo;
    const texto = responder(corpo);
    if (corpo.stream === false) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: texto } }] }));
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const pedaco of texto.match(/.{1,24}/gs) ?? []) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: pedaco } }] })}\n\n`);
    }
    res.end("data: [DONE]\n\n");
  });
}).listen(PORTA, () => console.log(`gateway simulado em http://localhost:${PORTA}`));
