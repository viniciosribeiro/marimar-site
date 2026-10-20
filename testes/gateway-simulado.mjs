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
/* WhatsApp da Marina simulado: começa caído (como em 18/10) com SIM_WHATSAPP_DESCONECTADO=1. */
const whatsapp = { conectado: !process.env.SIM_WHATSAPP_DESCONECTADO, leituras: 0 };
/* Um "QR" desenhado em SVG: só precisa ser imagem em data URL e mudar de versão. */
const qrSimulado = (versao) => {
  const quadros = Array.from({ length: 64 }, (_, i) => ((i * 7 + versao * 13) % 5 < 2 ? `<rect x="${(i % 8) * 25}" y="${Math.floor(i / 8) * 25}" width="25" height="25"/>` : "")).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><g fill="#111">${quadros}</g><text x="100" y="110" font-size="22" text-anchor="middle" fill="#c00">QR ${versao}</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
};

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
      if (para.endsWith("0000") || !whatsapp.conectado) {
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
      const responderRpc = (payload) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, payload })); };
      if (pedido.method === "channels.status") {
        const conta = whatsapp.conectado
          ? { accountId: "default", connected: true, linked: true, running: true, healthState: "healthy" }
          : { accountId: "default", connected: false, linked: true, running: false, healthState: "logged-out",
              lastError: "status=401 Unauthorized Stream Errored (conflict)",
              lastDisconnect: { at: Date.now() - 41 * 3600_000, error: "status=401 Unauthorized Stream Errored (conflict)" } };
        return responderRpc({ channels: [{ id: "whatsapp", accounts: [conta] }] });
      }
      /* Login por QR (web.login.start/wait), no formato do @openclaw/whatsapp
         2026.9.4: o primeiro wait devolve um QR novo, o segundo "lê" o QR. */
      if (pedido.method === "web.login.start") {
        whatsapp.leituras = 0;
        return setTimeout(() => responderRpc({ qrDataUrl: qrSimulado(1), sessionKey: "sim-sessao", message: "Scan this QR in WhatsApp → Linked Devices." }), 800);
      }
      if (pedido.method === "web.login.wait") {
        whatsapp.leituras++;
        if (whatsapp.leituras === 1) return setTimeout(() => responderRpc({ connected: false, qrDataUrl: qrSimulado(2), message: "QR refreshed. Scan the latest code in WhatsApp → Linked Devices." }), 1500);
        whatsapp.conectado = true;
        return setTimeout(() => responderRpc({ connected: true, message: "✅ Linked! WhatsApp is ready." }), 1500);
      }
      if (pedido.method === "channels.logout") {
        whatsapp.conectado = false;
        return responderRpc({ channel: "whatsapp", accountId: "default", cleared: true });
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
