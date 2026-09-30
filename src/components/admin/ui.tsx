import Link from "next/link";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Design system do painel — as peças que toda tela usa.
 *
 * Regras (detalhes em `docs/design-system-admin.md`):
 * - Cor só por token do tema (`marca`, `tinta`, `areia`, `linha`). O painel
 *   veste a identidade da pousada: trocar a cor em Identidade visual troca
 *   o painel junto.
 * - Alvo de toque com no mínimo 40px (`min-h-10`): o painel é usado no
 *   celular, na recepção.
 * - Texto em português simples, sem jargão ("Salvar", não "Submeter").
 *
 * Este arquivo não tem estado nem evento: serve em Server Component. As
 * peças interativas ficam em `ui-cliente.tsx`.
 */

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

/* ── botões ──────────────────────────────────────────────────────── */

type Variante = "primario" | "secundario" | "fantasma" | "perigo" | "suave";
type Tamanho = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-marca-texto hover:bg-marca-hover shadow-sm",
  secundario: "bg-white text-tinta border border-linha hover:bg-areia/60 shadow-sm",
  fantasma: "text-tinta-suave hover:text-tinta hover:bg-areia/70",
  perigo: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  suave: "bg-marca-suave text-marca-escura hover:bg-marca-borda/60",
};
const TAMANHOS: Record<Tamanho, string> = {
  sm: "min-h-9 px-3 text-xs gap-1.5",
  md: "min-h-10 px-4 text-sm gap-2",
  lg: "min-h-12 px-5 text-base gap-2",
};

export function botao(variante: Variante = "primario", tamanho: Tamanho = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none select-none",
    VARIANTES[variante], TAMANHOS[tamanho], extra,
  );
}

