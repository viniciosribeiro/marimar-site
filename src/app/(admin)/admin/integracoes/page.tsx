import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import { fetchTarifas } from "@/lib/worker"; import postgres from "postgres"; import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  // Sem fallback hardcoded: se a env var faltar, a tela avisa em vez de
  // vazar uma chave de exemplo que funcionava em producao.
  const apiKey = process.env.AGENT_API_KEY ?? "";
  const keyConfigurada = apiKey.length >= 16;

  // Resolve a URL base a partir do host da requisição (funciona em dev E produção),
  // em vez de depender de NEXT_PUBLIC_SITE_URL que pode estar ausente.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const baseUrl = `${proto}://${host}`;

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  // Testa Worker Desbravador
  let workerData: any = null; let workerLat = 0; let workerErr = "";
  try { const t0 = Date.now(); workerData = await fetchTarifas("2026-10-15", "2026-10-17", 2); workerLat = Date.now() - t0; } catch (e: any) { workerErr = e.message; }

  // Testa API do Agente
  const agentTests: any = {};
  for (const ep of ["pousada", "quartos", "faq", "pacotes"]) {
    try { const t0 = Date.now(); const r = await fetch(`${baseUrl}/api/agent/${ep}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) }); agentTests[ep] = { ok: r.ok, status: r.status, lat: Date.now() - t0 }; } catch { agentTests[ep] = { ok: false, status: 0, lat: 0 }; }
  }

  // Testa API Disponibilidade pública
  let dispOk = false; let dispLat = 0;
  try { const t0 = Date.now(); const r = await fetch(`${baseUrl}/api/disponibilidade?check_in=2026-10-15&check_out=2026-10-17&adultos=2`, { signal: AbortSignal.timeout(8000) }); dispOk = r.ok; dispLat = Date.now() - t0; } catch {}

  // Stats do banco
  const [qCount] = await sql`SELECT count(*)::int as c FROM quartos WHERE ativo = true`;
  const [lCount] = await sql`SELECT count(*)::int as c FROM leads`;
  const [mCount] = await sql`SELECT count(*)::int as c FROM midias`;
  const [cCount] = await sql`SELECT count(*)::int as c FROM cache_tarifas`;
  await sql.end();

  const maskedKey = keyConfigurada
    ? apiKey.slice(0, 8) + "●●●" + apiKey.slice(-4)
    : "⚠️ AGENT_API_KEY nao configurada no ambiente";

  return (
    <div className="p-5 sm:p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">🔌 Integrações</h1>
      <p className="text-sm text-gray-500 mb-6">Monitoramento em tempo real de todas as conexões</p>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatusCard label="Worker Desbravador" status={workerData ? "online" : "offline"} detail={workerData ? `${workerLat}ms • ${workerData.total_disponiveis} quartos` : workerErr} />
        <StatusCard label="API Disponibilidade" status={dispOk ? "online" : "offline"} detail={dispOk ? `${dispLat}ms` : "Falha"} />
        <StatusCard label="API do Agente" status={Object.values(agentTests).every((t: any) => t.ok) ? "online" : "partial"} detail={`${Object.values(agentTests).filter((t: any) => t.ok).length}/${Object.values(agentTests).length} endpoints`} />
        <StatusCard label="Banco de Dados" status="online" detail={`${qCount.c} quartos • ${mCount.c} mídias`} />
      </div>

      {/* Endpoints Agent */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-bold text-lg mb-4">📡 API do Agente — Status ao vivo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(agentTests).map(([ep, t]: any) => (
            <div key={ep} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${t.ok ? "bg-green-500" : "bg-red-500"}`} />
                <div>
                  <p className="text-sm font-mono font-medium">/api/agent/{ep}</p>
                  <p className="text-xs text-gray-400">{t.ok ? `HTTP ${t.status}` : "Offline"}</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{t.lat}ms</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dados do Worker */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-bold text-lg mb-4">🏨 Dados do Motor Desbravador</h2>
        {workerData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MiniStat label="Quartos" value={workerData.quartos.length + workerData.indisponiveis.length} />
            <MiniStat label="Disponíveis" value={workerData.total_disponiveis} />
            <MiniStat label="Noites" value={workerData.noites} />
            <MiniStat label="Latência" value={`${workerLat}ms`} />
          </div>
        ) : <p className="text-sm text-red-500 mb-4">⚠️ Worker offline — {workerErr}</p>}
        {workerData && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 mb-2">Ver JSON completo do Worker</summary>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-64 text-xs">{JSON.stringify(workerData, null, 2)}</pre>
          </details>
        )}
      </div>

      {/* Banco de dados */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-bold text-lg mb-4">🗄️ Banco de Dados</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Quartos ativos" value={qCount.c} />
          <MiniStat label="Mídias" value={mCount.c} />
          <MiniStat label="Leads" value={lCount.c} />
          <MiniStat label="Cache" value={cCount.c} />
        </div>
      </div>

      {/* Chave API */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-bold text-lg mb-3">🔑 Chave da API do Agente</h2>
        <div className="bg-gray-50 rounded-xl p-4 font-mono text-sm">
          <span className="text-gray-400">AGENT_API_KEY=</span>
          <span className="text-teal-700 font-medium">{maskedKey}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Header: <code className="bg-gray-100 px-1 rounded">Authorization: Bearer {maskedKey}</code></p>
      </div>

      {/* Variáveis de ambiente */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-bold text-lg mb-4">⚙️ Ambiente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            ["WORKER_BASE_URL", process.env.WORKER_BASE_URL],
            ["WORKER_SLUG", process.env.WORKER_SLUG],
            ["NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL],
            ["DATABASE_URL", "●●● configurado"],
            ["AUTH_SECRET", "●●● configurado"],
            ["AGENT_API_KEY", keyConfigurada ? "●●● configurada" : "⚠️ AUSENTE"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between p-2 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-600 text-xs">{k}</span>
              <span className="text-gray-500 font-mono text-xs truncate max-w-40">{v || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Guia OpenClaw */}
      <div className="bg-white rounded-xl shadow-sm p-5 mt-6">
        <h2 className="font-bold text-lg mb-4">🤖 Guia OpenClaw</h2>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed">
          <div># Configuração no OpenClaw</div>
          <div>URL Base: {baseUrl}/api/agent</div>
          <div>Header: Authorization: Bearer {apiKey}</div>
          <div>&nbsp;</div>
          <div># Endpoints:</div>
          <div>GET /pousada → consultar_pousada</div>
          <div>GET /quartos → consultar_quartos</div>
          <div>GET /disponibilidade?check_in=&check_out=&adultos= → consultar_disponibilidade</div>
          <div>GET /pacotes → consultar_pacotes</div>
          <div>GET /faq → consultar_faq</div>
          <div>POST /lead → registrar_lead</div>
          <div>&nbsp;</div>
          <div># Testar:</div>
          <div>curl -H "Authorization: Bearer {apiKey}" {baseUrl}/api/agent/pousada</div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, status, detail }: { label: string; status: string; detail: string }) {
  const colors: any = { online: "border-green-500 bg-green-50", offline: "border-red-500 bg-red-50", partial: "border-amber-500 bg-amber-50" };
  const dots: any = { online: "🟢", offline: "🔴", partial: "🟡" };
  return (
    <div className={`rounded-xl p-4 border-l-4 ${colors[status] || colors.offline} bg-white shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-sm">{dots[status]} {status === "online" ? "Online" : status === "partial" ? "Parcial" : "Offline"}</p>
      <p className="text-xs text-gray-400 mt-1">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}