/**
 * Exame do serviço de tarifas (PousadaHub), criado no incidente de 14/11/2026.
 *
 * O serviço é da pousada e fica fora deste repositório. Quando ele responde
 * "200, sem nenhum quarto", o site não tinha como dizer POR QUÊ. Esta rota
 * repete a consulta de sempre com pequenas variações e mostra o que voltou:
 * código, tempo, cabeçalhos de cache e um resumo do corpo.
 *
 * Só LEITURA. Ao serviço da própria pousada (`WORKER_BASE_URL`) vão as
 * consultas de sempre. Ao Desbravador vai apenas o que o site já faz em toda
 * sincronização de fotos: perguntar o tamanho de duas fotos de suíte (HEAD, só
 * cabeçalhos), para saber se o servidor do site continua sendo atendido lá, e
 * abrir a página pública de reservas (a do botão "Reservar") só para ler o nome
 * do arquivo do aplicativo, que muda quando o Desbravador publica versão nova.
 * Nenhuma consulta de tarifa ou de cadastro vai ao Desbravador a partir daqui,
 * nada é gravado, nenhum segredo é lido ou mostrado. No máximo uma rodada por
 * minuto por instância.
 */
import postgres from "postgres";
import { urlTarifas } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 40;

type Exame = {
  nome: string;
  o_que_muda: string;
  http: number;
  ms: number;
  cabecalhos: Record<string, string>;
  corpo: Record<string, unknown>;
};

const CABECALHOS = [
  "cf-cache-status", "age", "cache-control", "expires", "etag", "last-modified", "vary",
  "date", "server", "cf-ray", "content-type", "content-length",
  "via", "location", "allow", "retry-after", "www-authenticate",
];
const SENSIVEL = /senha|pass|token|secret|segredo|chave|key|pix|mail|auth|cookie/i;

function curto(v: unknown, n = 80): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
}

/** Resumo do corpo: nunca o conteúdo inteiro, nunca campo com cara de segredo. */
function resumir(texto: string): Record<string, unknown> {
  let dados: unknown;
  try { dados = JSON.parse(texto); } catch { return { formato: "texto", inicio: curto(texto, 400) }; }
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return { formato: Array.isArray(dados) ? "lista" : typeof dados, tamanho: Array.isArray(dados) ? dados.length : undefined };
  }
  const d = dados as Record<string, unknown>;
  const campos: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (SENSIVEL.test(k)) { campos[k] = "(oculto)"; continue; }
    if (Array.isArray(v)) campos[k] = `lista com ${v.length}`;
    else if (v && typeof v === "object") {
      const interno = Object.entries(v as Record<string, unknown>)
        .filter(([ik]) => !SENSIVEL.test(ik))
        .slice(0, 12)
        .map(([ik, iv]) => `${ik}=${iv !== null && typeof iv === "object" ? "{…}" : curto(iv, 30)}`);
      campos[k] = interno.join(", ");
    } else campos[k] = curto(v, 160);
  }
  const lista = (v: unknown) => (Array.isArray(v) ? v : []);
  const primeiro = lista(d.quartos)[0] ?? lista(d.indisponiveis)[0];
  return {
    formato: "json",
    campos,
    primeiro_quarto: primeiro && typeof primeiro === "object"
      ? Object.keys(primeiro as object).slice(0, 40).join(",")
      : undefined,
  };
}

async function examinar(nome: string, o_que_muda: string, url: string, init: RequestInit = {}): Promise<Exame> {
  const inicio = Date.now();
  try {
    const r = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000), ...init });
    const texto = await r.text();
    const cabecalhos: Record<string, string> = {};
    for (const c of CABECALHOS) { const v = r.headers.get(c); if (v) cabecalhos[c] = curto(v, 120); }
    r.headers.forEach((v, k) => { if (k.startsWith("x-") && !SENSIVEL.test(k)) cabecalhos[k] = curto(v, 120); });
    /* Dos cookies, só os nomes (dizem se há verificação de robô na frente); nunca os valores. */
    const cookies = r.headers.getSetCookie?.().map((c) => c.split("=")[0].trim()).filter(Boolean) ?? [];
    if (cookies.length) cabecalhos["cookies_recebidos"] = cookies.join(", ").slice(0, 120);
    return { nome, o_que_muda, http: r.status, ms: Date.now() - inicio, cabecalhos, corpo: { bytes: texto.length, ...resumir(texto) } };
  } catch (e) {
    const tipo = (e as Error)?.name;
    return {
      nome, o_que_muda, http: 0, ms: Date.now() - inicio, cabecalhos: {},
      corpo: { erro: tipo === "TimeoutError" || tipo === "AbortError" ? "sem resposta em 15 s" : "sem conexão" },
    };
  }
}

