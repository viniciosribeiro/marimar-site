import Link from "next/link";
import { CabecalhoPagina, Fecho, Lista, Nota, Secao } from "./Partes";
import { ValoresTravessia } from "./ValoresTravessia";
import { conteudoDoPainel, fotoDaSecao } from "./dados";
import { Migalhas } from "../DadosEstruturados";

/** /ilha-do-mel no site novo: o que ver (com as âncoras de cada atração), a travessia e os cuidados na ilha. */
export async function IlhaNovo() {
  const [c, foto] = await Promise.all([conteudoDoPainel(), fotoDaSecao(["praia"])]);
  const T = c.TRAVESSIA;
  return (
    <div>
      <Migalhas trilha={[["Ilha do Mel", "/ilha-do-mel"]]} />
      <CabecalhoPagina titulo="Ilha do Mel e Encantadas" foto={foto ? { url: foto.url, alt: foto.alt || "Ilha do Mel" } : null}>
        <p>{c.SOBRE_A_ILHA.acesso}</p>
      </CabecalhoPagina>

      <Secao id="atracoes" titulo="O que ver" apoio={<p className="text-[0.93rem]">{c.AVISO_DISTANCIAS}</p>}>
        <ul className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {c.ATRACOES.map((a) => (
            <li key={a.slug} id={a.slug} className="min-w-0 scroll-mt-[calc(var(--sn-topo)+1rem)] border-t border-sn-linha pt-5">
              <h3 className="sn-h3">{a.nome}</h3>
              {a.distanciaTexto && <p className="mt-1 text-[0.93rem] text-sn-texto-2">{a.distanciaTexto}</p>}
              <p className="mt-2.5 leading-relaxed">{a.texto}</p>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao id="travessia" titulo="Travessia e transporte"
        apoio={<p>Na ilha não circulam carros: tudo é a pé. O barco da {T.operadora} faz o trecho Pontal do Sul–{T.destino} em {T.duracao}.</p>}>
        <ValoresTravessia T={T} />
        <div className="mt-8"><Nota titulo={`Desça em ${T.destino}`}>{T.avisoDestino}</Nota></div>
        <Link href="/como-chegar" className="sn-link mt-6 inline-flex min-h-11 items-center">Ver o passo a passo da chegada</Link>
      </Secao>

      <Secao titulo="Cuidados na ilha">
        <Lista itens={c.CUIDADOS_AMBIENTAIS} />
      </Secao>

      <Fecho titulo="Planejando a viagem?" texto={<p>Veja o passo a passo da chegada e as suítes livres para as suas datas.</p>}>
        <Link href="/como-chegar" className="sn-botao">Como chegar</Link>
        <Link href="/reservar" className="sn-botao-linha">Ver datas e preços</Link>
      </Fecho>
    </div>
  );
}
