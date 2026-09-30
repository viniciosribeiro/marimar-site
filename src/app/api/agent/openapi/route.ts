import { NextResponse } from "next/server";
import { AREAS } from "@/lib/agent-mapa";

/**
 * Especificacao OpenAPI da API do agente.
 *
 * As rotas GET saem de AREAS (lib/agent-mapa.ts), o mesmo mapa que alimenta
 * /api/agent/indice e a aba de cobertura do painel. Antes a lista era escrita
 * a mao e tinha parado em 6 das 14 rotas.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const paths: Record<string, unknown> = {};
  for (const a of AREAS) {
    const rota = a.rota.split("?")[0];
    paths[rota] = { get: { summary: a.titulo, description: a.responde.join(" · "), responses: { "200": { description: "OK" } } } };
  }
  paths["/api/agent/indice"] = { get: { summary: "Mapa das fontes do agente", responses: { "200": { description: "OK" } } } };
  paths["/api/agent/disponibilidade"] = {
    get: {
      summary: "Disponibilidade e tarifas ao vivo do motor",
      parameters: [
        { name: "check_in", in: "query", schema: { type: "string", format: "date" } },
        { name: "check_out", in: "query", schema: { type: "string", format: "date" } },
        { name: "adultos", in: "query", schema: { type: "integer", minimum: 1 } },
        { name: "criancas", in: "query", description: "Crianças que não são de colo", schema: { type: "integer", minimum: 0 } },
        { name: "bebes", in: "query", description: "Bebês de colo (regra em Marina → Crianças e adicionais)", schema: { type: "integer", minimum: 0 } },
      ],
      responses: { "200": { description: "Quartos com precos" }, "400": { description: "Datas invalidas" } },
    },
  };
  paths["/api/agent/lead"] = {
    post: {
      summary: "Registrar lead",
      requestBody: { content: { "application/json": { schema: { type: "object", required: ["nome"], properties: { nome: { type: "string" }, telefone: { type: "string" }, email: { type: "string" }, mensagem: { type: "string" } } } } } },
      responses: { "200": { description: "Lead registrado" }, "400": { description: "Nome ausente ou JSON invalido" } },
    },
  };

  paths["/api/agent/documentos"] = {
    get: {
      summary: "Documentos enviados pela pousada",
      description: "Sem parâmetro: lista com trecho. ?busca=: trechos que falam do assunto. ?id=: texto completo.",
      parameters: [
        { name: "busca", in: "query", schema: { type: "string" } },
        { name: "id", in: "query", schema: { type: "string", format: "uuid" } },
      ],
      responses: { "200": { description: "OK" }, "404": { description: "Documento não encontrado" } },
    },
  };
  paths["/api/agent/lacuna"] = {
    post: {
      summary: "Registrar pergunta que a Marina não soube responder",
      requestBody: { content: { "application/json": { schema: { type: "object", required: ["pergunta"], properties: { pergunta: { type: "string" }, resposta: { type: "string" }, canal: { type: "string", enum: ["whatsapp", "site"] } } } } } },
      responses: { "200": { description: "Registrada" }, "400": { description: "Pergunta ausente" } },
    },
  };

  const spec = {
    openapi: "3.1.0",
    info: { title: "Pousada Marimar — Agent API", version: "1.2.0", description: "API para o agente Marina (WhatsApp e site)" },
    servers: [{ url: base }],
    security: [{ bearerAuth: [] }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    paths,
  };
  return NextResponse.json(spec);
}
