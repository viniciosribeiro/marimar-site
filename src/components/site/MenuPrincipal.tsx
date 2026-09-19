"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACAO, grupoAtivo, type GrupoNav } from "@/lib/navegacao";

type Props = {
  nome: string;
  logoUrl?: string | null;
  /** Escrever o nome ao lado da imagem. Logo que ja traz o nome desenhado
      nao precisa — e repetido fica pior do que so a imagem. */
  mostrarNome?: boolean;
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

  const barraRef = useRef<HTMLDivElement | null>(null);
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Fecha tudo ao navegar. Sem isto o painel fica aberto por cima da
     pagina nova — e no celular a gaveta cobre o conteudo recem-carregado. */
  useEffect(() => {
    setPainel(null);
    setGaveta(false);
    setSanfona(null);
  }, [pathname]);

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

  return (
    <>
    <header
      className={`sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b transition-marca ${
        compacto ? "border-linha shadow-sm" : "border-transparent"
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
          className="flex items-center justify-between gap-3 transition-marca"
          style={{
            height: compacto
              ? "max(3.5rem, calc(var(--logo-altura-compacta) + 1rem))"
              : "max(4rem, calc(var(--logo-altura) + 1.25rem))",
          }}
        >
          {/* ── Marca ── */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0 shrink" aria-label={`${nome} — início`}>
            {logoUrl
              ? <img src={logoUrl} alt="" aria-hidden
                  className="w-auto shrink-0 transition-marca"
                  style={{ height: compacto ? "var(--logo-altura-compacta)" : "var(--logo-altura)" }} />
              : <span className="text-2xl shrink-0" aria-hidden>🏝️</span>}
            {(mostrarNome || !logoUrl) && (
              <span className="font-titulo font-bold text-tinta leading-tight truncate text-[0.95rem] sm:text-lg">
                {nome}
              </span>
            )}
          </Link>

          {/* ── Menu do desktop ──
              So a partir de lg. Entre 768 e 1024 os seis rotulos, a marca e
              o botao nao cabiam na mesma linha e se atropelavam: ate 1024
              a gaveta atende melhor. */}
          <nav className="hidden lg:flex items-stretch self-stretch" aria-label="Navegação principal">
            {NAVEGACAO.map((grupo) => (
              <ItemDesktop
                key={grupo.rotulo}
                grupo={grupo}
                ativo={grupoAtivo(pathname, grupo)}
                aberto={painel === grupo.rotulo}
                onAbrir={() => abrir(grupo.rotulo)}
                onAlternar={() => setPainel((a) => (a === grupo.rotulo ? null : grupo.rotulo))}
              />
            ))}
          </nav>

          {/* ── Acoes ── */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Falar no WhatsApp"
                className="hidden sm:inline-flex items-center justify-center h-10 w-10 rounded-marca text-[#25D366] hover:bg-[#25D366]/10 transition-marca"
              >
                <IconeWhats size={20} />
              </a>
            )}
            <Link
              href="/reservar"
              className="hidden sm:inline-flex items-center bg-marca hover:bg-marca-hover text-marca-texto px-4 lg:px-5 py-2.5 rounded-marca text-sm font-semibold shadow-marca transition-marca"
            >
              Reservar
            </Link>

            <button
              onClick={() => setGaveta(true)}
              aria-label="Abrir menu"
              aria-expanded={gaveta}
              className="lg:hidden flex items-center gap-2 -mr-1 pl-2.5 pr-3 py-2 rounded-marca text-tinta border border-linha hover:bg-areia transition-marca"
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
        </div>
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
  grupo, ativo, aberto, onAbrir, onAlternar,
}: {
  grupo: GrupoNav;
  ativo: boolean;
  aberto: boolean;
  onAbrir: () => void;
  onAlternar: () => void;
}) {
  const marca = `after:absolute after:left-3 after:right-3 after:bottom-3 after:h-0.5 after:rounded-full after:transition-marca ${
    ativo ? "after:bg-marca" : "after:bg-transparent"
  }`;

  if (!grupo.itens?.length) {
    return (
      <Link
        href={grupo.href}
        onMouseEnter={onAbrir}
        aria-current={ativo ? "page" : undefined}
        className={`relative flex items-center px-3 text-sm font-medium transition-marca ${marca} ${
          ativo ? "text-marca" : "text-tinta-suave hover:text-marca"
        }`}
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
        className={`relative flex items-center gap-1.5 px-3 text-sm font-medium transition-marca ${marca} ${
          ativo || aberto ? "text-marca" : "text-tinta-suave hover:text-marca"
        }`}
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
          <div className="rounded-marca border border-linha bg-white shadow-marca-forte overflow-hidden">
            <p className="px-4 pt-3.5 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-tinta-suave/70">
              {grupo.rotulo}
            </p>
            <div className="pb-2">
              {grupo.itens.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group block px-4 py-2.5 hover:bg-areia transition-marca"
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

function Gaveta({
  nome, logoUrl, mostrarNome, pathname, sanfona, setSanfona, fechar,
  wa, whatsappExibicao, instagram, instagramUser,
}: {
  nome: string;
  logoUrl?: string | null;
  mostrarNome: boolean;
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
    <div className="lg:hidden fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-tinta/50 backdrop-blur-sm" onClick={fechar} aria-hidden />

      <nav
        className="absolute right-0 top-0 h-full w-[88vw] max-w-sm bg-white shadow-2xl flex flex-col"
        aria-label="Navegação"
      >
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-linha">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl
              ? <img src={logoUrl} alt="" aria-hidden className="w-auto shrink-0"
                  style={{ height: "var(--logo-altura-compacta)" }} />
              : <span className="text-xl shrink-0" aria-hidden>🏝️</span>}
            {(mostrarNome || !logoUrl) && (
              <span className="font-titulo font-bold text-tinta truncate">{nome}</span>
            )}
          </div>
          <button onClick={fechar} aria-label="Fechar menu"
            className="p-2 -mr-2 text-tinta-suave hover:text-tinta rounded-marca">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {NAVEGACAO.map((grupo) => {
            const ativo = grupoAtivo(pathname, grupo);
            const aberto = sanfona === grupo.rotulo;

            if (!grupo.itens?.length) {
              return (
                <Link
                  key={grupo.rotulo}
                  href={grupo.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex items-center px-5 py-4 text-base font-semibold border-b border-linha/60 transition-marca ${
                    ativo ? "text-marca bg-marca-sutil" : "text-tinta active:bg-areia"
                  }`}
                >
                  {grupo.rotulo}
                </Link>
              );
            }

            return (
              <div key={grupo.rotulo} className="border-b border-linha/60">
                {/* Toque de 56px de altura: a sanfona evita a lista de 17
                    links que a pessoa teria de rolar para achar "Contato". */}
                <button
                  onClick={() => setSanfona(aberto ? null : grupo.rotulo)}
                  aria-expanded={aberto}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-base font-semibold text-left transition-marca ${
                    ativo ? "text-marca" : "text-tinta"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {ativo && <span className="h-1.5 w-1.5 rounded-full bg-marca shrink-0" aria-hidden />}
                    <span className="truncate">{grupo.rotulo}</span>
                  </span>
                  <Chevron className={`shrink-0 text-tinta-suave transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
                </button>

                {aberto && (
                  <div className="bg-areia/60 pb-2">
                    {grupo.itens.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-5 py-3 border-l-2 border-linha ml-5 mr-3 active:bg-white transition-marca"
                      >
                        <span className="block text-[0.95rem] font-medium text-tinta">{item.rotulo}</span>
                        {item.descricao && (
                          <span className="block text-[0.78rem] leading-snug text-tinta-suave mt-0.5">
                            {item.descricao}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="px-5 py-5 space-y-2">
            {wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-tinta-suave hover:text-tinta transition-marca"
              >
                <span className="text-[#25D366]"><IconeWhats /></span>
                {whatsappExibicao || "Falar no WhatsApp"}
              </a>
            )}
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-tinta-suave hover:text-tinta transition-marca"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              {instagramUser}
            </a>
          </div>
        </div>

        {/* O CTA fica fixo no rodape da gaveta: e a acao que a pousada quer
            de qualquer ponto da lista, sem obrigar a rolar de volta. */}
        <div
          className="shrink-0 p-4 border-t border-linha bg-white"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Link
            href="/reservar"
            className="block text-center bg-marca hover:bg-marca-hover text-marca-texto py-3.5 rounded-marca font-semibold shadow-marca transition-marca"
          >
            Ver disponibilidade
          </Link>
        </div>
      </nav>
    </div>
  );
}
