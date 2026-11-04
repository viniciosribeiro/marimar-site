import { resumir } from "@/lib/format";
import postgres from "postgres"; import Link from "next/link";
import { lerContato } from "@/lib/pousada";
export const dynamic = "force-dynamic";
export default async function PacotesPage() {
  const sql=postgres(process.env.DATABASE_URL!, {max:1, prepare: false }); const lista=await sql`SELECT * FROM pacotes WHERE ativo=true ORDER BY ordem`; await sql.end();
  /* Sem pacote ativo a página abria vazia, sem dizer nada (visto em 04/11/2026). */
  if (lista.length === 0) {
    const contato = await lerContato();
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Pacotes</h1>
        <p className="text-gray-500 mb-8">Ofertas especiais para sua estadia</p>
        <div className="bg-fundo-suave rounded-marca p-6 sm:p-8">
          <p className="text-tinta leading-relaxed">No momento não há pacotes publicados. As tarifas de cada data aparecem na consulta de disponibilidade, direto do sistema de reservas da pousada.</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href="/reservar" className="inline-flex items-center justify-center bg-marca hover:bg-marca-hover text-marca-texto px-5 py-3 rounded-marca text-sm font-semibold transition-marca">Consultar disponibilidade</Link>
            <a href={`https://wa.me/${contato.whatsappDigitos}?text=${encodeURIComponent("Olá! Vocês têm algum pacote ou oferta para as minhas datas?")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-linha text-tinta px-5 py-3 rounded-marca text-sm font-semibold hover:bg-white transition-marca">Perguntar no WhatsApp</a>
          </div>
        </div>
      </div>
    );
  }
  return(<div className="max-w-7xl mx-auto px-4 py-12"><h1 className="text-3xl font-bold mb-2">Pacotes</h1><p className="text-gray-500 mb-8">Ofertas especiais para sua estadia</p><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{lista.map((p:any)=>(<Link key={p.id} href={`/pacotes/${p.slug}`} className="bg-white rounded-marca shadow hover:shadow-lg overflow-hidden group"><div className="h-40 bg-gradient-to-br from-marca-borda to-marca-suave flex items-center justify-center"><span className="text-4xl">🎁</span></div><div className="p-4"><h3 className="font-semibold text-lg group-hover:text-marca">{p.nome}</h3><p className="text-sm text-gray-500 mt-1">{resumir(p.descricao, 110)}</p></div></Link>))}</div></div>);
}