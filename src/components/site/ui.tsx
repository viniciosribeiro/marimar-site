import Link from "next/link";
import type { ReactNode } from "react";

/**
 * ═══════════════════════════════════════════════════════════════════
 * LINGUAGEM VISUAL DO SITE — Pousada Marimar
 * ═══════════════════════════════════════════════════════════════════
 *
 * Todo componente aqui usa TOKENS do tema (bg-marca, font-titulo,
 * rounded-marca, bg-areia...). Nenhum valor de cor, fonte ou raio fica
 * fixo — o editor visual do admin precisa continuar controlando tudo.
 *
 * Se uma pagina escrever um estilo proprio em vez de usar estes
 * componentes, o site volta a ter duas aparencias. Use daqui.
 */

/* ─────────────── Rotulo acima do titulo ─────────────── */
/** "LOCALIZAÇÃO ———" : versalete espacado com um traço curto ao lado. */
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-3 text-marca text-xs font-semibold uppercase tracking-[0.18em]">
      {children}
      <span className="h-px w-8 bg-marca/40" aria-hidden />
    </span>
  );
}

/* ─────────────── Títulos ─────────────── */
export function TituloPagina({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`font-titulo text-4xl sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.05] text-tinta ${className}`}>
      {children}
    </h1>
  );
}

/** Título de seção com o traço que continua para a direita. */
export function TituloSecao({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className="flex items-center gap-4 mb-1 scroll-mt-24" id={id}>
      <h2 className="font-titulo text-2xl lg:text-[1.9rem] font-bold text-tinta whitespace-nowrap">{children}</h2>
      <span className="h-px flex-1 bg-linha" aria-hidden />
    </div>
  );
}

export function Subtexto({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-tinta-suave leading-relaxed ${className}`}>{children}</p>;
}

/* ─────────────── Anotação manuscrita ─────────────── */
/**
 * Texto decorativo, como no mockup ("Um paraíso sem pressa").
 *
 * aria-hidden de proposito: e ornamento. Nenhuma informacao pode existir
 * SO aqui — quem usa leitor de tela ou desliga a fonte manuscrita nao pode
 * perder nada. Some no mobile, onde nao ha espaco para respirar.
 */
export function Manuscrita({
  children, className = "", tamanho = "md",
}: { children: ReactNode; className?: string; tamanho?: "sm" | "md" | "lg" }) {
  const t = { sm: "text-lg", md: "text-xl lg:text-2xl", lg: "text-2xl lg:text-3xl" }[tamanho];
  return (
    <span aria-hidden className={`hidden lg:block font-manuscrita ${t} text-marca/85 leading-tight ${className}`}>
      {children}
    </span>
  );
}

/* ─────────────── Cartões ─────────────── */
export function Cartao({
  children, className = "", destaque = false,
}: { children: ReactNode; className?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-marca border p-6 ${
      destaque ? "bg-areia border-linha" : "bg-white border-linha/70 shadow-marca"
    } ${className}`}>
      {children}
    </div>
  );
}

/* ─────────────── Passo numerado ─────────────── */
export function Passo({
  n, icone, titulo, children, ultimo = false,
}: { n: number; icone: ReactNode; titulo: string; children: ReactNode; ultimo?: boolean }) {
  return (
    <div className="relative flex-1">
      <div className="h-full bg-white rounded-marca border border-linha/70 shadow-marca p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-9 h-9 rounded-full bg-marca text-marca-texto flex items-center justify-center font-bold text-sm shrink-0">
            {n}
          </span>
          <span className="text-marca text-xl" aria-hidden>{icone}</span>
        </div>
        <h3 className="font-semibold text-tinta mb-2">{titulo}</h3>
        <p className="text-sm text-tinta-suave leading-relaxed">{children}</p>
      </div>
      {!ultimo && (
        <span aria-hidden className="hidden lg:block absolute top-1/2 -right-5 -translate-y-1/2 text-marca/40 text-lg tracking-tight">
          ⇢
        </span>
      )}
    </div>
  );
}

/* ─────────────── Aviso ─────────────── */
export function Aviso({
  titulo, children, tom = "atencao",
}: { titulo: string; children: ReactNode; tom?: "atencao" | "info" }) {
  const cor = tom === "atencao"
    ? "bg-amber-50/70 border-amber-200/80 text-amber-950"
    : "bg-areia border-linha text-tinta";
  return (
    <div className={`rounded-marca border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 ${cor}`}>
      <span className="flex items-center gap-2.5 font-semibold shrink-0">
        <span className="text-lg" aria-hidden>{tom === "atencao" ? "⚠️" : "ℹ️"}</span>
        {titulo}
      </span>
      <span className="hidden sm:block w-px self-stretch bg-current opacity-20" aria-hidden />
      <span className="text-sm leading-relaxed">{children}</span>
    </div>
  );
}

