/**
 * Exame do serviço de tarifas (PousadaHub), criado no incidente de 14/11/2026.
 *
 * O serviço é da pousada e fica fora deste repositório. Quando ele responde
 * "200, sem nenhum quarto", o site não tinha como dizer POR QUÊ. Esta rota
 * repete a consulta de sempre com pequenas variações e mostra o que voltou:
 * código, tempo, cabeçalhos de cache e um resumo do corpo.
 *
 * Só LEITURA e só o serviço da própria pousada (`WORKER_BASE_URL`): nada vai
 * ao Desbravador a partir daqui, nada é gravado, nenhum segredo é lido ou
 * mostrado. No máximo uma rodada por minuto por instância.
 */
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
    return { nome, o_que_muda, http: r.status, ms: Date.now() - inicio, cabecalhos, corpo: { bytes: texto.length, ...resumir(texto) } };
  } catch (e) {
    const tipo = (e as Error)?.name;
    return {
      nome, o_que_muda, http: 0, ms: Date.now() - inicio, cabecalhos: {},
      corpo: { erro: tipo === "TimeoutError" || tipo === "AbortError" ? "sem resposta em 15 s" : "sem conexão" },
    };
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
