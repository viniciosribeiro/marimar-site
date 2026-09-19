"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ALTURAS, LARGURAS, ANIMACOES, posicaoClasses, veuCss, texturaCss, type Banner,
} from "@/lib/banners";

/**
 * UM banner, em camadas:
 *
 *   1. mídia   — foto ou vídeo, com ponto focal
 *   2. véu     — gradiente que garante contraste ao texto
 *   3. textura — grão, pontos ou linhas
 *   4. conteúdo
 *
 * O MESMO componente desenha o site e a prévia do admin. É o que impede a
 * prévia de mentir: não existe um segundo renderizador para divergir.
 */
export function BannerCamadas({
  b, ativo = true, prioridade = false, previa = false, children,
}: {
  b: Banner;
  /** Slide visível. Inativo não anima nem toca vídeo. */
  ativo?: boolean;
  /** Só o primeiro slide da home: ele é o LCP. */
  prioridade?: boolean;
  /** Dentro do editor: sem links de verdade e sem vídeo pesado. */
  previa?: boolean;
  children?: React.ReactNode;
}) {
  const pos = posicaoClasses(b.posicao, b.centralizar_celular);
  const veu = veuCss(b.veu, b.veu_forca);
  const textura = texturaCss(b.textura, b.textura_forca);
  const claro = b.cor_texto === "claro";
  const foco = `${b.foco_x}% ${b.foco_y}%`;

  const anima = useAnimacoesLigadas();
  const classeAnim = anima && ativo ? ANIMACOES[b.animacao] : "";
  const sombra = b.sombra_texto
    ? claro
      ? "drop-shadow-[0_2px_12px_rgb(0_0_0/0.55)]"
      : "drop-shadow-[0_1px_6px_rgb(255_255_255/0.65)]"
    : "";

  return (
    <div className={`relative isolate overflow-hidden flex flex-col ${ALTURAS[b.altura]} ${
      claro ? "text-white" : "text-tinta"
    }`}>
      {/* ── 1. mídia ── */}
      <Midia b={b} ativo={ativo} prioridade={prioridade} previa={previa} foco={foco} anima={anima} />

      {/* ── 2. véu ── */}
      {veu && <div className="absolute inset-0 -z-10" style={{ backgroundImage: veu }} aria-hidden />}

      {/* ── 3. textura ── */}
      {textura && <div className="absolute inset-0 -z-10 mix-blend-overlay" style={textura} aria-hidden />}

      {/* ── 4. conteúdo ── */}
      <div className={`relative flex-1 flex flex-col px-5 sm:px-8 ${pos.vertical} ${pos.horizontal}`}>
        <div className={`w-full ${LARGURAS[b.largura_texto]} ${pos.texto} ${classeAnim}`}>
          {b.rotulo && (
            <p className={`text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] mb-3 ${
              claro ? "text-white/85" : "text-tinta-suave"
            } ${sombra}`}>
              {b.rotulo}
            </p>
          )}

          {b.titulo && (
            <h1 className={`font-titulo font-bold leading-[1.08] text-balance text-3xl sm:text-5xl lg:text-6xl ${
              claro ? "text-white" : "text-tinta"
            } ${sombra}`}>
              {b.titulo}
            </h1>
          )}

          {b.subtitulo && (
            <p className={`mt-4 text-base sm:text-lg lg:text-xl leading-relaxed text-pretty ${
              claro ? "text-white/90" : "text-tinta-suave"
            } ${sombra}`}>
              {b.subtitulo}
            </p>
          )}

          {b.texto && (
            <p className={`mt-4 text-sm sm:text-base leading-relaxed text-pretty ${
              claro ? "text-white/80" : "text-tinta-suave"
            }`}>
              {b.texto}
            </p>
          )}

          {(b.cta_texto || b.cta2_texto) && (
            <div className={`flex flex-wrap gap-3 mt-7 ${pos.botoes}`}>
              {b.cta_texto && (
                <Botao href={b.cta_href} previa={previa} principal claro={claro}>
                  {b.cta_texto}
                </Botao>
              )}
              {b.cta2_texto && (
                <Botao href={b.cta2_href} previa={previa} claro={claro}>
                  {b.cta2_texto}
                </Botao>
              )}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── mídia ───────────────────────── */

function Midia({
  b, ativo, prioridade, previa, foco, anima,
}: {
  b: Banner; ativo: boolean; prioridade: boolean; previa: boolean; foco: string; anima: boolean;
}) {
  const ehVideo = b.tipo_midia === "video" && !!b.video_url;
  const cartaz = b.imagem_url || null;
  const telaPequena = useTelaPequena();

  /**
   * O vídeo só toca quando faz sentido gastar a banda de quem está vendo:
   * slide visível, animações ligadas, fora da prévia do editor, e — no
   * celular — só se quem cadastrou pediu. Em qualquer outro caso fica a
   * foto de cartaz, que já estava carregada de qualquer jeito.
   */
  const tocarVideo = ehVideo && ativo && anima && !previa && (!telaPequena || b.video_no_celular);

  return (
    <>
      {cartaz && (
        <Image
          src={cartaz}
          alt={b.alt || ""}
          fill
          priority={prioridade}
          sizes="100vw"
          className={`object-cover -z-10 ${anima && b.ken_burns && ativo ? "anim-ken-burns" : ""}`}
          style={{ objectPosition: foco }}
        />
      )}

      {tocarVideo && (
        <video
          src={b.video_url!}
          poster={cartaz ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          // `aria-hidden` porque é decoração: nenhuma informação vive só aqui.
          aria-hidden
          className="absolute inset-0 -z-10 w-full h-full object-cover"
          style={{ objectPosition: foco }}
        />
      )}

      {!cartaz && !tocarVideo && (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-marca via-marca-hover to-marca-escura" />
      )}
    </>
  );
}

function Botao({
  href, children, principal, claro, previa,
}: {
  href: string | null; children: React.ReactNode; principal?: boolean; claro: boolean; previa: boolean;
}) {
  const classe = principal
    ? "bg-marca text-marca-texto hover:bg-marca-hover shadow-marca"
    : claro
    ? "border border-white/70 text-white hover:bg-white/15 backdrop-blur-sm"
    : "border border-linha text-tinta hover:bg-areia";

  const comum = `inline-flex items-center justify-center px-6 py-3 rounded-marca text-sm sm:text-base font-semibold transition-marca ${classe}`;

  // Na prévia o botão não navega: clicar levaria a pessoa para fora do
  // editor, perdendo o rascunho que ela ainda não publicou.
  if (previa || !href) return <span className={comum}>{children}</span>;
  return <Link href={href} className={comum}>{children}</Link>;
}

/* ───────────────────────── ganchos ───────────────────────── */

/**
 * Animações ligadas?
 *
 * Duas fontes: o botão "Animações" do editor visual (que zera `--duracao`) e
 * o `prefers-reduced-motion` do sistema. Qualquer um dos dois desliga — quem
 * pediu menos movimento pediu por um motivo.
 */
function useAnimacoesLigadas() {
  const [ligadas, setLigadas] = useState(true);
  useEffect(() => {
    const menos = window.matchMedia("(prefers-reduced-motion: reduce)");
    const avaliar = () => {
      const d = getComputedStyle(document.documentElement).getPropertyValue("--duracao");
      setLigadas(!menos.matches && !(d && parseFloat(d) < 1));
    };
    avaliar();
    menos.addEventListener("change", avaliar);
    return () => menos.removeEventListener("change", avaliar);
  }, []);
  return ligadas;
}

function useTelaPequena() {
  const [pequena, setPequena] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const ver = () => setPequena(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);
  return pequena;
}

/** Usado pela prévia do admin, que não quer o gancho de tela real. */
export const _internos = { useAnimacoesLigadas, useTelaPequena };
