import Link from "next/link";
import Image from "next/image";
import { tituloQuarto, resumir } from "@/lib/format";
import { CarrosselBanners, BuscaNoCelular } from "./CarrosselBanners";
import type { Banner } from "@/lib/banners";
import { IconeCirculo, Icone, OndaTitulo } from "./Icone";
import { BuscaHome } from "./BuscaHome";
import { Manuscrita } from "./ui";
import { FolhaPalmeira, OndaDivisor } from "./Tropical";
import type { ItemBloco } from "@/lib/blocos";
import {
  COMPLEXO, DIFERENCIAIS, DESTAQUES_TOPO, CAFE_DA_MANHA, RESTAURANTE,
  AVALIACOES, ATRACOES, POLITICAS, ENDERECO, TRAVESSIA,
} from "@/lib/conteudo-pousada";

/**
 * Cada secao da home e um bloco, ligado a uma linha de `blocos_home`.
 *
 * A home busca os blocos ativos por ordem e renderiza cada um pelo `tipo`.
 * Titulo e subtitulo vem do banco, com o texto atual como padrao quando o
 * campo estiver vazio. Os DADOS de cada secao continuam vindo de onde
 * devem: quartos do banco, fatos do conteudo canonico, fotos por secao.
 *
 * Visual (28/09/2026): tropical e editorial — fotos grandes no lugar de
 * cartoes brancos repetidos, ondas entre as secoes, folhagem desenhada em
 * SVG nas cores do tema. Tudo usa os tokens do editor visual (marca,
 * acento, areia, tinta, raio): trocar a cor no painel troca a home inteira.
 */

export type Bloco = {
  id: string;
  tipo: string;
  titulo: string | null;
  subtitulo: string | null;
  imagem_url: string | null;
};

export type DadosHome = {
  pousada: any;
  quartos: any[];
  faqs: any[];
  heroUrl: string | null;
  heroAlt: string | null;
  wa: string;
  /** Cadastrados em Admin → Banners do topo. Vazio = comportamento antigo. */
  banners: Banner[];
  /** Cartões de cada bloco, por tipo. Vazio = valem as constantes. */
  itens: Record<string, ItemBloco[]>;
  /** Até 3 pacotes ativos, para a aba de ofertas da busca. */
  pacotes: { slug: string; nome: string; resumo: string | null }[];
  /** Foto principal de cada seção (Admin → Fotos): pousada, restaurante, café, praia. */
  fotos?: Partial<Record<string, { url: string; alt: string }>>;
};

export function RenderBloco({ bloco, dados }: { bloco: Bloco; dados: DadosHome }) {
  const t = bloco.titulo?.trim() || null;
  const s = bloco.subtitulo?.trim() || null;

  switch (bloco.tipo) {
    case "hero":        return <Hero b={{ t, s, img: bloco.imagem_url }} d={dados} />;
    case "complexo":    return <Complexo t={t} s={s} itens={dados.itens.complexo ?? []} d={dados} />;
    case "diferenciais":return <Diferenciais t={t} s={s} itens={dados.itens.diferenciais ?? []} />;
    case "quartos":     return <Quartos t={t} s={s} d={dados} />;
    case "restaurante": return <Restaurante t={t} s={s} d={dados} />;
    case "avaliacoes":  return <Avaliacoes t={t} s={s} />;
    case "mapa":        return <Mapa t={t} s={s} />;
    case "cta":         return <Cta t={t} s={s} d={dados} />;
    case "faq":         return <Faq t={t} s={s} d={dados} />;
    case "sobre":       return <Sobre t={t} s={s} />;
    case "galeria":     return <ChamadaGaleria t={t} s={s} />;
    case "pacotes":     return <ChamadaSimples t={t ?? "Pacotes"} s={s ?? "Ofertas especiais para a sua estadia."} href="/pacotes" cta="Ver pacotes" />;
    case "passeios":    return <ChamadaSimples t={t ?? "Passeios"} s={s ?? "Trilhas e experiências na Ilha do Mel."} href="/ilha-do-mel" cta="Explorar a ilha" />;
    // "depoimentos" nao renderiza: o briefing proibe depoimento sem
    // identificar a plataforma de origem. Use o bloco "avaliacoes".
    default: return null;
  }
}

