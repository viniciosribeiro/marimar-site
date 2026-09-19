"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

export type BannerPublico = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  imagem_url: string;
  alt: string | null;
  cta_texto: string | null;
  cta_href: string | null;
};

/**
 * Carrossel do topo da home.
 *
 * Regras que ele respeita, e o porque de cada uma:
 *
 * - **Um banner so nao vira carrossel.** Sem setas, sem bolinhas, sem
 *   temporizador. Controles para navegar entre um item so sao ruido.
 * - **Para sozinho** com o mouse em cima, com o foco dentro, ou com a aba
 *   em segundo plano. Trocar a imagem por baixo de quem esta lendo e a
 *   forma mais rapida de irritar; e girar numa aba escondida so gasta
 *   bateria.
 * - **Respeita `prefers-reduced-motion`**, e tambem o botao de animacoes do
 *   editor: `--duracao` vira quase zero e o giro automatico nao comeca.
 * - **So a primeira imagem tem `priority`.** Ela e o LCP da home; marcar
 *   todas faria o navegador disputar banda consigo mesmo.
 */
export function CarrosselBanners({
  banners, children,
}: {
  banners: BannerPublico[];
  /** A busca de disponibilidade, que fica por cima de qualquer banner. */
  children?: React.ReactNode;
}) {
  const [atual, setAtual] = useState(0);
  const [parado, setParado] = useState(false);
  const toqueX = useRef<number | null>(null);
  const total = banners.length;

  const ir = useCallback((i: number) => setAtual(((i % total) + total) % total), [total]);

  useEffect(() => {
    if (total < 2 || parado) return;

    // Se o site esta com animacoes desligadas (ou o sistema pede menos
    // movimento), o carrossel simplesmente nao gira: quem quiser ver os
    // outros banners usa as bolinhas.
    const duracao = getComputedStyle(document.documentElement).getPropertyValue("--duracao");
    if (duracao && parseFloat(duracao) < 1) return;

    const t = setInterval(() => setAtual((a) => (a + 1) % total), 7000);
    return () => clearInterval(t);
  }, [total, parado]);

  useEffect(() => {
    const aoTrocarAba = () => setParado(document.hidden);
    document.addEventListener("visibilitychange", aoTrocarAba);
    return () => document.removeEventListener("visibilitychange", aoTrocarAba);
  }, []);

  return (
    <section
      className="relative isolate text-white py-24 lg:py-32 overflow-hidden bg-gradient-to-br from-marca via-marca-hover to-marca-escura"
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
      onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toqueX.current === null || total < 2) return;
        const d = e.changedTouches[0].clientX - toqueX.current;
        if (Math.abs(d) > 50) ir(atual + (d < 0 ? 1 : -1));
        toqueX.current = null;
      }}
      aria-roledescription={total > 1 ? "carrossel" : undefined}
    >
      {banners.map((b, i) => (
        <div key={b.id}
          className="absolute inset-0 -z-10 transition-opacity duration-700"
          style={{ opacity: i === atual ? 1 : 0 }}
          aria-hidden={i !== atual}>
          <Image src={b.imagem_url} alt={b.alt || ""} fill priority={i === 0}
            sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />
        </div>
      ))}

      <div className="relative max-w-5xl mx-auto px-4 text-center">
        {banners.map((b, i) => (
          <div key={b.id} className={i === atual ? "block" : "hidden"}>
            {b.titulo && (
              <h1 className="font-titulo text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 leading-tight drop-shadow-sm text-white">
                {b.titulo}
              </h1>
            )}
            {b.subtitulo && (
              <p className="text-base lg:text-lg text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
                {b.subtitulo}
              </p>
            )}
            {b.cta_texto && b.cta_href && (
              <Link href={b.cta_href}
                className="inline-block bg-white text-tinta px-6 py-3 rounded-marca font-semibold shadow-marca hover:bg-white/90 transition-marca">
                {b.cta_texto}
              </Link>
            )}
          </div>
        ))}

        {children}

        {total > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            {banners.map((b, i) => (
              <button key={b.id} onClick={() => ir(i)}
                aria-label={`Ver banner ${i + 1} de ${total}`}
                aria-current={i === atual}
                className="p-2 -m-1 group">
                <span className={`block h-1.5 rounded-full transition-all ${
                  i === atual ? "w-7 bg-white" : "w-3 bg-white/50 group-hover:bg-white/80"
                }`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
