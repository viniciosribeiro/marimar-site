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
  paths["/api/agent/roteiros"] = {
    get: {
      summary: "Roteiros de orientação com vídeo e foto, etapa por etapa",
      description: "Sem parâmetro: todos os ligados. ?busca=: o roteiro cujas palavras-chave aparecem na frase (ou nenhum). ?id=: um. Cada mídia traz url_whatsapp (MP4 até 16 MB) ou null — então vai como link.",
      parameters: [
        { name: "busca", in: "query", schema: { type: "string" } },
        { name: "id", in: "query", schema: { type: "string", format: "uuid" } },
      ],
      responses: { "200": { description: "OK" } },
    },
  };
  paths["/api/agent/equipe"] = {
    get: { summary: "Números da equipe responsável (mensagem de um deles vai para /chamados/resposta)", responses: { "200": { description: "OK" } } },
  };
  paths["/api/agent/chamados"] = {
    post: {
      summary: "Perguntar à equipe o que a Marina não sabe (abre chamado com código curto)",
      requestBody: { content: { "application/json": { schema: { type: "object", required: ["pergunta", "cliente"], properties: {
        pergunta: { type: "string" }, cliente: { type: "string", description: "número do cliente com DDD" }, contexto: { type: "string" },
        assunto: { type: "string", enum: ["reservas", "financeiro", "recepcao", "manutencao", "passeios", "restaurante", "eventos", "geral"] },
      } } } } },
      responses: { "200": { description: "Chamado aberto (dados.codigo, dados.mensagem_cliente, dados.aviso_manual)" }, "400": { description: "Faltou pergunta ou número" } },
    },
  };
  paths["/api/agent/chamados/resposta"] = {
    post: {
      summary: "Resposta da equipe: o site acha o chamado, reescreve no tom da Marina e entrega ao cliente",
      requestBody: { content: { "application/json": { schema: { type: "object", required: ["numero", "texto"], properties: {
        numero: { type: "string" }, texto: { type: "string" }, citado: { type: "string", description: "texto da mensagem respondida" }, codigo: { type: "string" },
      } } } } },
      responses: { "200": { description: "dados.equipe=false se não for da equipe; dados.entregar_manual se a Marina precisar mandar" } },
    },
  };
  paths["/api/agent/aprendizado/uso"] = {
    post: {
      summary: "Registrar que a Marina respondeu com algo aprendido",
      requestBody: { content: { "application/json": { schema: { type: "object", required: ["pergunta"], properties: { pergunta: { type: "string" }, canal: { type: "string", enum: ["whatsapp", "site"] } } } } } },
      responses: { "200": { description: "OK" } },
    },
  };
  paths["/api/agent/regras"] = {
    get: {
      summary: "Regra de crianças e adicionais, com a consulta ao motor já calculada",
      parameters: ["adultos", "criancas", "bebes", "noites"].map((name) => ({ name, in: "query", schema: { type: "integer", minimum: 0 } })),
      responses: { "200": { description: "OK" } },
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
    info: { title: "Pousada Marimar — Agent API", version: "1.4.0", description: "API para o agente Marina (WhatsApp e site)" },
    servers: [{ url: base }],
    security: [{ bearerAuth: [] }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    paths,
  };
  return NextResponse.json(spec);
}
