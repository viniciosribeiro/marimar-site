import Link from "next/link";
import { lerPousada } from "@/lib/pousada";
import { Icone } from "@/components/site/Icone";
import { AVALIACOES, COMODIDADES_CONFIRMADAS, COMPLEXO, DIFERENCIAIS, NAO_DISPONIVEL, RESTAURANTE } from "@/lib/conteudo-pousada";
import { CabecalhoPagina, Fecho, Lista, Nota, Secao } from "./Partes";
import { fotoDaSecao } from "./dados";

/** /a-pousada no site novo: quem somos, a pousada e o restaurante, a história (painel), o que oferecemos e o que não temos. */
export async function APousadaNovo() {
  const [p, foto] = await Promise.all([lerPousada(), fotoDaSecao(["pousada"])]);
  const historia = typeof p?.descricao_longa === "string" && p.descricao_longa.trim()
    ? p.descricao_longa.trim().split(/\n\s*\n/)
    : null;
  const google = AVALIACOES.plataformas[0];

  return (
    <div>
      <CabecalhoPagina titulo="A Pousada Marimar" foto={foto ? { url: foto.url, alt: foto.alt || "Pousada Marimar" } : null}>
        <p>{COMPLEXO.fraseLonga}</p>
      </CabecalhoPagina>

      <Secao titulo="A pousada e o restaurante">
        <div className="grid max-w-[60rem] gap-10 md:grid-cols-2">
          <div className="border-t border-sn-linha pt-5">
            <h3 className="sn-h3">Pousada Marimar</h3>
            <p className="mt-2 leading-relaxed">Suítes climatizadas, café da manhã incluso e administração familiar, a poucos passos do trapiche de Encantadas.</p>
            <Link href="/quartos" className="sn-link mt-2 inline-flex min-h-11 items-center">Ver as suítes</Link>
          </div>
          <div className="border-t border-sn-linha pt-5">
            <h3 className="sn-h3">{RESTAURANTE.nome}</h3>
            <p className="mt-2 leading-relaxed">{RESTAURANTE.posicao}</p>
            <Link href="/restaurante" className="sn-link mt-2 inline-flex min-h-11 items-center">Ver o restaurante</Link>
          </div>
        </div>
      </Secao>

      <Secao titulo="Nossa história" estreita>
        <div className="space-y-4 text-[1.04rem] leading-relaxed">
          {historia ? historia.map((t, i) => <p key={i} className="whitespace-pre-line">{t}</p>) : (
            <>
              <p>
                A Marimar é um empreendimento de administração familiar em Encantadas, na Ilha do Mel. Ao longo dos anos o
                negócio apareceu sob nomes diferentes (Marimar Hostel, Marimar Hostel Internacional, Marimar Pousada,
                Marimar Bistrô) e hoje opera como Pousada Marimar e {RESTAURANTE.nome}.
              </p>
              <p>
                O que não mudou foi a posição: de frente para o mar, a poucos passos do trapiche por onde chega quem visita
                Encantadas, com o restaurante da casa à beira-mar.
              </p>
            </>
          )}
        </div>
      </Secao>

      <Secao titulo="O que oferecemos">
        <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {DIFERENCIAIS.map((d) => (
            <li key={d.titulo} className="flex items-start gap-3.5">
              <Icone nome={d.icone} tamanho={24} className="mt-0.5 shrink-0 text-sn-mare-texto" />
              <div className="min-w-0">
                <h3 className="font-semibold">{d.titulo}</h3>
                <p className="mt-0.5 text-[0.95rem] leading-relaxed text-sn-texto-2">{d.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Comodidades">
        <Lista colunas={2} itens={[...COMODIDADES_CONFIRMADAS]} />
        <div className="mt-10">
          <Nota titulo="Para você não se surpreender">
            <ul className="space-y-1.5">
              {NAO_DISPONIVEL.map((n) => <li key={n.item}><strong className="font-semibold">{n.item}:</strong> {n.motivo}</li>)}
            </ul>
          </Nota>
        </div>
      </Secao>

      <Fecho titulo="Quer ver de perto?"
        texto={<p>{google.nota.toString().replace(".", ",")} de {google.escala} no {google.nome}, com {google.total} avaliações. <Link href="/avaliacoes" className="sn-link">Ver as notas</Link></p>}>
        <Link href="/reservar" className="sn-botao">Ver datas e preços</Link>
        <Link href="/como-chegar" className="sn-botao-linha">Como chegar</Link>
      </Fecho>
    </div>
  );
}
