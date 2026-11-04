import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { comSql } from "@/lib/db-conexao";
import { lerPousada, digitosWhatsApp } from "@/lib/pousada";
import { lerBanner, type Banner } from "@/lib/banners";
import { agruparItens, type ItemBloco } from "@/lib/blocos";
import { lerConteudo, padroes, type Conteudo } from "@/lib/conteudo-editavel";
import { lerRegras, REGRAS_PADRAO, type Regras } from "@/lib/regras-hospedagem";
import { brl, pluralizar, tituloQuarto } from "@/lib/format";
import { acharNoMotor, tarifasDeReferencia, temDiaria } from "../tarifas";
import { modeloDaVisita } from "@/lib/modelo-site";
import { AVALIACOES, CAFE_DA_MANHA, CONTATO, DIFERENCIAIS, IDENTIDADE, RESTAURANTE } from "@/lib/conteudo-pousada";
import { Icone } from "@/components/site/Icone";
import { BuscaNovo } from "../BuscaNovo";
import { LinhaTravessia } from "../LinhaTravessia";

/**
 * Página inicial do site novo — "Chegando pelo mar" (docs/plano-site-novo.md).
 *
 * A ordem conta a decisão de quem viaja: quando venho → qual suíte → como
 * chego → onde como → o que dizem → dúvidas. Seções da página inicial (painel)
 * continua ligando e desligando seções; a ordem é a do desenho.
 * Os dados são os mesmos do Clássico: banco, painel e motor, em tempo real.
 */

type Suite = {
  id: string; slug: string; nome: string; ocupacao_max: number; cama: string | null;
  desbravador_room_id: string | null; foto: string | null; foto_alt: string | null;
};
type Pergunta = { id: string; pergunta: string; resposta: string };

async function lerDados() {
  const vazio = {
    suites: [] as Suite[], totalSuites: 0, perguntas: [] as Pergunta[],
    fotos: {} as Record<string, { url: string; alt: string }>, banners: [] as Banner[],
    heroMidia: null as { url: string; alt: string } | null, itens: {} as Record<string, ItemBloco[]>,
    conteudo: padroes() as Conteudo, regras: REGRAS_PADRAO as Regras,
    escondidos: new Set<string>(), heroBloco: null as string | null,
  };
  try {
    return await comSql(async (sql) => {
      const suites = await sql<Suite[]>`
        SELECT q.id, q.slug, q.nome, q.ocupacao_max, q.cama, q.desbravador_room_id,
          COALESCE(
            (SELECT m.url FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' AND m.destaque = true ORDER BY m.ordem LIMIT 1),
            (SELECT m.url FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' ORDER BY m.ordem LIMIT 1)
          ) AS foto,
          COALESCE(
            (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' AND m.destaque = true ORDER BY m.ordem LIMIT 1),
            (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto' ORDER BY m.ordem LIMIT 1)
          ) AS foto_alt
        FROM quartos q WHERE q.ativo = true ORDER BY q.ordem, q.nome`;
      const perguntas = await sql<Pergunta[]>`SELECT id, pergunta, resposta FROM faq WHERE ativo = true ORDER BY ordem LIMIT 5`.catch(() => []);
      const fotosSecao = await sql<{ secao: string; url: string; alt: string }[]>`
        SELECT DISTINCT ON (secao) secao, url, alt FROM midias
        WHERE quarto_id IS NULL AND tipo = 'foto'
        ORDER BY secao, destaque DESC, ordem, criado_em`.catch(() => []);
      /* A foto do topo: a capa do álbum Praia e ilha; sem ela, a do álbum
         A pousada (Fotos e vídeos → estrela "Usar como capa do álbum"). Entre
         fotos sem capa, a mais larga — a foto do topo ocupa a tela inteira. */
      const [heroMidia] = await sql<{ url: string; alt: string }[]>`
        SELECT url, alt FROM midias
        WHERE quarto_id IS NULL AND tipo = 'foto' AND secao IN ('praia', 'pousada')
        ORDER BY (secao = 'praia') DESC, destaque DESC, largura DESC NULLS LAST, ordem, criado_em LIMIT 1`.catch(() => []);
      const banners = await sql`
        SELECT * FROM banners WHERE ativo = true
          AND (inicia_em IS NULL OR inicia_em <= now()) AND (termina_em IS NULL OR termina_em >= now())
        ORDER BY ordem, criado_em`.catch(() => []);
      const itensBlocos = await sql`
        SELECT i.*, b.tipo FROM blocos_itens i JOIN blocos_home b ON b.id = i.bloco_id
        WHERE i.ativo = true ORDER BY i.ordem, i.criado_em`.catch(() => []);
      const blocos = await sql<{ tipo: string; ativo: boolean; imagem_url: string | null }[]>`
        SELECT tipo, ativo, imagem_url FROM blocos_home`.catch(() => []);
      return {
        suites: suites.slice(0, 6), totalSuites: suites.length, perguntas,
        fotos: Object.fromEntries(fotosSecao.map((f) => [f.secao, { url: f.url, alt: f.alt }])),
        banners: banners.map((b) => lerBanner(b)), heroMidia: heroMidia ?? null,
        itens: agruparItens([...itensBlocos]),
        conteudo: await lerConteudo(sql), regras: await lerRegras(sql),
        escondidos: new Set(blocos.filter((b) => b.ativo === false).map((b) => b.tipo)),
        heroBloco: blocos.find((b) => b.tipo === "hero" && b.ativo !== false)?.imagem_url ?? null,
      };
    });
  } catch (e) {
    console.error("[HomeNovo] banco indisponível:", (e as Error).message);
    return vazio;
  }
}

