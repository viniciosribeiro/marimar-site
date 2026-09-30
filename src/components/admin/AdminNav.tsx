"use client";

import { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Home, BedDouble, FolderTree, Sparkles, Images, UtensilsCrossed,
  GalleryHorizontalEnd, Blocks, LayoutGrid, Gift, Compass, Star, HelpCircle, ScrollText,
  Map, Palmtree, Palette, Inbox, MessageCircleHeart, Plug, Stethoscope, Users,
  ExternalLink, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, Menu, X, type LucideIcon,
} from "lucide-react";
import { Toaster } from "./ui-cliente";
import { cn } from "./ui";

/**
 * O casco do painel: menu lateral, barra do celular e os avisos (toasts).
 *
 * - Desktop: menu lateral fixo, que recolhe para só ícones (a escolha fica
 *   guardada no navegador).
 * - Celular: barra no topo com o nome da tela e menu em gaveta, com alvos
 *   de toque grandes.
 * - Login: sem menu nenhum — quem não entrou não tem o que navegar.
 */

export type Item = { href: string; label: string; icone: string };
export type Grupo = { grupo: string; itens: Item[] };

const ICONES: Record<string, LucideIcon> = {
  painel: LayoutDashboard, pousada: Home, quartos: BedDouble, categorias: FolderTree,
  comodidades: Sparkles, fotos: Images, cardapio: UtensilsCrossed, banners: GalleryHorizontalEnd,
  blocos: Blocks, cartoes: LayoutGrid, pacotes: Gift, passeios: Compass, depoimentos: Star,
  faq: HelpCircle, politicas: ScrollText, conteudo: Map, atracoes: Palmtree, visual: Palette,
  leads: Inbox, marina: MessageCircleHeart, integracoes: Plug, diagnostico: Stethoscope, usuarios: Users,
};

const CHAVE_RECOLHIDO = "marimar:menu-recolhido";

/* A preferência "menu recolhido" mora no navegador. useSyncExternalStore
   lê de lá sem piscar no primeiro desenho e sem estado duplicado. */
const assinantes = new Set<() => void>();
const lerRecolhido = () => { try { return localStorage.getItem(CHAVE_RECOLHIDO) === "1"; } catch { return false; } };
const gravarRecolhido = (v: boolean) => {
  try { localStorage.setItem(CHAVE_RECOLHIDO, v ? "1" : "0"); } catch {}
  assinantes.forEach((f) => f());
};
const assinar = (f: () => void) => { assinantes.add(f); return () => { assinantes.delete(f); }; };

export function AdminNav({ grupos, nome, children }: { grupos: Grupo[]; nome: string; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  /* O menu do celular fica aberto só na tela em que foi aberto: trocar de
     página fecha sozinho, sem efeito para "resetar" estado. */
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;
  const setAberto = (v: boolean) => setAbertoEm(v ? pathname : null);
  const recolhido = useSyncExternalStore(assinar, lerRecolhido, () => false);

  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  const alternar = () => gravarRecolhido(!recolhido);

  const semMenu = pathname.startsWith("/admin/login");
  const ativo = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/"));
  const atual = grupos.flatMap((g) => g.itens).find((i) => ativo(i.href));

  const toaster = <Suspense fallback={null}><Toaster /></Suspense>;

  if (semMenu) return <div className="painel-admin">{children}{toaster}</div>;

  const menu = (compacto: boolean) => (
    <>
      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Menu do painel">
        {grupos.map((g) => (
          <div key={g.grupo} className="mb-5">
            {compacto
              ? <div className="mx-3 mb-2 border-t border-white/10" aria-hidden />
              : <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{g.grupo}</p>}
            {g.itens.map((i) => {
              const Icone = ICONES[i.icone] ?? LayoutDashboard;
              const on = ativo(i.href);
              return (
                <Link key={i.href} href={i.href} title={compacto ? i.label : undefined}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "group mb-0.5 flex items-center gap-3 rounded-xl text-sm transition-colors",
                    compacto ? "h-10 w-10 justify-center mx-auto" : "min-h-10 px-3",
                    on ? "bg-white text-tinta font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}>
                  <Icone className={cn("h-[18px] w-[18px] shrink-0", on ? "text-marca" : "")} strokeWidth={on ? 2.2 : 1.8} />
                  {!compacto && <span className="truncate">{i.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={cn("shrink-0 border-t border-white/10 p-3 space-y-0.5", compacto && "flex flex-col items-center")}>
        {[
          { href: "/", label: "Ver o site", Icone: ExternalLink, externo: true },
          { href: "/admin/trocar-senha", label: "Trocar senha", Icone: KeyRound },
          { href: "/api/auth/signout", label: "Sair", Icone: LogOut },
        ].map(({ href, label, Icone, externo }) => (
          <Link key={href} href={href} title={compacto ? label : undefined}
            {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}
            className={cn(
              "flex items-center gap-3 rounded-xl text-sm text-white/65 hover:bg-white/10 hover:text-white",
              compacto ? "h-10 w-10 justify-center" : "min-h-10 px-3",
            )}>
            <Icone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            {!compacto && label}
          </Link>
        ))}
      </div>
    </>
  );

  const marca = (compacto: boolean) => (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-marca text-marca-texto shadow-sm">
        <Palmtree className="h-5 w-5" strokeWidth={2} />
      </span>
      {!compacto && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-titulo text-[15px] font-bold text-white">{nome}</span>
          <span className="block text-[11px] text-white/55">Painel da pousada</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="painel-admin min-h-screen bg-fundo-suave lg:flex">
      {/* ─── Celular: barra do topo ─── */}
      <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-linha/70 bg-white/90 px-2 backdrop-blur">
        <button onClick={() => setAberto(true)} aria-label="Abrir menu" aria-expanded={aberto}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-tinta hover:bg-areia/60">
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex-1 truncate text-center text-sm font-semibold text-tinta">{atual?.label ?? nome}</span>
        <Link href="/" target="_blank" aria-label="Ver o site"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-tinta-suave hover:bg-areia/60">
          <ExternalLink className="h-[18px] w-[18px]" />
        </Link>
      </header>

      {/* ─── Celular: gaveta ─── */}
      {aberto && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-tinta/50 backdrop-blur-[2px]" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-tinta shadow-2xl animate-[deslizar_.2s_ease-out]">
            <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
              {marca(false)}
              <button onClick={() => setAberto(false)} aria-label="Fechar menu"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            {menu(false)}
          </aside>
        </div>
      )}

      {/* ─── Desktop: menu lateral ─── */}
      <aside className={cn(
        "hidden lg:flex sticky top-0 h-screen shrink-0 flex-col bg-tinta transition-[width] duration-200",
        recolhido ? "w-[76px]" : "w-64",
      )}>
        <div className={cn("flex h-16 items-center border-b border-white/10 shrink-0", recolhido ? "justify-center px-2" : "justify-between px-4")}>
          {marca(recolhido)}
          {!recolhido && (
            <button onClick={alternar} aria-label="Recolher menu" title="Recolher menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white">
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
        {recolhido && (
          <button onClick={alternar} aria-label="Abrir menu" title="Abrir menu"
            className="mx-auto mt-3 flex h-9 w-9 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white">
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        )}
        {menu(recolhido)}
      </aside>

      <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      {toaster}
    </div>
  );
}
