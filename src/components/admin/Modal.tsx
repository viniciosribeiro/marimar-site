"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Janela de edição: centralizada no computador, folha que sobe no celular
 * (o polegar alcança os botões). Esc e clique fora fecham.
 */
export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", k); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-fundo-suave shadow-2xl sm:max-w-2xl sm:rounded-2xl animate-[subir_.2s_ease-out]">
        <div className="flex items-center justify-between border-b border-linha/70 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-tinta">{title}</h2>
          <button onClick={onClose} aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-tinta-suave hover:bg-areia/60 hover:text-tinta">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