/**
 * O mesmo pedido que `conferirCopias` (sincronização de fotos) faz a cada
 * rodada: HEAD numa foto de suíte hospedada no Desbravador, com o mesmo
 * cabeçalho. Diz se o servidor do site continua sendo atendido por lá.
 */
async function examinarFotos(): Promise<Exame[]> {
  const db = process.env.DATABASE_URL;
  if (!db) return [];
  const sql = postgres(db, { max: 1, connect_timeout: 5 });
  let fotos: { url_origem: string }[] = [];
  try {
    fotos = [...await sql<{ url_origem: string }[]>`
      SELECT url_origem FROM midias
      WHERE origem = 'desbravador' AND tipo = 'foto'
        AND url_origem LIKE 'https://reservas.desbravador.com.br/%'
      ORDER BY atualizado_em DESC NULLS LAST LIMIT 2`];
  } catch { fotos = []; } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
  const exames: Exame[] = [];
  for (const foto of fotos) {
    const arquivo = foto.url_origem.split("/").pop() ?? "foto";
    exames.push(await examinar("foto_no_desbravador", `tamanho da foto ${arquivo}, como na sincronização de fotos`,
      foto.url_origem, { method: "HEAD", headers: { accept: "image/*" } }));
  }
  return exames;
}

/** Só o formato: código, tempo, tamanho e os NOMES dos campos (nunca os valores). */
async function sondar(nome: string, o_que_muda: string, url: string): Promise<Exame> {
  const inicio = Date.now();
  try {
    const r = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    const texto = await r.text();
    let campos = "";
    try {
      const d = JSON.parse(texto);
      if (d && typeof d === "object" && !Array.isArray(d)) {
        campos = Object.entries(d as Record<string, unknown>)
          .map(([k, v]) => `${k}:${Array.isArray(v) ? "lista" + v.length : v === null ? "nulo" : typeof v}`).join(", ").slice(0, 600);
      } else campos = Array.isArray(d) ? `lista com ${d.length}` : typeof d;
    } catch { campos = "(não é JSON)"; }
    return { nome, o_que_muda, http: r.status, ms: Date.now() - inicio, cabecalhos: { "content-type": curto(r.headers.get("content-type"), 60) }, corpo: { bytes: texto.length, campos } };
  } catch {
    return { nome, o_que_muda, http: 0, ms: Date.now() - inicio, cabecalhos: {}, corpo: { erro: "sem resposta" } };
  }
}

/**
 * A página pública de reservas da pousada (a mesma que o botão "Reservar"
 * abre): só o nome do arquivo do aplicativo, para saber se o Desbravador
 * publicou uma versão nova. Em 11/11/2026 era `main.f5828971.js`.
 */
