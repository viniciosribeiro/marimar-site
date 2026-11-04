"use client";

/** Abre o chat da Marina (o mesmo do botão flutuante) a partir de um ponto da página. */
export function BotaoMarina({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("marimar:abrir-marina"))}>
      {children}
    </button>
  );
}
