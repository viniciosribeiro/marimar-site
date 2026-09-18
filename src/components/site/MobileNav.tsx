"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav({ itens }: { itens: [string, string][] }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  // Fecha ao navegar — sem isso o menu fica por cima da pagina nova
  useEffect(() => { setAberto(false); }, [pathname]);

  // Trava o scroll do fundo enquanto o menu esta aberto
  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        aria-expanded={aberto}
        className="md:hidden p-2 -mr-2 text-gray-600 hover:text-marca rounded-lg"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {aberto && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAberto(false)} />
          <nav className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Menu</span>
              <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="p-2 -mr-2 text-gray-400 hover:text-gray-700">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              {itens.map(([href, label]) => {
                const ativo = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`block px-5 py-3 text-base transition-marca ${
                      ativo ? "text-marca font-semibold bg-marca-sutil" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100">
              <Link href="/reservar" className="block text-center bg-marca hover:bg-marca-hover text-white py-3 rounded-marca font-semibold transition-marca">
                Ver disponibilidade
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
