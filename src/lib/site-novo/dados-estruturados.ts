/**
 * Dados estruturados (schema.org em JSON-LD) do site novo: o que buscadores
 * e assistentes leem como fato sobre a pousada, cada suíte, o restaurante e
 * as perguntas frequentes.
 *
 * Só entra o que está CONFIRMADO em src/lib/conteudo-pousada.ts ou vem do
 * painel. De propósito, fica de fora: nota e número de avaliações (são do
 * Google, Booking e TripAdvisor; o Google não aceita nota de outra
 * plataforma como dado do próprio site), horários e telefone do restaurante
 * (pendentes de confirmação) e preço (muda com as datas; o motor manda).
 */
import {
  COMODIDADES_CONFIRMADAS, ENDERECO, IDENTIDADE, POLITICAS, RESTAURANTE,
} from "@/lib/conteudo-pousada";

export type No = Record<string, unknown>;

export const idPousada = (site: string) => `${site}/#pousada`;

/** "14h" → "14:00"; "08h30" → "08:30"; o que não for hora → null. */
export function horaIso(texto: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})\s*h\s*(\d{2})?\s*$/i.exec(texto ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function endereco(): No {
  return {
    "@type": "PostalAddress",
    streetAddress: `${ENDERECO.logradouro}, ${ENDERECO.bairro}, ${ENDERECO.ilha}`,
    addressLocality: ENDERECO.cidade,
    addressRegion: ENDERECO.uf,
    postalCode: ENDERECO.cep,
    addressCountry: "BR",
  };
}

const ponto = (): No => ({ "@type": "GeoCoordinates", latitude: ENDERECO.lat, longitude: ENDERECO.lng });

const recursos = (nomes: readonly string[]): No[] =>
  nomes.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true }));

/** Só endereços absolutos (as fotos do painel e do motor já são). */
const absolutas = (urls: (string | null | undefined)[], site: string): string[] =>
  [...new Set(urls.filter((u): u is string => !!u).map((u) => (u.startsWith("/") ? `${site}${u}` : u)))]
    .filter((u) => /^https?:\/\//.test(u));

/** A pousada (página inicial). `telefone`: o do painel, senão o WhatsApp oficial. */
export function noPousada(site: string, d: { telefone?: string | null; email?: string | null; logo?: string | null; fotos?: (string | null | undefined)[] }): No {
  const imagens = absolutas(d.fotos ?? [], site);
  const logo = absolutas([d.logo], site)[0];
  const checkin = horaIso(POLITICAS.checkIn);
  const checkout = horaIso(POLITICAS.checkOut);
  return {
    "@type": "Hotel",
    "@id": idPousada(site),
    name: IDENTIDADE.nome,
    alternateName: IDENTIDADE.nomeCompleto,
    url: `${site}/`,
    ...(logo ? { logo } : {}),
    ...(imagens.length ? { image: imagens } : {}),
    ...(d.telefone ? { telephone: d.telefone } : {}),
    ...(d.email ? { email: d.email } : {}),
    address: endereco(),
    geo: ponto(),
    ...(checkin ? { checkinTime: checkin } : {}),
    ...(checkout ? { checkoutTime: checkout } : {}),
    petsAllowed: POLITICAS.pets,
    amenityFeature: recursos(COMODIDADES_CONFIRMADAS),
    sameAs: [IDENTIDADE.instagram],
  };
}

export function noSite(site: string): No {
  return { "@type": "WebSite", "@id": `${site}/#site`, url: `${site}/`, name: IDENTIDADE.nome, inLanguage: "pt-BR", publisher: { "@id": idPousada(site) } };
}

/** O restaurante da pousada (/restaurante). */
export function noRestaurante(site: string, d: { fotos?: (string | null | undefined)[] } = {}): No {
  const imagens = absolutas(d.fotos ?? [], site);
  return {
    "@type": "Restaurant",
    "@id": `${site}/restaurante#restaurante`,
    name: RESTAURANTE.nome,
    description: RESTAURANTE.posicao,
    url: `${site}/restaurante`,
    hasMenu: `${site}/restaurante#cardapio`,
    ...(imagens.length ? { image: imagens } : {}),
    address: endereco(),
    geo: ponto(),
    parentOrganization: { "@id": idPousada(site) },
  };
}

/** Uma suíte (/quartos/[slug]). */
export function noSuite(site: string, s: {
  slug: string; nome: string; descricao?: string | null; fotos?: (string | null | undefined)[];
  ocupacaoMax?: number | null; cama?: string | null; metragem?: number | string | null; comodidades?: string[];
}): No {
  const imagens = absolutas(s.fotos ?? [], site).slice(0, 8);
  const m = Number(s.metragem);
  return {
    "@type": "HotelRoom",
    "@id": `${site}/quartos/${s.slug}#suite`,
    name: s.nome,
    url: `${site}/quartos/${s.slug}`,
    ...(s.descricao?.trim() ? { description: s.descricao.trim() } : {}),
    ...(imagens.length ? { image: imagens } : {}),
    ...(s.ocupacaoMax && s.ocupacaoMax > 0 ? { occupancy: { "@type": "QuantitativeValue", maxValue: s.ocupacaoMax, unitText: "pessoas" } } : {}),
    ...(s.cama?.trim() ? { bed: s.cama.trim() } : {}),
    ...(Number.isFinite(m) && m > 0 ? { floorSize: { "@type": "QuantitativeValue", value: m, unitCode: "MTK" } } : {}),
    ...(s.comodidades?.length ? { amenityFeature: recursos(s.comodidades) } : {}),
    containedInPlace: { "@type": "Hotel", "@id": idPousada(site), name: IDENTIDADE.nome, url: `${site}/` },
  };
}

/** As perguntas frequentes (/faq), as mesmas que a página mostra. */
export function noPerguntas(site: string, itens: { p: string; r: string }[]): No | null {
  const validas = itens.filter((i) => i.p?.trim() && i.r?.trim());
  if (!validas.length) return null;
  return {
    "@type": "FAQPage",
    "@id": `${site}/faq#perguntas`,
    mainEntity: validas.map((i) => ({ "@type": "Question", name: i.p.trim(), acceptedAnswer: { "@type": "Answer", text: i.r.trim() } })),
  };
}

/** O caminho da página a partir do início: [["Suítes", "/quartos"], ["Suíte Queen", "/quartos/suite-queen"]]. */
export function noMigalhas(site: string, trilha: [nome: string, caminho: string][]): No {
  const itens: [string, string][] = [["Início", "/"], ...trilha];
  return {
    "@type": "BreadcrumbList",
    itemListElement: itens.map(([name, caminho], i) => ({
      "@type": "ListItem", position: i + 1, name, item: caminho === "/" ? `${site}/` : `${site}${caminho}`,
    })),
  };
}

/** O texto do <script type="application/ld+json">, seguro dentro do HTML (sem "</script>" vindo do painel). */
export function jsonLd(nos: (No | null | undefined)[]): string | null {
  const validos = nos.filter((n): n is No => !!n);
  if (!validos.length) return null;
  return JSON.stringify({ "@context": "https://schema.org", "@graph": validos })
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
