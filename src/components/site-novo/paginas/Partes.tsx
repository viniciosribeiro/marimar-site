import type { ReactNode } from "react";
import Image from "next/image";

/**
 * Peças das páginas de conteúdo do site novo (fase 5): o mesmo cabeçalho, as
 * mesmas seções e o mesmo respiro em todas — A pousada, Ilha do Mel, Como
 * chegar, Eventos, Avaliações, Perguntas, Políticas, Contato, Pacotes.
 */
export function CabecalhoPagina({ titulo, children, foto }: {
  titulo: string; children?: ReactNode; foto?: { url: string; alt: string } | null;
}) {
  if (!foto) {
    return (
      <header className="sn-margem mx-auto max-w-[1240px] pt-10 lg:pt-16">
        <h1 className="sn-titulo-pagina">{titulo}</h1>
        {children && <div className="mt-4 max-w-[40rem] text-[1.06rem] leading-relaxed text-sn-texto-2">{children}</div>}
      </header>
    );
  }
  return (
    <header className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:px-10 lg:pt-14">
      <div className="relative aspect-[4/3] overflow-hidden bg-sn-areia lg:order-2 lg:aspect-[5/4] lg:rounded-[18px]">
        <Image src={foto.url} alt={foto.alt} fill preload sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      <div className="sn-margem lg:px-0">
        <h1 className="sn-titulo-pagina">{titulo}</h1>
        {children && <div className="mt-4 max-w-[36rem] text-[1.06rem] leading-relaxed text-sn-texto-2">{children}</div>}
      </div>
    </header>
  );
}

export function Secao({ id, titulo, children, apoio, estreita = false }: {
  id?: string; titulo: string; children: ReactNode; apoio?: ReactNode; estreita?: boolean;
}) {
  const idTitulo = id ? `${id}-titulo` : undefined;
  return (
    <section id={id} aria-labelledby={idTitulo} className={`sn-margem mx-auto mt-16 scroll-mt-[calc(var(--sn-topo)+1rem)] lg:mt-24 ${estreita ? "max-w-[860px]" : "max-w-[1240px]"}`}>
      <h2 id={idTitulo} className="sn-h2">{titulo}</h2>
      {apoio && <div className="mt-3 max-w-[42rem] text-sn-texto-2">{apoio}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Um aviso que importa (destino do barco, o que não temos…): areia, sem ícone gritando. */
export function Nota({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="max-w-[44rem] rounded-[16px] bg-sn-areia/70 px-5 py-4 leading-relaxed">
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={titulo ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

/** A faixa final de cada página: uma pergunta e no máximo duas ações. */
export function Fecho({ titulo, texto, children }: { titulo: string; texto?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`fecho-${idDe(titulo)}`} className="mt-20 bg-sn-areia/60 lg:mt-28">
      <div className="sn-margem mx-auto grid max-w-[1240px] gap-6 py-14 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16">
        <div className="max-w-[38rem]">
          <h2 id={`fecho-${idDe(titulo)}`} className="sn-h2">{titulo}</h2>
          {texto && <div className="mt-3 leading-relaxed text-sn-texto-2">{texto}</div>}
        </div>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </section>
  );
}

/** Lista com um ícone pequeno à esquerda (ou um traço). */
export function Lista({ itens, colunas = 1 }: { itens: ReactNode[]; colunas?: 1 | 2 }) {
  return (
    <ul className={`grid max-w-[52rem] gap-x-8 gap-y-3 ${colunas === 2 ? "sm:grid-cols-2" : ""}`}>
      {itens.map((item, i) => (
        <li key={i} className="flex items-start gap-3 leading-relaxed">
          <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-sn-mare-texto" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

const idDe = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