/* Uma consulta ao motor por visita, dividida por todos os cartões (../tarifas). */
async function PrecoSuite({ codigo }: { codigo: string | null }) {
  if (!codigo) return null;
  const q = acharNoMotor(await tarifasDeReferencia(2), codigo);
  if (!temDiaria(q)) {
    return <p className="mt-2 text-[0.92rem] text-sn-texto-2">Preço para as suas datas na busca</p>;
  }
  return (
    <p className="mt-2 text-[0.95rem]">
      <span className="font-semibold tabular-nums">{brl(q.diaria)}</span>
      <span className="text-sn-texto-2"> por noite</span>
    </p>
  );
}

/** O céu acompanha a hora em Encantadas (America/Sao_Paulo). */
function faixaDoCeu(): "amanhecer" | "dia" | "tarde" | "noite" {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (h >= 5 && h < 8) return "amanhecer";
  if (h >= 8 && h < 16) return "dia";
  if (h >= 16 && h < 19) return "tarde";
  return "noite";
}


export async function HomeNovo() {
  const [d, p, visita] = await Promise.all([lerDados(), lerPousada(), modeloDaVisita()]);
  const wa = digitosWhatsApp(p?.whatsapp) || CONTATO.whatsappDigitos;
  const banner = d.banners[0] ?? null;
  /* O banner do painel costuma ser uma foto pequena (o de 04/11 tem 945 px):
     no topo de tela inteira ele só entra se não houver foto de praia ou da pousada. */
  const foto = d.heroBloco || d.heroMidia?.url || banner?.imagem_url || p?.og_image_url || null;
  const fotoAlt = (banner && foto === banner.imagem_url ? banner.alt : null) || d.heroMidia?.alt || "Encantadas, Ilha do Mel";
  const foco = banner && foto === banner.imagem_url ? `${banner.foco_x ?? 50}% ${banner.foco_y ?? 50}%` : "50% 50%";
  const regraCriancas = d.regras.idadeColoMax !== null ? { idadeColoMax: d.regras.idadeColoMax } : null;
  const ver = (tipo: string) => !d.escondidos.has(tipo);
  const T = d.conteudo.TRAVESSIA;
  const terminal = T.terminais.find((t) => t.principal) ?? T.terminais[0];
  const inclusos = (d.itens.diferenciais?.length ? d.itens.diferenciais : DIFERENCIAIS.map((x, i) => ({ id: String(i), icone: x.icone, titulo: x.titulo }))) as { id: string; icone: string | null; titulo: string }[];
  const fotoRestaurante = d.fotos.restaurante ?? d.fotos.cafe ?? null;

  return (
    <>
      {/* ── topo: a foto, a frase e a busca ─────────────────────────── */}
      <section data-topo-imersivo aria-labelledby="sn-titulo" className="relative isolate text-white"
        style={{ marginTop: "calc(-1 * var(--sn-topo))" }}>
        <div className="absolute inset-0 -z-10 overflow-hidden bg-sn-mar">
          {foto && <Image src={foto} alt={fotoAlt} fill preload sizes="100vw" className="object-cover" style={{ objectPosition: foco }} />}
          <div className="sn-hero-veu absolute inset-0" />
          {visita.config.ceuPorHora && <div className={`sn-ceu sn-ceu--${faixaDoCeu()} absolute inset-0`} aria-hidden />}
        </div>
        {banner?.titulo && (
          <p className="sn-margem absolute left-0 right-0 z-10 mx-auto max-w-[1240px]"
            style={{ top: "calc(var(--sn-topo) + 0.75rem)" }}>
            <span className="inline-flex flex-wrap items-center gap-x-2 rounded-full bg-black/35 px-3.5 py-1.5 text-[0.88rem] backdrop-blur-sm">
              {banner.rotulo && <strong className="font-semibold">{banner.rotulo}</strong>}
              <span>{banner.titulo}</span>
              {banner.cta_href && banner.cta_texto && <Link href={banner.cta_href} className="underline underline-offset-4">{banner.cta_texto}</Link>}
            </span>
          </p>
        )}
        <div className="sn-margem mx-auto grid min-h-[min(68svh,38rem)] max-w-[1240px] grid-cols-1 content-end gap-7 pt-[calc(var(--sn-topo)+2.5rem)] lg:pt-[calc(var(--sn-topo)+4rem)] lg:min-h-[min(92svh,54rem)] lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-14 lg:pb-16">
          <div className="max-w-[40rem]">
            <h1 id="sn-titulo">
              <span className="mb-3 block font-sans text-[1rem] font-medium tracking-normal text-white/90">
                {IDENTIDADE.nome}, em Encantadas, Ilha do Mel
              </span>
              <span className="sn-display block text-white">Chegue pelo mar.<br />Fique sem pressa.</span>
            </h1>
            <p className="mt-5 max-w-[32rem] text-[1.06rem] leading-relaxed text-white/90">
              Administração familiar, a poucos passos do trapiche, com restaurante próprio à beira-mar.
            </p>
          </div>
          <div data-sem-flutuante className="relative z-10 -mb-28 w-full max-w-[27rem] lg:mb-0 lg:justify-self-end">
            <BuscaNovo regra={regraCriancas} />
          </div>
        </div>
      </section>
      <div aria-hidden className="h-28 lg:hidden" />

      {/* ── as suítes ───────────────────────────────────────────────── */}
      {ver("quartos") && d.suites.length > 0 && (
        <section aria-labelledby="sn-suites" className="sn-margem mx-auto max-w-[1240px] pt-14 lg:pt-24">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2 id="sn-suites" className="sn-h2">As suítes</h2>
            <Link href="/quartos" className="sn-link text-[0.98rem]">Ver as {pluralizar(d.totalSuites, "suíte")}</Link>
          </div>
          <p className="mt-3 max-w-[40rem] text-sn-texto-2">
            Todas com banheiro privativo, ar-condicionado e café da manhã incluso. Os valores são diárias para 2 adultos,
            consultadas agora para daqui a uma semana; o preço das suas datas aparece na busca.
          </p>
          <ul className="sn-trilho -mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-0">
            {d.suites.map((q) => (
              <li key={q.id} className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
                <Link href={`/quartos/${q.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-sn-areia">
                    {q.foto && <Image src={q.foto} alt={q.foto_alt || tituloQuarto(q.nome)} fill sizes="(max-width: 640px) 78vw, (max-width: 1024px) 44vw, 33vw" className="object-cover" />}
                  </div>
                  <h3 className="sn-h3 mt-3 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{tituloQuarto(q.nome)}</h3>
                  <p className="mt-0.5 text-[0.93rem] text-sn-texto-2">
                    Até {pluralizar(q.ocupacao_max, "pessoa")}{q.cama ? `, ${q.cama.toLowerCase()}` : ""}
                  </p>
                  <Suspense fallback={<p className="mt-2 text-[0.92rem] text-sn-texto-2">Consultando o preço…</p>}>
                    <PrecoSuite codigo={q.desbravador_room_id} />
                  </Suspense>
                </Link>
              </li>
            ))}
          </ul>
          {ver("diferenciais") && inclusos.length > 0 && (
            <div className="mt-14 border-t border-sn-linha pt-8">
              <h3 className="sn-h3">O que vem com a diária</h3>
              <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3.5 lg:grid-cols-4 lg:gap-x-8">
                {inclusos.slice(0, 8).map((i) => (
                  <li key={i.id} className="flex items-start gap-2.5 text-[0.95rem] leading-snug lg:gap-3 lg:text-[0.97rem]">
                    <Icone nome={i.icone || "check"} tamanho={22} className="mt-0.5 shrink-0 text-sn-mare-texto" />
                    <span>{i.titulo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── a travessia: o momento de ousadia do site ───────────────── */}
      {ver("mapa") && (
        <section aria-labelledby="sn-travessia" className="sobre-escuro mt-20 bg-sn-mar text-white lg:mt-28">
          <div className="sn-margem mx-auto max-w-[1240px] py-16 lg:py-24">
            <div className="max-w-[40rem]">
              <h2 id="sn-travessia" className="sn-h2 text-white">Chegar já faz parte da viagem</h2>
              <p className="mt-4 text-[1.04rem] leading-relaxed text-white/80">
                Não há carros na ilha. De {terminal?.nome ?? "Pontal do Sul"}, o barco leva {T.duracao} até {T.destino},
                e do trapiche se chega a pé.
              </p>
            </div>
            <LinhaTravessia className="mt-12 lg:mt-16" paradas={[
              { titulo: terminal?.nome ?? "Pontal do Sul", texto: "Onde saem os barcos. De Curitiba, pela BR-277 até o litoral." },
              { titulo: "Travessia de barco", texto: `${T.operadora}, ${T.duracao}.`, onda: true },
              { titulo: `Trapiche de ${T.destino}`, texto: T.avisoDestino },
              { titulo: IDENTIDADE.nome, texto: "Um percurso curto, a pé. A entrada é pelo restaurante, de frente para o mar.", fim: true },
            ]} />
            <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4 lg:justify-center">
              <Link href="/como-chegar" className="sn-botao-linha text-white">Ver o passo a passo</Link>
              <Link href="/como-chegar#rota" className="sn-link">Traçar a rota de onde você está</Link>
            </div>
          </div>
        </section>
      )}

      {/* ── o restaurante ───────────────────────────────────────────── */}
      {ver("restaurante") && (
        <section aria-labelledby="sn-restaurante" className="sn-margem mx-auto grid max-w-[1240px] gap-8 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-sn-areia lg:aspect-[5/4]">
            {fotoRestaurante && <Image src={fotoRestaurante.url} alt={fotoRestaurante.alt || RESTAURANTE.nome} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />}
          </div>
          <div>
            <p className="text-[0.98rem] font-medium text-sn-texto-2">{RESTAURANTE.nome}</p>
            <h2 id="sn-restaurante" className="sn-h2 mt-2">À beira-mar, de frente para Encantadas</h2>
            <p className="mt-4 text-[1.04rem] leading-relaxed text-sn-texto-2">
              É o restaurante da própria pousada. {RESTAURANTE.cardapioResumo}
            </p>
            <p className="mt-4 text-[1.04rem] leading-relaxed">
              <strong className="font-semibold">Café da manhã incluso</strong> na diária, das {CAFE_DA_MANHA.horario}, no restaurante.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/restaurante#cardapio" className="sn-botao">Ver o cardápio</Link>
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Gostaria de reservar uma mesa no ${RESTAURANTE.nome}.`)}`}
                target="_blank" rel="noopener noreferrer" className="sn-botao-linha text-sn-texto">Reservar mesa</a>
            </div>
          </div>
        </section>
      )}

      {/* ── as notas ────────────────────────────────────────────────── */}
      {ver("avaliacoes") && (
        <section aria-labelledby="sn-notas" className="border-y border-sn-linha bg-sn-areia/60">
          <div className="sn-margem mx-auto max-w-[1240px] py-12 lg:py-16">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 id="sn-notas" className="sn-h3 text-[1.5rem]">Notas dos hóspedes</h2>
              <Link href="/avaliacoes" className="sn-link text-[0.98rem]">Ver as notas por critério</Link>
            </div>
            <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
              {AVALIACOES.plataformas.map((a) => (
                <li key={a.nome}>
                  <p className="font-titulo text-[2.5rem] leading-none tabular-nums">
                    {a.nota.toString().replace(".", ",")}<span className="ml-0.5 font-sans text-[1rem] text-sn-texto-2">de {a.escala}</span>
                  </p>
                  <p className="mt-2 text-[0.98rem] font-medium">{a.nome}</p>
                  <p className="text-[0.88rem] text-sn-texto-2">{pluralizar(a.total, "avaliação", "avaliações")}</p>
                </li>
              ))}
            </ul>
            <p className="mt-7 text-[0.85rem] text-sn-texto-2">Notas publicadas por cada plataforma, consultadas em {AVALIACOES.consultadoEm}.</p>
          </div>
        </section>
      )}

      {/* ── dúvidas antes de reservar ──────────────────────────────── */}
      {ver("faq") && d.perguntas.length > 0 && (
        <section aria-labelledby="sn-perguntas" className="sn-margem mx-auto max-w-[860px] py-16 lg:py-24">
          <h2 id="sn-perguntas" className="sn-h2">Antes de reservar</h2>
          <div className="mt-8 divide-y divide-sn-linha border-y border-sn-linha">
            {d.perguntas.map((f) => (
              <details key={f.id}>
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-[1.06rem] font-medium">
                  {f.pergunta}
                  <span aria-hidden className="sn-mais inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-sn-linha text-[1.2rem] leading-none">+</span>
                </summary>
                <p className="pb-5 pr-10 leading-relaxed text-sn-texto-2">{f.resposta}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="sn-link mt-6 inline-block text-[0.98rem]">Ver todas as perguntas</Link>
        </section>
      )}
    </>
  );
}
