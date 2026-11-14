import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchTarifas, validarConsulta, TIMEOUT_BUSCA, type Consulta, type WorkerResponse } from "@/lib/worker";
import { buildDeepLink, ROTULO_SISTEMA_DE_RESERVAS } from "@/lib/deeplink";
import { calcularOcupacao, type Ocupacao } from "@/lib/regras-hospedagem";
import { brl, dataBR, pluralizar, tituloQuarto } from "@/lib/format";
import { lerContato, lerPousada } from "@/lib/pousada";
import { Icone } from "@/components/site/Icone";
import { BuscaNovo, type BuscaInicial } from "../BuscaNovo";
import { BotaoMarina } from "../BotaoMarina";
import { acharNoMotor, tarifasDeReferencia, temDiaria } from "../tarifas";
import { CartaoSuiteNovo } from "./CartaoSuiteNovo";
import { GaleriaSuite } from "./GaleriaSuite";
import { BarraReserva, type AcaoBarra } from "./BarraReserva";
import { estadoDoPreco, hospedes, iconeDaComodidade, linhaCapacidade, paramsDaConsulta, periodo, type EstadoPreco } from "./preco";
import { DadosEstruturados } from "../DadosEstruturados";
import { noMigalhas, noSuite } from "@/lib/site-novo/dados-estruturados";
import { urlDoSite } from "@/lib/seo";
import { lerSuite, type Foto, type SuiteCompleta } from "./dados";

/**
 * /quartos/[slug] no site novo: fotos grandes, o que a suíte tem e, ao lado
 * (embaixo, no celular), o preço DAS DATAS da pessoa — a mesma consulta e a
 * mesma conta do /reservar (regra de crianças, total do motor + bebês) — e
 * "Reservar estas datas" com o roomCode da suíte (link aprovado no iPhone em
 * 28/10). Sem datas, um preço de referência dito como referência.
 *
 * As datas viajam no endereço (?check_in=…&check_out=…&adultos=…): dá para
 * compartilhar e voltar. A consulta ao motor começa antes de qualquer coisa
 * e chega por streaming (Suspense): a página aparece na hora.
 */
export type BuscaSuite = { check_in?: string; check_out?: string; adultos?: string; criancas?: string; bebes?: string };
type Resposta = { ok: boolean; dados?: WorkerResponse | null };

