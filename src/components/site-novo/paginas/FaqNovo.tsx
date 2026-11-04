import Link from "next/link";
import { comSql } from "@/lib/db-conexao";
import { lerContato } from "@/lib/pousada";
import { COMPLEXO, faqCanonico } from "@/lib/conteudo-pousada";
import { CabecalhoPagina, Fecho } from "./Partes";
import { PerguntasComBusca, type GrupoPerguntas } from "./PerguntasComBusca";
import { conteudoDoPainel } from "./dados";
import { DadosEstruturados } from "../DadosEstruturados";
import { noMigalhas, noPerguntas } from "@/lib/site-novo/dados-estruturados";
import { urlDoSite } from "@/lib/seo";

/** /faq no site novo: as mesmas perguntas do Clássico (canônicas + as do painel, sem repetir), com busca. */
export async function FaqNovo() {
  const [c, contato, extras] = await Promise.all([
    conteudoDoPainel(),
    lerContato(),
    comSql((sql) => sql<{ id: string; pergunta: string; resposta: string }[]>`SELECT id, pergunta, resposta FROM faq WHERE ativo = true ORDER BY ordem`)
      .then((l) => [...l]).catch(() => [] as { id: string; pergunta: string; resposta: string }[]),
  ]);
  const canonico = faqCanonico(c);
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const conhecidas = new Set(canonico.flatMap((g) => g.itens.map((i) => norm(i.p))));
  const outras = extras.filter((f) => !conhecidas.has(norm(f.pergunta)));
  const grupos: GrupoPerguntas[] = [
    ...canonico.map((g) => ({ titulo: g.grupo, itens: g.itens.map((i) => ({ p: i.p, r: i.r })) })),
    ...(outras.length ? [{ titulo: "Outras dúvidas", itens: outras.map((f) => ({ p: f.pergunta, r: f.resposta })) }] : []),
  ];
  const wa = contato.whatsappDigitos || null;

  return (
    <div>
      <DadosEstruturados nos={[noPerguntas(urlDoSite(), grupos.flatMap((g) => g.itens)), noMigalhas(urlDoSite(), [["Perguntas frequentes", "/faq"]])]} />
      <CabecalhoPagina titulo="Perguntas frequentes">
        <p>A dúvida mais comum primeiro: <strong className="font-semibold text-sn-texto">{COMPLEXO.respostaFaq}</strong></p>
      </CabecalhoPagina>
      <div className="sn-margem mx-auto mt-10 max-w-[860px]">
        <PerguntasComBusca grupos={grupos} whatsapp={wa} />
      </div>
      <Fecho titulo="Não achou o que precisava?">
        {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="sn-botao">Perguntar no WhatsApp</a>}
        <Link href="/politicas" className="sn-botao-linha">Ver as políticas</Link>
      </Fecho>
    </div>
  );
}
