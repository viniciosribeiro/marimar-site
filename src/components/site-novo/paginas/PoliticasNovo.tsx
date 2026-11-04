import Link from "next/link";
import { comSql } from "@/lib/db-conexao";
import { NAO_DISPONIVEL, POLITICAS } from "@/lib/conteudo-pousada";
import { lerRegras, textoCriancas, REGRAS_PADRAO } from "@/lib/regras-hospedagem";
import { CabecalhoPagina, Fecho, Secao } from "./Partes";
import { conteudoDoPainel } from "./dados";
import { Migalhas } from "../DadosEstruturados";

const SECOES = [
  { id: "chegada", titulo: "Horário de chegada" },
  { id: "cancelamento", titulo: "Cancelamento" },
  { id: "criancas", titulo: "Crianças e camas extras" },
  { id: "regras-da-casa", titulo: "Regras da casa" },
  { id: "o-que-nao-temos", titulo: "O que não temos" },
];

/**
 * /politicas no site novo: as regras oficiais com um índice. A regra de
 * crianças configurada no painel vence o texto padrão (é a mesma que calcula o
 * preço na busca e que a Marina usa), como no Clássico.
 */
export async function PoliticasNovo() {
  const [regras, c] = await Promise.all([comSql(lerRegras).catch(() => REGRAS_PADRAO), conteudoDoPainel()]);
  const criancas = textoCriancas(regras);
  return (
    <div>
      <Migalhas trilha={[["Políticas", "/politicas"]]} />
      <CabecalhoPagina titulo="Políticas">
        <p>As regras abaixo são as oficiais da pousada. Quando houver divergência com o que aparece em sites de reserva de terceiros, vale o que está aqui e o que consta na sua tarifa.</p>
      </CabecalhoPagina>

      <div className="sn-margem mx-auto mt-10 max-w-[860px]">
        <dl className="grid grid-cols-1 gap-4 border-y border-sn-linha py-5 sm:grid-cols-3">
          {[["Check-in", `a partir das ${POLITICAS.checkIn}`], ["Check-out", `até as ${POLITICAS.checkOut}`], ["Café da manhã", POLITICAS.cafeDaManha]].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[0.9rem] text-sn-texto-2">{k}</dt>
              <dd className="mt-0.5 font-titulo text-[1.35rem] leading-tight">{v}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Nesta página" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {SECOES.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="inline-flex h-11 items-center rounded-full bg-white px-4 text-[0.95rem] font-medium ring-1 ring-sn-linha hover:ring-sn-texto-2">{s.titulo}</a></li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="[&_p]:leading-relaxed [&_p+p]:mt-3">
        <Secao id="chegada" titulo="Horário de chegada" estreita>
          <p>Check-in a partir das <strong className="font-semibold">{POLITICAS.checkIn}</strong>.</p>
          <p>Normalmente aceitamos check-in até as <strong className="font-semibold">{POLITICAS.checkInLimite}</strong>, porque a chegada depende da travessia da {c.TRAVESSIA.operadora}. {POLITICAS.chegadaTardia}</p>
        </Secao>
        <Secao id="cancelamento" titulo="Cancelamento" estreita>
          {POLITICAS.cancelamento.map((t, i) => <p key={i}>{t}</p>)}
        </Secao>
        <Secao id="criancas" titulo="Crianças e camas extras" estreita>
          <p>{criancas ?? POLITICAS.criancas}</p>
          <p className="text-sn-texto-2">{POLITICAS.observacao}</p>
        </Secao>
        <Secao id="regras-da-casa" titulo="Regras da casa" estreita>
          <p>{POLITICAS.petsTexto}</p>
          <p>{POLITICAS.fumar}</p>
          <p>{POLITICAS.silencio}</p>
          <p>{POLITICAS.pacotes}</p>
        </Secao>
        <Secao id="o-que-nao-temos" titulo="O que não temos" estreita>
          {NAO_DISPONIVEL.map((n) => <p key={n.item}><strong className="font-semibold">{n.item}:</strong> {n.motivo}</p>)}
        </Secao>
      </div>

      <Fecho titulo="Dúvida sobre alguma regra?" texto={<p>Pergunte antes de reservar: a pousada responde.</p>}>
        <Link href="/contato" className="sn-botao">Falar com a pousada</Link>
        <Link href="/faq" className="sn-botao-linha">Perguntas frequentes</Link>
      </Fecho>
    </div>
  );
}
