import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { comSql } from "@/lib/db-conexao";
import { lerContato } from "@/lib/pousada";
import { dataBR, pluralizar, resumir } from "@/lib/format";
import { CabecalhoPagina, Fecho, Lista, Nota } from "./Partes";
import { Migalhas } from "../DadosEstruturados";

type Pacote = {
  id: string; nome: string; slug: string; descricao: string | null; inclusos: unknown;
  vigencia_inicio: string | Date | null; vigencia_fim: string | Date | null; diaria_minima: number | null; imagem_url: string | null;
};

const iso = (d: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
function vigencia(p: Pacote): string | null {
  const a = iso(p.vigencia_inicio), b = iso(p.vigencia_fim);
  if (a && b) return `De ${dataBR(a)} a ${dataBR(b)}`;
  if (a) return `A partir de ${dataBR(a)}`;
  if (b) return `Até ${dataBR(b)}`;
  return null;
}
const inclusos = (p: Pacote) => (Array.isArray(p.inclusos) ? p.inclusos.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);

/** /pacotes no site novo: os pacotes ativos do painel; sem nenhum, a explicação (como no Clássico desde 04/11). */
export async function PacotesNovo() {
  const [lista, contato] = await Promise.all([
    comSql((sql) => sql<Pacote[]>`SELECT * FROM pacotes WHERE ativo = true ORDER BY ordem`).then((l) => [...l]).catch(() => null),
    lerContato(),
  ]);
  const wa = contato.whatsappDigitos;
  const perguntar = wa ? `https://wa.me/${wa}?text=${encodeURIComponent("Olá! Vocês têm algum pacote ou oferta para as minhas datas?")}` : null;

  return (
    <div>
      <Migalhas trilha={[["Pacotes", "/pacotes"]]} />
      <CabecalhoPagina titulo="Pacotes"><p>Ofertas especiais para a sua estadia, quando a pousada publica.</p></CabecalhoPagina>
      <div className="sn-margem mx-auto mt-10 max-w-[1240px]">
        {!lista?.length ? (
          <Nota>
            <p>{lista === null ? "Não conseguimos carregar os pacotes agora." : "No momento não há pacotes publicados."} As tarifas de cada data aparecem na consulta de disponibilidade, direto do sistema de reservas da pousada.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/reservar" className="sn-botao">Consultar disponibilidade</Link>
              {perguntar && <a href={perguntar} target="_blank" rel="noopener noreferrer" className="sn-botao-linha">Perguntar no WhatsApp</a>}
            </div>
          </Nota>
        ) : (
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((p) => (
              <li key={p.id} className="min-w-0">
                <Link href={`/pacotes/${p.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-sn-areia">
                    {p.imagem_url && <Image src={p.imagem_url} alt={p.nome} fill sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover" />}
                  </div>
                  <h2 className="sn-h3 mt-3 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{p.nome}</h2>
                  {p.descricao && <p className="mt-1 text-[0.95rem] leading-relaxed text-sn-texto-2">{resumir(p.descricao, 140)}</p>}
                  <p className="mt-2 text-[0.93rem]">
                    {[vigencia(p), p.diaria_minima ? `mínimo de ${pluralizar(p.diaria_minima, "noite")}` : null].filter(Boolean).join(", ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Fecho titulo="Prefere ver as suas datas?">
        <Link href="/reservar" className="sn-botao">Ver datas e preços</Link>
      </Fecho>
    </div>
  );
}

/** /pacotes/[slug] no site novo. Pacote desligado ou inexistente: 404, como no Clássico. */
export async function PacoteNovo({ slug }: { slug: string }) {
  const [p] = await comSql((sql) => sql<Pacote[]>`SELECT * FROM pacotes WHERE slug = ${slug} AND ativo = true`);
  if (!p) notFound();
  const contato = await lerContato();
  const wa = contato.whatsappDigitos;
  const itens = inclusos(p);
  const quando = vigencia(p);
  return (
    <div>
      <Migalhas trilha={[["Pacotes", "/pacotes"], [p.nome, `/pacotes/${slug}`]]} />
      <div className="sn-margem mx-auto max-w-[1240px] pt-3 lg:pt-6">
        <Link href="/pacotes" className="inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] text-sn-texto-2 hover:text-sn-texto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
          Todos os pacotes
        </Link>
      </div>
      <CabecalhoPagina titulo={p.nome} foto={p.imagem_url ? { url: p.imagem_url, alt: p.nome } : null}>
        {p.descricao && <p className="whitespace-pre-line">{p.descricao}</p>}
      </CabecalhoPagina>
      <div className="sn-margem mx-auto mt-12 grid max-w-[1240px] gap-10 md:grid-cols-2">
        {itens.length > 0 && (
          <section aria-labelledby="sn-incluso">
            <h2 id="sn-incluso" className="sn-h3">O que está incluso</h2>
            <div className="mt-4"><Lista itens={itens} /></div>
          </section>
        )}
        {(quando || p.diaria_minima) && (
          <section aria-labelledby="sn-condicoes">
            <h2 id="sn-condicoes" className="sn-h3">Condições</h2>
            <dl className="mt-4 divide-y divide-sn-linha border-y border-sn-linha">
              {quando && <div className="py-3"><dt className="text-[0.9rem] text-sn-texto-2">Quando</dt><dd className="mt-0.5">{quando}</dd></div>}
              {p.diaria_minima ? <div className="py-3"><dt className="text-[0.9rem] text-sn-texto-2">Estadia mínima</dt><dd className="mt-0.5">{pluralizar(p.diaria_minima, "noite")}</dd></div> : null}
            </dl>
          </section>
        )}
      </div>
      <Fecho titulo="Quer este pacote?" texto={<p>Veja as datas livres ou pergunte à pousada.</p>}>
        <Link href="/reservar" className="sn-botao">Ver datas e preços</Link>
        {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Tenho interesse no pacote "${p.nome}".`)}`} target="_blank" rel="noopener noreferrer" className="sn-botao-linha">Perguntar no WhatsApp</a>}
      </Fecho>
    </div>
  );
}