/* ══════════════ pecas comuns ══════════════ */

/** Raio dos cartoes grandes: o dobro do raio do tema, para acompanhar o editor. */
const RAIO_G = "rounded-[calc(var(--raio)*2)]";

function Cabecalho({
  sobre, titulo, texto, alinhar = "centro", claro = false,
}: { sobre?: string; titulo: string; texto?: string | null; alinhar?: "centro" | "esquerda"; claro?: boolean }) {
  const centro = alinhar === "centro";
  return (
    <div className={`mb-10 lg:mb-14 ${centro ? "text-center" : ""}`}>
      {sobre && (
        <span className={`inline-flex items-center gap-2 font-semibold text-[0.72rem] uppercase tracking-[0.24em] ${claro ? "text-white/85" : "text-marca"}`}>
          <span className={`h-px w-6 ${claro ? "bg-white/60" : "bg-marca/60"}`} aria-hidden />
          {sobre}
          {centro && <span className={`h-px w-6 ${claro ? "bg-white/60" : "bg-marca/60"}`} aria-hidden />}
        </span>
      )}
      <h2 className={`font-titulo text-[1.9rem] leading-[1.1] sm:text-4xl lg:text-[2.9rem] font-bold mt-3 text-balance ${claro ? "text-white" : "text-tinta"}`}>
        {titulo}
      </h2>
      <OndaTitulo className={`mt-4 ${centro ? "mx-auto" : ""}`} />
      {texto && (
        <p className={`mt-4 text-[0.95rem] sm:text-base leading-relaxed max-w-2xl ${centro ? "mx-auto" : ""} ${claro ? "text-white/80" : "text-tinta-suave"}`}>
          {texto}
        </p>
      )}
    </div>
  );
}

function BotaoPilula({
  href, children, variante = "solido", externo = false,
}: { href: string; children: React.ReactNode; variante?: "solido" | "claro" | "contorno" | "contorno-claro"; externo?: boolean }) {
  const cls = {
    solido: "bg-marca text-marca-texto hover:bg-marca-hover shadow-marca",
    claro: "bg-white text-tinta hover:bg-white/90 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)]",
    contorno: "border border-tinta/20 text-tinta hover:bg-white",
    "contorno-claro": "border border-white/60 text-white hover:bg-white/15 backdrop-blur-sm",
  }[variante];
  const comum = `inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-sm sm:text-[0.95rem] font-semibold transition-marca ${cls}`;
  return externo
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={comum}>{children}</a>
    : <Link href={href} className={comum}>{children}</Link>;
}

/** Fundo de reserva quando a seção ainda não tem foto: degradê do tema com folhagem. */
function FundoSemFoto({ tom = "marca" }: { tom?: "marca" | "acento" }) {
  return (
    <div className={`absolute inset-0 ${tom === "marca" ? "bg-gradient-to-br from-marca via-marca-hover to-marca-escura" : "bg-gradient-to-br from-acento via-acento-hover to-tinta"}`}>
      <FolhaPalmeira className="absolute -right-10 -top-6 w-72 text-white/15 rotate-[25deg]" />
      <FolhaPalmeira className="absolute -left-16 -bottom-16 w-64 text-white/10 -rotate-[150deg]" />
    </div>
  );
}

