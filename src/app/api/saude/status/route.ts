import postgres from "postgres";
import { list } from "@vercel/blob";
import { lookup } from "node:dns/promises";
import { fetchTarifas } from "@/lib/worker";
import { chamarRpc } from "@/lib/openclaw-config";
import { lerSaude } from "@/lib/whatsapp-saude";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 40;

/**
 * Exclusivamente LEITURA. Nenhum teste cria reserva, envia mensagens,
 * dispara cron, consulta credenciais no cliente ou altera tabelas.
 * NUNCA expor payloads de OpenClaw, SQL, ElevenLabs ou tokens.
 */
type Estado = "online" | "atencao" | "offline" | "nao_verificado";
type Sonda = { estado: Estado; latencia_ms: number | null; descricao: string; metodo?: string };
type Dados = {
  consultado_em: string;
  servicos: Record<string, Sonda>;
  historico_disponivel: false;
  intervalo_segundos: 300;
};
const NAO = (descricao: string): Sonda => ({ estado: "nao_verificado", latencia_ms: null, descricao, metodo: "não disponível" });
let cache: { ate: number; dados: Dados } | null = null;
let pendente: Promise<Dados> | null = null;

async function sonda(nome: string, metodo: string, fn: () => Promise<void>): Promise<Sonda> {
  const inicio = Date.now();
  try {
    await fn();
    return { estado: "online", latencia_ms: Date.now() - inicio, descricao: nome + ": verificação concluída", metodo };
  } catch {
    // Falha de um único teste não derruba os demais; detalhes internos ficam no servidor.
    return { estado: "atencao", latencia_ms: Date.now() - inicio, descricao: nome + ": verificação não concluiu", metodo };
  }
}
async function getSeguro(url: string, ms = 4500): Promise<Response> {
  const r = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(ms), redirect: "follow" });
  if (!r.ok) throw new Error("probe-not-ok");
  return r;
}
function origem(): string { return "https://www.pousadamarimarilhadomel.com.br"; }
const host = "www.pousadamarimarilhadomel.com.br";

