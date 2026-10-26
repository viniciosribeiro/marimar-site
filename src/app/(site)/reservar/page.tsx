import { fetchTarifas, validarConsulta, TIMEOUT_BUSCA } from "@/lib/worker";
import { buildDeepLink } from "@/lib/deeplink";
import { SeletorDatas } from "@/components/site/SeletorDatas";
import { FormularioBuscaDisponibilidade } from "@/components/site/FormularioBuscaDisponibilidade";
import { RolarParaResultados } from "@/components/site/RolarParaResultados";
import { tituloQuarto, resumir, brl, pluralizar, escassez, dataBR } from "@/lib/format";
import Link from "next/link";
import Image from "next/image";
import postgres from "postgres";
import { lerPousada, digitosWhatsApp } from "@/lib/pousada";
import { comSql } from "@/lib/db-conexao";
import {
  lerRegras, lerAdicionais, calcularOcupacao, regraAtiva, precoAdicional,
  REGRAS_PADRAO, type Adicional,
} from "@/lib/regras-hospedagem";

export const dynamic = "force-dynamic";
/* O motor demora em datas concorridas: a busca espera até 45 s (TIMEOUT_BUSCA). */
export const maxDuration = 60;

export default async function ReservarPage({ searchParams }: { searchParams: Promise<{ check_in?: string; check_out?: string; adultos?: string; criancas?: string; bebes?: string; ver_resultados?: string }> }) {
  const sp = await searchParams;
  const ci = sp.check_in; const co = sp.check_out;
  // Datas e hospedes passam pela mesma validacao das rotas de API: antes,
  // "adultos=abc" virava NaN e check-out antes do check-in ia ao motor.
  const v = ci && co ? validarConsulta({ checkIn: ci, checkOut: co, adultos: sp.adultos, criancas: sp.criancas, bebes: sp.bebes }) : null;
  const adultos = v?.ok ? v.consulta.adultos : 2;
  const criancas = v?.ok ? v.consulta.criancas : 0;
  const bebesInformados = v?.ok ? v.consulta.bebes : 0;

  /* A regra de crianças da pousada (configurada em Marina → Regras e
     adicionais) decide como a consulta vai ao motor: criança que não é de
     colo vai como adulto. É a MESMA conta que a Marina usa — antes o site
     mandava as crianças ao motor, que cobra por uma faixa etária que nem
     está configurada lá, e site e Marina davam preços diferentes. */
  const { regras, adicionais } = await comSql(async (sql) => ({
    regras: await lerRegras(sql),
    adicionais: (await lerAdicionais(sql)).filter((a) => a.visivelSite),
  })).catch(() => ({ regras: REGRAS_PADRAO, adicionais: [] as Adicional[] }));
  const temRegra = regraAtiva(regras);
  const noitesConsulta = v?.ok ? Math.round((Date.parse(v.consulta.checkOut) - Date.parse(v.consulta.checkIn)) / 86_400_000) : 0;
  const oc = calcularOcupacao({ adultos, criancas, bebes: bebesInformados, noites: noitesConsulta }, regras);
  const bebes = oc.bebes;
  let resultados: any[] = []; let erro = ""; let noites = 0; let whatsapp = "";
  let avisoCrianca = "";

  // O motor e a parte lenta: a consulta comeca antes do banco, em paralelo.
  const tarifas = v?.ok
    ? fetchTarifas(v.consulta.checkIn, v.consulta.checkOut, oc.adultosMotor, oc.criancasMotor, { timeoutMs: TIMEOUT_BUSCA })
    : null;
  tarifas?.catch(() => {}); // o erro e tratado no await abaixo

  // Ja lida pelo layout nesta mesma requisicao: nao abre outra conexao.
  // Sem o WhatsApp o botao some; a busca de quartos continua.
  const pousadaData = await lerPousada();
  whatsapp = digitosWhatsApp(pousadaData?.whatsapp);

  if (v && !v.ok) {
    erro = v.motivo === "ordem"
      ? "A data de saída precisa ser depois da data de entrada."
      : "Não entendemos as datas escolhidas. Escolha de novo no formulário abaixo.";
  }

  if (ci && co && tarifas) {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      noites = Math.round((new Date(co + "T12:00").getTime() - new Date(ci + "T12:00").getTime()) / 86400000);
      const data = await tarifas;
      // O aviso de faixa etária é do motor; com a regra da pousada aplicada ele não vale.
      avisoCrianca = oc.regraAplicada ? "" : data.aviso_crianca || "";
      const ids = [...data.quartos, ...data.indisponiveis].map(r => r.id);
      const locais = ids.length > 0 ? await sql`SELECT q.*, c.nome as cat_nome FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id WHERE q.desbravador_room_id = ANY(${ids})` : [];
      const map = new Map(locais.map((l: any) => [l.desbravador_room_id, l]));
      const quartoIds = locais.map((l: any) => l.id);
      const fotos = quartoIds.length > 0 ? await sql`SELECT * FROM midias WHERE quarto_id = ANY(${quartoIds}) AND tipo = 'foto' ORDER BY destaque DESC, ordem` : [];
      const fotosMap = new Map<string, any[]>();
      for (const f of fotos) { if (!fotosMap.has(f.quarto_id)) fotosMap.set(f.quarto_id, []); fotosMap.get(f.quarto_id)!.push(f); }

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
          totalFinal: (r.total_geral ?? r.total) + (oc.valorBebes ?? 0),
          valorBebes: oc.valorBebes ?? 0,
          deepLink: buildDeepLink({ checkIn: ci, checkOut: co, adultos: oc.adultosMotor, criancas: oc.criancasMotor }),
          whatsappUrl: whatsapp
            ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Gostaria de reservar:\n\n*Quarto:* ${nomeExibido}\n*Check-in:* ${dataBR(ci)}\n*Check-out:* ${dataBR(co)}\n*Noites:* ${noites}\n*Adultos:* ${adultos}${criancas > 0 ? `\n*Crianças:* ${criancas}` : ""}${bebes > 0 ? `\n*Bebês de colo:* ${bebes}` : ""}\n*Valor total:* ${brl((r.total_geral ?? r.total) + (oc.valorBebes ?? 0))}\n\nPodem verificar a disponibilidade?`)}`
            : null,
        };
      });
    } catch (e) {
      /* O motivo vai para os logs da Vercel (Logs → /reservar). */
      console.error("[reservar] busca falhou:", ci, co, (e as Error)?.message ?? e);
      erro = "Não conseguimos consultar a disponibilidade agora. Tente novamente em instantes ou fale com a gente no WhatsApp.";
    } finally {
      await sql.end();
    }
  }

  const disponiveis = resultados.filter(r => r.disponivel);
  const esgotados = resultados.filter(r => !r.disponivel);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <span className="inline-flex items-center gap-2 text-marca font-semibold text-[0.72rem] uppercase tracking-[0.24em]">
        <span className="h-px w-6 bg-marca/60" aria-hidden />Reservas
      </span>
      <h1 className="font-titulo text-[2.2rem] leading-tight lg:text-5xl font-bold text-tinta mt-3 mb-2">Disponibilidade</h1>
      <p className="text-tinta-suave mb-8">Tarifas em tempo real, direto com a pousada.</p>

      {/* Mesmo padrão da busca da home: campos largos e altos no celular (os
          seletores tinham a largura do número e eram difíceis de tocar). */}
      <FormularioBuscaDisponibilidade variante="reservar" className={`bg-white rounded-[calc(var(--raio)*1.5)] shadow-marca-forte border border-linha/60 p-4 sm:p-5 mb-10 grid grid-cols-2 ${temRegra ? "sm:grid-cols-6 max-w-5xl" : "sm:grid-cols-5 max-w-4xl"} gap-3`}>
        {/* Calendário de estadia: abre no mês da entrada; manda check_in e check_out como antes. */}
        <SeletorDatas variante="reservar" entradaInicial={ci} saidaInicial={co} />
        <label className="min-w-0">
          <span className="block text-xs font-medium text-tinta-suave mb-1 px-1">Adultos</span>
          <select name="adultos" defaultValue={adultos} className="w-full h-12 border border-linha rounded-xl px-3 text-[0.95rem] text-tinta bg-white focus:ring-2 focus:ring-marca outline-none"><option>1</option><option>2</option><option>3</option><option>4</option></select>
        </label>
        <label className="min-w-0">
          <span className="block text-xs font-medium text-tinta-suave mb-1 px-1">{temRegra ? `Crianças (${regras.idadeColoMax! + 1}+ anos)` : "Crianças"}</span>
          <select name="criancas" defaultValue={criancas} className="w-full h-12 border border-linha rounded-xl px-3 text-[0.95rem] text-tinta bg-white focus:ring-2 focus:ring-marca outline-none"><option>0</option><option>1</option><option>2</option><option>3</option></select>
        </label>
        {temRegra && (
          <label className="min-w-0">
            <span className="block text-xs font-medium text-tinta-suave mb-1 px-1">Bebês (até {regras.idadeColoMax} {regras.idadeColoMax === 1 ? "ano" : "anos"})</span>
            <select name="bebes" defaultValue={bebes} className="w-full h-12 border border-linha rounded-xl px-3 text-[0.95rem] text-tinta bg-white focus:ring-2 focus:ring-marca outline-none"><option>0</option><option>1</option><option>2</option></select>
          </label>
        )}
      </FormularioBuscaDisponibilidade>

      {/* A ancora so surge apos uma busca; nunca rolar a pagina ao abrir /reservar sem datas. */}
      {(ci && co) && (
        <div id="resultados-disponibilidade" className="scroll-mt-24 sm:scroll-mt-28" aria-label="Resultado da consulta de disponibilidade">
          <RolarParaResultados ativo={sp.ver_resultados === "1"} />
        </div>
      )}

      {erro && (
        <div className="text-red-700 bg-red-50 border border-red-100 p-4 rounded-lg mb-6">
          <p className="text-sm">{erro}</p>
          {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" className="inline-block mt-1 py-2.5 text-sm font-medium text-green-700 hover:underline">💬 Falar no WhatsApp</a>}
        </div>
      )}

      {ci && co && !erro && (
        <div>
          <p className="text-sm text-gray-500 mb-2">
            {pluralizar(noites, "noite")}: {dataBR(ci)} → {dataBR(co)} • {pluralizar(adultos, "adulto")}
            {criancas > 0 ? ` • ${pluralizar(criancas, "criança")}` : ""}
            {bebes > 0 ? ` • ${pluralizar(bebes, "bebê")} de colo` : ""}
          </p>
          {oc.explicacao && (
            <p className="text-sm text-marca-escura bg-marca-sutil border border-marca-borda rounded-lg px-4 py-3 mb-6">
              {oc.explicacao} Regra da pousada.
            </p>
          )}

          {avisoCrianca && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-6">
              ℹ️ {avisoCrianca}
            </p>
          )}

          {disponiveis.length > 0 && (
            <div className="mb-5 flex flex-col gap-1">
              <h2 className="font-titulo text-2xl font-bold text-tinta">
                {pluralizar(disponiveis.length, "tipo de suíte", "tipos de suíte")} {disponiveis.length === 1 ? "disponível" : "disponíveis"} para você
              </h2>
              <p className="text-sm text-tinta-suave">Confira as fotos, as tarifas e escolha sua acomodação.</p>
            </div>
          )}

          {resultados.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-3">Nenhum quarto disponível para essas datas.</p>
              {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" className="text-sm font-medium text-green-700 hover:underline">💬 Consultar outras datas no WhatsApp</a>}
            </div>
          ) : (
            <>
              {disponiveis.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6 mb-10">
                  {disponiveis.map((r: any) => <CardQuarto key={r.id} r={r} noites={noites} />)}
                </div>
              )}

              {esgotados.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Sem disponibilidade nessas datas
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
                    {esgotados.map((r: any) => <CardQuarto key={r.id} r={r} noites={noites} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {adicionais.length > 0 && <Adicionais itens={adicionais} destacarBebe={bebes > 0} />}
    </div>
  );
}

/**
 * Adicionais cadastrados em Marina → Regras e adicionais. Preço vem de lá;
 * sem preço, "sob consulta" — nunca um valor inventado.
 */
function Adicionais({ itens, destacarBebe }: { itens: Adicional[]; destacarBebe: boolean }) {
  const ordenados = destacarBebe ? [...itens].sort((a, b) => Number(b.categoria === "bebe") - Number(a.categoria === "bebe")) : itens;
  return (
    <section className="mt-4 border-t border-linha/60 pt-8">
      <h2 className="font-titulo text-2xl font-bold text-tinta">Adicionais para a sua estadia</h2>
      <p className="text-sm text-tinta-suave mt-1 mb-5">Peça na reserva ou pelo WhatsApp. Valores cobrados à parte.</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordenados.map((a) => (
          <li key={a.id} className="rounded-marca border border-linha/70 bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-tinta">{a.nome}</p>
              <p className="shrink-0 text-sm font-semibold text-marca">{precoAdicional(a)}</p>
            </div>
            {a.descricao && <p className="mt-1 text-sm text-tinta-suave leading-relaxed">{a.descricao}</p>}
            {a.precisaPedir && <p className="mt-2 text-xs text-tinta-suave">Pedir com antecedência</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardQuarto({ r, noites }: { r: any; noites: number }) {
  return (
    <article className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-linha/60 bg-white shadow-[0_5px_20px_-12px_rgba(13,49,55,0.35)] transition-shadow duration-200 hover:shadow-[0_12px_28px_-14px_rgba(13,49,55,0.30)] ${!r.disponivel ? "opacity-75" : ""}`}>
      <div className="relative aspect-[1.45] sm:aspect-[1.65] overflow-hidden bg-gradient-to-br from-marca-borda to-marca-suave">
        {r.fotoCapa ? (
          <Image
            src={r.fotoCapa}
            alt={r.nomeLocal}
            fill
            sizes="(max-width: 640px) 44vw, (max-width: 1024px) 45vw, (max-width: 1280px) 30vw, 23vw"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl sm:text-5xl" aria-label="Sem foto disponível">🏨</div>
        )}
        {r.alertaEstoque && (
          <span className="absolute bottom-2 left-2 right-2 w-fit max-w-[90%] rounded-md bg-amber-500/95 px-2 py-1 text-[10px] font-bold leading-tight text-white shadow sm:bottom-auto sm:top-3 sm:left-3 sm:right-auto sm:rounded-full sm:px-3 sm:text-xs">
            {r.alertaEstoque}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <div className="min-w-0">
          <h3 className="min-h-[2.5em] line-clamp-2 font-titulo text-[0.96rem] font-bold leading-[1.25] text-tinta sm:min-h-0 sm:text-xl">{r.nomeLocal}</h3>
          {r.catNome && (
            <span className="mt-1.5 inline-flex max-w-full truncate rounded-full bg-marca-sutil px-2 py-0.5 text-[10px] font-semibold text-marca-ativa sm:text-xs">
              {tituloQuarto(r.catNome)}
            </span>
          )}
          <p className="mt-2 text-[11px] leading-snug text-tinta-suave sm:text-sm">
            <span aria-hidden="true">👥 </span>Até {pluralizar(r.ocupacao_max, "pessoa")}
          </p>
          <p className="mt-2 hidden text-xs leading-relaxed text-tinta-suave sm:line-clamp-2">{resumir(r.descricaoLocal, 105)}</p>
          {r.cama && <p className="mt-1 hidden text-xs text-tinta-suave sm:block">🛏 {r.cama}{r.metragem ? ` · ${r.metragem}m²` : ""}</p>}
          {r.estadia_minima > 1 && <p className="mt-1 text-[10px] leading-snug text-amber-800 sm:text-xs">Mínimo: {pluralizar(r.estadia_minima, "noite")}</p>}
        </div>

        <div className="mt-auto pt-3">
          <div className="grid grid-cols-2 gap-1 border-t border-linha/70 pt-2.5 sm:gap-3 sm:pt-3">
            <div className="min-w-0">
              <p className="text-[10px] leading-tight text-tinta-suave sm:text-xs">Diária</p>
              <p className="mt-0.5 whitespace-nowrap text-[clamp(0.78rem,2.75vw,1.25rem)] font-bold leading-tight tracking-tight text-marca">{brl(r.diaria)}</p>
            </div>
            <div className="min-w-0 border-l border-linha/70 pl-1.5 sm:pl-3">
              <p className="whitespace-nowrap text-[9px] leading-tight text-tinta-suave sm:text-xs">Total {pluralizar(noites, "noite")}</p>
              <p className="mt-0.5 whitespace-nowrap text-[clamp(0.78rem,2.75vw,1.25rem)] font-extrabold leading-tight tracking-tight text-tinta">{brl(r.totalFinal)}</p>
            </div>
          </div>
          {r.valor_adulto > 0 && <p className="mt-1.5 text-[10px] leading-snug text-tinta-suave sm:text-xs">Adulto: {brl(r.valor_adulto)}/noite</p>}
          {r.valorBebes > 0 && <p className="mt-1 text-[10px] leading-snug text-tinta-suave sm:text-xs">Bebê de colo: {brl(r.valorBebes)} (à parte na pousada)</p>}
          {r.total_criancas > 0 && (
            <p className="mt-1 text-[10px] leading-snug text-tinta-suave sm:text-xs">
              Crianças: {brl(r.total_criancas)}
              {r.crianca_valor_variavel && r.valor_crianca_max ? ` (${brl(r.valor_crianca)}–${brl(r.valor_crianca_max)}/noite)` : ""}
            </p>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {!r.disponivel ? (
            <span className="block rounded-lg bg-gray-100 px-2 py-3 text-center text-xs leading-snug text-gray-600">
              {r.motivo_indisponivel ? r.motivo_indisponivel.charAt(0).toUpperCase() + r.motivo_indisponivel.slice(1) : "Esgotado no período"}
            </span>
          ) : r.avisoEstadia ? (
            <span className="block rounded-lg bg-amber-50 px-2 py-3 text-center text-xs leading-snug text-amber-800">
              Exige mínimo de {pluralizar(r.avisoEstadia, "noite")}
            </span>
          ) : (
            <>
              <a href={r.deepLink} target="_blank" rel="noopener noreferrer" aria-label={`Reservar ${r.nomeLocal} no site oficial`}
                className="flex min-h-10 items-center justify-center rounded-lg bg-marca px-2 py-2 text-center text-[12px] font-semibold text-marca-texto transition-colors hover:bg-marca-hover sm:min-h-11 sm:text-sm">
                Reservar
              </a>
              <div className="grid grid-cols-2 items-stretch gap-1.5 sm:gap-2">
                {r.whatsappUrl ? (
                  <a href={r.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={`Consultar ${r.nomeLocal} pelo WhatsApp`}
                    className="flex min-h-9 items-center justify-center rounded-lg border border-green-500 px-1 text-center text-[10px] font-semibold leading-none text-green-700 transition-colors hover:bg-green-50 sm:min-h-10 sm:text-xs">
                    WhatsApp
                  </a>
                ) : <span />}
                {r.slugLocal ? (
                  <Link href={`/quartos/${r.slugLocal}`} aria-label={`Ver detalhes do quarto ${r.nomeLocal}`}
                    className="flex min-h-9 items-center justify-center rounded-lg border border-marca/30 px-1 text-center text-[10px] font-semibold leading-none text-marca transition-colors hover:bg-marca-sutil sm:min-h-10 sm:text-xs">
                    Detalhes
                  </Link>
                ) : <span />}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
