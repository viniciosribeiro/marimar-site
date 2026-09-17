import { fetchTarifas } from "@/lib/worker"; import { buildDeepLink } from "@/lib/deeplink"; import Link from "next/link"; import postgres from "postgres";

export const dynamic = "force-dynamic";

export default async function ReservarPage({ searchParams }: { searchParams: Promise<{ check_in?: string; check_out?: string; adultos?: string; criancas?: string }> }) {
  const sp = await searchParams;
  const ci = sp.check_in; const co = sp.check_out;
  const adultos = parseInt(sp.adultos || "2"); const criancas = parseInt(sp.criancas || "0");
  let resultados: any[] = []; let erro = ""; let noites = 0; let whatsapp = "";

  // Busca dados da pousada para WhatsApp
  const sql0 = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [pousadaData] = await sql0`SELECT whatsapp, nome FROM pousada LIMIT 1`;
  whatsapp = pousadaData?.whatsapp?.replace(/\D/g, "") || "5541999999999";

  if (ci && co) {
    try {
      noites = Math.round((new Date(co + "T12:00").getTime() - new Date(ci + "T12:00").getTime()) / 86400000);
      const data = await fetchTarifas(ci, co, adultos, criancas);
      const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
      const ids = [...data.quartos, ...data.indisponiveis].map(r => r.id);
      const locais = ids.length > 0 ? await sql`SELECT q.*, c.nome as cat_nome FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id WHERE q.desbravador_room_id = ANY(${ids})` : [];
      const map = new Map(locais.map((l: any) => [l.desbravador_room_id, l]));
      // Busca fotos de todos os quartos locais
      const quartoIds = locais.map((l: any) => l.id);
      const fotos = quartoIds.length > 0 ? await sql`SELECT * FROM midias WHERE quarto_id = ANY(${quartoIds}) ORDER BY ordem` : [];
      const fotosMap = new Map<string, any[]>();
      for (const f of fotos) { if (!fotosMap.has(f.quarto_id)) fotosMap.set(f.quarto_id, []); fotosMap.get(f.quarto_id)!.push(f); }
      await sql.end();

      resultados = [...data.quartos, ...data.indisponiveis].map(r => {
        const l = map.get(r.id);
        const qFotos = l ? (fotosMap.get(l.id) || []) : [];
        const fotoCapa = qFotos.length > 0 ? qFotos[0].url : null;
        return {
          ...r, nomeLocal: l?.nome || r.nome, slugLocal: l?.slug || "",
          descricaoLocal: l?.descricao_motor || r.categoria || "", catNome: l?.cat_nome,
          cama: l?.cama, metragem: l?.metragem, fotoCapa,
          deepLink: buildDeepLink({ checkIn: ci, checkOut: co, adultos, criancas }),
          whatsappUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Gostaria de reservar:\n\n*Quarto:* ${l?.nome || r.nome}\n*Check-in:* ${new Date(ci+"T12:00").toLocaleDateString("pt-BR")}\n*Check-out:* ${new Date(co+"T12:00").toLocaleDateString("pt-BR")}\n*Noites:* ${noites}\n*Adultos:* ${adultos}${criancas > 0 ? `\n*Crianças:* ${criancas}` : ""}\n*Valor total:* R$ ${r.total}\n\nPodem verificar a disponibilidade?`)}`
        };
      });
    } catch (e: any) { erro = "Erro ao consultar. Tente novamente."; }
  }

  const fmtData = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR");

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Reservar</h1>
      <p className="text-gray-500 mb-8">Consulte disponibilidade em tempo real</p>

      <form className="bg-white rounded-xl shadow p-4 mb-8 flex flex-col sm:flex-row gap-3 max-w-2xl">
        <input type="date" name="check_in" defaultValue={ci} required className="border rounded-lg px-3 py-2 flex-1 text-sm" />
        <input type="date" name="check_out" defaultValue={co} required className="border rounded-lg px-3 py-2 flex-1 text-sm" />
        <select name="adultos" defaultValue={adultos} className="border rounded-lg px-3 py-2 text-sm"><option>1</option><option>2</option><option>3</option><option>4</option></select>
        <select name="criancas" defaultValue={criancas} className="border rounded-lg px-3 py-2 text-sm"><option>0</option><option>1</option><option>2</option><option>3</option></select>
        <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-medium">Buscar</button>
      </form>

      {erro && <p className="text-red-600 bg-red-50 p-4 rounded-lg mb-6">{erro}</p>}

      {ci && co && !erro && (
        <div>
          <p className="text-sm text-gray-500 mb-6">
            {noites} noite(s): {ci ? fmtData(ci) : ""} → {co ? fmtData(co) : ""} • {adultos} adulto(s){criancas > 0 ? ` • ${criancas} crianca(s)` : ""}
          </p>
          {resultados.length === 0 ? (
            <p className="text-gray-500 text-center py-12">Nenhum quarto disponivel para essas datas.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resultados.map((r: any) => (
                <div key={r.id} className={`bg-white rounded-xl shadow overflow-hidden ${!r.disponivel ? "opacity-60" : ""}`}>
                  {r.fotoCapa ? (
                    <img src={r.fotoCapa} alt={r.nomeLocal} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center"><span className="text-5xl">🏨</span></div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-lg">{r.nomeLocal || r.nome}</h3>
                      {r.catNome && r.catNome}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{r.descricaoLocal?.slice(0, 120)}</p>
                    {r.cama && <p className="text-xs text-gray-500 mb-1">🛏 {r.cama}{r.metragem ? ` • ${r.metragem}m²` : ""}</p>}
                    <p className="text-xs text-gray-500 mb-3">👥 Ate {r.ocupacao_max} pessoas</p>
                    
                    <div className="border-t pt-3 mb-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-gray-500">Diaria:</span>
                        <span className="text-xl font-bold text-teal-600">R$ {r.diaria}</span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-sm text-gray-500">Total {noites} noite(s):</span>
                        <span className="text-xl font-bold text-teal-600">R$ {r.total}</span>
                      </div>
                      {r.valor_adulto > 0 && <p className="text-xs text-gray-400 mt-1">Por adulto: R$ {r.valor_adulto}/noite</p>}
                    </div>

                    {!r.disponivel ? (
                      <span className="block text-center text-sm text-red-600 bg-red-50 py-2 rounded">Esgotado no periodo</span>
                    ) : (
                      <div className="space-y-2">
                        <a href={r.deepLink} target="_blank" className="block text-center bg-teal-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-teal-700 font-medium">
                          Reservar no site oficial
                        </a>
                        <a href={r.whatsappUrl} target="_blank" className="block text-center border-2 border-green-500 text-green-600 text-sm px-4 py-2.5 rounded-lg hover:bg-green-50 font-medium">
                          💬 Consultar no WhatsApp
                        </a>
                        {r.slugLocal && (
                          <Link href={`/quartos/${r.slugLocal}`} className="block text-center text-teal-600 text-xs hover:underline">Ver detalhes do quarto</Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}