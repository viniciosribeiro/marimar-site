import Link from "next/link";
import { lerPousada } from "@/lib/pousada";
import { lerTema } from "@/lib/tema";
import { modeloDaVisita } from "@/lib/modelo-site";
import { LayoutNovo } from "./LayoutNovo";

/* Os quatro destinos de quase toda visita: escolher, ver preço, chegar, tirar dúvida. */
const CAMINHOS = [
  { href: "/quartos", titulo: "Suítes", texto: "Fotos, camas e quantas pessoas cabem em cada uma" },
  { href: "/reservar", titulo: "Datas e preços", texto: "Quais suítes estão livres nas suas datas e quanto custam" },
  { href: "/como-chegar", titulo: "Como chegar", texto: "De Pontal do Sul até a porta, com o barco para Encantadas" },
  { href: "/faq", titulo: "Perguntas frequentes", texto: "Chegada, estadia, restaurante, reserva e cancelamento" },
];

/**
 * A página "não encontrada" no site novo (endereço que não existe, suíte ou
 * pacote desligado). Fica fora do layout do site (o Next a desenha só com o
 * layout raiz), por isso traz o casco do Novo consigo.
 */
export async function NaoEncontradaNovo() {
  const [p, visita] = await Promise.all([lerPousada(), modeloDaVisita()]);
  return (
    <LayoutNovo p={p ?? {}} tema={lerTema(p)} visita={visita}>
      <section aria-labelledby="sn-nao-encontrada" className="sn-margem mx-auto max-w-[860px] pb-20 pt-12 lg:pb-28 lg:pt-20">
        <h1 id="sn-nao-encontrada" className="sn-titulo-pagina">Não encontramos esta página</h1>
        <p className="mt-4 max-w-[36rem] text-[1.06rem] leading-relaxed text-sn-texto-2">
          O endereço pode ter mudado ou ter sido digitado com algum erro. Daqui você chega ao que quase todo mundo procura:
        </p>
        <ul className="mt-8 border-t border-sn-linha">
          {CAMINHOS.map((c) => (
            <li key={c.href} className="border-b border-sn-linha">
              <Link href={c.href} className="group flex min-h-16 items-center justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="block text-[1.08rem] font-semibold">{c.titulo}</span>
                  <span className="mt-0.5 block text-[0.95rem] leading-snug text-sn-texto-2">{c.texto}</span>
                </span>
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 text-sn-texto-2 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <Link href="/" className="sn-botao-linha">Voltar ao início</Link>
        </div>
      </section>
    </LayoutNovo>
  );
}