/* ─────────────── Botões ─────────────── */
type BotaoProps = {
  href: string; children: ReactNode; icone?: ReactNode;
  variante?: "solido" | "contorno"; externo?: boolean; className?: string;
};

export function Botao({ href, children, icone, variante = "solido", externo = false, className = "" }: BotaoProps) {
  const estilo = variante === "solido"
    ? "bg-marca hover:bg-marca-hover text-marca-texto border-transparent"
    : "bg-white hover:bg-areia text-tinta border-linha";
  const cls = `inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-marca border text-sm font-semibold transition-marca ${estilo} ${className}`;
  const conteudo = <>{icone && <span aria-hidden>{icone}</span>}{children}</>;

  return externo
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{conteudo}</a>
    : <Link href={href} className={cls}>{conteudo}</Link>;
}

/* ─────────────── Selo ─────────────── */
export function Selo({ children, tom = "areia" }: { children: ReactNode; tom?: "areia" | "marca" }) {
  return (
    <span className={`inline-block text-xs px-3 py-1 rounded-full ${
      tom === "marca" ? "bg-marca text-marca-texto" : "bg-areia text-tinta border border-linha"
    }`}>
      {children}
    </span>
  );
}

/* ─────────────── Hero ─────────────── */
export function Hero({
  imagem, alt, rotulo, titulo, texto, manuscrita, legenda, atributos, children,
}: {
  imagem?: string | null; alt?: string; rotulo?: string; titulo: ReactNode;
  texto?: ReactNode; manuscrita?: string; legenda?: string;
  atributos?: { icone: string; texto: string }[]; children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-areia">
      {imagem && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagem} alt={alt || ""} className="absolute inset-0 -z-10 w-full h-full object-cover" />
          {/* Clareia a esquerda para o texto escuro ficar legivel sobre foto */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/75 to-white/10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-white/60 to-transparent" />
        </>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 relative">
        <div className="max-w-xl">
          {rotulo && <div className="mb-4"><Rotulo>{rotulo}</Rotulo></div>}
          <TituloPagina>{titulo}</TituloPagina>
          {texto && <Subtexto className="mt-4 text-[15px]">{texto}</Subtexto>}
          {children}

          {atributos && atributos.length > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-8">
              {atributos.map((a) => (
                <span key={a.texto} className="flex items-center gap-2.5 text-xs text-tinta-suave max-w-[10rem] leading-snug">
                  <span className="text-marca text-lg shrink-0" aria-hidden>{a.icone}</span>
                  {a.texto}
                </span>
              ))}
            </div>
          )}
        </div>

        {manuscrita && (
          <Manuscrita tamanho="lg" className="absolute right-8 xl:right-20 top-12 -rotate-6 text-right">
            {manuscrita}
          </Manuscrita>
        )}

        {legenda && (
          <span className="hidden sm:block absolute bottom-4 right-6 text-[11px] text-white bg-tinta/55 backdrop-blur-sm px-2.5 py-1 rounded">
            {legenda}
          </span>
        )}
      </div>
    </section>
  );
}

/* ─────────────── Seção ─────────────── */
export function Secao({
  children, fundo = "branco", className = "",
}: { children: ReactNode; fundo?: "branco" | "areia" | "suave"; className?: string }) {
  const bg = { branco: "bg-white", areia: "bg-areia", suave: "bg-fundo-suave" }[fundo];
  return (
    <section className={`${bg} ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 secao-py">{children}</div>
    </section>
  );
}

/* ─────────────── Ornamento de onda ─────────────── */
/** Faixa decorativa entre seções, como a areia no rodapé do mockup. */
export function Onda({ inverter = false }: { inverter?: boolean }) {
  return (
    <div aria-hidden className={`w-full overflow-hidden leading-[0] ${inverter ? "rotate-180" : ""}`}>
      <svg viewBox="0 0 1440 80" className="w-full h-10 lg:h-14" preserveAspectRatio="none">
        <path d="M0,40 C240,80 480,0 720,30 C960,60 1200,10 1440,45 L1440,80 L0,80 Z" className="fill-areia" />
        <path d="M0,58 C260,90 520,22 780,50 C1040,78 1240,36 1440,62 L1440,80 L0,80 Z" className="fill-areia-forte opacity-60" />
      </svg>
    </div>
  );
}
