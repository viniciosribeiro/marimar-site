"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Grupo = { grupo: string; itens: { href: string; label: string; icone: string }[] };

export function AdminNav({ grupos, nome }: { grupos: Grupo[]; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setAberto(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  const atual = grupos.flatMap((g) => g.itens).find((i) => i.href === pathname);

  return (
    <>
      {/* ─── Barra superior: so no mobile ─── */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4">
        <button onClick={() => setAberto(true)} aria-label="Abrir menu" className="p-2 -ml-2 text-gray-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="font-semibold text-sm text-gray-800 truncate">{atual?.label ?? nome}</span>
        <Link href="/" target="_blank" className="p-2 -mr-2 text-gray-400" aria-label="Ver o site">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </Link>
      </header>

      {/* ─── Backdrop mobile ─── */}
      {aberto && <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setAberto(false)} />}

      {/* ─── Sidebar ─── */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0
        bg-white border-r border-gray-200 flex flex-col
        transition-transform duration-200 lg:transition-none
        ${aberto ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100 shrink-0">
          <Link href="/admin" className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">🏝️</span>
            <span className="font-bold text-gray-800 text-sm truncate">{nome}</span>
          </Link>
          <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="lg:hidden p-1 text-gray-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {grupos.map((g) => (
            <div key={g.grupo} className="mb-5">
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {g.grupo}
              </p>
              {g.itens.map((i) => {
                const ativo = pathname === i.href;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg mb-0.5 transition-colors ${
                      ativo
                        ? "bg-gray-900 text-white font-medium"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <span className="w-4 text-center shrink-0">{i.icone}</span>
                    <span className="truncate">{i.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3 shrink-0 space-y-0.5">
          <Link href="/" target="_blank" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
            <span className="w-4 text-center">🌐</span> Ver o site
          </Link>
          <Link href="/admin/trocar-senha" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
            <span className="w-4 text-center">🔑</span> Trocar senha
          </Link>
          <Link href="/api/auth/signout" className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
            <span className="w-4 text-center">🚪</span> Sair
          </Link>
        </div>
      </aside>
    </>
  );
}