export async function SuiteNovo({ slug, busca }: { slug: string; busca: BuscaSuite }) {
  let lido: Awaited<ReturnType<typeof lerSuite>> | undefined;
  try {
    lido = await lerSuite(slug);
  } catch (e) {
    console.error("[SuiteNovo] banco indisponível:", (e as Error).message);
  }
  if (lido === null) notFound();
  if (!lido) return <BancoFora />;
  const { q, fotos, videos, comodidades, outras, regras } = lido;
  const nome = tituloQuarto(q.nome);

  const v = busca.check_in || busca.check_out
    ? validarConsulta({ checkIn: busca.check_in, checkOut: busca.check_out, adultos: busca.adultos, criancas: busca.criancas, bebes: busca.bebes })
    : null;
  const consulta = v?.ok ? v.consulta : null;
  const noites = consulta ? Math.round((Date.parse(consulta.checkOut) - Date.parse(consulta.checkIn)) / 86_400_000) : 0;
  const oc = consulta ? calcularOcupacao({ ...consulta, noites }, regras) : null;

  /* O motor é a parte lenta: começa já, e a página não espera por ele. */
  const resposta: Promise<Resposta> = consulta && oc
    ? fetchTarifas(consulta.checkIn, consulta.checkOut, oc.adultosMotor, oc.criancasMotor, { timeoutMs: TIMEOUT_BUSCA })
      .then((dados) => ({ ok: true, dados }), (e: unknown) => {
        console.error("[SuiteNovo] consulta ao motor falhou:", slug, consulta.checkIn, consulta.checkOut, (e as Error)?.message ?? e);
        return { ok: false };
      })
    : tarifasDeReferencia(2).then((dados) => ({ ok: !!dados, dados }));

  const pousada = await lerPousada();
  const contato = await lerContato(pousada);
  /* Sem foto própria, as do motor (mesma regra do Clássico); a sincronização traz para o painel. */
  const fotosGaleria: Foto[] = fotos.length ? fotos : await fotosDoMotor(resposta, q.desbravador_room_id, nome);

  const regraCriancas = regras.idadeColoMax !== null ? { idadeColoMax: regras.idadeColoMax } : null;
  const inicial: BuscaInicial = {
    checkIn: consulta?.checkIn ?? null, checkOut: consulta?.checkOut ?? null,
    adultos: consulta?.adultos ?? numero(busca.adultos), criancas: consulta?.criancas ?? numero(busca.criancas),
    bebes: consulta?.bebes ?? numero(busca.bebes),
  };
  const qs = consulta ? `?${paramsDaConsulta(consulta, regraCriancas !== null)}` : "";
  const erroDatas = v && !v.ok
    ? (v.motivo === "ordem" ? "A data de saída precisa ser depois da data de entrada." : "Não entendemos as datas escolhidas. Escolha de novo.")
    : null;

  const site = urlDoSite();
  return (
    <article className="pb-16 lg:pb-24">
      <DadosEstruturados nos={[
        noSuite(site, {
          slug: q.slug, nome, descricao: q.descricao?.trim() || q.descricao_motor, fotos: fotosGaleria.map((f) => f.url),
          ocupacaoMax: q.ocupacao_max, cama: q.cama, metragem: q.metragem, comodidades: comodidades.map((c) => c.nome),
        }),
        noMigalhas(site, [["Suítes", "/quartos"], [nome, `/quartos/${q.slug}`]]),
      ]} />
      <div className="sn-margem mx-auto max-w-[1240px] pt-3 lg:pt-6">
        <Link href="/quartos" className="inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] text-sn-texto-2 hover:text-sn-texto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
          Todas as suítes
        </Link>
      </div>

      <GaleriaSuite fotos={fotosGaleria} nome={nome} />

      <div className="sn-margem mx-auto mt-7 grid max-w-[1240px] grid-cols-1 gap-x-14 gap-y-8 [grid-template-areas:'titulo'_'preco'_'detalhes'] lg:mt-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:[grid-template-areas:'titulo_preco'_'detalhes_preco']">
        <header className="min-w-0 [grid-area:titulo]">
          <h1 className="sn-titulo-pagina">{nome}</h1>
          <p className="mt-3 text-[1.02rem] text-sn-texto-2">{linhaCapacidade(q)}</p>
        </header>

        <aside id="preco" aria-labelledby="sn-preco" data-sem-flutuante="celular" className="min-w-0 scroll-mt-[calc(var(--sn-topo)+1rem)] [grid-area:preco] lg:sticky lg:top-[calc(var(--sn-topo)+1.5rem)] lg:self-start">
          <div className="rounded-[20px] bg-white p-5 ring-1 ring-sn-linha shadow-[0_24px_50px_-34px_rgb(14_42_62/0.45)] sm:p-6">
            <h2 id="sn-preco" className="sr-only">Preço e reserva</h2>
            {erroDatas && <p role="alert" className="mb-4 rounded-xl bg-sn-areia/70 px-3.5 py-2.5 text-[0.95rem]">{erroDatas}</p>}
            <Suspense fallback={<Carregando comDatas={!!consulta} />}>
              <PainelPreco q={q} nome={nome} consulta={consulta} noites={noites} oc={oc} resposta={resposta}
                whatsapp={contato.whatsappDigitos} qs={qs} />
            </Suspense>
            <div id="datas" className="mt-5 scroll-mt-[calc(var(--sn-topo)+1rem)] border-t border-sn-linha pt-5">
              {consulta ? (
                <details className="sn-trocar group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                    Trocar datas ou hóspedes
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden className="transition-transform group-open:rotate-180"><polyline points="6 9 12 15 18 9" /></svg>
                  </summary>
                  <div className="pt-3"><FormularioDatas slug={q.slug} regra={regraCriancas} inicial={inicial} titulo="Novas datas" /></div>
                </details>
              ) : (
                <FormularioDatas slug={q.slug} regra={regraCriancas} inicial={inicial} titulo="Quando você vem?" />
              )}
            </div>
            {pousada?.chat_ativo && (
              <p className="mt-4 text-center text-[0.95rem]">
                <BotaoMarina className="sn-link min-h-11 px-2">Tirar dúvidas com a Marina</BotaoMarina>
              </p>
            )}
          </div>
        </aside>

        <div className="min-w-0 [grid-area:detalhes]">
          <Detalhes q={q} comodidades={comodidades} />
          {videos.length > 0 && (
            <section aria-labelledby="sn-videos" className="mt-12">
              <h2 id="sn-videos" className="sn-h3">Vídeos da suíte</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {videos.map((vid) => (
                  <li key={vid.id}>
                    <figure className="overflow-hidden rounded-[14px] bg-white ring-1 ring-sn-linha">
                      {/* preload="none": o vídeo só baixa quando a pessoa aperta play. */}
                      <video src={vid.url} poster={vid.thumb_url ?? undefined} controls playsInline preload="none"
                        className="aspect-video w-full bg-sn-mar object-cover" aria-label={vid.titulo ?? vid.alt} />
                      {(vid.titulo || vid.descricao) && (
                        <figcaption className="p-3.5">
                          {vid.titulo && <p className="font-semibold">{vid.titulo}</p>}
                          {vid.descricao && <p className="mt-0.5 text-[0.92rem] leading-relaxed text-sn-texto-2">{vid.descricao}</p>}
                        </figcaption>
                      )}
                    </figure>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {outras.length > 0 && (
        <section aria-labelledby="sn-outras" className="sn-margem mx-auto mt-20 max-w-[1240px] lg:mt-28">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2 id="sn-outras" className="sn-h2">Outras suítes</h2>
            <Link href="/quartos" className="sn-link text-[0.98rem]">Ver todas</Link>
          </div>
          <p className="mt-3 max-w-[40rem] text-[0.93rem] text-sn-texto-2">
            {consulta
              ? "Preços para as mesmas datas e hóspedes."
              : "Preço por noite para 2 adultos, consultado agora para daqui a uma semana."}
          </p>
          <ul className="sn-trilho -mx-4 mt-7 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-x-8 lg:overflow-visible lg:px-0">
            {outras.map((o) => (
              <li key={o.id} className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
                <CartaoSuiteNovo q={o} consulta={qs} precos={consulta ? resposta : undefined}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 44vw, 78vw" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/* ── o preço ──────────────────────────────────────────────────────── */

async function PainelPreco({ q, nome, consulta, noites, oc, resposta, whatsapp, qs }: {
  q: SuiteCompleta; nome: string; consulta: Consulta | null; noites: number; oc: Ocupacao | null;
  resposta: Promise<Resposta>; whatsapp: string; qs: string;
}) {
  const r = await resposta;
  const wa = (texto: string) => (whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}` : null);

  /* Sem datas: a referência, dita como referência. */
  if (!consulta || !oc) {
    const ref = r.ok ? acharNoMotor(r.dados ?? null, q.desbravador_room_id) : null;
    const barra: AcaoBarra = { href: "#datas", rotulo: "Escolher datas" };
    return (
      <>
        {temDiaria(ref) ? (
          <>
            <p className="text-[0.95rem] text-sn-texto-2">A partir de</p>
            <p className="mt-0.5"><span className="font-titulo text-[2.1rem] leading-none tabular-nums">{brl(ref.diaria)}</span> <span className="text-sn-texto-2">por noite</span></p>
            <p className="mt-2.5 text-[0.9rem] leading-relaxed text-sn-texto-2">
              Para 2 adultos, consultado agora para daqui a uma semana. Escolha as datas para ver o preço exato e reservar.
            </p>
          </>
        ) : (
          <p className="text-[1.02rem] leading-relaxed">Escolha as datas para ver o preço e a vaga desta suíte, direto do sistema de reservas da pousada.</p>
        )}
        <BarraReserva titulo={temDiaria(ref) ? `${brl(ref.diaria)} por noite` : nome}
          detalhe={temDiaria(ref) ? "Referência. Escolha as datas." : "Escolha as datas para ver o preço."} acao={barra} />
      </>
    );
  }

  const quem = hospedes(consulta);
  const resumo = `${periodo(consulta.checkIn, consulta.checkOut)}, ${pluralizar(noites, "noite")}, ${quem}`;
  const estado: EstadoPreco = estadoDoPreco(r.ok ? acharNoMotor(r.dados ?? null, q.desbravador_room_id) : null, {
    noites, hospedesNoMotor: oc.adultosMotor + oc.criancasMotor, valorBebes: oc.valorBebes, falhou: !r.ok,
  });
  const outrasSuites = `/reservar${qs}${qs ? "&" : "?"}ver_resultados=1`;
  const pergunta = wa(`Olá! Tenho interesse na suíte *${nome}* de ${dataBR(consulta.checkIn)} a ${dataBR(consulta.checkOut)} (${quem}). Vocês têm disponibilidade?`);

  if (estado.tipo === "ok") {
    const link = buildDeepLink({
      checkIn: consulta.checkIn, checkOut: consulta.checkOut,
      adultos: oc.adultosMotor, criancas: oc.criancasMotor, quartoId: q.desbravador_room_id,
    });
    const reservarWa = wa(`Olá! Gostaria de reservar:\n\n*Quarto:* ${nome}\n*Check-in:* ${dataBR(consulta.checkIn)}\n*Check-out:* ${dataBR(consulta.checkOut)}\n*Noites:* ${noites}\n*Adultos:* ${consulta.adultos}${consulta.criancas > 0 ? `\n*Crianças:* ${consulta.criancas}` : ""}${oc.bebes > 0 ? `\n*Bebês de colo:* ${oc.bebes}` : ""}\n*Valor total:* ${brl(estado.total)}\n\nPodem verificar a disponibilidade?`);
    return (
      <>
        <p className="text-[0.93rem] text-sn-texto-2">{resumo}</p>
        <p className="mt-2"><span className="font-titulo text-[2.1rem] leading-none tabular-nums">{brl(estado.diaria)}</span> <span className="text-sn-texto-2">por noite</span></p>
        <p className="mt-1.5 text-[1.02rem]">Total de {pluralizar(noites, "noite")}: <strong className="font-semibold tabular-nums">{brl(estado.total)}</strong></p>
        {estado.valorBebes > 0 && (
          <p className="mt-1 text-[0.88rem] text-sn-texto-2">Inclui {brl(estado.valorBebes)} de bebê de colo, pago à parte na pousada.</p>
        )}
        {oc.explicacao && <p className="mt-1 text-[0.88rem] text-sn-texto-2">{oc.explicacao} Regra da pousada.</p>}
        <ul className="mt-3 space-y-1 text-[0.92rem]">
          {estado.escassez && <li className="font-medium text-sn-mata">{estado.escassez}</li>}
          {estado.estadiaMinima && <li>Estadia mínima de {pluralizar(estado.estadiaMinima, "noite")} nestas datas.</li>}
          {estado.pacote && <li className="text-sn-texto-2">Tarifa: {estado.pacote}</li>}
        </ul>
        <a href={link} target="_blank" rel="noopener noreferrer" className="sn-botao mt-5 w-full rounded-xl"
          aria-label={`Reservar estas datas: ${nome}, ${dataBR(consulta.checkIn)} a ${dataBR(consulta.checkOut)}`}>
          Reservar estas datas
        </a>
        <p className="mt-2 text-center text-[0.84rem] text-sn-texto-2">A reserva termina no sistema de reservas da pousada.</p>
        {reservarWa && <a href={reservarWa} target="_blank" rel="noopener noreferrer" className="sn-botao-linha mt-3 w-full rounded-xl">Perguntar no WhatsApp</a>}
        <BarraReserva titulo={`${brl(estado.diaria)} por noite`} detalhe={`Total de ${pluralizar(noites, "noite")}: ${brl(estado.total)}`}
          acao={{ href: link, rotulo: "Reservar", externo: true }} />
      </>
    );
  }

  const texto = {
    nao_comporta: estado.tipo === "nao_comporta" && estado.capacidade
      ? `Esta suíte é para até ${pluralizar(estado.capacidade, "pessoa")}. Veja as suítes livres para ${quem} nestas datas.`
      : `Esta suíte não acomoda ${quem}. Veja as suítes livres nestas datas.`,
    esgotada: "Sem vaga nesta suíte nestas datas. Veja as suítes livres para o mesmo período.",
    sem_tarifa: "O sistema de reservas não publicou tarifa desta suíte para estas datas. Veja as outras suítes ou pergunte à pousada.",
    fora_do_motor: "O sistema de reservas não trouxe esta suíte para estas datas. Veja as suítes livres ou pergunte à pousada.",
    erro: "Não conseguimos mostrar o preço aqui agora. Veja o preço desta suíte para as suas datas direto no sistema de reservas da pousada ou fale com a gente.",
  }[estado.tipo];
  const tentarDeNovo = `/quartos/${q.slug}${qs}#preco`;
  /* Falha da consulta (14/11/2026): o caminho direto, já nesta suíte e nas datas. */
  const linkMotor = estado.tipo === "erro"
    ? buildDeepLink({ checkIn: consulta.checkIn, checkOut: consulta.checkOut, adultos: oc.adultosMotor, criancas: oc.criancasMotor, quartoId: q.desbravador_room_id })
    : "";
  return (
    <>
      <p className="text-[0.93rem] text-sn-texto-2">{resumo}</p>
      <p role="status" className="mt-2 text-[1.04rem] leading-relaxed">{texto}</p>
      <div className="mt-4 grid gap-3">
        {estado.tipo === "erro"
          ? <a href={linkMotor} target="_blank" rel="noopener noreferrer" data-link-motor className="sn-botao w-full rounded-xl">{ROTULO_SISTEMA_DE_RESERVAS}</a>
          : <Link href={outrasSuites} className="sn-botao w-full rounded-xl">Ver as suítes livres</Link>}
        {pergunta && <a href={pergunta} target="_blank" rel="noopener noreferrer" className="sn-botao-linha w-full rounded-xl">Perguntar no WhatsApp</a>}
        {estado.tipo === "erro" && <a href={tentarDeNovo} className="sn-botao-linha w-full rounded-xl">Tentar de novo</a>}
      </div>
      <BarraReserva
        titulo={estado.tipo === "erro" ? "Não deu para consultar agora" : estado.tipo === "esgotada" ? "Sem vaga nestas datas" : estado.tipo === "nao_comporta" ? "Não acomoda o grupo" : "Sem preço nestas datas"}
        detalhe={resumo}
        acao={estado.tipo === "erro" ? { href: linkMotor, rotulo: "Ver no sistema", externo: true } : { href: outrasSuites, rotulo: "Ver livres" }} />
    </>
  );
}

function Carregando({ comDatas }: { comDatas: boolean }) {
  return (
    <div role="status" aria-live="polite">
      <p className="text-[1.02rem]">{comDatas ? "Consultando o preço e a vaga para as suas datas…" : "Consultando o preço desta suíte…"}</p>
      <div aria-hidden className="mt-3 h-9 w-40 animate-pulse rounded-lg bg-sn-areia motion-reduce:animate-none" />
      <div aria-hidden className="mt-2 h-4 w-56 animate-pulse rounded bg-sn-areia motion-reduce:animate-none" />
    </div>
  );
}

function FormularioDatas({ slug, regra, inicial, titulo }: {
  slug: string; regra: { idadeColoMax: number } | null; inicial: BuscaInicial; titulo: string;
}) {
  return (
    <BuscaNovo regra={regra} estilo="plano" action={`/quartos/${slug}#preco`} titulo={titulo} inicial={inicial} nota={null}
      rotuloBotao="Ver o preço destas datas"
      espera={{ titulo: "Consultando esta suíte", texto: "Estamos conferindo o preço e a vaga para as suas datas." }} />
  );
}

/* ── o que a suíte tem ───────────────────────────────────────────── */

function Detalhes({ q, comodidades }: { q: SuiteCompleta; comodidades: { id: string; nome: string }[] }) {
  const ficha: [string, string][] = [["Hóspedes", `Até ${pluralizar(q.ocupacao_max, "pessoa")}`]];
  if (q.cama?.trim()) ficha.push(["Cama", q.cama.trim()]);
  const m = Number(q.metragem);
  if (Number.isFinite(m) && m > 0) ficha.push(["Tamanho", `${m.toLocaleString("pt-BR")} m²`]);
  if (q.vista?.trim()) ficha.push(["Vista", q.vista.trim()]);
  if (q.cat_nome?.trim()) ficha.push(["Categoria", q.cat_nome.trim()]);
  const textoMotor = q.descricao_motor?.trim();
  const texto = q.descricao?.trim();

  return (
    <>
      {(texto || textoMotor) && (
        <div className="max-w-[40rem] space-y-4 text-[1.04rem] leading-relaxed">
          {texto && <p className="whitespace-pre-line break-words">{texto}</p>}
          {textoMotor && textoMotor !== texto && <p className="whitespace-pre-line break-words text-sn-texto-2">{textoMotor}</p>}
        </div>
      )}
      <dl className={`grid max-w-[40rem] grid-cols-2 gap-x-6 gap-y-4 border-y border-sn-linha py-5 ${texto || textoMotor ? "mt-8" : ""}`}>
        {ficha.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[0.88rem] text-sn-texto-2">{k}</dt>
            <dd className="mt-0.5 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {comodidades.length > 0 && (
        <section aria-labelledby="sn-comodidades" className="mt-10">
          <h2 id="sn-comodidades" className="sn-h3">O que tem na suíte</h2>
          <ul className="mt-4 grid max-w-[40rem] grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {comodidades.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 leading-snug">
                <Icone nome={iconeDaComodidade(c.nome)} tamanho={20} className="mt-0.5 shrink-0 text-sn-mare-texto" />
                <span>{c.nome}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function BancoFora() {
  return (
    <div className="sn-margem mx-auto max-w-[1240px] py-16">
      <h1 className="sn-titulo-pagina">Suíte</h1>
      <p className="mt-4 max-w-[36rem] text-[1.05rem]">Não conseguimos carregar esta suíte agora. Tente de novo em instantes.</p>
      <Link href="/quartos" className="sn-botao mt-6">Ver todas as suítes</Link>
    </div>
  );
}

/* ── auxiliares ──────────────────────────────────────────────────── */

async function fotosDoMotor(resposta: Promise<Resposta>, codigo: string | null, nome: string): Promise<Foto[]> {
  const r = await resposta;
  const m = r.ok ? acharNoMotor(r.dados ?? null, codigo) : null;
  return (m?.fotos ?? []).filter((u) => typeof u === "string" && !!u).map((url) => ({ url, alt: nome }));
}

const numero = (s: string | undefined) => {
  const n = Number.parseInt(s ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
};

