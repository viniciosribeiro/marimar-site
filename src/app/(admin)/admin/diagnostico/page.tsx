import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import { fetchTarifas } from "@/lib/worker";
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
  return(<div className="p-6"><h1 className="text-2xl font-bold mb-2">Diagnostico</h1><p className="text-sm text-gray-500 mb-6">Teste a conexao com o motor Desbravador</p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className={`bg-white rounded-lg shadow p-4 ${workerJson?"border-green-500 border-2":"border-red-500 border-2"}`}><h3 className="font-semibold">Worker</h3><p className="text-2xl font-bold mt-2">{workerStatus}</p></div>
      <div className="bg-white rounded-lg shadow p-4"><h3 className="font-semibold">Quartos retornados</h3><p className="text-2xl font-bold mt-2">{workerJson?workerJson.quartos.length+workerJson.indisponiveis.length:"—"}</p></div>
      <div className="bg-white rounded-lg shadow p-4"><h3 className="font-semibold">Disponiveis</h3><p className="text-2xl font-bold mt-2">{workerJson?.total_disponiveis??"—"}</p></div>
    </div>
    {erro&&<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"><p className="text-red-700 font-medium">Erro: {erro}</p><p className="text-sm text-red-500 mt-1">Verifique se o Worker esta no ar e a URL em .env.local</p></div>}
    {workerJson&&<div className="bg-white rounded-lg shadow p-4"><h3 className="font-semibold mb-3">JSON retornado pelo Worker</h3><pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">{JSON.stringify(workerJson,null,2)}</pre></div>}
  </div>);
}