import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;
  const spec = {
    openapi: "3.1.0",
    info: { title: "Pousada Marimar — Agent API", version: "1.0.0", description: "API para o agente Marina (WhatsApp)" },
    servers: [{ url: base }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/agent/pousada": { get: { summary: "Informacoes da pousada e politicas", responses: { "200": { description: "Dados da pousada" } } } },
      "/api/agent/quartos": { get: { summary: "Catalogo de quartos", responses: { "200": { description: "Lista de quartos" } } } },
      "/api/agent/disponibilidade": { get: { summary: "Disponibilidade e tarifas", parameters: [{ name: "check_in", in: "query", schema: { type: "string" } }, { name: "check_out", in: "query", schema: { type: "string" } }, { name: "adultos", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "Quartos com precos" } } } },
      "/api/agent/pacotes": { get: { summary: "Pacotes vigentes", responses: { "200": { description: "Pacotes ativos" } } } },
      "/api/agent/faq": { get: { summary: "FAQ do agente", responses: { "200": { description: "Perguntas visiveis" } } } },
      "/api/agent/lead": { post: { summary: "Registrar lead", requestBody: { content: { "application/json": { schema: { type: "object", properties: { nome: { type: "string" }, telefone: { type: "string" }, email: { type: "string" }, mensagem: { type: "string" } } } } } }, responses: { "201": { description: "Lead criado" } } } },
    },
  };
  return NextResponse.json(spec);
}