async function medir(): Promise<Dados> {
  const workerUrl = process.env.WORKER_BASE_URL?.trim();
  const db = process.env.DATABASE_URL;
  const gateway = Boolean(process.env.OPENCLAW_GATEWAY_TOKEN && process.env.OPENCLAW_GATEWAY_URL);
  const voztoken = process.env.ELEVENLABS_API_KEY;
  const blob = process.env.BLOB_READ_WRITE_TOKEN;

  // Uma leitura RPC read-only de channels.status alimenta Gateway e WhatsApp.
  // NUNCA invocar config.patch, channels.login, refresh, send ou vigiarWhatsapp.
  const statusGateway = gateway ? (async () => {
    const inicio = Date.now();
    const r = await chamarRpc("channels.status", {}, 5500);
    const latencia = Date.now() - inicio;
    if (!r.ok) return { gateway: { estado: "atencao", latencia_ms: latencia, descricao: "Gateway: sondagem autenticada indisponível", metodo: "RPC channels.status" } as Sonda, whatsapp: NAO("Não foi possível determinar o estado do canal") };
    const info = lerSaude(r.dados);
    const canal: Sonda = !info ? NAO("Gateway acessível, sem estado do WhatsApp no retorno")
      : { estado: info.estado === "conectado" ? "online" : "atencao", latencia_ms: latencia, descricao: info.estado === "conectado" ? "Canal conectado conforme o gateway" : "Canal reportou: " + info.estado, metodo: "RPC channels.status (leitura)" };
    return { gateway: { estado: "online", latencia_ms: latencia, descricao: "Gateway autenticado respondeu ao status de canais", metodo: "RPC channels.status (leitura)" } as Sonda, whatsapp: canal };
  })() : Promise.resolve({ gateway: NAO("Credencial de gateway não configurada"), whatsapp: NAO("Estado de canal requer gateway") });

  const bancoPromise = db ? (async () => {
    const sql = postgres(db, { max: 1, connect_timeout: 5, prepare: false, idle_timeout: 2 });
    const resultado: Record<string,Sonda> = {};
    try {
      resultado.neon = await sonda("Neon PostgreSQL", "SELECT 1", async () => { await sql`SELECT 1 AS ok`; });
      if (resultado.neon.estado !== "online") throw new Error("db-off");
      const tarefas: [string,string,string,() => Promise<void>][] = [
        ["regras", "Regras de hospedagem", "SELECT id FROM regras_hospedagem", async () => { await sql`SELECT id FROM regras_hospedagem LIMIT 1`; }],
        ["marina_conhecimento", "Conhecimento da Marina", "SELECT id FROM marina_config", async () => { await sql`SELECT id FROM marina_config LIMIT 1`; }],
        ["fotos", "Biblioteca de fotos", "SELECT id FROM midias", async () => { await sql`SELECT id FROM midias LIMIT 1`; }],
        ["marina_site", "Chat da Marina", "SELECT chat_ativo FROM pousada", async () => {
          const r = await sql<{chat_ativo: boolean}[]>`SELECT chat_ativo FROM pousada LIMIT 1`;
          if (!r[0]?.chat_ativo) throw new Error("disabled");
        }],
        ["whatsapp_vigia", "Registro do vigia", "SELECT ultimaVez FROM integracoes", async () => {
          const r = await sql<{valor: string}[]>`SELECT valor FROM integracoes WHERE chave = 'wa_vigia' LIMIT 1`;
          if (!r[0]?.valor) throw new Error("no-run");
          const v = JSON.parse(r[0].valor) as {ultimaVez?:number};
          if (!v.ultimaVez || Date.now()-v.ultimaVez>25*60*1000) throw new Error("stale-run");
        }]
      ];
      // Mesma conexão: sequencial, não concorrer queries simultâneas num pool de 1.
      for (const [id,nome,metodo,fn] of tarefas) resultado[id] = await sonda(nome,metodo,fn);
    } catch {
      for (const id of ["regras","marina_conhecimento","fotos","marina_site","whatsapp_vigia"]) resultado[id] ??= NAO("Banco não respondeu; verificação dependente indisponível");
    } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
    return resultado;
  })() : Promise.resolve({
    neon: NAO("Banco não configurado neste ambiente"),
    regras: NAO("Depende do banco"), marina_conhecimento: NAO("Depende do banco"),
    fotos: NAO("Depende do banco"), marina_site: NAO("Depende do banco"),
    whatsapp_vigia: NAO("Depende do banco")
  } as Record<string,Sonda>);

  const [site, admin, ssl, dns, worker, desbravador, voz, blobResult, mapas, gatewayResult, bancoResult] = await Promise.all([
    sonda("Página inicial", "HTTPS GET /", async () => { await getSeguro(origem()+"/",6000); }),
    sonda("Login do painel", "HTTPS GET /admin/login", async () => { await getSeguro("https://admin.pousadamarimarilhadomel.com.br/admin/login",6500); }),
    sonda("Conexão TLS", "HTTPS GET", async () => { await getSeguro(origem()+"/",6000); }),
    sonda("Resolução DNS", "DNS lookup", async () => { await lookup(host); }),
    workerUrl ? sonda("PousadaHub", "HTTP GET raiz do Worker", async () => {
      await getSeguro(workerUrl.replace(/\/+$/, "") + "/",5000);
    }) : NAO("Worker sem configuração"),
    workerUrl ? sonda("Desbravador", "Consulta real de tarifas, sem reserva", async () => {
      const ci = new Date(); ci.setUTCDate(ci.getUTCDate()+10);
      const co = new Date(ci); co.setUTCDate(co.getUTCDate()+2);
      const res = await fetchTarifas(ci.toISOString().slice(0,10),co.toISOString().slice(0,10),2,0,{timeoutMs:16000});
      if (!Array.isArray(res.quartos) || !Array.isArray(res.indisponiveis)) throw new Error("invalid-response");
      // Zero quartos disponiveis pode ser normal.
    }) : NAO("Motor sem configuração"),
    voztoken ? sonda("ElevenLabs", "GET /v1/user autenticado", async () => {
      const r=await fetch("https://api.elevenlabs.io/v1/user",{headers:{"xi-api-key":voztoken},signal:AbortSignal.timeout(6000),cache:"no-store"});
      if (!r.ok) throw new Error("voice-unauthorized");
    }) : NAO("Provedor de voz sem chave de acesso"),
    blob ? sonda("Vercel Blob", "Listagem somente leitura (limit:1)", async () => {
      await list({limit:1,token:blob});
    }) : NAO("Armazenamento Blob não configurado"),
    sonda("OpenFreeMap", "HTTPS GET estilo de mapa", async () => {
      const r=await getSeguro("https://tiles.openfreemap.org/styles/liberty/style.json",6000);
      const ct=r.headers.get("content-type")??"";
      if(!ct.includes("json")) throw new Error("invalid map");
    }),
    statusGateway, bancoPromise,
  ]);
  // Status derivados conservadores: nunca um 'online' só porque existe a API.
  const abertura: Sonda = {estado:"online",latencia_ms:null,descricao:"Endpoint de observabilidade acessível",metodo:"GET /api/saude/status"};
  const servicos: Record<string,Sonda> = {
    site, api:abertura, worker, desbravador, neon:bancoResult.neon,
    openclaw:gatewayResult.gateway, whatsapp:gatewayResult.whatsapp, voz,
    blob:blobResult, ssl, dns, mapas, autenticacao:admin,
    marina_site:bancoResult.marina_site, marina_conhecimento:bancoResult.marina_conhecimento,
    fotos:bancoResult.fotos, regras:bancoResult.regras,
    whatsapp_vigia:bancoResult.whatsapp_vigia,
    avisos:NAO("Entrega de alertas exige teste controlado autenticado"),
    webhooks:NAO("Webhooks não possuem confirmação sem envio de evento"),
  };
  return {consultado_em:new Date().toISOString(),servicos,historico_disponivel:false,intervalo_segundos:300};
}
const headers={ "Cache-Control":"public, s-maxage=300, stale-while-revalidate=300", "X-Content-Type-Options":"nosniff" };
export async function GET(request: Request) {
  if(new URL(request.url).search) return Response.redirect(new URL("/api/saude/status",request.url),308);
  if(cache && cache.ate>Date.now())return Response.json(cache.dados,{headers});
  if(!pendente)pendente=medir().then(d=>{cache={dados:d,ate:Date.now()+300000};return d}).finally(()=>{pendente=null});
  try{return Response.json(await pendente,{headers})}
  catch{return Response.json({consultado_em:new Date().toISOString(),servicos:{},historico_disponivel:false,intervalo_segundos:300},{headers:{"Cache-Control":"public,s-maxage=60"}})}
}
