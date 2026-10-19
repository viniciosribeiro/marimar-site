import { SeloMarimar } from "./Tropical";

/**
 * Abertura do site (pedido do Vinicios em 19/10/2026): ao abrir o site, a
 * logo da Marimar surge no centro da tela, o texto ("Pousada") aparece letra
 * a letra embaixo, e a tela se abre para o site. Igual no celular e no
 * computador. Antes, quem abria via só o ícone padrão da Vercel.
 *
 * - Desenhada no servidor e animada só com CSS (globals.css, `.abertura`):
 *   aparece já na primeira pintura, sem esperar o JavaScript, e some sozinha
 *   mesmo sem ele.
 * - Uma vez por visita: o script curto ANTES dela marca a aba
 *   (sessionStorage). Ao recarregar ou trocar de página na mesma aba, o
 *   `<html data-abertura="vista">` a esconde antes de pintar — sem piscar.
 * - Quem pediu "reduzir movimento" no aparelho não vê a abertura.
 * - Liga, desliga e troca o texto em Identidade visual → Forma → Movimento.
 */
export function Abertura({ logoUrl, texto }: { logoUrl: string | null; texto: string }) {
  const letras = Array.from(texto.trim() || "Pousada");
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("marimar:abertura")){document.documentElement.dataset.abertura="vista"}else{sessionStorage.setItem("marimar:abertura","1")}}catch(e){}`,
        }}
      />
      <div className="abertura" aria-hidden="true" suppressHydrationWarning>
        <div className="abertura__palco">
          <span className="abertura__halo" />
          <span className="abertura__logo">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt="" fetchPriority="high" />
            ) : (
              <SeloMarimar tamanho={120} />
            )}
          </span>
          <span className="abertura__texto">
            {letras.map((l, i) => (
              <span key={i} style={{ ["--i" as string]: i }}>{l === " " ? " " : l}</span>
            ))}
          </span>
          <span className="abertura__linha" />
        </div>
      </div>
    </>
  );
}