/* ══════════════ HERO ══════════════ */
function Hero({ b, d }: { b: { t: string | null; s: string | null; img: string | null }; d: DadosHome }) {
  const img = b.img || d.heroUrl;
  const nome = b.t || d.pousada?.nome || "Pousada Marimar";

  /* A busca é a MESMA nos dois caminhos: com banners cadastrados ela vai por
     cima do carrossel; sem banners, fica sobre a foto única. Duplicá-la
     acabaria com dois formulários de disponibilidade divergentes. */
  const busca = (
    <div className="mt-8">
      <BuscaHome pacotes={d.pacotes} />
    </div>
  );

  if (d.banners.length > 0) {
    return <CarrosselBanners banners={d.banners}>{busca}</CarrosselBanners>;
  }

  return (
    <>
      <section
        data-topo-imersivo
        className="relative isolate text-white overflow-hidden min-h-[34rem] sm:min-h-[44rem] flex items-center"
        style={{ marginTop: "calc(-1 * var(--altura-topo))", paddingTop: "calc(var(--altura-topo) + 2rem)", paddingBottom: "5rem" }}
      >
        {img ? (
          <>
            <Image src={img} alt={d.heroAlt || nome} fill priority sizes="100vw" className="object-cover -z-10 anim-ken-burns" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/30 to-black/65" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10"><FundoSemFoto /></div>
        )}

        <div className="relative w-full max-w-5xl mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-2 text-white/90 text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.28em] mb-5">
            Encantadas · Ilha do Mel · Paraná
          </span>
          <h1 className="font-titulo text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-7xl font-bold text-white drop-shadow-[0_2px_20px_rgb(0_0_0/0.35)] text-balance">
            {nome}
          </h1>
          <Manuscrita tamanho="lg" className="block text-white/95 mt-2">sem pressa, na Ilha do Mel</Manuscrita>
          <p className="text-base lg:text-lg text-white/90 mt-5 max-w-2xl mx-auto leading-relaxed">
            {b.s || COMPLEXO.fraseLonga}
          </p>

          <ul className="hidden sm:flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-white/90 text-sm">
            {DESTAQUES_TOPO.map((x) => (
              <li key={x.texto} className="flex items-center gap-2">
                <span className="text-white/70" aria-hidden><Icone nome={x.icone} tamanho={17} /></span>
                {x.texto}
              </li>
            ))}
          </ul>

          {/* No celular a busca vai abaixo da foto (BuscaNoCelular). */}
          <div className="hidden sm:block">{busca}</div>
        </div>

        <OndaDivisor className="absolute bottom-0 inset-x-0 text-fundo" />
      </section>
      <BuscaNoCelular>{busca}</BuscaNoCelular>
    </>
  );
}

/* ══════════════ A POUSADA (bloco "complexo") ══════════════ */
function Complexo({ t, s, itens, d }: { t: string | null; s: string | null; itens: ItemBloco[]; d: DadosHome }) {
  /* Sem itens cadastrados valem os dois cartões do conteúdo canônico. A
     POUSADA vem primeiro: ela é a protagonista, e o restaurante é dela
     (decisão de 28/09/2026 — ver COMPLEXO em conteudo-pousada.ts). */
  const cartoes: ItemBloco[] = itens.length
    ? itens
    : [
        {
          id: "pousada", icone: "cama", cor: "mata",
          titulo: "Pousada Marimar",
          texto: "Suítes climatizadas com café da manhã incluso, a poucos passos do trapiche de Encantadas. Administração familiar e atendimento acolhedor.",
          imagem_url: d.fotos?.pousada?.url ?? null, href: "/quartos", cta_texto: "Conheça as suítes",
        },
        {
          id: "restaurante", icone: "talheres", cor: "coral",
          titulo: RESTAURANTE.nome,
          texto: "O restaurante da pousada, pé na areia, de frente para a Praia de Encantadas. Peixes, camarões, drinks e o melhor visual da ilha.",
          imagem_url: d.fotos?.restaurante?.url ?? null, href: "/restaurante", cta_texto: "Conheça o restaurante",
        },
      ];

  const [principal, segundo, ...resto] = cartoes;

  return (
    <section className="relative secao-py overflow-hidden">
      <FolhaPalmeira className="hidden lg:block absolute -left-24 top-10 w-80 text-marca/[0.06] -rotate-[30deg] pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Cabecalho sobre={s || "A pousada"} titulo={t || "Hospedagem com restaurante pé na areia"} />

        <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
          {principal && <CartaoFoto item={principal} rotulo="Hospedagem" className="lg:col-span-7 min-h-[26rem] lg:min-h-[34rem]" />}
          {segundo && <CartaoFoto item={segundo} rotulo="Gastronomia" tom="acento" className="lg:col-span-5 min-h-[22rem] lg:min-h-[34rem]" />}
        </div>

        {resto.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-5">
            {resto.map((i) => <CartaoFoto key={i.id} item={i} className="min-h-[18rem]" />)}
          </div>
        )}
      </div>
    </section>
  );
}

