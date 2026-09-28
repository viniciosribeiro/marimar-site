"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACAO, grupoAtivo, type GrupoNav } from "@/lib/navegacao";
import { MarcaLockup } from "./MarcaLockup";
import { FolhaPalmeira } from "./Tropical";

type Props = {
  nome: string;
  logoUrl?: string | null;
  /** Escrever o nome ao lado da imagem. Logo que ja traz o nome desenhado
      nao precisa — e repetido fica pior do que so a imagem. */
  mostrarNome?: boolean;
  /** Texto proprio ao lado da logo; vazio usa o nome da pousada. */
  nomeTexto?: string | null;
  /** Segunda linha, menor. Ex.: "POUSADA" sob "Marimar". */
  nomeSubtexto?: string | null;
  /** Arranjo da barra em tela larga. Abaixo de `lg` e sempre logo + Menu:
      e o unico arranjo que cabe, e os tres viram o mesmo ali. */
  topo?: "esquerda" | "centro" | "dividido";
  whatsappDigitos?: string;
  whatsappExibicao?: string | null;
  instagram: string;
  instagramUser: string;
};

/* ─────────────────────────── icones ─────────────────────────── */

function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconeWhats({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    </svg>
  );
}

/* ══════════════════════════ componente ══════════════════════════ */

