"use client";

import { useSemFlutuante } from "./useSemFlutuante";

/** O botão único do site novo quando o chat da Marina está desligado no painel. */
export function PilulaWhatsApp({ digitos }: { digitos: string }) {
  const esconder = useSemFlutuante();
  return (
    <a href={`https://wa.me/${digitos}`} target="_blank" rel="noopener noreferrer" aria-hidden={esconder || undefined} tabIndex={esconder ? -1 : undefined}
      className={`fixed z-40 flex h-12 items-center gap-2.5 rounded-full bg-sn-mar pl-2 pr-4 text-white shadow-[0_14px_30px_-12px_rgb(0_0_0/0.55)] ring-1 ring-white/15 transition-[opacity,transform] duration-200 hover:bg-sn-mar-2 ${esconder ? "pointer-events-none translate-y-3 opacity-0" : ""}`}
      style={{ right: "max(1rem, env(safe-area-inset-right, 0px))", bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acento text-acento-texto" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" /></svg>
      </span>
      <span className="text-[0.95rem] font-semibold">Falar no WhatsApp</span>
    </a>
  );
}
