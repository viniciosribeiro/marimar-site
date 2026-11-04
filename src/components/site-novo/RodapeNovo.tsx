import Link from "next/link";
import { COLUNAS_RODAPE } from "@/lib/navegacao";
import { COMPLEXO, ENDERECO, IDENTIDADE } from "@/lib/conteudo-pousada";

/**
 * Rodapé do site novo: mais leve que o do Clássico. Endereço e contatos de
 * verdade (Dados da pousada; sem número inventado), a mesma árvore de links
 * do topo e a linha da travessia em miniatura, que é a assinatura do site.
 */
export function RodapeNovo({ nome, logoUrl, whatsapp, whatsappDigitos, telefone, email, endereco }: {
  nome: string; logoUrl: string | null; whatsapp: string | null; whatsappDigitos: string;
  telefone: string | null; email: string | null; endereco: string | null;
}) {
  const ano = new Date().getFullYear();
  const lado = { paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" };
  return (
    <footer className="sobre-escuro mt-auto bg-sn-mar text-[#EAE4DA]">
      <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-14 sm:px-6 lg:px-10 lg:pb-14" style={lado}>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt={nome} width={150} height={40} className="h-10 w-auto brightness-0 invert" />
              : <p className="font-titulo text-[1.6rem] italic text-white">Marimar</p>}
            <p className="mt-4 text-[0.98rem] leading-relaxed text-white/85">{COMPLEXO.fraseRodape}</p>
            <address className="mt-5 not-italic text-[0.95rem] leading-relaxed text-white/75">
              {endereco || ENDERECO.completo}
            </address>
            <ul className="mt-4 space-y-1.5 text-[0.95rem]">
              {whatsappDigitos && whatsapp && (
                <li><a href={`https://wa.me/${whatsappDigitos}`} target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp {whatsapp}</a></li>
              )}
              {telefone && <li><a href={`tel:${telefone.replace(/\D/g, "")}`} className="hover:underline">Telefone {telefone}</a></li>}
              {email && <li><a href={`mailto:${email}`} className="break-all hover:underline">{email}</a></li>}
              <li><a href={IDENTIDADE.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline">Instagram {IDENTIDADE.instagramUser}</a></li>
            </ul>
          </div>

          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {COLUNAS_RODAPE.map((c) => (
              <div key={c.titulo}>
                <h2 className="font-titulo text-[1.05rem] text-white">{c.titulo}</h2>
                <ul className="mt-3 space-y-2 text-[0.93rem] text-white/75">
                  {c.itens.map((i) => (
                    <li key={i.href}><Link href={i.href} className="hover:text-white hover:underline">{i.rotulo}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* A travessia em miniatura: Pontal do Sul → barco → Encantadas. */}
        <div className="mt-12 border-t border-white/15 pt-6">
          <svg viewBox="0 0 600 28" className="h-7 w-full max-w-xl text-white/45" aria-hidden preserveAspectRatio="xMinYMid meet">
            <circle cx="6" cy="14" r="4" fill="currentColor" />
            <path d="M14 14 H150 C180 14 190 6 215 6 S250 22 275 22 S310 6 335 6 S370 22 395 22 S430 14 460 14 H580" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round" />
            <circle cx="588" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="588" cy="14" r="2.5" fill="currentColor" />
          </svg>
          <div className="mt-2 flex max-w-xl justify-between text-[0.8rem] text-white/60">
            <span>Pontal do Sul</span><span>Encantadas, Ilha do Mel</span>
          </div>
        </div>

        <p className="mt-8 text-[0.85rem] text-white/55">© {ano} {nome}</p>
      </div>
    </footer>
  );
}
