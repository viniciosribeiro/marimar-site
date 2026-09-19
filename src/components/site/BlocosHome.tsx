import Link from "next/link";
import Image from "next/image";
import { tituloQuarto, resumir } from "@/lib/format";
import { CarrosselBanners } from "./CarrosselBanners";
import type { Banner } from "@/lib/banners";
import { IconeCirculo, Icone, OndaTitulo } from "./Icone";
import { BuscaHome } from "./BuscaHome";
import { Manuscrita } from "./ui";
import type { ItemBloco } from "@/lib/blocos";
import {
  COMPLEXO, DIFERENCIAIS, DESTAQUES_TOPO, CAFE_DA_MANHA, RESTAURANTE,
  AVALIACOES, ATRACOES, POLITICAS, ENDERECO, TRAVESSIA,
} from "@/lib/conteudo-pousada";

/**
 * Cada secao da home e um bloco, ligado a uma linha de `blocos_home`.
 *
 * ANTES: a home era JSX fixo e a tabela `blocos_home` existia sem ninguem
 * ler — o admin tinha tela para editar blocos e o site ignorava. A Cecilia
 * mudava titulo, desativava secao, reordenava, e nada acontecia.
 *
 * AGORA: a home busca os blocos ativos por ordem e renderiza cada um pelo
 * `tipo`. Titulo e subtitulo vem do banco, com o texto atual como padrao
 * quando o campo estiver vazio. Os DADOS de cada secao continuam vindo de
 * onde devem: quartos do motor/banco, fatos do conteudo canonico.
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
};

export function RenderBloco({ bloco, dados }: { bloco: Bloco; dados: DadosHome }) {
  const t = bloco.titulo?.trim() || null;
  const s = bloco.subtitulo?.trim() || null;

  switch (bloco.tipo) {
    case "hero":        return <Hero b={{ t, s, img: bloco.imagem_url }} d={dados} />;
    case "complexo":    return <Complexo t={t} s={s} itens={dados.itens.complexo ?? []} />;
    case "diferenciais":return <Diferenciais t={t} s={s} itens={dados.itens.diferenciais ?? []} />;
    case "quartos":     return <Quartos t={t} s={s} d={dados} />;
    case "restaurante": return <Restaurante t={t} s={s} />;
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

/* ══════════════ Cabecalho reutilizavel ══════════════ */
function Cabecalho({ sobre, titulo, texto }: { sobre?: string; titulo: string; texto?: string | null }) {
  return (
    <div className="text-center mb-10 lg:mb-14">
      {sobre && (
        <span className="block text-marca font-semibold text-[0.7rem] uppercase tracking-[0.22em]">
          {sobre}
        </span>
      )}
      <h2 className="font-titulo text-[1.65rem] sm:text-3xl lg:text-[2.35rem] font-bold text-tinta mt-2.5 text-balance">
        {titulo}
      </h2>
      {/* A onda amarra a identidade: mesmo lugar, mesmo tamanho, em toda
          seção. É o que dá ritmo à página em vez de títulos soltos. */}
      <OndaTitulo className="mx-auto mt-3.5" />
      {texto && <p className="text-tinta-suave mt-4 max-w-xl mx-auto text-sm leading-relaxed">{texto}</p>}
    </div>
  );
}

/* ══════════════ HERO ══════════════ */
function Hero({ b, d }: { b: { t: string | null; s: string | null; img: string | null }; d: DadosHome }) {
  const img = b.img || d.heroUrl;
  const nome = b.t || d.pousada?.nome || "Pousada Marimar";

  /* A busca é a MESMA nos dois caminhos: com banners cadastrados ela vai por
     cima do carrossel; sem banners, fica sobre a foto única. Duplicá-la
     acabaria com dois formulários de disponibilidade divergentes — e esse é
     justamente o componente que não pode divergir. */
  const busca = (
    <div className="mt-8">
      <BuscaHome pacotes={d.pacotes} />
    </div>
  );

  // Com banners cadastrados, eles mandam no topo. Sem nenhum, continua
  // valendo a foto marcada como destaque em Fotos — quem nunca cadastrar um
  // banner nao perde o topo que ja tinha.
  if (d.banners.length > 0) {
    return <CarrosselBanners banners={d.banners}>{busca}</CarrosselBanners>;
  }

  return (
    <section className="relative isolate text-white py-24 lg:py-32 overflow-hidden bg-gradient-to-br from-marca via-marca-hover to-marca-escura">
      {img && (
        <>
          <Image src={img} alt={d.heroAlt || nome} fill priority sizes="100vw" className="object-cover -z-10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />
        </>
      )}
      <div className="relative max-w-5xl mx-auto px-4 text-center">
        <span className="inline-block text-white/90 text-xs sm:text-sm font-medium bg-white/15 px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm border border-white/20">
          🌊 Encantadas · Ilha do Mel · Paraná
        </span>
        <h1 className="font-titulo text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 leading-tight drop-shadow-sm text-white">{nome}</h1>
        <p className="text-base lg:text-lg text-white/90 mb-7 max-w-2xl mx-auto leading-relaxed">
          {b.s || COMPLEXO.fraseLonga}
        </p>

        {/* Os quatro atributos são fatos confirmados, não slogans: é o que
            a pessoa precisa saber antes de olhar datas. */}
        <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 text-white/90 text-xs sm:text-sm">
          {DESTAQUES_TOPO.map((x) => (
            <li key={x.texto} className="flex items-center gap-2">
              <span className="text-white/70" aria-hidden><Icone nome={x.icone} tamanho={17} /></span>
              {x.texto}
            </li>
          ))}
        </ul>

        {busca}
      </div>
    </section>
  );
}