export function BotaoLink({
  href, children, variante = "primario", tamanho = "md", className, externo,
}: {
  href: string; children: React.ReactNode; variante?: Variante; tamanho?: Tamanho;
  className?: string; externo?: boolean;
}) {
  return (
    <Link href={href} className={botao(variante, tamanho, className)}
      {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
    </Link>
  );
}

/* ── campos ──────────────────────────────────────────────────────── */

export const campo = cn(
  "w-full rounded-xl border border-linha bg-white px-3.5 py-2.5 text-sm text-tinta",
  "placeholder:text-tinta-suave/60 shadow-sm transition-colors",
  "focus:outline-none focus:border-marca focus:ring-2 focus:ring-marca/25",
  "disabled:bg-areia/40",
);

export function Rotulo({
  rotulo, ajuda, obrigatorio, children, className,
}: {
  rotulo: string; ajuda?: React.ReactNode; obrigatorio?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-sm font-medium text-tinta">
        {rotulo}{obrigatorio && <span className="text-red-600" aria-hidden> *</span>}
      </span>
      {ajuda && <span className="block text-xs text-tinta-suave mt-0.5">{ajuda}</span>}
      <span className="block mt-1.5">{children}</span>
    </label>
  );
}

/* ── estrutura de página ─────────────────────────────────────────── */

export function Pagina({ children, larga, className }: { children: React.ReactNode; larga?: boolean; className?: string }) {
  return (
    <div className={cn("px-4 py-6 sm:px-6 lg:px-10 lg:py-8 mx-auto w-full", larga ? "max-w-7xl" : "max-w-5xl", className)}>
      {children}
    </div>
  );
}

export function Cabecalho({
  titulo, descricao, acoes, voltar, sobre,
}: {
  titulo: string; descricao?: React.ReactNode; acoes?: React.ReactNode;
  voltar?: { href: string; rotulo: string }; sobre?: string;
}) {
  return (
    <header className="mb-6 lg:mb-8">
      {voltar && (
        <Link href={voltar.href} className="inline-flex items-center gap-1 text-xs font-medium text-tinta-suave hover:text-marca mb-3 min-h-8">
          <span aria-hidden>←</span> {voltar.rotulo}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {sobre && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-marca mb-1">{sobre}</p>}
          <h1 className="font-titulo text-2xl sm:text-[1.75rem] font-bold tracking-tight text-tinta">{titulo}</h1>
          {descricao && <p className="mt-1.5 text-sm text-tinta-suave max-w-2xl leading-relaxed">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2 shrink-0">{acoes}</div>}
      </div>
    </header>
  );
}

export function Cartao({
  children, className, titulo, descricao, acoes, semPadding,
}: {
  children: React.ReactNode; className?: string; titulo?: React.ReactNode;
  descricao?: React.ReactNode; acoes?: React.ReactNode; semPadding?: boolean;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-linha/80 bg-white shadow-sm", className)}>
      {(titulo || acoes) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-semibold text-tinta">{titulo}</h2>}
            {descricao && <p className="text-xs text-tinta-suave mt-0.5 leading-relaxed">{descricao}</p>}
          </div>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
      )}
      <div className={semPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}

/* ── status ──────────────────────────────────────────────────────── */

type TomSelo = "neutro" | "sucesso" | "aviso" | "erro" | "info" | "marca";
const SELOS: Record<TomSelo, string> = {
  neutro: "bg-gray-100 text-gray-700 ring-gray-200",
  sucesso: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  aviso: "bg-amber-50 text-amber-900 ring-amber-200",
  erro: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  marca: "bg-marca-suave text-marca-escura ring-marca-borda",
};

export function Selo({ tom = "neutro", children, ponto, className, title }: {
  tom?: TomSelo; children: React.ReactNode; ponto?: boolean; className?: string; title?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap", SELOS[tom], className)}>
      {ponto && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />}
      {children}
    </span>
  );
}

type TomAviso = "info" | "sucesso" | "aviso" | "erro";
const AVISOS: Record<TomAviso, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  sucesso: "border-emerald-200 bg-emerald-50 text-emerald-900",
  aviso: "border-amber-200 bg-amber-50 text-amber-950",
  erro: "border-red-200 bg-red-50 text-red-900",
};
const ICONES_AVISO: Record<TomAviso, string> = { info: "ℹ", sucesso: "✓", aviso: "!", erro: "×" };

export function Aviso({ tom = "info", titulo, children, className, acao }: {
  tom?: TomAviso; titulo?: string; children?: React.ReactNode; className?: string; acao?: React.ReactNode;
}) {
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl border px-4 py-3 text-sm", AVISOS[tom], className)}>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-bold" aria-hidden>
        {ICONES_AVISO[tom]}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {acao && <div className="shrink-0 self-center">{acao}</div>}
    </div>
  );
}

/* ── estados ─────────────────────────────────────────────────────── */

export function Vazio({ icone = "🌴", titulo, children, acao }: {
  icone?: React.ReactNode; titulo: string; children?: React.ReactNode; acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha bg-areia/30 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm" aria-hidden>{icone}</div>
      <p className="font-semibold text-tinta">{titulo}</p>
      {children && <p className="mt-1 max-w-md text-sm text-tinta-suave leading-relaxed">{children}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-areia/70", className)} aria-hidden />;
}

/** Tela de carregamento padrão, usada pelos `loading.tsx`. */
export function Carregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <Pagina>
      <div role="status" aria-label="Carregando">
        <Esqueleto className="h-4 w-24 mb-3" />
        <Esqueleto className="h-8 w-64 mb-2" />
        <Esqueleto className="h-4 w-96 max-w-full mb-8" />
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {[0, 1, 2].map((i) => <Esqueleto key={i} className="h-24" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: linhas }).map((_, i) => <Esqueleto key={i} className="h-16" />)}
        </div>
        <span className="sr-only">Carregando…</span>
      </div>
    </Pagina>
  );
}

/* ── números ─────────────────────────────────────────────────────── */

export function Indicador({ rotulo, valor, detalhe, tom = "neutro", href }: {
  rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode;
  tom?: "neutro" | "sucesso" | "aviso" | "erro"; href?: string;
}) {
  const barra = { neutro: "bg-linha", sucesso: "bg-emerald-500", aviso: "bg-amber-500", erro: "bg-red-500" }[tom];
  const corpo = (
    <div className="relative h-full overflow-hidden rounded-2xl border border-linha/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <span className={cn("absolute inset-y-0 left-0 w-1", barra)} aria-hidden />
      <p className="text-xs font-medium text-tinta-suave">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-tinta">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-tinta-suave leading-snug">{detalhe}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{corpo}</Link> : corpo;
}

/* ── listas responsivas: tabela no desktop, cartões no celular ───── */

export type Coluna<T> = {
  titulo: string;
  celula: (item: T) => React.ReactNode;
  /** Some no celular (o cartão mostra só o essencial). */
  soDesktop?: boolean;
  className?: string;
};

/* Classes literais: o Tailwind só gera o que aparece escrito no código. */
const CARTOES_ATE = {
  md: ["md:hidden", "hidden md:block"],
  lg: ["lg:hidden", "hidden lg:block"],
  xl: ["xl:hidden", "hidden xl:block"],
} as const;

export function Lista<T>({
  itens, colunas, chave, acoes, vazio, principal, cartoesAte = "md",
}: {
  itens: T[];
  colunas: Coluna<T>[];
  chave: (item: T) => string;
  acoes?: (item: T) => React.ReactNode;
  vazio?: React.ReactNode;
  /** Qual coluna vira o título do cartão no celular (índice). */
  principal?: number;
  /** Até onde mostrar cartões em vez de tabela. Tabela larga (muitas colunas
      ou muitas ações) pede "lg" ou "xl" — senão espreme em tablet. */
  cartoesAte?: keyof typeof CARTOES_ATE;
}) {
  if (!itens.length) return <>{vazio ?? <Vazio titulo="Nada cadastrado ainda" />}</>;
  const p = principal ?? 0;
  return (
    <>
      {/* Celular: cartões */}
      <ul className={cn("space-y-3 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0", CARTOES_ATE[cartoesAte][0])}>
        {itens.map((item) => (
          <li key={chave(item)} className="rounded-2xl border border-linha/80 bg-white p-4 shadow-sm">
            <div className="font-semibold text-tinta">{colunas[p].celula(item)}</div>
            <dl className="mt-2 space-y-1">
              {colunas.map((c, i) => i === p || c.soDesktop ? null : (
                <div key={c.titulo} className="flex justify-between gap-3 text-sm">
                  <dt className="text-tinta-suave">{c.titulo}</dt>
                  <dd className="text-right text-tinta min-w-0">{c.celula(item)}</dd>
                </div>
              ))}
            </dl>
            {acoes && <div className="mt-3 flex flex-wrap gap-2 border-t border-linha/60 pt-3">{acoes(item)}</div>}
          </li>
        ))}
      </ul>
      {/* Tablet e desktop: tabela */}
      <div className={cn("overflow-x-auto rounded-2xl border border-linha/80 bg-white shadow-sm", CARTOES_ATE[cartoesAte][1])}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-linha/80 bg-areia/40">
              {colunas.map((c) => (
                <th key={c.titulo} className={cn("px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-tinta-suave", c.className)}>{c.titulo}</th>
              ))}
              {acoes && <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-linha/50">
            {itens.map((item) => (
              <tr key={chave(item)} className="hover:bg-areia/25 transition-colors">
                {colunas.map((c) => <td key={c.titulo} className={cn("px-4 py-3 align-middle text-tinta", c.className)}>{c.celula(item)}</td>)}
                {acoes && <td className="px-4 py-3"><div className="flex items-center justify-end gap-2">{acoes(item)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** "há 5 min", "ontem", "12/09" — como quem opera fala. */
export function quandoFoi(iso: string | Date | null | undefined): string {
  if (!iso) return "nunca";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const seg = Math.round((Date.now() - d.getTime()) / 1000);
  if (seg < 60) return "agora há pouco";
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} ${h === 1 ? "hora" : "horas"}`;
  const dias = Math.round(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: dias > 300 ? "2-digit" : undefined });
}
