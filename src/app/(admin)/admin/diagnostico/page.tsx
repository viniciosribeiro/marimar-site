import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { fetchTarifas } from "@/lib/worker";
import { contarDominioAntigo } from "@/lib/dominio-antigo";
export const dynamic = "force-dynamic";
export default async function DiagnosticoPage() {
  const s=await auth(); if(!s?.user) redirect("/admin/login");
  let workerStatus="Testando..."; let workerJson=null; let erro=""; let latencia=0;
  try {
    const t0=Date.now();
    const data=await fetchTarifas("2026-10-15","2026-10-17",2);
    latencia=Date.now()-t0;
    workerStatus=`Online (${latencia}ms)`;
    workerJson=data;
  } catch(e:any) { workerStatus="Offline"; erro=e.message; }

  /* Quantas imagens ainda moram no servidor antigo. Fica numa consulta
     isolada: se ela falhar, o diagnostico do motor — que e o motivo de
     alguem abrir esta tela as pressas — continua aparecendo. */
  let antigas: Awaited<ReturnType<typeof contarDominioAntigo>> = { total: 0, porLugar: [] };
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    antigas = await contarDominioAntigo(sql);
    await sql.end();
  } catch {}
  return(<div className="p-5 sm:p-8"><h1 className="text-2xl font-bold mb-2">Diagnostico</h1><p className="text-sm text-gray-500 mb-6">Teste a conexao com o motor Desbravador</p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className={`bg-white rounded-lg shadow p-4 ${workerJson?"border-green-500 border-2":"border-red-500 border-2"}`}><h3 className="font-semibold">Worker</h3><p className="text-2xl font-bold mt-2">{workerStatus}</p></div>
      <div className="bg-white rounded-lg shadow p-4"><h3 className="font-semibold">Quartos retornados</h3><p className="text-2xl font-bold mt-2">{workerJson?workerJson.quartos.length+workerJson.indisponiveis.length:"—"}</p></div>
      <div className="bg-white rounded-lg shadow p-4"><h3 className="font-semibold">Disponiveis</h3><p className="text-2xl font-bold mt-2">{workerJson?.total_disponiveis??"—"}</p></div>
    </div>
    <div className={`rounded-lg p-4 mb-6 border ${antigas.total ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-200"}`}>
      <h3 className="font-semibold text-sm">Imagens no servidor antigo</h3>
      {antigas.total ? (
        <>
          <p className="text-2xl font-bold mt-1 text-amber-900">{antigas.total}</p>
          <p className="text-sm text-amber-900 mt-1">
            Essas imagens ainda carregam de <code className="font-mono text-xs">pousadamarimarilhadomel.com.br</code>.
            No dia em que o DNS apontar para a Vercel, o servidor antigo sai do ar e todas somem de uma vez.
          </p>
          <p className="text-sm text-amber-900 mt-2">
            Para resolver, no terminal do projeto:{" "}
            <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">npm run db:migrar-fotos -- --dry</code>{" "}
            para ver o que seria feito, e sem <code className="font-mono text-xs">--dry</code> para fazer.
          </p>
          <ul className="text-xs text-amber-800 mt-2 space-y-0.5">
            {antigas.porLugar.map((p) => (
              <li key={p.onde}><span className="font-mono">{p.onde}</span> — {p.quantas}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-emerald-900 mt-1">
          Nenhuma. Todas as imagens estão hospedadas conosco — a virada de DNS não derruba nada.
        </p>
      )}
    </div>

    {erro&&<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"><p className="text-red-700 font-medium">Erro: {erro}</p><p className="text-sm text-red-500 mt-1">Verifique se o Worker esta no ar e a URL em .env.local</p></div>}
    {workerJson&&<div className="bg-white rounded-lg shadow p-4"><h3 className="font-semibold mb-3">JSON retornado pelo Worker</h3><pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">{JSON.stringify(workerJson,null,2)}</pre></div>}
  </div>);
}