/* ══════════════ COMPLEXO ══════════════ */
function Complexo({ t, s, itens }: { t: string | null; s: string | null; itens: ItemBloco[] }) {
  /* Sem itens cadastrados valem os dois cartões do conteúdo canônico: quem
     nunca abrir a tela do admin não perde o que já estava no ar. */
  const cartoes: ItemBloco[] = itens.length
    ? itens
    : [
        {
          id: "restaurante", icone: "talheres", cor: "coral",
          titulo: RESTAURANTE.nome,
          texto: "Na parte da frente, pé na areia, de frente para a Praia de Encantadas. Gastronomia, drinks e o melhor visual da ilha.",
          imagem_url: null, href: "/restaurante", cta_texto: "Conheça o restaurante",
        },
        {
          id: "pousada", icone: "cama", cor: "mata",
          titulo: "Pousada Marimar",
          texto: "As acomodações ficam logo atrás do restaurante, a poucos passos do trapiche. Conforto, privacidade e a essência da Ilha do Mel.",
          imagem_url: null, href: "/quartos", cta_texto: "Conheça as acomodações",
        },
      ];

  return (
    <section className="bg-fundo-suave secao-py">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Cabecalho sobre={s || "Como funciona"} titulo={t || "Um complexo, duas partes"} />

        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-4 items-stretch">
          <CartaoComplexo item={cartoes[0]} />

          {/* O conector é informação, não enfeite: é ele que diz que os dois
              cartões são partes do MESMO lugar. Vira horizontal no celular,
              onde os cartões ficam um sobre o outro. */}
          <div className="flex lg:flex-col items-center justify-center gap-3 lg:py-10 lg:w-28">
            <span className="h-px lg:h-auto lg:w-px flex-1 bg-linha" aria-hidden />
            <span className="text-[0.62rem] uppercase tracking-[0.18em] text-tinta-suave text-center leading-tight shrink-0">
              Anexada<br className="hidden lg:block" /> aos fundos
            </span>
            <OndaTitulo className="shrink-0 hidden lg:block" />
            <span className="h-px lg:h-auto lg:w-px flex-1 bg-linha" aria-hidden />
          </div>

          {cartoes[1] && <CartaoComplexo item={cartoes[1]} />}
        </div>

        {cartoes.length > 2 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            {cartoes.slice(2).map((i) => <CartaoComplexo key={i.id} item={i} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function CartaoComplexo({ item }: { item: ItemBloco }) {
  return (
    <article className="relative bg-white rounded-marca border border-linha shadow-marca overflow-hidden flex flex-col">
      {item.imagem_url && (
        <div className="relative h-48 sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imagem_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      )}

      <div className={`relative px-6 pb-6 text-center ${item.imagem_url ? "pt-10" : "pt-8"}`}>
        {/* Com foto, o ícone monta na junção entre imagem e texto — é o que
            costura as duas metades em vez de deixar dois blocos empilhados. */}
        {item.icone && (
          <span className={item.imagem_url ? "absolute -top-6 left-1/2 -translate-x-1/2" : "inline-block mb-3"}>
            <span className="block rounded-full bg-white p-1.5 shadow-marca">
              <IconeCirculo nome={item.icone} cor={item.cor} tamanho={44} />
            </span>
          </span>
        )}

        <h3 className="font-titulo text-xl font-bold text-tinta">{item.titulo}</h3>
        {item.texto && (
          <p className="text-sm text-tinta-suave leading-relaxed mt-2">{item.texto}</p>
        )}
        {item.href && item.cta_texto && (
          <Link href={item.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:gap-2.5 transition-all mt-4">
            {item.cta_texto}
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </article>
  );
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
    <section className="secao-py">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Cabecalho sobre={s || "Por que a Marimar"} titulo={t || "O que está incluso na sua estadia"} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {cartoes.map((d) => (
            <article key={d.id}
              className="bg-white rounded-marca p-5 border border-linha shadow-marca hover:shadow-marca-forte transition-marca">
              <div className="flex items-start gap-3">
                <IconeCirculo nome={d.icone || "check"} cor={d.cor} tamanho={40} />
                <h3 className="font-semibold text-tinta text-sm leading-snug pt-2">{d.titulo}</h3>
              </div>
              {d.texto && (
                <p className="text-xs text-tinta-suave leading-relaxed mt-3">{d.texto}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════ QUARTOS ══════════════ */
function Quartos({ t, s, d }: { t: string | null; s: string | null; d: DadosHome }) {
  if (d.quartos.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
      <Cabecalho sobre="Acomodações" titulo={t || "Nossas suítes"}
        texto={s || "Todas com banheiro privativo, ar-condicionado e TV. Consulte a disponibilidade para ver as opções e tarifas das suas datas."} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {d.quartos.map((q: any) => (
          <Link key={q.id} href={`/quartos/${q.slug}`} className="group bg-white rounded-marca shadow-marca hover:shadow-marca-forte transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col">
            <div className="relative h-52 overflow-hidden bg-marca-suave">
              {q.foto ? (
                <Image src={q.foto} alt={q.foto_alt || tituloQuarto(q.nome)} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><span className="text-5xl opacity-40">🏨</span></div>
              )}
              {q.cat_nome && (
                <span className="absolute top-3 left-3 bg-white/95 text-xs font-medium text-marca-ativa px-3 py-1 rounded-full shadow-sm">{tituloQuarto(q.cat_nome)}</span>
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
  );
}

/* ══════════════ RESTAURANTE ══════════════ */
function Restaurante({ t, s }: { t: string | null; s: string | null }) {
  return (
    <section className="bg-fundo-suave py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-marca p-7 border border-gray-100 shadow-marca">
          <span className="text-marca font-medium text-sm">Gastronomia</span>
          <h2 className="font-titulo text-xl lg:text-2xl font-bold text-gray-900 mt-2 mb-3">{t || RESTAURANTE.nome}</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{s || RESTAURANTE.posicao}</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">{RESTAURANTE.cardapioResumo}</p>
          <Link href="/restaurante" className="text-sm text-marca font-medium hover:text-marca-hover transition-marca">Conhecer o restaurante →</Link>
        </div>
        <div className="bg-white rounded-marca p-7 border border-gray-100 shadow-marca">
          <span className="text-marca font-medium text-sm">Incluso na diária</span>
          <h2 className="font-titulo text-xl lg:text-2xl font-bold text-gray-900 mt-2 mb-3">Café da manhã</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{CAFE_DA_MANHA.estilo}, servido das <strong>{CAFE_DA_MANHA.horario}</strong>.</p>
          <div className="flex flex-wrap gap-2">
            {CAFE_DA_MANHA.itens.map((i) => <span key={i} className="text-xs bg-marca-sutil text-marca-ativa px-3 py-1 rounded-full">{i}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════ AVALIACOES ══════════════ */
function Avaliacoes({ t, s }: { t: string | null; s: string | null }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
      <Cabecalho sobre={s || "Avaliações"} titulo={t || "O que dizem quem já ficou"} />
      <p className="text-xs text-gray-400 text-center -mt-8 mb-10">Notas consultadas em {AVALIACOES.consultadoEm} · sujeitas a alteração</p>
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
      <div className="text-center">
        <Link href="/avaliacoes" className="text-sm text-marca font-medium hover:text-marca-hover transition-marca">Ver detalhes por critério →</Link>
      </div>
    </section>
  );
}

/* ══════════════ MAPA ══════════════ */
function Mapa({ t, s }: { t: string | null; s: string | null }) {
  return (
    <section className="bg-fundo-suave py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="text-marca font-medium text-sm">Localização</span>
          <h2 className="font-titulo text-2xl lg:text-3xl font-bold text-gray-900 mt-2 mb-4">{t || "A poucos passos do trapiche"}</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            {s || <>A travessia da {TRAVESSIA.operadora} até <strong>{TRAVESSIA.destino}</strong> leva {TRAVESSIA.duracao}. Do trapiche, o percurso até a pousada é curto e feito a pé — não há circulação de veículos na ilha.</>}
          </p>
          <div className="bg-white rounded-marca p-4 border border-gray-100 mb-5 text-sm">
            <p className="font-medium text-gray-800 mb-1">📍 {ENDERECO.completo}</p>
            <p className="text-gray-500 text-xs">Plus Code {ENDERECO.plusCode}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/como-chegar" className="bg-marca hover:bg-marca-hover text-marca-texto px-5 py-2.5 rounded-marca text-sm font-semibold transition-marca">Como chegar</Link>
            <a href={`https://www.google.com/maps/search/?api=1&query=${ENDERECO.lat},${ENDERECO.lng}`} target="_blank" rel="noopener noreferrer" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-marca text-sm font-medium hover:bg-white transition-marca">Abrir no mapa</a>
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
  );
}

/* ══════════════ CTA ══════════════ */
function Cta({ t, s, d }: { t: string | null; s: string | null; d: DadosHome }) {
  /* A faixa usa a MESMA foto de destaque do topo quando nao ha banner
     proprio: repetir uma foto que a pousada ja escolheu e melhor do que
     inventar um degrade — e some sozinha se nenhuma existir. */
  const foto = d.heroUrl;

  return (
    <section className="relative isolate overflow-hidden text-white">
      {foto && (
        <>
          <Image src={foto} alt="" fill sizes="100vw" className="object-cover -z-10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-tinta/85 via-tinta/70 to-tinta/85" />
        </>
      )}
      {!foto && <div className="absolute inset-0 -z-10 bg-gradient-to-r from-marca to-marca-ativa" />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          <div className="min-w-0 text-center lg:text-left">
            <Manuscrita tamanho="lg" className="text-white/95">Ilha do Mel</Manuscrita>
            <p className="text-[0.62rem] sm:text-xs uppercase tracking-[0.3em] text-white/70 mt-2">
              Natureza · Gastronomia · Bem-estar
            </p>
          </div>

          <div className="lg:ml-auto text-center lg:text-right min-w-0">
            <h2 className="font-titulo text-2xl lg:text-[2rem] font-bold text-white text-balance">
              {t || "Sua próxima história começa aqui."}
            </h2>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              {s || `Check-in a partir das ${POLITICAS.checkIn} · Café da manhã incluso`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center shrink-0">
            <Link href="/reservar"
              className="inline-flex items-center justify-center gap-2 bg-marca hover:bg-marca-hover text-marca-texto px-7 py-3.5 rounded-marca font-semibold shadow-marca transition-marca">
              <Icone nome="calendario" tamanho={18} />
              Reservar agora
            </Link>
            {d.wa && (
              <a href={`https://wa.me/${d.wa}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-white/60 text-white px-6 py-3.5 rounded-marca font-semibold hover:bg-white/15 backdrop-blur-sm transition-marca">
                <Icone nome="telefone" tamanho={18} />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════ FAQ ══════════════ */
function Faq({ t, s, d }: { t: string | null; s: string | null; d: DadosHome }) {
  if (d.faqs.length === 0) return null;
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
      <Cabecalho titulo={t || "Perguntas Frequentes"} texto={s} />
      <div className="space-y-3">
        {d.faqs.map((f: any) => (
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
        <Link href="/faq" className="text-sm text-marca font-medium hover:text-marca-hover transition-marca">Ver todas as dúvidas →</Link>
      </div>
    </section>
  );
}

/* ══════════════ SOBRE ══════════════ */
function Sobre({ t, s }: { t: string | null; s: string | null }) {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
      <Cabecalho titulo={t || "Bem-vindo à Marimar"} texto={s || COMPLEXO.fraseLonga} />
      <Link href="/a-pousada" className="inline-block bg-marca hover:bg-marca-hover text-marca-texto px-6 py-3 rounded-marca font-semibold transition-marca">Conhecer a pousada</Link>
    </section>
  );
}

function ChamadaGaleria({ t, s }: { t: string | null; s: string | null }) {
  return <ChamadaSimples t={t ?? "Galeria"} s={s ?? "Veja as fotos da pousada, do restaurante e das suítes."} href="/galeria" cta="Ver galeria" />;
}

function ChamadaSimples({ t, s, href, cta }: { t: string; s: string; href: string; cta: string }) {
  return (
    <section className="bg-fundo-suave py-14">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-2">{t}</h2>
        <p className="text-sm text-gray-600 mb-6 max-w-lg mx-auto leading-relaxed">{s}</p>
        <Link href={href} className="inline-block border border-marca text-marca hover:bg-marca hover:text-marca-texto px-6 py-2.5 rounded-marca font-medium text-sm transition-marca">{cta}</Link>
      </div>
    </section>
  );
}