/** Cartão com a foto de fundo e o texto por cima — o formato "revista". */
function CartaoFoto({
  item, rotulo, tom = "marca", className = "",
}: { item: ItemBloco; rotulo?: string; tom?: "marca" | "acento"; className?: string }) {
  const conteudo = (
    <>
      {item.imagem_url ? (
        <>
          <Image src={item.imagem_url} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
        </>
      ) : (
        <FundoSemFoto tom={tom} />
      )}

      <div className="relative mt-auto p-6 sm:p-8 lg:p-10 text-white">
        {rotulo && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
            {item.icone && <Icone nome={item.icone} tamanho={14} />}
            {rotulo}
          </span>
        )}
        <h3 className="font-titulo text-3xl sm:text-4xl font-bold text-white mt-4 text-balance">{item.titulo}</h3>
        {item.texto && <p className="text-white/85 text-[0.95rem] leading-relaxed mt-3 max-w-lg">{item.texto}</p>}
        {item.href && item.cta_texto && (
          <span className="inline-flex items-center gap-2 mt-6 h-11 px-5 rounded-full bg-white text-tinta text-sm font-semibold transition-all group-hover:gap-3">
            {item.cta_texto} <span aria-hidden>→</span>
          </span>
        )}
      </div>
    </>
  );

  const cls = `group relative isolate flex flex-col overflow-hidden ${RAIO_G} shadow-[0_30px_60px_-30px_rgb(18_50_79/0.55)] ${className}`;
  return item.href
    ? <Link href={item.href} className={cls}>{conteudo}</Link>
    : <article className={cls}>{conteudo}</article>;
}

