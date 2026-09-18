import postgres from "postgres";
import Link from "next/link";
import Image from "next/image";
import { tituloQuarto, resumir } from "@/lib/format";
import {
  COMPLEXO, DIFERENCIAIS, CAFE_DA_MANHA, RESTAURANTE,
  AVALIACOES, ATRACOES, POLITICAS, ENDERECO, TRAVESSIA,
} from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let p: any = null;
  let quartosList: any[] = [];
  let faqs: any[] = [];
  let heroMidia: any = null;

  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    [p] = await sql`SELECT * FROM pousada LIMIT 1`;
    quartosList = await sql`
      SELECT q.*, c.nome as cat_nome,
        (SELECT url FROM midias WHERE quarto_id = q.id AND destaque = true ORDER BY ordem LIMIT 1) as foto
      FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id
      WHERE q.ativo = true ORDER BY q.ordem LIMIT 6
    `;
    faqs = await sql`SELECT * FROM faq WHERE ativo = true ORDER BY ordem LIMIT 6`;
    [heroMidia] = await sql`
      SELECT url, alt FROM midias WHERE destaque = true
      ORDER BY (quarto_id IS NULL) DESC, ordem LIMIT 1
    `;
    await sql.end();
  } catch (e) {
    console.error("[HomePage] banco indisponivel:", (e as Error).message);
  }

  const wa = p?.whatsapp?.replace(/\D/g, "") || "";
  const heroUrl: string | null = heroMidia?.url || p?.og_image_url || null;
  const nome = p?.nome || "Pousada Marimar";

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <section className="relative isolate text-white py-24 lg:py-32 overflow-hidden bg-gradient-to-br from-marca via-marca-hover to-marca-escura">
        {heroUrl && (
          <>
            <Image src={heroUrl} alt={heroMidia?.alt || nome} fill priority sizes="100vw" className="object-cover -z-10" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />
          </>
        )}

        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <span className="inline-block text-white/90 text-xs sm:text-sm font-medium bg-white/15 px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm border border-white/20">
            🌊 Encantadas · Ilha do Mel · Paraná
          </span>

          <h1 className="font-titulo text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 leading-tight drop-shadow-sm">
            {nome}
          </h1>

          {/* O fato estrutural do complexo, logo de cara */}
          <p className="text-base lg:text-lg text-white/90 mb-9 max-w-2xl mx-auto leading-relaxed">
            {COMPLEXO.fraseLonga}
          </p>

          {/* Busca em destaque — vai direto para o motor Desbravador */}
          <form action="/reservar" className="bg-white rounded-marca shadow-2xl p-3 max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-2 text-left">
            <label className="col-span-2 sm:col-span-1">
              <span className="block text-[11px] font-medium text-gray-500 px-1 mb-1">Check-in</span>
              <input type="date" name="check_in" required className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-marca focus:border-transparent outline-none" />
            </label>
            <label className="col-span-2 sm:col-span-1">
              <span className="block text-[11px] font-medium text-gray-500 px-1 mb-1">Check-out</span>
              <input type="date" name="check_out" required className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-marca focus:border-transparent outline-none" />
            </label>
            <label>
              <span className="block text-[11px] font-medium text-gray-500 px-1 mb-1">Adultos</span>
              <select name="adultos" defaultValue="2" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-marca outline-none">
                <option>1</option><option>2</option><option>3</option><option>4</option>
              </select>
            </label>
            <label>
              <span className="block text-[11px] font-medium text-gray-500 px-1 mb-1">Crianças</span>
              <select name="criancas" defaultValue="0" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-marca outline-none">
                <option>0</option><option>1</option><option>2</option><option>3</option>
              </select>
            </label>
            <button type="submit" className="col-span-2 sm:col-span-1 bg-marca hover:bg-marca-hover text-white px-5 py-2.5 rounded-lg font-semibold transition-marca text-sm self-end">
              Ver disponibilidade
            </button>
          </form>
          <p className="text-xs text-white/70 mt-3">Disponibilidade e tarifas em tempo real, direto do nosso sistema de reservas.</p>
        </div>
      </section>

      {/* ═══ O COMPLEXO ═══ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="text-center mb-10">
          <span className="text-marca font-medium text-sm">Como funciona</span>
          <h2 className="font-titulo text-2xl lg:text-3xl font-bold text-gray-900 mt-2">Um complexo, duas partes</h2>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-2 items-stretch">
          <div className="bg-marca-sutil border border-marca-borda rounded-marca p-6 text-center">
            <div className="text-3xl mb-3">🏖️</div>
            <h3 className="font-semibold text-gray-900 mb-1.5">{RESTAURANTE.nome}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Na parte da frente, pé na areia, de frente para a Praia de Encantadas.</p>
          </div>

          <div className="flex sm:flex-col items-center justify-center gap-2 text-gray-300 py-2">
            <div className="h-px sm:h-full sm:w-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400 whitespace-nowrap px-2">anexada aos fundos</span>
            <div className="h-px sm:h-full sm:w-px flex-1 bg-gray-200" />
          </div>

          <div className="bg-white border border-gray-200 rounded-marca p-6 text-center shadow-marca">
            <div className="text-3xl mb-3">🛏️</div>
            <h3 className="font-semibold text-gray-900 mb-1.5">Pousada Marimar</h3>
            <p className="text-sm text-gray-600 leading-relaxed">As acomodações ficam logo atrás do restaurante, a poucos passos do trapiche.</p>
          </div>
        </div>
      </section>

      {/* ═══ DIFERENCIAIS ═══ */}
      <section className="bg-fundo-suave py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-marca font-medium text-sm">Por que a Marimar</span>
            <h2 className="font-titulo text-2xl lg:text-3xl font-bold text-gray-900 mt-2">O que está incluso na sua estadia</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DIFERENCIAIS.map((d) => (
              <div key={d.titulo} className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca">
                <div className="text-2xl mb-3">{d.icone}</div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1.5">{d.titulo}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{d.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ACOMODAÇÕES ═══ */}
      {quartosList.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="text-center mb-12">
            <span className="text-marca font-medium text-sm">Acomodações</span>
            <h2 className="font-titulo text-2xl lg:text-3xl font-bold text-gray-900 mt-2">Nossas suítes</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
              Todas com banheiro privativo, ar-condicionado e TV. Consulte a disponibilidade para ver as opções e tarifas das suas datas.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quartosList.map((q: any) => (
              <Link key={q.id} href={`/quartos/${q.slug}`} className="group bg-white rounded-marca shadow-marca hover:shadow-marca-forte transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col">
                <div className="relative h-52 overflow-hidden bg-marca-suave">
                  {q.foto ? (
                    <Image src={q.foto} alt={q.nome} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><span className="text-5xl opacity-40">🏨</span></div>
                  )}
                  {q.cat_nome && (
                    <span className="absolute top-3 left-3 bg-white/95 text-xs font-medium text-marca-ativa px-3 py-1 rounded-full shadow-sm">
                      {tituloQuarto(q.cat_nome)}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 group-hover:text-marca transition-marca">{tituloQuarto(q.nome)}</h3>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed flex-1">{resumir(q.descricao || q.descricao_motor, 110)}</p>
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    {q.cama && <span>🛏 {q.cama}</span>}
                    <span>👥 Até {q.ocupacao_max}</span>
                    {q.metragem && <span>{q.metragem}m²</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/quartos" className="inline-flex items-center gap-2 text-marca font-medium hover:text-marca-hover transition-marca">
              Ver todas as acomodações <span className="text-lg">→</span>
            </Link>
          </div>
        </section>
      )}

      {/* ═══ RESTAURANTE + CAFÉ ═══ */}
      <section className="bg-fundo-suave py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-marca p-7 border border-gray-100 shadow-marca">
            <span className="text-marca font-medium text-sm">Gastronomia</span>
            <h2 className="font-titulo text-xl lg:text-2xl font-bold text-gray-900 mt-2 mb-3">{RESTAURANTE.nome}</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{RESTAURANTE.posicao}</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">{RESTAURANTE.cardapioResumo}</p>
            <Link href="/restaurante" className="text-sm text-marca font-medium hover:text-marca-hover transition-marca">
              Conhecer o restaurante →
            </Link>
          </div>

          <div className="bg-white rounded-marca p-7 border border-gray-100 shadow-marca">
            <span className="text-marca font-medium text-sm">Incluso na diária</span>
            <h2 className="font-titulo text-xl lg:text-2xl font-bold text-gray-900 mt-2 mb-3">Café da manhã</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {CAFE_DA_MANHA.estilo}, servido das <strong>{CAFE_DA_MANHA.horario}</strong>.
            </p>
            <div className="flex flex-wrap gap-2">
              {CAFE_DA_MANHA.itens.map((i) => (
                <span key={i} className="text-xs bg-marca-sutil text-marca-ativa px-3 py-1 rounded-full">{i}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ AVALIAÇÕES ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="text-center mb-10">
          <span className="text-marca font-medium text-sm">Avaliações</span>
          <h2 className="font-titulo text-2xl lg:text-3xl font-bold text-gray-900 mt-2">O que dizem quem já ficou</h2>
          <p className="text-xs text-gray-400 mt-3">Notas consultadas em {AVALIACOES.consultadoEm} · sujeitas a alteração</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {AVALIACOES.plataformas.map((a) => (
            <div key={a.nome} className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca text-center">
              <p className="text-3xl font-bold text-marca">{a.nota.toString().replace(".", ",")}</p>
              <p className="text-xs text-gray-400 mb-2">de {a.escala}</p>
              <p className="text-sm font-medium text-gray-800">{a.nome}</p>
              <p className="text-xs text-gray-400">{a.total} avaliações</p>
            </div>
          ))}
        </div>

        <div className="bg-fundo-suave rounded-marca p-6 max-w-3xl mx-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Destaques por critério · Booking</p>
          <div className="space-y-2.5">
            {AVALIACOES.detalheBooking.map((d) => (
              <div key={d.criterio} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-32 shrink-0">{d.criterio}</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-marca rounded-full" style={{ width: `${d.nota * 10}%` }} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{d.nota.toString().replace(".", ",")}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LOCALIZAÇÃO ═══ */}
      <section className="bg-fundo-suave py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-marca font-medium text-sm">Localização</span>
            <h2 className="font-titulo text-2xl lg:text-3xl font-bold text-gray-900 mt-2 mb-4">A poucos passos do trapiche</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              A travessia da {TRAVESSIA.operadora} até <strong>{TRAVESSIA.destino}</strong> leva {TRAVESSIA.duracao}.
              Do trapiche, o percurso até a pousada é curto e feito a pé — não há circulação de veículos na ilha.
            </p>
            <div className="bg-white rounded-marca p-4 border border-gray-100 mb-5 text-sm">
              <p className="font-medium text-gray-800 mb-1">📍 {ENDERECO.completo}</p>
              <p className="text-gray-500 text-xs">Plus Code {ENDERECO.plusCode}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/como-chegar" className="bg-marca hover:bg-marca-hover text-white px-5 py-2.5 rounded-marca text-sm font-semibold transition-marca">
                Como chegar
              </Link>
              <a href={`https://www.google.com/maps/search/?api=1&query=${ENDERECO.lat},${ENDERECO.lng}`} target="_blank" rel="noopener noreferrer"
                className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-marca text-sm font-medium hover:bg-white transition-marca">
                Abrir no mapa
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {ATRACOES.filter((a) => a.destaque).map((a) => (
              <Link key={a.slug} href={`/ilha-do-mel#${a.slug}`} className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca hover:shadow-marca-forte transition-marca">
                <h3 className="font-semibold text-sm text-gray-900 mb-1.5">{a.nome}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{a.resumo}</p>
                {a.distanciaTexto && <p className="text-xs text-marca mt-2">{a.distanciaTexto}</p>}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="bg-gradient-to-r from-marca to-marca-ativa text-white py-16 lg:py-20 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-titulo text-2xl lg:text-4xl font-bold mb-4">Pronto para sua estadia em Encantadas?</h2>
          <p className="text-white/85 text-base lg:text-lg mb-8">
            Check-in a partir das {POLITICAS.checkIn} · Check-out até {POLITICAS.checkOut} · Café da manhã incluso
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/reservar" className="bg-white text-marca-ativa px-8 py-3.5 rounded-marca font-semibold hover:bg-gray-100 transition-marca">
              Consultar disponibilidade
            </Link>
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="border-2 border-white/50 text-white px-8 py-3.5 rounded-marca font-semibold hover:bg-white/10 transition-marca">
                💬 Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      {faqs.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="text-center mb-10">
            <h2 className="font-titulo text-2xl lg:text-3xl font-bold text-gray-900">Perguntas Frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f: any) => (
              <details key={f.id} className="group bg-white rounded-marca shadow-marca border border-gray-100">
                <summary className="px-6 py-4 font-medium text-gray-800 cursor-pointer hover:text-marca transition-marca list-none flex items-center justify-between gap-4">
                  {f.pergunta}
                  <span className="text-gray-300 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <p className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{f.resposta}</p>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/faq" className="text-sm text-marca font-medium hover:text-marca-hover transition-marca">
              Ver todas as dúvidas →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
