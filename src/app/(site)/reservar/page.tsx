import { fetchTarifas } from "@/lib/worker";
import { buildDeepLink } from "@/lib/deeplink";
import { tituloQuarto, resumir, brl, pluralizar, escassez, dataBR } from "@/lib/format";
import Link from "next/link";
import Image from "next/image";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export default async function ReservarPage({ searchParams }: { searchParams: Promise<{ check_in?: string; check_out?: string; adultos?: string; criancas?: string }> }) {
  const sp = await searchParams;
  const ci = sp.check_in; const co = sp.check_out;
  const adultos = parseInt(sp.adultos || "2"); const criancas = parseInt(sp.criancas || "0");
  let resultados: any[] = []; let erro = ""; let noites = 0; let whatsapp = "";
  let avisoCrianca = "";

  const sql0 = postgres(process.env.DATABASE_URL!, { max: 1 });
  const [pousadaData] = await sql0`SELECT whatsapp, nome FROM pousada LIMIT 1`;
  await sql0.end();
  whatsapp = pousadaData?.whatsapp?.replace(/\D/g, "") || "";

  if (ci && co) {
    try {
      noites = Math.round((new Date(co + "T12:00").getTime() - new Date(ci + "T12:00").getTime()) / 86400000);
      const data = await fetchTarifas(ci, co, adultos, criancas);
      avisoCrianca = data.aviso_crianca || "";
      const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
      const ids = [...data.quartos, ...data.indisponiveis].map(r => r.id);
      const locais = ids.length > 0 ? await sql`SELECT q.*, c.nome as cat_nome FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id WHERE q.desbravador_room_id = ANY(${ids})` : [];
      const map = new Map(locais.map((l: any) => [l.desbravador_room_id, l]));
      const quartoIds = locais.map((l: any) => l.id);
      const fotos = quartoIds.length > 0 ? await sql`SELECT * FROM midias WHERE quarto_id = ANY(${quartoIds}) ORDER BY ordem` : [];
      const fotosMap = new Map<string, any[]>();
      for (const f of fotos) { if (!fotosMap.has(f.quarto_id)) fotosMap.set(f.quarto_id, []); fotosMap.get(f.quarto_id)!.push(f); }
      await sql.end();

      resultados = [...data.quartos, ...data.indisponiveis].map(r => {
        const l = map.get(r.id);
        const qFotos = l ? (fotosMap.get(l.id) || []) : [];
        // Cai para a foto do proprio motor quando o quarto ainda nao tem midia local
        const fotoCapa = qFotos.length > 0 ? qFotos[0].url : (r.fotos?.[0] || null);
        const nomeExibido = tituloQuarto(l?.nome || r.nome);
        return {
          ...r, nomeLocal: nomeExibido, slugLocal: l?.slug || "",
          descricaoLocal: l?.descricao_motor || r.categoria || "", catNome: l?.cat_nome,
          cama: l?.cama, metragem: l?.metragem, fotoCapa,
          avisoEstadia: r.estadia_minima > noites ? r.estadia_minima : null,
          alertaEstoque: r.disponivel ? escassez(r.unidades_disponiveis) : null,
          deepLink: buildDeepLink({ checkIn: ci, checkOut: co, adultos, criancas }),
          whatsappUrl: whatsapp
            ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Gostaria de reservar:\n\n*Quarto:* ${nomeExibido}\n*Check-in:* ${dataBR(ci)}\n*Check-out:* ${dataBR(co)}\n*Noites:* ${noites}\n*Adultos:* ${adultos}${criancas > 0 ? `\n*Crianças:* ${criancas}` : ""}\n*Valor total:* ${brl(r.total_geral ?? r.total)}\n\nPodem verificar a disponibilidade?`)}`
            : null,
        };
      });
    } catch {
      erro = "Não conseguimos consultar a disponibilidade agora. Tente novamente em instantes ou fale com a gente no WhatsApp.";
    }
  }

  const disponiveis = resultados.filter(r => r.disponivel);
  const esgotados = resultados.filter(r => !r.disponivel);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Reservar</h1>
      <p className="text-gray-500 mb-8">Consulte disponibilidade em tempo real</p>

      <form className="bg-white rounded-marca shadow p-4 mb-8 flex flex-col sm:flex-row gap-3 max-w-3xl">
        <label className="flex-1 min-w-0">
          <span className="block text-xs text-gray-500 mb-1">Check-in</span>
          <input type="date" name="check_in" defaultValue={ci} required className="w-full border rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="flex-1 min-w-0">
          <span className="block text-xs text-gray-500 mb-1">Check-out</span>
          <input type="date" name="check_out" defaultValue={co} required className="w-full border rounded-lg px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="block text-xs text-gray-500 mb-1">Adultos</span>
          <select name="adultos" defaultValue={adultos} className="border rounded-lg px-3 py-2 text-sm"><option>1</option><option>2</option><option>3</option><option>4</option></select>
        </label>
        <label>
          <span className="block text-xs text-gray-500 mb-1">Crianças</span>
          <select name="criancas" defaultValue={criancas} className="border rounded-lg px-3 py-2 text-sm"><option>0</option><option>1</option><option>2</option><option>3</option></select>
        </label>
        <button type="submit" className="bg-marca text-marca-texto px-6 rounded-lg hover:bg-marca-hover font-medium self-end py-2">Buscar</button>
      </form>

      {erro && (
        <div className="text-red-700 bg-red-50 border border-red-100 p-4 rounded-lg mb-6">
          <p className="text-sm">{erro}</p>
          {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" className="inline-block mt-2 text-sm font-medium text-green-700 hover:underline">💬 Falar no WhatsApp</a>}
        </div>
      )}

      {ci && co && !erro && (
        <div>
          <p className="text-sm text-gray-500 mb-2">
            {pluralizar(noites, "noite")}: {dataBR(ci)} → {dataBR(co)} • {pluralizar(adultos, "adulto")}
            {criancas > 0 ? ` • ${pluralizar(criancas, "criança")}` : ""}
          </p>

          {avisoCrianca && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-6">
              ℹ️ {avisoCrianca}
            </p>
          )}

          {resultados.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-3">Nenhum quarto disponível para essas datas.</p>
              {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" className="text-sm font-medium text-green-700 hover:underline">💬 Consultar outras datas no WhatsApp</a>}
            </div>
          ) : (
            <>
              {disponiveis.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                  {disponiveis.map((r: any) => <CardQuarto key={r.id} r={r} noites={noites} />)}
                </div>
              )}

              {esgotados.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Sem disponibilidade nessas datas
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {esgotados.map((r: any) => <CardQuarto key={r.id} r={r} noites={noites} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CardQuarto({ r, noites }: { r: any; noites: number }) {
  return (
    <div className={`bg-white rounded-marca shadow overflow-hidden flex flex-col ${!r.disponivel ? "opacity-60" : ""}`}>
      <div className="relative h-48 bg-gradient-to-br from-marca-borda to-marca-suave">
        {r.fotoCapa ? (
          <Image
            src={r.fotoCapa}
            alt={r.nomeLocal}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full flex items-center justify-center"><span className="text-5xl">🏨</span></div>
        )}
        {r.alertaEstoque && (
          <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
            {r.alertaEstoque}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-lg leading-tight">{r.nomeLocal}</h3>
          {r.catNome && <span className="text-xs text-marca-ativa bg-marca-sutil px-2 py-0.5 rounded shrink-0">{tituloQuarto(r.catNome)}</span>}
        </div>

        <p className="text-xs text-gray-500 mb-2 leading-relaxed">{resumir(r.descricaoLocal, 120)}</p>

        <div className="text-xs text-gray-500 space-y-1 mb-3">
          {r.cama && <p>🛏 {r.cama}{r.metragem ? ` • ${r.metragem}m²` : ""}</p>}
          <p>👥 Até {pluralizar(r.ocupacao_max, "pessoa")}</p>
          {r.estadia_minima > 1 && <p>🗓 Mínimo de {pluralizar(r.estadia_minima, "noite")}</p>}
        </div>

        <div className="border-t pt-3 mb-3 mt-auto">
          <div className="flex items-baseline gap-1">
            <span className="text-sm text-gray-500">Diária:</span>
            <span className="text-xl font-bold text-marca">{brl(r.diaria)}</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm text-gray-500">Total {pluralizar(noites, "noite")}:</span>
            <span className="text-xl font-bold text-marca">{brl(r.total_geral ?? r.total)}</span>
          </div>
          {r.valor_adulto > 0 && <p className="text-xs text-gray-400 mt-1">Por adulto: {brl(r.valor_adulto)}/noite</p>}
          {r.total_criancas > 0 && (
            <p className="text-xs text-gray-400">
              Crianças: {brl(r.total_criancas)}
              {r.crianca_valor_variavel && r.valor_crianca_max ? ` (${brl(r.valor_crianca)}–${brl(r.valor_crianca_max)}/noite)` : ""}
            </p>
          )}
        </div>

        {!r.disponivel ? (
          <span className="block text-center text-sm text-gray-600 bg-gray-100 py-2 rounded">
            {r.motivo_indisponivel ? r.motivo_indisponivel.charAt(0).toUpperCase() + r.motivo_indisponivel.slice(1) : "Esgotado no período"}
          </span>
        ) : r.avisoEstadia ? (
          <span className="block text-center text-sm text-amber-800 bg-amber-50 py-2 rounded">
            Exige mínimo de {pluralizar(r.avisoEstadia, "noite")}
          </span>
        ) : (
          <div className="space-y-2">
            <a href={r.deepLink} target="_blank" className="block text-center bg-marca text-marca-texto text-sm px-4 py-2.5 rounded-lg hover:bg-marca-hover font-medium">
              Reservar no site oficial
            </a>
            {r.whatsappUrl && (
              <a href={r.whatsappUrl} target="_blank" className="block text-center border-2 border-green-500 text-green-600 text-sm px-4 py-2.5 rounded-lg hover:bg-green-50 font-medium">
                💬 Consultar no WhatsApp
              </a>
            )}
            {r.slugLocal && (
              <Link href={`/quartos/${r.slugLocal}`} className="block text-center text-marca text-xs hover:underline">Ver detalhes do quarto</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