/* ══════════════ DIFERENCIAIS ══════════════ */
function Diferenciais({ t, s, itens }: { t: string | null; s: string | null; itens: ItemBloco[] }) {
  const cartoes: ItemBloco[] = itens.length
    ? itens
    : DIFERENCIAIS.map((d, i) => ({
        id: String(i), icone: d.icone, cor: d.cor, titulo: d.titulo, texto: d.texto,
        imagem_url: null, href: null, cta_texto: null,
      }));

  return (
    <section className="relative bg-areia overflow-hidden">
      <OndaDivisor virada className="text-fundo" />
      <FolhaPalmeira className="absolute -right-20 top-16 w-96 text-marca/[0.07] rotate-[30deg] pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <Cabecalho sobre={s || "Por que a Marimar"} titulo={t || "O que está incluso na sua estadia"} />
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-8 lg:gap-y-12">
          {cartoes.map((d) => (
            <li key={d.id} className="text-center sm:text-left">
              <div className="flex justify-center sm:justify-start">
                <span className="rounded-full bg-white p-1.5 shadow-marca">
                  <IconeCirculo nome={d.icone || "check"} cor={d.cor} tamanho={48} />
                </span>
              </div>
              <h3 className="font-titulo font-semibold text-tinta text-[0.98rem] sm:text-lg leading-snug mt-4">{d.titulo}</h3>
              {d.texto && (
                <p className="hidden sm:block text-sm text-tinta-suave leading-relaxed mt-2">{d.texto}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <OndaDivisor className="text-fundo" />
    </section>
  );
}

/* ══════════════ QUARTOS ══════════════ */
function Quartos({ t, s, d }: { t: string | null; s: string | null; d: DadosHome }) {
  if (d.quartos.length === 0) return null;
  return (
    <section className="secao-py overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-end sm:justify-between gap-8">
          <Cabecalho alinhar="esquerda" sobre="Acomodações" titulo={t || "Nossas suítes"}
            texto={s || "Banheiro privativo, ar-condicionado e TV em todas. Consulte a disponibilidade para ver as opções e tarifas das suas datas."} />
          <Link href="/quartos" className="hidden sm:inline-flex shrink-0 mb-14 items-center gap-2 text-marca font-semibold hover:gap-3 transition-all">
            Todas as suítes <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      {/* Celular: carrossel de deslizar, com a próxima suíte aparecendo na
          borda (é o convite para deslizar). Computador: grade de três. */}
      <ul className="flex lg:grid lg:grid-cols-3 gap-4 lg:gap-6 overflow-x-auto lg:overflow-visible snap-x snap-mandatory no-scrollbar px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-px-4 pb-2">
        {d.quartos.map((q: any) => (
          <li key={q.id} className="snap-start shrink-0 w-[82%] sm:w-[46%] lg:w-auto">
            <Link href={`/quartos/${q.slug}`}
              className={`group relative isolate flex flex-col justify-end aspect-[4/5] overflow-hidden ${RAIO_G} bg-areia shadow-[0_24px_50px_-28px_rgb(18_50_79/0.6)]`}>
              {q.foto ? (
                <Image src={q.foto} alt={q.foto_alt || tituloQuarto(q.nome)} fill
                  sizes="(max-width: 640px) 82vw, (max-width: 1024px) 46vw, 33vw"
                  className="object-cover -z-10 transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
              ) : (
                <div className="-z-10"><FundoSemFoto /></div>
              )}
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {q.cat_nome && (
                <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[0.72rem] font-semibold text-tinta">
                  {tituloQuarto(q.cat_nome)}
                </span>
              )}

              <div className="p-5 sm:p-6 text-white">
                <h3 className="font-titulo text-2xl font-bold text-white">{tituloQuarto(q.nome)}</h3>
                <p className="text-sm text-white/80 mt-1.5 line-clamp-2">{resumir(q.descricao || q.descricao_motor, 90)}</p>
                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/20">
                  <span className="text-xs text-white/85 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Até {q.ocupacao_max} pessoas</span>
                    {q.cama && <span>{q.cama}</span>}
                    {q.metragem && <span>{q.metragem} m²</span>}
                  </span>
                  <span className="shrink-0 w-10 h-10 rounded-full bg-white text-tinta flex items-center justify-center transition-transform group-hover:translate-x-1" aria-hidden>→</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="sm:hidden text-center mt-6 px-4">
        <BotaoPilula href="/quartos" variante="contorno">Ver todas as suítes</BotaoPilula>
      </div>
    </section>
  );
}

/* ══════════════ RESTAURANTE ══════════════ */
function Restaurante({ t, s, d }: { t: string | null; s: string | null; d: DadosHome }) {
  const foto = d.fotos?.restaurante;
  const cafe = d.fotos?.cafe;
  return (
    <section className="relative bg-tinta text-white overflow-hidden">
      <OndaDivisor virada className="text-fundo" />
      <FolhaPalmeira className="absolute -right-24 bottom-0 w-[28rem] text-white/[0.05] rotate-[200deg] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className={`relative aspect-[4/3] lg:aspect-[5/6] overflow-hidden ${RAIO_G} shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]`}>
          {foto ? (
            <Image src={foto.url} alt={foto.alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          ) : (
            <FundoSemFoto tom="acento" />
          )}
          <Manuscrita tamanho="lg" className="absolute left-5 bottom-4 text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.5)]">pé na areia</Manuscrita>
        </div>

        <div>
          <Cabecalho alinhar="esquerda" claro sobre="Gastronomia" titulo={t || RESTAURANTE.nome} texto={s || RESTAURANTE.posicao} />
          <p className="text-white/75 leading-relaxed -mt-6 mb-8">{RESTAURANTE.cardapioResumo}</p>

          <div className="rounded-[calc(var(--raio)*1.5)] bg-white/[0.06] border border-white/10 p-5 sm:p-6 flex gap-4 items-start">
            {cafe && (
              <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden">
                <Image src={cafe.url} alt={cafe.alt} fill sizes="96px" className="object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-acento">Incluso na diária</p>
              <h3 className="font-titulo text-xl font-bold text-white mt-1">Café da manhã</h3>
              <p className="text-sm text-white/75 mt-1">{CAFE_DA_MANHA.estilo}, das <strong className="text-white">{CAFE_DA_MANHA.horario}</strong>.</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {CAFE_DA_MANHA.itens.slice(0, 6).map((i) => (
                  <span key={i} className="text-[0.72rem] rounded-full bg-white/10 px-2.5 py-1 text-white/85">{i}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <BotaoPilula href="/restaurante" variante="claro">Ver o cardápio</BotaoPilula>
            {d.wa && (
              <BotaoPilula href={`https://wa.me/${d.wa}?text=${encodeURIComponent("Olá! Gostaria de reservar uma mesa no Marimar Café Bistrô Bar.")}`} variante="contorno-claro" externo>
                Reservar mesa
              </BotaoPilula>
            )}
          </div>
        </div>
      </div>
      <OndaDivisor className="text-fundo" />
    </section>
  );
}

/* ══════════════ AVALIACOES ══════════════ */
function Avaliacoes({ t, s }: { t: string | null; s: string | null }) {
  return (
    <section className="secao-py">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Cabecalho sobre={s || "Avaliações"} titulo={t || "O que dizem quem já ficou"} />
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 -mt-4">
          {AVALIACOES.plataformas.map((a) => {
            const proporcao = a.nota / a.escala;
            return (
              <li key={a.nome} className={`relative text-center ${RAIO_G} bg-fundo-suave px-4 py-6`}>
                <p className="font-titulo text-4xl sm:text-5xl font-bold text-tinta tabular-nums">
                  {a.nota.toString().replace(".", ",")}
                  <span className="text-base text-tinta-suave font-normal">/{a.escala}</span>
                </p>
                <div className="h-1 rounded-full bg-linha mt-3 mx-auto max-w-[7rem] overflow-hidden" aria-hidden>
                  <div className="h-full rounded-full bg-marca" style={{ width: `${Math.round(proporcao * 100)}%` }} />
                </div>
                <p className="text-sm font-semibold text-tinta mt-3">{a.nome}</p>
                <p className="text-xs text-tinta-suave">{a.total} avaliações</p>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-tinta-suave/80 text-center mt-5">Notas consultadas em {AVALIACOES.consultadoEm} · sujeitas a alteração</p>
        <div className="text-center mt-6">
          <Link href="/avaliacoes" className="inline-flex items-center gap-2 text-sm text-marca font-semibold hover:gap-3 transition-all">Ver detalhes por critério <span aria-hidden>→</span></Link>
        </div>
      </div>
    </section>
  );
}

/* ══════════════ MAPA ══════════════ */
function Mapa({ t, s }: { t: string | null; s: string | null }) {
  const destaques = ATRACOES.filter((a) => a.destaque);
  return (
    <section className="relative bg-fundo-suave overflow-hidden">
      <OndaDivisor virada className="text-fundo" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div>
          <Cabecalho alinhar="esquerda" sobre="Localização" titulo={t || "A poucos passos do trapiche"} />
          <p className="text-tinta-suave leading-relaxed -mt-6 mb-6">
            {s || <>A travessia da {TRAVESSIA.operadora} até <strong className="text-tinta">{TRAVESSIA.destino}</strong> leva {TRAVESSIA.duracao}. Do trapiche, o percurso até a pousada é curto e feito a pé — não há circulação de veículos na ilha.</>}
          </p>
          <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-marca mb-6">
            <span className="shrink-0 w-10 h-10 rounded-full bg-marca-suave text-marca flex items-center justify-center"><Icone nome="mapa" tamanho={18} /></span>
            <div className="text-sm">
              <p className="font-semibold text-tinta">{ENDERECO.completo}</p>
              <p className="text-tinta-suave text-xs mt-0.5">Plus Code {ENDERECO.plusCode}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <BotaoPilula href="/como-chegar">Como chegar</BotaoPilula>
            <BotaoPilula href={`https://www.google.com/maps/search/?api=1&query=${ENDERECO.lat},${ENDERECO.lng}`} variante="contorno" externo>Abrir no mapa</BotaoPilula>
          </div>
        </div>

        <ul className="grid sm:grid-cols-2 gap-4">
          {destaques.map((a, i) => (
            <li key={a.slug}>
              <Link href={`/ilha-do-mel#${a.slug}`} className={`group block h-full ${RAIO_G} bg-white p-5 sm:p-6 shadow-marca hover:shadow-marca-forte hover:-translate-y-0.5 transition-all`}>
                <span className="font-titulo text-3xl font-bold text-marca/25 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-titulo font-semibold text-lg text-tinta mt-1">{a.nome}</h3>
                <p className="text-sm text-tinta-suave leading-relaxed mt-1.5">{a.resumo}</p>
                {a.distanciaTexto && <p className="text-xs font-semibold text-marca mt-3">{a.distanciaTexto}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <OndaDivisor className="text-fundo" />
    </section>
  );
}

/* ══════════════ CTA ══════════════ */
function Cta({ t, s, d }: { t: string | null; s: string | null; d: DadosHome }) {
  /* Prefere uma foto da praia; senão a do topo. Sem nenhuma, o degradê do tema. */
  const foto = d.fotos?.praia?.url ?? d.heroUrl;

  return (
    <section className="relative isolate overflow-hidden text-white">
      {foto ? (
        <>
          <Image src={foto} alt="" fill sizes="100vw" className="object-cover -z-10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-tinta/90 via-tinta/70 to-marca-escura/80" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10"><FundoSemFoto /></div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
        <Manuscrita tamanho="lg" className="block text-white/95">Ilha do Mel</Manuscrita>
        <h2 className="font-titulo text-3xl sm:text-4xl lg:text-5xl font-bold text-white text-balance mt-2">
          {t || "Sua próxima história começa aqui."}
        </h2>
        <p className="text-white/80 mt-4 leading-relaxed">
          {s || `Check-in a partir das ${POLITICAS.checkIn} · Café da manhã incluso`}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <BotaoPilula href="/reservar" variante="claro">
            <Icone nome="calendario" tamanho={18} /> Ver disponibilidade
          </BotaoPilula>
          {d.wa && (
            <BotaoPilula href={`https://wa.me/${d.wa}`} variante="contorno-claro" externo>
              <Icone nome="telefone" tamanho={18} /> Falar no WhatsApp
            </BotaoPilula>
          )}
        </div>
      </div>
    </section>
  );
}

/* ══════════════ FAQ ══════════════ */
function Faq({ t, s, d }: { t: string | null; s: string | null; d: DadosHome }) {
  if (d.faqs.length === 0) return null;
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 secao-py">
      <Cabecalho sobre="Dúvidas" titulo={t || "Perguntas frequentes"} texto={s} />
      <div className="divide-y divide-linha border-y border-linha">
        {d.faqs.map((f: any) => (
          <details key={f.id} className="group">
            <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none font-titulo font-semibold text-tinta text-[1.02rem] hover:text-marca transition-marca">
              {f.pergunta}
              <span className="shrink-0 w-9 h-9 rounded-full border border-linha flex items-center justify-center text-marca text-lg transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="pb-5 pr-12 text-[0.95rem] text-tinta-suave leading-relaxed">{f.resposta}</p>
          </details>
        ))}
      </div>
      <div className="text-center mt-8">
        <Link href="/faq" className="inline-flex items-center gap-2 text-sm text-marca font-semibold hover:gap-3 transition-all">Ver todas as dúvidas <span aria-hidden>→</span></Link>
      </div>
    </section>
  );
}

/* ══════════════ SOBRE ══════════════ */
function Sobre({ t, s }: { t: string | null; s: string | null }) {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 secao-py text-center">
      <Cabecalho titulo={t || "Bem-vindo à Marimar"} texto={s || COMPLEXO.fraseLonga} />
      <BotaoPilula href="/a-pousada">Conhecer a pousada</BotaoPilula>
    </section>
  );
}

function ChamadaGaleria({ t, s }: { t: string | null; s: string | null }) {
  return <ChamadaSimples t={t ?? "Galeria"} s={s ?? "Veja as fotos da pousada, das suítes, do restaurante e da ilha."} href="/galeria" cta="Ver galeria" />;
}

function ChamadaSimples({ t, s, href, cta }: { t: string; s: string; href: string; cta: string }) {
  return (
    <section className="relative bg-areia overflow-hidden">
      <FolhaPalmeira className="absolute -right-16 -top-8 w-64 text-marca/[0.08] rotate-[30deg] pointer-events-none" />
      <div className="relative max-w-4xl mx-auto px-4 py-14 lg:py-16 text-center">
        <h2 className="font-titulo text-2xl sm:text-3xl font-bold text-tinta mb-2">{t}</h2>
        <p className="text-tinta-suave mb-6 max-w-lg mx-auto leading-relaxed">{s}</p>
        <BotaoPilula href={href} variante="contorno">{cta}</BotaoPilula>
      </div>
    </section>
  );
}
