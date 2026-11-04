import Image from "next/image";
import Link from "next/link";
import { comSql } from "@/lib/db-conexao";
import { lerRota } from "@/lib/rota";
import { COMPLEXO, ENDERECO, RESTAURANTE } from "@/lib/conteudo-pousada";
import { PlanejadorRota } from "@/components/site/rota/PlanejadorRota";
import { LinhaTravessia } from "../LinhaTravessia";
import { CabecalhoPagina, Fecho, Nota, Secao } from "./Partes";
import { ValoresTravessia } from "./ValoresTravessia";
import { conteudoDoPainel, fotoDaSecao } from "./dados";

/**
 * /como-chegar no site novo: o passo a passo na linha da travessia (a mesma da
 * página inicial), a travessia com terminais e valores, a chegada pelo
 * restaurante e o mapa com a rota de sempre (PlanejadorRota, com o #rota que
 * a página inicial usa). Textos do painel (Ilha, chegada e eventos; Rota e mapa).
 */
export async function ComoChegarNovo() {
  const [c, rota, capa, fachada] = await Promise.all([
    conteudoDoPainel(),
    comSql(lerRota).catch(() => null),
    fotoDaSecao(["praia", "pousada"], true),
    fotoDaSecao(["restaurante", "pousada"]),
  ]);
  const T = c.TRAVESSIA;
  const etapas = c.CHEGADA_ETAPAS;
  /* O trecho de barco é o que sai da etapa que fala em embarque/barco/travessia (padrão: a segunda). */
  const barco = Math.max(0, etapas.findIndex((e) => /embarq|barco|travessia/i.test(e.titulo)));

  return (
    <div>
      <CabecalhoPagina titulo="Como chegar" foto={capa ? { url: capa.url, alt: capa.alt || "Encantadas, Ilha do Mel" } : null}>
        <p>{c.SOBRE_A_ILHA.acesso}</p>
        <p className="mt-4"><a href="#rota" className="sn-link">Traçar a rota de onde você está</a></p>
      </CabecalhoPagina>

      <section aria-labelledby="sn-passos" className="sobre-escuro mt-16 bg-sn-mar text-white lg:mt-24">
        <div className="sn-margem mx-auto max-w-[1240px] py-16 lg:py-24">
          <h2 id="sn-passos" className="sn-h2 text-white">Passo a passo da chegada</h2>
          <p className="mt-4 max-w-[40rem] leading-relaxed text-white/80">
            Não há carros na ilha. Do continente, o barco leva {T.duracao} até {T.destino}, e do trapiche se chega a pé.
          </p>
          <LinhaTravessia className="mt-12 lg:mt-16"
            paradas={etapas.map((e, i) => ({ titulo: e.titulo, texto: e.texto, onda: i === barco && i < etapas.length - 1, fim: i === etapas.length - 1 }))} />
        </div>
      </section>
      <div className="sn-margem mx-auto mt-8 max-w-[1240px]">
        <Nota titulo={`Desça em ${T.destino}`}>{T.avisoDestino}</Nota>
      </div>

      <Secao id="travessia" titulo="A travessia" apoio={<p>Operada pela {T.operadora}. O trecho Pontal do Sul–{T.destino} leva {T.duracao}.</p>}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="sn-h3">De onde sai</h3>
            <ul className="mt-4 divide-y divide-sn-linha border-y border-sn-linha">
              {T.terminais.map((t) => (
                <li key={t.nome} className="py-3.5">
                  <p className="font-medium">{t.nome}{t.principal ? <span className="font-normal text-sn-texto-2">, o mais usado</span> : null}</p>
                  <p className="mt-0.5 text-[0.95rem] text-sn-texto-2">{t.endereco}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="sn-h3">Quanto custa</h3>
            <div className="mt-4"><ValoresTravessia T={T} /></div>
          </div>
        </div>
        <div className="mt-10"><Nota titulo="E o carro?">{T.estacionamento}</Nota></div>
      </Secao>

      <Secao titulo="Chegando na pousada">
        <div className={`grid gap-8 lg:items-center lg:gap-16 ${fachada ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}`}>
          {fachada && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-sn-areia">
              <Image src={fachada.url} alt={fachada.alt || `${RESTAURANTE.nome}, o restaurante da Pousada Marimar`} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
            </div>
          )}
          <div className="max-w-[38rem] space-y-3 leading-relaxed">
            <p>{COMPLEXO.fraseLonga}</p>
            <p><strong className="font-semibold">A entrada é pelo {RESTAURANTE.nome}</strong>, o restaurante da pousada, de frente para o mar.</p>
            <p className="text-sn-texto-2">{c.SOBRE_A_ILHA.bagagem}</p>
          </div>
        </div>
      </Secao>

      <Secao id="mapa" titulo={rota?.textos.titulo || "Trace a rota até a pousada"}
        apoio={<p>{ENDERECO.completo}. A entrada é pelo {RESTAURANTE.nome}, de frente para o mar.</p>}>
        {rota?.ativo ? <PlanejadorRota config={rota} /> : <Nota>{ENDERECO.rotuloMapa}</Nota>}
      </Secao>

      <Fecho titulo="Dúvida sobre a chegada?" texto={<p>A pousada ajuda a planejar o horário do barco e a caminhada até a porta.</p>}>
        <Link href="/contato" className="sn-botao">Falar com a pousada</Link>
        <Link href="/reservar" className="sn-botao-linha">Ver datas e preços</Link>
      </Fecho>
    </div>
  );
}
