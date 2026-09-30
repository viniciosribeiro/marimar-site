"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { botao, cn } from "./ui";

/* ═══ toasts ════════════════════════════════════════════════════════
   Qualquer componente chama `avisar("Salvo")`. As telas antigas, que
   voltam com `?ok=` e `?erro=` na URL, também viram toast sozinhas: o
   Toaster lê a URL, mostra e limpa — sem precisar mexer nelas. */

type Toast = { id: number; texto: string; tom: "ok" | "erro" | "info" };
const EVENTO = "marimar:toast";

export function avisar(texto: string, tom: Toast["tom"] = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { texto, tom } }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const seq = useRef(0);

  const adicionar = useCallback((texto: string, tom: Toast["tom"]) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, texto, tom }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tom === "erro" ? 8000 : 4500);
  }, []);

  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<{ texto: string; tom: Toast["tom"] }>).detail;
      adicionar(d.texto, d.tom);
    };
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, [adicionar]);

  /* ?ok= / ?erro= das telas que respondem com redirect. */
  useEffect(() => {
    const ok = params.get("ok");
    const erro = params.get("erro");
    if (!ok && !erro) return;
    if (ok) adicionar(ok, "ok");
    if (erro) adicionar(erro, "erro");
    const resto = new URLSearchParams(params.toString());
    resto.delete("ok");
    resto.delete("erro");
    const qs = resto.toString();
    router.replace(pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }, [params, pathname, router, adicionar]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
      {toasts.map((t) => (
        <div key={t.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg animate-[entrar_.2s_ease-out]",
            t.tom === "ok" && "border-emerald-200 bg-white text-tinta",
            t.tom === "erro" && "border-red-200 bg-red-50 text-red-900",
            t.tom === "info" && "border-linha bg-white text-tinta",
          )}>
          <span className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
            t.tom === "ok" ? "bg-emerald-500" : t.tom === "erro" ? "bg-red-500" : "bg-marca",
          )} aria-hidden>{t.tom === "ok" ? "✓" : t.tom === "erro" ? "!" : "i"}</span>
          <p className="flex-1 leading-snug">{t.texto}</p>
          <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
            className="-m-1 p-1 text-tinta-suave hover:text-tinta" aria-label="Fechar aviso">×</button>
        </div>
      ))}
    </div>
  );
}

/* ═══ confirmação ═══════════════════════════════════════════════════
   Toda ação que apaga ou desfaz passa por aqui. Diálogo de verdade (com
   foco, Esc e fundo), não o `confirm()` do navegador — que no iPhone
   aparece como "marimar-site.vercel.app diz:" e assusta quem opera. */

type PedidoConfirmacao = {
  titulo: string;
  texto?: string;
  confirmar?: string;
  perigo?: boolean;
};

export function useConfirmar() {
  const [pedido, setPedido] = useState<(PedidoConfirmacao & { resolver: (v: boolean) => void }) | null>(null);

  const confirmar = useCallback((p: PedidoConfirmacao) =>
    new Promise<boolean>((resolver) => setPedido({ ...p, resolver })), []);

  const fechar = (v: boolean) => { pedido?.resolver(v); setPedido(null); };

  const dialogo = pedido ? (
    <Dialogo titulo={pedido.titulo} aoFechar={() => fechar(false)}>
      {pedido.texto && <p className="text-sm text-tinta-suave leading-relaxed">{pedido.texto}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => fechar(false)} className={botao("secundario")}>Cancelar</button>
        <button type="button" autoFocus onClick={() => fechar(true)} className={botao(pedido.perigo ? "perigo" : "primario")}>
          {pedido.confirmar ?? "Confirmar"}
        </button>
      </div>
    </Dialogo>
  ) : null;

  return { confirmar, dialogo };
}

/** Botão de formulário que pede confirmação antes de enviar. */
export function BotaoConfirmar({
  children, titulo, texto, confirmar = "Confirmar", perigo = true, className, variante,
}: {
  children: React.ReactNode; titulo: string; texto?: string; confirmar?: string;
  perigo?: boolean; className?: string; variante?: Parameters<typeof botao>[0];
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { confirmar: pedir, dialogo } = useConfirmar();
  const { pending } = useFormStatus();
  return (
    <>
      <button ref={ref} type="button" disabled={pending}
        onClick={async () => {
          if (await pedir({ titulo, texto, confirmar, perigo })) ref.current?.form?.requestSubmit();
        }}
        className={className ?? botao(variante ?? (perigo ? "fantasma" : "secundario"), "sm", perigo ? "text-red-700 hover:bg-red-50 hover:text-red-800" : "")}>
        {pending ? "Aguarde…" : children}
      </button>
      {dialogo}
    </>
  );
}

/* ═══ diálogo e gaveta ═════════════════════════════════════════════ */

function useEsc(fechar: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", k);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = anterior; };
  }, [fechar]);
}