export function MenuPrincipal({
  nome,
  logoUrl,
  mostrarNome = true,
  nomeTexto = null,
  nomeSubtexto = null,
  topo = "esquerda",
  whatsappDigitos,
  whatsappExibicao,
  instagram,
  instagramUser,
}: Props) {
  const pathname = usePathname();

  /** Painel aberto no desktop (rotulo do grupo) e gaveta do celular. */
  const [painel, setPainel] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState(false);
  const [sanfona, setSanfona] = useState<string | null>(null);
  const [compacto, setCompacto] = useState(false);
  /** A página começa com uma foto que pede o topo transparente por cima. */
  const [imersivo, setImersivo] = useState(false);

  const barraRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Fecha tudo ao navegar. Sem isto o painel fica aberto por cima da
     pagina nova — e no celular a gaveta cobre o conteudo recem-carregado. */
  useEffect(() => {
    setPainel(null);
    setGaveta(false);
    setSanfona(null);
  }, [pathname]);

  /* Topo transparente sobre a foto. Só liga se a página realmente começa
     com uma foto marcada com `data-topo-imersivo` (o topo da home): se a
     administração reordenar os blocos e a foto sair do topo, o cabeçalho
     volta a ser sólido sozinho, em vez de ficar branco sobre branco. */
  useEffect(() => {
    const id = requestAnimationFrame(() => setImersivo(!!document.querySelector("[data-topo-imersivo]")));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  /* A altura real do cabeçalho vira `--altura-topo`: é quanto a foto do
     topo sobe para ficar por baixo dele, e onde as abas fixas da galeria
     param. Medida, e não calculada, porque depende da logo e do arranjo. */
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const medir = () => document.documentElement.style.setProperty("--altura-topo", `${el.offsetHeight}px`);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Cabecalho condensa depois do primeiro rolar. Ganha altura para a marca
     respirar no topo da pagina e devolve tela enquanto a pessoa le. */
  useEffect(() => {
    const aoRolar = () => setCompacto(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  /* Trava o fundo so quando a gaveta esta aberta. O painel do desktop nao
     trava: rolar com ele aberto e um jeito legitimo de fecha-lo. */
  useEffect(() => {
    if (!gaveta) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [gaveta]);

  /* Esc fecha o que estiver aberto, na ordem em que a pessoa espera. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (gaveta) setGaveta(false);
      else if (painel) setPainel(null);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [gaveta, painel]);

  /* Clique fora da barra fecha o painel. O mouseleave sozinho nao cobre
     quem abre com teclado ou toque e depois clica no meio da pagina. */
  useEffect(() => {
    if (!painel) return;
    const aoClicar = (e: MouseEvent) => {
      if (barraRef.current && !barraRef.current.contains(e.target as Node)) setPainel(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [painel]);

  useEffect(() => () => { if (fecharTimer.current) clearTimeout(fecharTimer.current); }, []);

  /* Abrir no hover e confortavel; fechar no hover e traicoeiro. A folga
     de 140ms deixa o mouse atravessar o vao entre o botao e o painel sem
     que ele suma no meio do caminho. */
  const abrir = useCallback((rotulo: string) => {
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    setPainel(rotulo);
  }, []);
  const agendarFechar = useCallback(() => {
    if (fecharTimer.current) clearTimeout(fecharTimer.current);
    fecharTimer.current = setTimeout(() => setPainel(null), 140);
  }, []);

  const wa = whatsappDigitos && whatsappDigitos.length >= 10 ? whatsappDigitos : null;
  /** Transparente só no topo da página imersiva e com nenhum painel aberto. */
  const sobreFoto = imersivo && !compacto && !painel;

  /* `minHeight`, nao `height`: com o nome ACIMA ou ABAIXO da logo o conjunto
     fica mais alto que a imagem, e uma altura fechada o cortaria. O minimo
     garante a area de toque mesmo com logo pequena; o resto cresce sozinho. */
  const alturaBarra = compacto
    ? "max(3.5rem, calc(var(--logo-altura-compacta) + 1rem))"
    : "max(4rem, calc(var(--logo-altura) + 1.25rem))";

  /* Os tres arranjos usam as MESMAS pecas em ordens diferentes. Montadas
     uma vez aqui, elas nao podem divergir entre um arranjo e outro. */
  const metade = Math.ceil(NAVEGACAO.length / 2);
  const grupos = (de: number, ate: number) =>
    NAVEGACAO.slice(de, ate).map((grupo) => (
      <ItemDesktop
        key={grupo.rotulo}
        grupo={grupo}
        ativo={grupoAtivo(pathname, grupo)}
        aberto={painel === grupo.rotulo}
        onAbrir={() => abrir(grupo.rotulo)}
        onAlternar={() => setPainel((a) => (a === grupo.rotulo ? null : grupo.rotulo))}
        claro={sobreFoto}
      />
    ));

  const marca = (
    <Link href="/" className="min-w-0 shrink" aria-label={`${nome} — início`}>
      <MarcaLockup
        nome={nome}
        logoUrl={logoUrl}
        mostrarNome={mostrarNome}
        texto={nomeTexto}
        subtexto={nomeSubtexto}
        altura={compacto ? "var(--logo-altura-compacta)" : "var(--logo-altura)"}
        sobreFoto={sobreFoto}
      />
    </Link>
  );

  const acoes = (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar no WhatsApp"
          className={`hidden sm:inline-flex items-center justify-center h-11 w-11 rounded-full transition-marca ${
            sobreFoto ? "text-white hover:bg-white/15" : "text-[#1faa59] hover:bg-[#25D366]/10"
          }`}
        >
          <IconeWhats size={20} />
        </a>
      )}
      <Link
        href="/reservar"
        className={`hidden sm:inline-flex items-center gap-2 px-5 lg:px-6 h-11 rounded-full text-sm font-semibold transition-marca ${
          sobreFoto
            ? "bg-white text-tinta hover:bg-white/90 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)]"
            : "bg-marca hover:bg-marca-hover text-marca-texto shadow-marca"
        }`}
      >
        Reservar
      </Link>

      <button
        onClick={() => setGaveta(true)}
        aria-label="Abrir menu"
        aria-expanded={gaveta}
        className={`lg:hidden flex items-center gap-2 -mr-1 pl-3 pr-3.5 h-11 rounded-full border transition-marca ${
          sobreFoto
            ? "text-white border-white/50 bg-white/10 backdrop-blur-md hover:bg-white/20"
            : "text-tinta border-linha bg-white/70 hover:bg-areia"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span className="text-sm font-medium">Menu</span>
      </button>
    </div>
  );

  return (
    <>
    <header
      ref={headerRef}
      data-sobre-foto={sobreFoto || undefined}
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-500 ${
        sobreFoto
          ? "bg-transparent border-transparent"
          : `bg-white/85 backdrop-blur-xl backdrop-saturate-150 ${
              compacto ? "border-linha/80 shadow-[0_10px_30px_-18px_rgb(18_50_79/0.35)]" : "border-linha/40"
            }`
      }`}
    >
      <div
        ref={barraRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        onMouseLeave={agendarFechar}
      >
        {/* A altura da barra SEGUE a logo, em vez de a logo ter de caber numa
            barra fixa. Era esse o aperto: altura travada no codigo deixava
            qualquer logo horizontal minuscula ao lado do nome. O `max()`
            garante o minimo de toque de 64px mesmo com logo pequena. */}
        <div
          className={
            topo === "dividido"
              ? "flex items-center justify-between gap-3 py-2 lg:grid lg:grid-cols-[1fr_auto_1fr] transition-marca"
              : topo === "centro"
              ? "flex items-center justify-between gap-3 py-2 lg:justify-center lg:relative transition-marca"
              : "flex items-center justify-between gap-3 py-2 transition-marca"
          }
          style={{ minHeight: alturaBarra }}
        >
          {topo === "dividido" && (
            <nav className="hidden lg:flex items-stretch self-stretch justify-end"
              aria-label="Navegação principal">
              {grupos(0, metade)}
            </nav>
          )}

          {marca}

          {topo === "esquerda" && (
            <nav className="hidden lg:flex items-stretch self-stretch" aria-label="Navegação principal">
              {grupos(0, NAVEGACAO.length)}
            </nav>
          )}

          {topo === "dividido" ? (
            <div className="flex items-center gap-3 lg:self-stretch lg:justify-between">
              <nav className="hidden lg:flex items-stretch self-stretch" aria-label="Navegação principal (continuação)">
                {grupos(metade, NAVEGACAO.length)}
              </nav>
              {acoes}
            </div>
          ) : topo === "centro" ? (
            /* A logo fica no centro da linha; as acoes saem do fluxo para
               a direita, senao empurrariam a logo para fora do meio. */
            <div className="lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2">{acoes}</div>
          ) : (
            acoes
          )}
        </div>

        {/* Segunda linha do arranjo centralizado: o menu inteiro, centrado
            sob a marca. So existe a partir de `lg`. */}
        {topo === "centro" && (
          <nav className="hidden lg:flex items-stretch justify-center h-12 border-t border-linha/60"
            aria-label="Navegação principal">
            {grupos(0, NAVEGACAO.length)}
          </nav>
        )}
      </div>
    </header>

    {/* A gaveta fica FORA do <header> de proposito.
        O cabecalho usa backdrop-blur, e backdrop-filter cria bloco
        contentor: um filho `fixed inset-0` passa a se medir pelo header
        (64px de altura) em vez da janela. Era o que acontecia — a gaveta
        aparecia recortada na faixa do topo, com a lista de links cortada e
        o fundo escuro cobrindo so o cabecalho. */}
      {gaveta && (
        <Gaveta
          nome={nome}
          logoUrl={logoUrl}
          mostrarNome={mostrarNome}
          nomeTexto={nomeTexto}
          nomeSubtexto={nomeSubtexto}
          pathname={pathname}
          sanfona={sanfona}
          setSanfona={setSanfona}
          fechar={() => setGaveta(false)}
          wa={wa}
          whatsappExibicao={whatsappExibicao}
          instagram={instagram}
          instagramUser={instagramUser}
        />
      )}
    </>
  );
}

/* ───────────────────────── item do desktop ───────────────────────── */

function ItemDesktop({
  grupo, ativo, aberto, onAbrir, onAlternar, claro = false,
}: {
  grupo: GrupoNav;
  ativo: boolean;
  aberto: boolean;
  onAbrir: () => void;
  onAlternar: () => void;
  /** Sobre a foto do topo: texto branco. */
  claro?: boolean;
}) {
  /* Indicador da página atual: um traço curto e centrado, que cresce no
     hover — mais discreto que o sublinhado de ponta a ponta. */
  const marca = `after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-3 after:h-[2px] after:rounded-full after:transition-all after:duration-300 ${
    ativo ? `after:w-5 ${claro ? "after:bg-white" : "after:bg-marca"}` : `after:w-0 hover:after:w-5 ${claro ? "after:bg-white/80" : "after:bg-marca/60"}`
  }`;
  const cor = claro
    ? ativo || aberto ? "text-white" : "text-white/85 hover:text-white"
    : ativo || aberto ? "text-marca" : "text-tinta hover:text-marca";

  if (!grupo.itens?.length) {
    return (
      <Link
        href={grupo.href}
        onMouseEnter={onAbrir}
        aria-current={ativo ? "page" : undefined}
        className={`relative flex items-center px-3.5 text-[0.93rem] font-medium tracking-[0.01em] transition-marca ${marca} ${cor} ${claro ? "drop-shadow-[0_1px_6px_rgb(0_0_0/0.35)]" : ""}`}
      >
        {grupo.rotulo}
      </Link>
    );
  }

  return (
    <div className="relative flex items-stretch" onMouseEnter={onAbrir}>
      {/* O gatilho e um LINK, nao um botao: "Restaurante" leva a
          /restaurante. Quem tem mouse ve o painel ao passar por cima e
          decide se abre a pagina inteira ou um item do painel.

          No celular nao existe "passar por cima": o primeiro toque abriria
          a pagina sem nunca revelar o painel. Por isso o primeiro toque de
          um ponteiro sem hover so abre o painel — o segundo navega. */}
      <Link
        href={grupo.href}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" && !aberto) {
            e.preventDefault();
            onAlternar();
          }
        }}
        onFocus={onAbrir}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); onAbrir(); } }}
        aria-expanded={aberto}
        aria-haspopup="true"
        className={`relative flex items-center gap-1.5 px-3.5 text-[0.93rem] font-medium tracking-[0.01em] transition-marca ${marca} ${cor} ${claro ? "drop-shadow-[0_1px_6px_rgb(0_0_0/0.35)]" : ""}`}
      >
        {grupo.rotulo}
        <Chevron className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
      </Link>

      {aberto && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full w-[24rem] pt-2 z-10"
          role="group"
          aria-label={grupo.rotulo}
        >
          <div className="relative rounded-2xl border border-linha/70 bg-white/95 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgb(18_50_79/0.35)] overflow-hidden">
            <FolhaPalmeira className="absolute -right-8 -bottom-10 w-40 text-marca/[0.07] rotate-[20deg] pointer-events-none" />
            <p className="relative px-5 pt-4 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-marca">
              {grupo.rotulo}
            </p>
            <div className="relative pb-3 px-2">
              {grupo.itens.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group block px-3 py-2.5 rounded-xl hover:bg-areia/80 transition-marca"
                >
                  <span className="flex items-center gap-2 text-[0.94rem] font-semibold text-tinta group-hover:text-marca transition-marca">
                    {item.rotulo}
                    <span className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-marca text-marca" aria-hidden>→</span>
                  </span>
                  {item.descricao && (
                    <span className="block text-[0.8rem] leading-snug text-tinta-suave mt-0.5">
                      {item.descricao}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── gaveta do celular ────────────────────────── */

/**
 * Menu do celular em tela cheia.
 *
 * Antes era uma gaveta branca de 88% da largura com links de 16px — lista
 * de sistema, não de pousada. Agora: fundo areia com folhagem, títulos
 * grandes na fonte da marca, cada grupo abre no lugar (sanfona), e a ação
 * que importa ("Ver disponibilidade") fica presa embaixo, acima da barra
 * de gestos do iPhone (`safe-area-inset-bottom`).
 */
function Gaveta({
  nome, logoUrl, mostrarNome, nomeTexto, nomeSubtexto, pathname, sanfona, setSanfona, fechar,
  wa, whatsappExibicao, instagram, instagramUser,
}: {
  nome: string;
  logoUrl?: string | null;
  mostrarNome: boolean;
  nomeTexto: string | null;
  nomeSubtexto: string | null;
  pathname: string;
  sanfona: string | null;
  setSanfona: (v: string | null) => void;
  fechar: () => void;
  wa: string | null;
  whatsappExibicao?: string | null;
  instagram: string;
  instagramUser: string;
}) {
  return (
    <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-tinta/40 backdrop-blur-sm anim-gaveta-fundo" onClick={fechar} aria-hidden />

      <nav
        className="absolute inset-0 sm:left-auto sm:w-[26rem] bg-areia flex flex-col overflow-hidden anim-gaveta"
        aria-label="Navegação"
      >
        {/* Folhagem de fundo — decoração, fica atrás de tudo. */}
        <FolhaPalmeira className="absolute -right-16 -top-10 w-72 text-marca/[0.08] rotate-[35deg] pointer-events-none" />
        <FolhaPalmeira className="absolute -left-20 bottom-24 w-64 text-acento/[0.09] -rotate-[140deg] pointer-events-none" />

        <div
          className="relative shrink-0 flex items-center justify-between px-5 pb-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <MarcaLockup
            nome={nome}
            logoUrl={logoUrl}
            mostrarNome={mostrarNome}
            texto={nomeTexto}
            subtexto={nomeSubtexto}
            altura="var(--logo-altura-compacta)"
            className="min-w-0"
          />
          <button onClick={fechar} aria-label="Fechar menu"
            className="shrink-0 w-11 h-11 rounded-full bg-white text-tinta shadow-marca flex items-center justify-center hover:bg-white/80 transition-marca">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-6">
          <ul className="space-y-1">
            {NAVEGACAO.map((grupo, n) => {
              const ativo = grupoAtivo(pathname, grupo);
              const aberto = sanfona === grupo.rotulo;
              const titulo = (
                <span className="flex items-baseline gap-3 min-w-0">
                  <span className="text-[0.7rem] font-semibold tabular-nums text-marca/70 w-5 shrink-0">
                    {String(n + 1).padStart(2, "0")}
                  </span>
                  <span className={`font-titulo text-[1.65rem] leading-tight truncate ${ativo ? "text-marca" : "text-tinta"}`}>
                    {grupo.rotulo}
                  </span>
                </span>
              );

              if (!grupo.itens?.length) {
                return (
                  <li key={grupo.rotulo}>
                    <Link href={grupo.href} aria-current={ativo ? "page" : undefined}
                      className="flex items-center justify-between py-3 border-b border-linha/70">
                      {titulo}
                      <span className="text-marca text-lg" aria-hidden>→</span>
                    </Link>
                  </li>
                );
              }

              return (
                <li key={grupo.rotulo} className="border-b border-linha/70">
                  <button
                    onClick={() => setSanfona(aberto ? null : grupo.rotulo)}
                    aria-expanded={aberto}
                    className="w-full flex items-center justify-between gap-3 py-3 text-left"
                  >
                    {titulo}
                    <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                      aberto ? "bg-marca text-marca-texto rotate-180" : "bg-white text-tinta"
                    }`}>
                      <Chevron />
                    </span>
                  </button>

                  <div className={`grid transition-[grid-template-rows] duration-300 ${aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="pl-8 pb-4 space-y-1">
                        {grupo.itens.map((item) => (
                          <Link key={item.href} href={item.href} tabIndex={aberto ? 0 : -1}
                            className="block rounded-xl px-3 py-2.5 bg-white/70 hover:bg-white active:bg-white transition-marca">
                            <span className="block text-[0.98rem] font-semibold text-tinta">{item.rotulo}</span>
                            {item.descricao && (
                              <span className="block text-[0.8rem] leading-snug text-tinta-suave mt-0.5">{item.descricao}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="grid grid-cols-2 gap-2 mt-6">
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm text-tinta shadow-marca">
                <span className="text-[#1faa59] shrink-0"><IconeWhats /></span>
                <span className="truncate">{whatsappExibicao || "WhatsApp"}</span>
              </a>
            )}
            <a href={instagram} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm text-tinta shadow-marca">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0 text-marca">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              <span className="truncate">{instagramUser}</span>
            </a>
          </div>
        </div>

        {/* O CTA fica fixo no rodape da gaveta: e a acao que a pousada quer
            de qualquer ponto da lista, sem obrigar a rolar de volta. */}
        <div
          className="relative shrink-0 px-5 pt-3 bg-gradient-to-t from-areia via-areia to-areia/0"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Link
            href="/reservar"
            className="flex items-center justify-center gap-2 bg-marca hover:bg-marca-hover text-marca-texto h-14 rounded-full font-semibold text-base shadow-marca-forte transition-marca"
          >
            Ver disponibilidade
            <span aria-hidden>→</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
