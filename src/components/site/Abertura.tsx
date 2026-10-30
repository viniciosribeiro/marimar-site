import { SeloMarimar } from "./Tropical";

/**
 * Abertura do site. Dois estilos (Identidade visual → Forma → Movimento):
 *
 * - "video" (30/10/2026, pedido do Vinicios): o pôr do sol no mar com a
 *   logo e um brilho passando letra a letra, os 5 s inteiros do vídeo. No
 *   computador ocupa a tela toda (corta só céu e mar, a logo fica no
 *   centro); no celular em pé o vídeo aparece inteiro no meio, com a própria
 *   imagem desfocada completando o céu e o mar acima e abaixo.
 * - "logo" (19/10/2026): a logo surge no centro, o texto ("Pousada")
 *   aparece letra a letra embaixo, e a tela se abre para o site.
 *
 * Nos dois:
 * - Animação e saída só com CSS (globals.css, `.abertura`): aparece na
 *   primeira pintura e some sozinha, mesmo sem JavaScript.
 * - Uma vez por visita: o script curto ANTES dela marca a aba
 *   (sessionStorage). Ao recarregar ou trocar de página na mesma aba, o
 *   `<html data-abertura="vista">` a esconde antes de pintar — sem piscar.
 * - Não pega toque (`pointer-events: none`): no iPhone, uma camada por
 *   cima, mesmo transparente, travava o "Escolher data" (27/10/2026).
 * - Quem pediu "reduzir movimento" no aparelho não vê a abertura.
 */

/* Arquivos em public/abertura. O MP4 (H.264) toca em todo celular e
   navegador comum; o WebM é só reserva para navegador sem H.264. */
const VIDEO_MP4 = "/abertura/por-do-sol.mp4";
const VIDEO_WEBM = "/abertura/por-do-sol.webm";
const CAPA = "/abertura/por-do-sol.jpg";

const MARCAR_VISITA = `try{if(sessionStorage.getItem("marimar:abertura")){document.documentElement.dataset.abertura="vista"}else{sessionStorage.setItem("marimar:abertura","1")}}catch(e){}`;

/* O vídeo só ganha endereço (e só é baixado) quando a abertura vai mesmo
   aparecer: não na segunda página da visita, não para quem pediu menos
   movimento e não com "economia de dados" ligada — aí fica a capa parada. */
const LIGAR_VIDEO = `try{var d=document.documentElement,v=document.getElementById("abertura-video"),c=navigator.connection;
if(v&&d.dataset.abertura!=="vista"&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!(c&&c.saveData)){
v.muted=true;v.defaultMuted=true;v.setAttribute("muted","");v.setAttribute("playsinline","");
v.src=v.canPlayType('video/mp4; codecs="avc1.640028"')?"${VIDEO_MP4}":"${VIDEO_WEBM}";
var p=v.play();if(p&&p.catch)p.catch(function(){})}}catch(e){}`;

export function Abertura({ estilo, logoUrl, texto }: { estilo: "video" | "logo"; logoUrl: string | null; texto: string }) {
  if (estilo === "video") {
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: MARCAR_VISITA }} />
        <div className="abertura abertura--video" aria-hidden="true" suppressHydrationWarning>
          <span className="abertura__fundo" style={{ backgroundImage: `url(${CAPA})` }} />
          <video id="abertura-video" className="abertura__video" poster={CAPA} muted playsInline autoPlay preload="none"
            disablePictureInPicture disableRemotePlayback tabIndex={-1} suppressHydrationWarning />
          <script dangerouslySetInnerHTML={{ __html: LIGAR_VIDEO }} />
        </div>
      </>
    );
  }

  const letras = Array.from(texto.trim() || "Pousada");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: MARCAR_VISITA }} />
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
              <span key={i} style={{ ["--i" as string]: i }}>{l === " " ? " " : l}</span>
            ))}
          </span>
          <span className="abertura__linha" />
        </div>
      </div>
    </>
  );
}
