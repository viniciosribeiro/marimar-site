/**
 * Graph API da Meta (WhatsApp Cloud API) simulada, para testar a API
 * oficial sem conta na Meta. O site aponta para cá com
 * WHATSAPP_META_GRAPH_URL=http://localhost:4030.
 *
 *   node testes/meta-simulada.mjs            (porta 4030)
 *
 * Guarda o que o site mandou (GET /__enviadas, DELETE limpa). Responde
 * no formato real: { messaging_product, contacts, messages: [{ id }] }.
 */
import http from "node:http";

const PORTA = Number(process.env.PORTA ?? 4030);
const enviadas = [];
let n = 0;

http.createServer((req, res) => {
  let bruto = "";
  req.on("data", (c) => (bruto += c));
  req.on("end", () => {
    const json = (status, corpo) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(corpo)); };
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/__enviadas") {
      if (req.method === "DELETE") enviadas.length = 0;
      return json(200, enviadas);
    }
    if (req.headers.authorization !== `Bearer ${process.env.WHATSAPP_META_TOKEN ?? "token-meta-teste"}`) {
      return json(401, { error: { message: "Invalid OAuth access token", code: 190 } });
    }
    const partes = url.pathname.split("/").filter(Boolean); // [v23.0, PHONE, messages]
    if (req.method === "POST" && partes[2] === "messages") {
      const corpo = JSON.parse(bruto || "{}");
      if (corpo.status === "read") { enviadas.push({ tipo: "lida", id: corpo.message_id }); return json(200, { success: true }); }
      const id = `wamid.SIM${++n}`;
      enviadas.push({ tipo: corpo.type, para: corpo.to, corpo: corpo[corpo.type], id });
      return json(200, { messaging_product: "whatsapp", contacts: [{ input: corpo.to, wa_id: corpo.to }], messages: [{ id }] });
    }
    if (req.method === "POST" && partes[2] === "media") return json(200, { id: `MIDIA${++n}` });
    if (req.method === "GET" && partes.length === 2 && url.searchParams.get("fields")) {
      return json(200, { display_phone_number: "+55 41 99501-2920", verified_name: "Pousada Marimar", quality_rating: "GREEN", id: partes[1] });
    }
    return json(404, { error: { message: "não simulado", code: 100 } });
  });
}).listen(PORTA, () => console.log(`Meta simulada em http://localhost:${PORTA}`));
