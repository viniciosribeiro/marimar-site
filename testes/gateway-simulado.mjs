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

const normal = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palavras = (s) => normal(s).split(/[^a-z0-9]+/).filter((p) => p.length > 3);

function responder(corpo) {
  const sistema = corpo.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const pergunta = [...corpo.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const chaves = palavras(pergunta);
  const linhas = sistema.split("\n").filter((l) => {
    const n = normal(l);
    return chaves.some((c) => n.includes(c));
  });
  const achou = linhas.filter((l) => /^\s*(•|-|P:|R:|\[)/.test(l)).slice(0, 4);
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
  if (req.method === "GET" && req.url === "/__ultima") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(ultima));
  }
  let bruto = "";
  req.on("data", (c) => (bruto += c));
  req.on("end", () => {
    if (req.url === "/api/v1/admin/rpc") {
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
