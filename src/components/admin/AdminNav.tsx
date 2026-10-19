"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Sun, Inbox, MessageCircleHeart, BedDouble, UtensilsCrossed, Globe, Settings, Search, LayoutGrid,
  ExternalLink, LogOut, Palmtree, X, type LucideIcon,
} from "lucide-react";
import { Toaster } from "./ui-cliente";
import { cn } from "./ui";
import { AREAS, itemAtual, inicioDaArea, type Area, type AreaId } from "./areas";
import { PaletaTarefas } from "./PaletaTarefas";

/**
 * O casco do painel ("Central"), no visual de vidro líquido.
 * Fase 1 do estudo aprovado em 19/10/2026 (docs/estudo-painel-central.md):
 *
 * - Computador: menu lateral de vidro, solto da borda, com as 7 áreas.
 * - Topo de cada tela: a área e as telas dela, em abas de vidro.
 * - Celular: barra inferior em cápsula (Hoje · Atender · Marina · Site ·
 *   Mais), como no iPhone; "Mais" abre as outras áreas.
 * - "O que você quer fazer?" em toda tela (botão ou Ctrl+K).
 * - Perfil Técnico (papel "master") vê também Pessoas, Integrações e
 *   Diagnóstico.
 * - Login: sem menu nenhum.
 */

const ICONES: Record<AreaId | "mais", LucideIcon> = {
  hoje: Sun, atendimento: Inbox, marina: MessageCircleHeart, hospedagem: BedDouble,
  restaurante: UtensilsCrossed, site: Globe, ajustes: Settings, mais: LayoutGrid,
};
const NA_BARRA: (AreaId | "mais")[] = ["hoje", "atendimento", "marina", "site", "mais"];

/** Números no menu: o total da área Atendimento e o de cada tela dela. */
export type ContagensPainel = { atendimento: number; porItem: Record<string, number> };

export function AdminNav({ nome, tecnico, contagens, children }: {
  nome: string; tecnico: boolean; contagens: ContagensPainel; children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [paleta, setPaleta] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaleta(true); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const toaster = <Suspense fallback={null}><Toaster /></Suspense>;
  if (pathname.startsWith("/admin/login")) return <div className="painel-admin min-h-screen">{children}{toaster}</div>;

  const abrirPaleta = () => setPaleta(true);
  /* Só os menus esperam a aba da URL (useSearchParams); o conteúdo da tela
     é desenhado uma vez só, fora do Suspense. */
  return (
    <div className="painel-admin min-h-screen">
      <div className="lg:flex lg:gap-4 lg:p-3">
        <Suspense fallback={<aside className="vidro hidden lg:flex sticky top-3 h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-[1.75rem] p-3"><Marca nome={nome} /></aside>}>
          <MenuLateral nome={nome} tecnico={tecnico} contagens={contagens} abrirPaleta={abrirPaleta} />
        </Suspense>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<header className="vidro sticky top-0 z-40 h-16 rounded-b-[1.6rem] lg:top-3 lg:rounded-[1.6rem]" />}>
            <TopoArea tecnico={tecnico} contagens={contagens} abrirPaleta={abrirPaleta} />
          </Suspense>
          <main className="min-w-0 pb-32 lg:pb-6">{children}</main>
        </div>
      </div>
      <Suspense fallback={null}>
        <BarraCelular tecnico={tecnico} contagens={contagens} />
      </Suspense>
      <PaletaTarefas aberta={paleta} aoFechar={() => setPaleta(false)} tecnico={tecnico} />
      {toaster}
    </div>
  );
}

/** A área e a tela de agora, pela URL (a aba decide quando a tela é a mesma). */
function useAreaAtual() {
  const pathname = usePathname() ?? "";
  const aba = useSearchParams()?.get("aba") ?? null;
  const atual = itemAtual(pathname, aba);
  return { pathname, aba, atual, area: atual?.area ?? AREAS[0] };
}

const visiveis = (a: Area, tecnico: boolean) => a.itens.filter((i) => tecnico || !i.tecnico);
const contadorArea = (id: AreaId, c: ContagensPainel) => (id === "atendimento" ? c.atendimento : 0);

function Marca({ nome }: { nome: string }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5 rounded-2xl px-2 py-1.5">
      <span className="vidro-marca flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-marca-texto">
        <Palmtree className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-titulo text-[15px] font-bold text-tinta">{nome}</span>
        <span className="block text-[11px] text-tinta-suave">Central da pousada</span>
      </span>
    </Link>
  );
}