async function versaoDaPagina(slug: string): Promise<Exame> {
  const inicio = Date.now();
  const nome = "pagina_de_reservas", o_que_muda = "nome do arquivo do aplicativo na página pública de reservas";
  try {
    const r = await fetch(`https://reservas.desbravador.com.br/hotel-app/${encodeURIComponent(slug)}`, {
      method: "GET", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { accept: "text/html" },
    });
    const texto = await r.text();
    const arquivos = [...new Set(texto.match(/static\/(?:js|css)\/main\.[a-f0-9]+\.(?:js|css)/g) ?? [])];
    return {
      nome, o_que_muda, http: r.status, ms: Date.now() - inicio,
      cabecalhos: { "content-type": curto(r.headers.get("content-type"), 60), "last-modified": curto(r.headers.get("last-modified"), 60) },
      corpo: {
        bytes: texto.length,
        arquivos: arquivos.join(", ") || "(nenhum encontrado)",
        /* A página é pública (é a que o hóspede abre): título, endereços dos arquivos e o texto visível. */
        titulo: curto(texto.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1], 120),
        enderecos: [...texto.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((m) => curto(m[1], 90)).slice(0, 14).join(" | "),
        texto_visivel: curto(texto.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "), 300),
      },
    };
  } catch {
    return { nome, o_que_muda, http: 0, ms: Date.now() - inicio, cabecalhos: {}, corpo: { erro: "sem resposta" } };
  }
}

/**
 * O arquivo do aplicativo que a página pública de reservas manda a qualquer
 * visitante. Daqui saem só NOMES: rotas da página, parâmetros que ela lê do
 * endereço (para saber se os links "Reservar" do site continuam valendo),
 * endereços que ela chama e nomes dos pedidos. Nenhum valor é mostrado.
 */
async function lerAplicativo(caminho: string): Promise<Exame> {
  const inicio = Date.now();
  const nome = "aplicativo_de_reservas", o_que_muda = "nomes de rotas, parâmetros e pedidos no arquivo público " + caminho.split("/").pop();
  if (!/^\/hotel-app\/assets\/[\w.-]+\.js$/.test(caminho)) {
    return { nome, o_que_muda, http: 0, ms: 0, cabecalhos: {}, corpo: { erro: "arquivo do aplicativo não reconhecido" } };
  }
  try {
    const r = await fetch("https://reservas.desbravador.com.br" + caminho, {
      method: "GET", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { accept: "*/*" },
    });
    const js = await r.text();
    const unicos = (re: RegExp, max: number, grupo = 1) => {
      const vistos = new Set<string>();
      for (const m of js.matchAll(re)) { const v = (m[grupo] ?? "").slice(0, 90); if (v) vistos.add(v); if (vistos.size >= max) break; }
      return [...vistos].join(" | ");
    };
    const conta = (re: RegExp) => (js.match(re) ?? []).length;
    return {
      nome, o_que_muda, http: r.status, ms: Date.now() - inicio,
      cabecalhos: { "content-type": curto(r.headers.get("content-type"), 60), "last-modified": curto(r.headers.get("last-modified"), 60) },
      corpo: {
        bytes: js.length,
        rotas: unicos(/path:\s*["'`]([^"'`]{1,70})["'`]/g, 50),
        parametros_do_endereco: unicos(/\.get\(["'`]([A-Za-z0-9_]{2,24})["'`]\)/g, 60),
        enderecos_chamados: unicos(/["'`]((?:https?:\/\/[a-z0-9.-]+)?\/[A-Za-z0-9_\/.-]{2,80}\.(?:php|json))(?:\?[^"'`]*)?["'`]/g, 40),
        servidores: unicos(/["'`](https?:\/\/[a-z0-9.-]+)(?:[\/?][^"'`]*)?["'`]/g, 40),
        pedidos: unicos(/\b([A-Za-z]{3,30}R[QS])\b/g, 80),
        outros_arquivos: unicos(/["'`](?:\.\/|assets\/)?([\w-]+-[\w-]{6,12}\.js)["'`]/g, 60),
        verificacao_de_robo: `recaptcha ${conta(/recaptcha/gi)}, turnstile ${conta(/turnstile/gi)}, hcaptcha ${conta(/hcaptcha/gi)}`,
        nomes_antigos: `wsrolRQ ${conta(/wsrolRQ/g)}, interface.php ${conta(/interface\.php/g)}, roomCode ${conta(/roomCode/g)}, rateCode ${conta(/rateCode/g)}, checkin ${conta(/checkin/g)}, child1 ${conta(/child1/g)}, child2 ${conta(/child2/g)}`,
      },
    };
  } catch {
    return { nome, o_que_muda, http: 0, ms: Date.now() - inicio, cabecalhos: {}, corpo: { erro: "sem resposta" } };
  }
}

function dia(mais: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + mais);
  return d.toISOString().slice(0, 10);
}

type Saida = { consultado_em: string; regiao: string; servico: string; exames: Exame[] };
let guardado: { ate: number; dados: Saida } | null = null;
let pendente: Promise<Saida> | null = null;

async function rodar(): Promise<Saida> {
  const ci = dia(10), co = dia(12);
  /* O endereço sai de `urlTarifas`: é exatamente a consulta que o site faz. */
  const padrao = new URL(urlTarifas(ci, co, 2, 0));
  const base = padrao.origin;
  const slug = padrao.searchParams.get("slug") ?? "";
  const tarifas = (s: string, entrada: string, saida: string, adultos: number, extra = "") => {
    const u = new URL(urlTarifas(entrada, saida, adultos, 0));
    u.searchParams.set("slug", s);
    return u.toString() + extra;
  };
  /* Em sequência, para os tempos não se misturarem. */
  const exames: Exame[] = [];
  exames.push(await examinar("padrao", "a consulta de sempre", tarifas(slug, ci, co, 2)));
  exames.push(await examinar("sem_cache", "a mesma, com um parâmetro novo e pedindo resposta fresca",
    tarifas(slug, ci, co, 2, `&_=${Date.now()}`), { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } }));
  exames.push(await examinar("outra_data", "outro período e 3 adultos", tarifas(slug, dia(40), dia(43), 3)));
  exames.push(await examinar("slug_maiusculas", "o nome da pousada em maiúsculas", tarifas(slug.toUpperCase(), ci, co, 2)));
  exames.push(await examinar("slug_inexistente", "uma pousada que não existe, para comparar a resposta e o tempo",
    tarifas("pousada-que-nao-existe-teste", ci, co, 2)));
  exames.push(await examinar("raiz", "a página inicial do serviço", `${base}/`));
  exames.push(await examinar("padrao_de_novo", "a consulta de sempre, repetida no fim", tarifas(slug, ci, co, 2)));
  exames.push(...await examinarFotos());
  /* O serviço tem algum modo de detalhe ou outra rota? Só o formato da resposta. */
  for (const extra of ["debug=1", "raw=1", "verbose=1", "detalhes=1"]) {
    exames.push(await sondar("tarifas_com_" + extra.split("=")[0], "a consulta de sempre com " + extra, tarifas(slug, ci, co, 2, "&" + extra)));
  }
  const consulta = padrao.search;
  for (const caminho of ["/debug", "/health", "/status", "/hotel", "/quartos", "/disponibilidade", "/diagnostico"]) {
    exames.push(await sondar("rota" + caminho.replace("/", "_"), "outra rota do serviço: " + caminho, base + caminho + consulta));
  }
  const pagina = await versaoDaPagina(slug);
  exames.push(pagina);
  const arquivoDoAplicativo = String((pagina.corpo as { enderecos?: string }).enderecos ?? "").split(" | ").find((e) => /^\/hotel-app\/assets\/index-[\w.-]+\.js$/.test(e));
  if (arquivoDoAplicativo) exames.push(await lerAplicativo(arquivoDoAplicativo));
  return { consultado_em: new Date().toISOString(), regiao: process.env.VERCEL_REGION ?? "local", servico: padrao.host, exames };
}

const SEM_CACHE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };

export async function GET() {
  /* Sem o serviço configurado não há o que examinar (mesma regra de /api/saude/status). */
  if (!process.env.WORKER_BASE_URL?.trim()) return Response.json({ configurado: false }, { status: 503, headers: SEM_CACHE });
  if (guardado && guardado.ate > Date.now()) return Response.json(guardado.dados, { headers: SEM_CACHE });
  if (!pendente) {
    pendente = rodar()
      .then((dados) => { guardado = { ate: Date.now() + 60_000, dados }; return dados; })
      .finally(() => { pendente = null; });
  }
  try { return Response.json(await pendente, { headers: SEM_CACHE }); }
  catch { return Response.json({ erro: "exame não concluiu" }, { status: 500, headers: SEM_CACHE }); }
}
