import Link from "next/link";
import { AVALIACOES } from "@/lib/conteudo-pousada";
import { CabecalhoPagina, Fecho, Lista, Nota, Secao } from "./Partes";
import { Migalhas } from "../DadosEstruturados";

const virgula = (n: number) => n.toString().replace(".", ",");

/**
 * /avaliacoes no site novo: as notas de cada plataforma (com a data em que
 * foram consultadas), o detalhe por critério do Booking — inclusive onde há o
 * que melhorar — e o que mais elogiam. Sem depoimento sem origem.
 */
export function AvaliacoesNovo() {
  const total = AVALIACOES.plataformas.reduce((s, p) => s + p.total, 0);
  return (
    <div>
      <Migalhas trilha={[["Avaliações", "/avaliacoes"]]} />
      <CabecalhoPagina titulo="Avaliações">
        <p>São {total.toLocaleString("pt-BR")} avaliações de hóspedes em {AVALIACOES.plataformas.length} plataformas.</p>
        <p className="mt-2 text-[0.93rem]">Números consultados em {AVALIACOES.consultadoEm} e sujeitos a alteração. Cada nota pertence à plataforma indicada.</p>
      </CabecalhoPagina>

      <section aria-label="Notas por plataforma" className="sn-margem mx-auto mt-10 max-w-[1240px]">
        <ul className="grid grid-cols-2 gap-x-8 gap-y-8 border-y border-sn-linha py-8 sm:grid-cols-3 lg:grid-cols-5">
          {AVALIACOES.plataformas.map((a) => (
            <li key={a.nome} className="min-w-0">
              <p className="font-titulo leading-none">
                <span className="text-[2.6rem] tabular-nums">{virgula(a.nota)}</span>
                <span className="ml-1 text-[1rem] text-sn-texto-2">de {a.escala}</span>
              </p>
              <p className="mt-2 font-medium">
                {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:underline-offset-4">{a.nome}</a> : a.nome}
              </p>
              <p className="text-[0.93rem] text-sn-texto-2">{a.total.toLocaleString("pt-BR")} avaliações</p>
            </li>
          ))}
        </ul>
      </section>

      <Secao id="criterios" titulo="Nota por critério" apoio={<p>Detalhamento do Booking, incluindo os pontos em que temos o que melhorar.</p>}>
        <dl className="max-w-[44rem] space-y-3.5">
          {AVALIACOES.detalheBooking.map((d) => (
            <div key={d.criterio} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 sm:grid-cols-[10rem_1fr_2.75rem]">
              <dt className="text-[0.97rem]">{d.criterio}</dt>
              <dd className="h-2.5 overflow-hidden rounded-full bg-sn-areia" aria-hidden>
                <span className="block h-full rounded-full bg-sn-mar" style={{ width: `${Math.max(0, Math.min(10, d.nota)) * 10}%` }} />
              </dd>
              <dd className="text-right font-semibold tabular-nums">{virgula(d.nota)}</dd>
            </div>
          ))}
        </dl>
      </Secao>

      <Secao titulo="O que mais elogiam">
        <Lista colunas={2} itens={[...AVALIACOES.pontosFortes]} />
      </Secao>

      {AVALIACOES.depoimentos.length > 0 ? (
        <Secao titulo="O que dizem">
          <ul className="grid gap-8 md:grid-cols-2">
            {AVALIACOES.depoimentos.map((d, i) => (
              <li key={i}>
                <blockquote className="border-l-2 border-sn-linha pl-5">
                  <p className="leading-relaxed">“{d.texto}”</p>
                  <footer className="mt-3 text-[0.93rem] text-sn-texto-2">{d.autor}, no {d.plataforma}</footer>
                </blockquote>
              </li>
            ))}
          </ul>
        </Secao>
      ) : (
        <div className="sn-margem mx-auto mt-12 max-w-[1240px]">
          <Nota>Preferimos mostrar as notas das plataformas a publicar depoimentos sem identificar a origem. Para ler os comentários dos hóspedes, abra qualquer uma das plataformas acima.</Nota>
        </div>
      )}

      <Fecho titulo="Venha conferir">
        <Link href="/reservar" className="sn-botao">Ver datas e preços</Link>
        <Link href="/quartos" className="sn-botao-linha">Ver as suítes</Link>
      </Fecho>
    </div>
  );
}
