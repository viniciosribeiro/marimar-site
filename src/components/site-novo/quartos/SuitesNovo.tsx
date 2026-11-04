import Link from "next/link";
import { pluralizar } from "@/lib/format";
import { lerContato } from "@/lib/pousada";
import { comSql } from "@/lib/db-conexao";
import { lerRegras, REGRAS_PADRAO } from "@/lib/regras-hospedagem";
import { BuscaNovo } from "../BuscaNovo";
import { CartaoSuiteNovo } from "./CartaoSuiteNovo";
import { lerPessoas } from "./preco";
import { lerSuitesAtivas } from "./dados";

/**
 * /quartos no site novo: as suítes com foto inteira, para quantas pessoas
 * cabem e um preço de referência dito com todas as letras (para quantos
 * adultos, para quando). "Para quantas pessoas?" filtra pela capacidade e
 * consulta a referência para esse número de adultos. Sem datas aqui: o
 * preço exato é na página da suíte ou na busca.
 */
export async function SuitesNovo({ pessoas }: { pessoas?: string }) {
  const [suites, contato, regras] = await Promise.all([
    lerSuitesAtivas(),
    lerContato(),
    comSql(lerRegras).catch(() => REGRAS_PADRAO),
  ]);
  const regraCriancas = regras.idadeColoMax !== null ? { idadeColoMax: regras.idadeColoMax } : null;
  const maior = Math.max(0, ...(suites ?? []).map((s) => s.ocupacao_max));
  const n = lerPessoas(pessoas, maior);
  const visiveis = (suites ?? []).filter((s) => !n || s.ocupacao_max >= n);
  const adultos = Math.max(2, n);
  const opcoes = Array.from({ length: Math.max(0, Math.min(maior, 6) - 1) }, (_, i) => i + 2);

  return (
    <div>
      <div className="sn-margem mx-auto max-w-[1240px] pt-10 lg:pt-16">
        <h1 className="sn-titulo-pagina">As suítes</h1>
        <p className="mt-4 max-w-[38rem] text-[1.06rem] leading-relaxed text-sn-texto-2">
          {suites?.length ? `${pluralizar(suites.length, "suíte")} a poucos passos do trapiche de Encantadas. ` : ""}
          Todas com banheiro privativo, ar-condicionado e café da manhã incluso.
        </p>

        {suites && suites.length > 0 && opcoes.length > 0 && (
          <nav aria-label="Filtrar as suítes por número de pessoas" className="mt-8">
            <p className="text-[0.92rem] font-medium text-sn-texto-2">Para quantas pessoas?</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              <li><Filtro href="/quartos" ativo={!n}>Todas</Filtro></li>
              {opcoes.map((o) => (
                <li key={o}><Filtro href={`/quartos?pessoas=${o}`} ativo={n === o}>{o === Math.min(maior, 6) && maior > 6 ? `${o} ou mais` : String(o)}</Filtro></li>
              ))}
            </ul>
          </nav>
        )}

        {suites === null ? (
          <div className="mt-10 rounded-[18px] bg-sn-areia/60 p-8">
            <p className="text-[1.05rem]">Não conseguimos carregar as suítes agora. Tente de novo em instantes.</p>
            <Link href="/reservar" className="sn-botao mt-5">Ver datas e preços</Link>
          </div>
        ) : visiveis.length === 0 ? (
          <div className="mt-10 rounded-[18px] bg-sn-areia/60 p-8">
            <p className="text-[1.05rem]">
              {n ? `Nenhuma suíte acomoda ${pluralizar(n, "pessoa")} sozinha.` : "Nenhuma suíte publicada no momento."}
              {" "}Fale com a pousada pelo WhatsApp: dá para consultar mais de uma suíte para as mesmas datas.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {contato.whatsappDigitos && (
                <a href={`https://wa.me/${contato.whatsappDigitos}?text=${encodeURIComponent(`Olá! Somos ${n ? pluralizar(n, "pessoa") : "um grupo"} e gostaríamos de consultar suítes na Pousada Marimar.`)}`}
                  target="_blank" rel="noopener noreferrer" className="sn-botao">Perguntar no WhatsApp</a>
              )}
              {n > 0 && <Link href="/quartos" className="sn-botao-linha">Ver todas as suítes</Link>}
            </div>
          </div>
        ) : (
          <>
            <p className="mt-6 max-w-[42rem] text-[0.93rem] text-sn-texto-2">
              Preço por noite para {pluralizar(adultos, "adulto")}, consultado agora no sistema de reservas para daqui a
              uma semana. O preço exato aparece quando você escolhe as datas.
            </p>
            <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
              {visiveis.map((q) => (
                <li key={q.id} className="min-w-0">
                  <CartaoSuiteNovo q={q} nivel="h2" adultosReferencia={adultos}
                    consulta={n ? `?adultos=${n}` : ""}
                    sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw" />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <section aria-labelledby="sn-datas" className="mt-20 bg-sn-areia/60 lg:mt-28">
        <div className="sn-margem mx-auto grid max-w-[1240px] gap-8 py-14 lg:grid-cols-[1fr_27rem] lg:items-center lg:gap-16 lg:py-20">
          <div className="max-w-[34rem]">
            <h2 id="sn-datas" className="sn-h2">Já sabe as datas?</h2>
            <p className="mt-3 text-sn-texto-2">
              Veja quais suítes estão livres e o preço exato para a sua estadia, direto do sistema de reservas da pousada.
            </p>
          </div>
          <div data-sem-flutuante>
            <BuscaNovo regra={regraCriancas} estilo="contorno" inicial={n ? { adultos: Math.min(4, n) } : undefined} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Filtro({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} aria-current={ativo ? "true" : undefined}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-4 text-[0.97rem] font-medium tabular-nums transition-colors ${ativo
        ? "bg-sn-mar text-white"
        : "bg-white text-sn-texto ring-1 ring-sn-linha hover:ring-sn-texto-2"}`}>
      {children}
    </Link>
  );
}