export function Dialogo({ titulo, children, aoFechar }: { titulo: string; children: React.ReactNode; aoFechar: () => void }) {
  useEsc(aoFechar);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={aoFechar} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-2xl animate-[subir_.2s_ease-out]">
        <h2 className="text-lg font-semibold text-tinta pr-6">{titulo}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Painel que desliza da direita (desktop) ou de baixo (celular). */
export function Gaveta({ titulo, descricao, children, aoFechar, rodape }: {
  titulo: string; descricao?: string; children: React.ReactNode; aoFechar: () => void; rodape?: React.ReactNode;
}) {
  useEsc(aoFechar);
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={aoFechar} />
      <div className="absolute inset-x-0 bottom-0 top-10 sm:top-0 sm:left-auto sm:w-[34rem] flex flex-col rounded-t-3xl sm:rounded-none bg-fundo-suave shadow-2xl animate-[deslizar_.22s_ease-out]">
        <div className="flex items-start justify-between gap-4 border-b border-linha/70 bg-white px-5 py-4 rounded-t-3xl sm:rounded-none">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-tinta">{titulo}</h2>
            {descricao && <p className="text-xs text-tinta-suave mt-0.5">{descricao}</p>}
          </div>
          <button onClick={aoFechar} className={botao("fantasma", "sm", "-mr-2")} aria-label="Fechar">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {rodape && <div className="border-t border-linha/70 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ═══ formulário ═══════════════════════════════════════════════════ */

/** Botão de enviar com "Salvando…" automático. */
export function BotaoEnviar({ children, variante = "primario", tamanho = "md", className, pendente = "Salvando…" }: {
  children: React.ReactNode; variante?: Parameters<typeof botao>[0]; tamanho?: Parameters<typeof botao>[1];
  className?: string; pendente?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={botao(variante, tamanho, className)}>
      {pending && <Girando />}
      {pending ? pendente : children}
    </button>
  );
}

export function Girando({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Chama uma Server Action que devolve `{ ok, mensagem }`, mostra o toast e
 * recarrega os dados da tela — sem redirect, sem perder filtro nem rolagem.
 */
export type Resultado = { ok: boolean; mensagem: string };

export function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const executar = useCallback(
    (acao: (fd: FormData) => Promise<Resultado>, fd: FormData, depois?: (r: Resultado) => void) =>
      new Promise<Resultado>((resolver) => {
        iniciar(async () => {
          let r: Resultado;
          try { r = await acao(fd); }
          catch { r = { ok: false, mensagem: "Não consegui salvar. Confira a conexão e tente de novo." }; }
          avisar(r.mensagem, r.ok ? "ok" : "erro");
          if (r.ok) router.refresh();
          depois?.(r);
          resolver(r);
        });
      }),
    [router],
  );
  return { executar, pendente };
}

/* ═══ abas ═════════════════════════════════════════════════════════ */

export function Abas<T extends string>({ abas, atual, aoTrocar, className }: {
  abas: { id: T; rotulo: string; contador?: number; alerta?: boolean }[];
  atual: T; aoTrocar: (id: T) => void; className?: string;
}) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]", className)}>
      <div role="tablist" className="inline-flex min-w-full gap-1 rounded-2xl border border-linha/70 bg-white p-1 shadow-sm sm:min-w-0 xl:flex xl:flex-wrap">
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={atual === a.id} onClick={() => aoTrocar(a.id)}
            className={cn(
              "relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors",
              atual === a.id ? "bg-marca text-marca-texto shadow-sm" : "text-tinta-suave hover:bg-areia/60 hover:text-tinta",
            )}>
            {a.rotulo}
            {a.contador !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums",
                atual === a.id ? "bg-white/25" : a.alerta ? "bg-amber-100 text-amber-900" : "bg-areia text-tinta-suave")}>
                {a.contador}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