/* ─── Computador: menu lateral de vidro ─── */
function MenuLateral({ nome, tecnico, contagens, abrirPaleta }: {
  nome: string; tecnico: boolean; contagens: ContagensPainel; abrirPaleta: () => void;
}) {
  const { area: areaAtual } = useAreaAtual();
  return (
    <aside className="vidro hidden lg:flex sticky top-3 h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-[1.75rem] p-3" aria-label="Áreas do painel">
      <Marca nome={nome} />
      <button type="button" onClick={abrirPaleta}
        className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-full border border-white/80 bg-white/55 px-3.5 text-left text-sm text-tinta-suave shadow-[inset_0_1px_0_#fff] hover:bg-white/75">
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">O que você quer fazer?</span>
        <kbd className="rounded-md border border-white/80 bg-white/60 px-1.5 text-[10px] whitespace-nowrap">Ctrl K</kbd>
      </button>
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto overscroll-contain">
        {AREAS.map((a) => {
          const Icone = ICONES[a.id];
          const on = a.id === areaAtual.id;
          const n = contadorArea(a.id, contagens);
          return (
            <div key={a.id}>
              {a.id === "ajustes" && <div className="mx-3 my-3 h-px bg-tinta/10" aria-hidden />}
              <Link href={inicioDaArea(a, tecnico)} aria-current={on ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-2xl border px-3 text-sm font-semibold transition-[background-color,transform] duration-200",
                  on ? "vidro-bolha text-tinta" : "border-transparent text-tinta-suave hover:bg-white/45 hover:text-tinta")}>
                <Icone className={cn("h-[18px] w-[18px] shrink-0", on && "text-marca")} strokeWidth={on ? 2.2 : 1.8} />
                <span className="flex-1 truncate">{a.nome}</span>
                {n > 0 && <span className="rounded-full bg-orange-500 px-2 text-[11px] font-bold leading-5 text-white shadow-[0_2px_8px_-2px_rgb(249_115_22)]">{n}</span>}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="mt-3 space-y-0.5 border-t border-tinta/10 pt-3">
        <Link href="/" target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-3 rounded-2xl px-3 text-sm text-tinta-suave hover:bg-white/45 hover:text-tinta">
          <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.8} /> Ver o site
        </Link>
        <Link href="/api/auth/signout" prefetch={false} className="flex min-h-10 items-center gap-3 rounded-2xl px-3 text-sm text-tinta-suave hover:bg-white/45 hover:text-tinta">
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} /> Sair
        </Link>
        <p className="px-3 pt-1 text-[11px] text-tinta-suave/80">{tecnico ? "Perfil Técnico" : "Perfil Gestão"}</p>
      </div>
    </aside>
  );
}

/* ─── Topo: a área e as telas dela ─── */
function TopoArea({ tecnico, contagens, abrirPaleta }: { tecnico: boolean; contagens: ContagensPainel; abrirPaleta: () => void }) {
  const { atual, area } = useAreaAtual();
  const abas = visiveis(area, tecnico);
  const Icone = ICONES[area.id];
  return (
    <header className="vidro sticky top-0 z-40 rounded-b-[1.6rem] border-t-0 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:top-3 lg:rounded-[1.6rem] lg:border-t lg:px-4 lg:pt-3">
      <div className="flex min-h-11 items-center gap-2">
        <span className="lg:hidden vidro-marca flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-marca-texto">
          <Icone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-titulo text-lg font-bold leading-tight text-tinta">{area.nome}</p>
          <p className="hidden truncate text-xs text-tinta-suave sm:block">{area.descricao}</p>
        </div>
        <button type="button" onClick={abrirPaleta} aria-label="O que você quer fazer?"
          className="lg:hidden flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/55 text-tinta shadow-[inset_0_1px_0_#fff]">
          <Search className="h-[18px] w-[18px]" />
        </button>
        <Link href="/" target="_blank" aria-label="Ver o site"
          className="lg:hidden flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/55 text-tinta-suave shadow-[inset_0_1px_0_#fff]">
          <ExternalLink className="h-[18px] w-[18px]" />
        </Link>
      </div>
      {abas.length > 1 && (
        <nav aria-label={`Telas de ${area.nome}`}
          className="-mx-3 mt-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:-mx-1 lg:px-1">
          <div className="flex w-max gap-1.5">
            {abas.map((i) => {
              const on = atual?.item.href === i.href;
              const n = contagens.porItem[i.href] ?? 0;
              return (
                <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
                  className={cn("inline-flex min-h-9 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                    on ? "vidro-marca text-marca-texto" : "border-white/70 bg-white/40 text-tinta-suave hover:bg-white/70 hover:text-tinta")}>
                  {i.rotulo}
                  {n > 0 && (
                    <span className={cn("ml-1.5 rounded-full px-1.5 text-[10.5px] font-bold leading-[18px]", on ? "bg-white/30" : "bg-orange-500 text-white")}>{n}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

/* ─── Celular: barra inferior em cápsula de vidro + folha "Mais" ─── */
function BarraCelular({ tecnico, contagens }: { tecnico: boolean; contagens: ContagensPainel }) {
  const { pathname, aba, area: areaAtual } = useAreaAtual();
  /* "Mais" fica aberto só na tela em que foi aberto. */
  const [maisEm, setMaisEm] = useState<string | null>(null);
  const aqui = pathname + (aba ?? "");
  const maisAberto = maisEm === aqui;
  const naBarra = (id: string) => ["hoje", "atendimento", "marina", "site"].includes(id);

  return (
    <>
      <nav aria-label="Áreas"
        className="vidro fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-5 gap-1 rounded-full p-1.5 lg:hidden">
        {NA_BARRA.map((id) => {
          const Icone = ICONES[id];
          const area = AREAS.find((a) => a.id === id);
          const on = id === "mais" ? !naBarra(areaAtual.id) || maisAberto : id === areaAtual.id && !maisAberto;
          const n = area ? contadorArea(area.id, contagens) : 0;
          const classe = cn("relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold transition-[background-color,transform] duration-300",
            on ? "vidro-bolha scale-[1.04] text-marca" : "border border-transparent text-tinta-suave");
          const corpo = (
            <>
              <Icone className="h-5 w-5" strokeWidth={on ? 2.2 : 1.8} />
              <span className="max-w-full truncate px-1">{area ? area.curto ?? area.nome : "Mais"}</span>
              {n > 0 && <span className="absolute right-[18%] top-1 rounded-full bg-orange-500 px-1.5 text-[9.5px] font-bold leading-4 text-white">{n}</span>}
            </>
          );
          return area
            ? <Link key={id} href={inicioDaArea(area, tecnico)} aria-current={on ? "page" : undefined} className={classe} onClick={() => setMaisEm(null)}>{corpo}</Link>
            : <button key={id} type="button" aria-expanded={maisAberto} className={classe} onClick={() => setMaisEm(maisAberto ? null : aqui)}>{corpo}</button>;
        })}
      </nav>

      {maisAberto && (
        <div className="fixed inset-0 z-[45] lg:hidden" role="dialog" aria-modal="true" aria-label="Mais áreas">
          <div className="absolute inset-0 bg-tinta/20 backdrop-blur-[2px]" onClick={() => setMaisEm(null)} />
          <div className="vidro-forte absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.6rem)] max-h-[70vh] overflow-y-auto rounded-[2rem] p-3 animate-[subir_.22s_ease-out]">
            <div className="mb-1 flex items-center justify-between px-2">
              <p className="font-titulo text-lg font-bold text-tinta">Mais</p>
              <button type="button" onClick={() => setMaisEm(null)} aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full text-tinta-suave hover:bg-white/50"><X className="h-5 w-5" /></button>
            </div>
            {AREAS.filter((a) => !naBarra(a.id)).map((a) => {
              const Icone = ICONES[a.id];
              return (
                <div key={a.id} className="mb-2 rounded-[1.4rem] bg-white/45 p-2">
                  <p className="flex items-center gap-2 px-2 pb-1 pt-1 text-sm font-bold text-tinta"><Icone className="h-4 w-4 text-marca" />{a.nome}</p>
                  <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                    {visiveis(a, tecnico).map((i) => (
                      <Link key={i.href} href={i.href} onClick={() => setMaisEm(null)}
                        className="inline-flex min-h-10 items-center rounded-full border border-white/80 bg-white/60 px-3.5 text-[13px] font-semibold text-tinta">
                        {i.rotulo}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-1.5 px-1 pt-1">
              <Link href="/api/auth/signout" prefetch={false} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3.5 text-[13px] font-semibold text-tinta-suave">
                <LogOut className="h-4 w-4" /> Sair
              </Link>
              <span className="inline-flex min-h-10 items-center px-2 text-[11px] text-tinta-suave">{tecnico ? "Perfil Técnico" : "Perfil Gestão"}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
