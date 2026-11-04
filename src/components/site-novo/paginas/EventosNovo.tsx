import { lerContato } from "@/lib/pousada";
import { COMPLEXO } from "@/lib/conteudo-pousada";
import { CabecalhoPagina, Fecho, Lista, Secao } from "./Partes";
import { conteudoDoPainel, fotoDaSecao } from "./dados";

/** /eventos no site novo: o que a pousada realiza, os espaços e o contato (valores e capacidade são sob consulta). */
export async function EventosNovo() {
  const [c, contato, foto] = await Promise.all([conteudoDoPainel(), lerContato(), fotoDaSecao(["eventos"])]);
  const E = c.EVENTOS;
  const wa = contato.whatsappDigitos;
  return (
    <div>
      <CabecalhoPagina titulo="Eventos e casamentos" foto={foto ? { url: foto.url, alt: foto.alt || "Evento na Pousada Marimar" } : null}>
        <p>Celebrar em Encantadas é reunir as pessoas em um lugar onde não passa carro, o mar está na porta e ninguém tem pressa de ir embora.</p>
      </CabecalhoPagina>

      <Secao titulo="O que realizamos e onde">
        <div className="grid max-w-[60rem] gap-10 md:grid-cols-2">
          <div>
            <h3 className="sn-h3">O que realizamos</h3>
            <div className="mt-4"><Lista itens={E.tipos} /></div>
          </div>
          <div>
            <h3 className="sn-h3">Espaços</h3>
            <div className="mt-4"><Lista itens={E.espacos} /></div>
          </div>
        </div>
        <p className="mt-10 max-w-[44rem] leading-relaxed">{COMPLEXO.fraseLonga}</p>
        {E.capacidade && <p className="mt-3 max-w-[44rem] leading-relaxed">Capacidade: {E.capacidade}.</p>}
      </Secao>

      <Fecho titulo="Vamos montar o seu" texto={<p>{E.avisoPendente}</p>}>
        {wa && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent("Olá! Gostaria de informações sobre eventos na Pousada Marimar.")}`}
            target="_blank" rel="noopener noreferrer" className="sn-botao">Falar sobre meu evento</a>
        )}
      </Fecho>
    </div>
  );
}
