import postgres from "postgres";
import { fetchTarifas } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 35;

/**
 * Painel PUBLICO de status: somente leituras, nunca altera banco, reservas,
 * OpenClaw, WhatsApp ou configuracoes. Nao expor hosts internos nem segredos.
 *
 * Cached no servidor e na CDN por 5 minutos para evitar criar carga
 * proporcional ao numero de visitantes. Nao representa SLA ou uptime mensal.
 */
type Estado = "online" | "atencao" | "offline" | "nao_verificado";
type Sonda = { estado: Estado; latencia_ms: number | null; descricao: string };
type Dados = { consultado_em: string; servicos: Record<string, Sonda>; historico_disponivel: false };
const aguardeMs = 16_000;
let instantaneo: { ate: number; dados: Dados } | null = null;
let emAndamento: Promise<Dados> | null = null;

async function testar(nome: string, trabalho: () => Promise<void>): Promise<Sonda> {
  const inicio = Date.now();
  try {
    await trabalho();
    return { estado: "online", latencia_ms: Date.now() - inicio, descricao: "Verificacao de leitura concluida" };
  } catch {
    return { estado: "atencao", latencia_ms: Date.now() - inicio, descricao: nome + ": resposta indisponivel na ultima verificacao" };
  }
}

async function medir(): Promise<Dados> {
  const workerBase = process.env.WORKER_BASE_URL?.trim();
  const bancoConfigurado = Boolean(process.env.DATABASE_URL);
  const [worker, desbravador, banco] = await Promise.all([
    workerBase
      ? testar("Worker PousadaHub", async () => {
          const res = await fetch(workerBase.replace(/\/+$/, "") + "/", {
            signal: AbortSignal.timeout(5000), cache: "no-store",
          });
          if (!res.ok) throw new Error("worker");
        })
      : Promise.resolve({ estado: "nao_verificado", latencia_ms: null, descricao: "Sonda nao configurada" } as Sonda),
    workerBase
      ? testar("Consultas Desbravador", async () => {
          const entrada = new Date();
          entrada.setUTCDate(entrada.getUTCDate() + 9);
          const saida = new Date(entrada);
          saida.setUTCDate(saida.getUTCDate() + 2);
          // Chamado read-only da mesma integracao usada nas reservas.
          // Resposta sem quartos disponiveis NAO significa indisponibilidade.
          await fetchTarifas(entrada.toISOString().slice(0, 10), saida.toISOString().slice(0, 10), 2, 0, { timeoutMs: aguardeMs });
        })
      : Promise.resolve({ estado: "nao_verificado", latencia_ms: null, descricao: "Sonda nao configurada" } as Sonda),
    bancoConfigurado
      ? testar("Neon PostgreSQL", async () => {
          const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
          try { await sql`SELECT 1 AS ok`; }
          finally { await sql.end({ timeout: 2 }).catch(() => {}); }
        })
      : Promise.resolve({ estado: "nao_verificado", latencia_ms: null, descricao: "Sonda nao configurada" } as Sonda),
  ]);

  return {
    consultado_em: new Date().toISOString(),
    historico_disponivel: false,
    servicos: {
      site: { estado: "online", latencia_ms: null, descricao: "Esta API publica respondeu" },
      api: { estado: "online", latencia_ms: null, descricao: "Endpoint de saude disponivel" },
      worker, desbravador, neon: banco,
    },
  };
}

export async function GET(request: Request) {
  // Evita que query strings aleatorias burlem o cache publico da CDN.
  if (new URL(request.url).search) return Response.redirect(new URL("/api/saude/status", request.url), 308);
  if (instantaneo && instantaneo.ate > Date.now()) {
    return Response.json(instantaneo.dados, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff" } });
  }
  if (!emAndamento) emAndamento = medir().then(dados => {
    instantaneo = { dados, ate: Date.now() + 300_000 };
    return dados;
  }).finally(() => { emAndamento = null; });
  try {
    const dados = await emAndamento;
    return Response.json(dados, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ consultado_em: new Date().toISOString(), servicos: {}, historico_disponivel: false }, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }
}
