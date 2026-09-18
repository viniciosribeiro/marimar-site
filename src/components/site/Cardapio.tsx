"use client";

import { useState, useMemo } from "react";
import { LightboxCardapio } from "./LightboxCardapio";
import Image from "next/image";
import { brl } from "@/lib/format";
import { marcador, classesMarcador, LISTA_MARCADORES, type CategoriaCardapio } from "@/lib/cardapio";

/**
 * Vitrine do cardapio.
 *
 * Client component porque tem busca e filtro. O conteudo chega pronto do
 * servidor — nao ha fetch no navegador, entao o cardapio aparece completo no
 * primeiro carregamento e continua indexavel.
 */
export function Cardapio({ categorias }: { categorias: CategoriaCardapio[] }) {
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<string[]>([]);
  // Lightbox vive aqui, nao em cada card: um so por vez, e o card nao
  // precisa carregar o visualizador inteiro para mostrar uma miniatura.
  const [aberto, setAberto] = useState<{ item: CategoriaCardapio["itens"][number]; i: number } | null>(null);

  // So oferece filtro de marcador que realmente existe no cardapio
  const marcadoresEmUso = useMemo(() => {
    const usados = new Set<string>();
    categorias.forEach((c) => c.itens.forEach((i) => (i.marcadores ?? []).forEach((m) => usados.add(m))));
    return LISTA_MARCADORES.filter((m) => usados.has(m.chave));
  }, [categorias]);

  const normalizar = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return categorias
      .map((c) => ({
        ...c,
        itens: c.itens.filter((i) => {
          const casaBusca = !termo ||
            normalizar(i.nome).includes(termo) ||
            normalizar(i.descricao ?? "").includes(termo);
          const casaFiltro = filtros.length === 0 ||
            filtros.every((f) => (i.marcadores ?? []).includes(f));
          return casaBusca && casaFiltro;
        }),
      }))
      .filter((c) => c.itens.length > 0);
  }, [categorias, busca, filtros]);

  const totalEncontrado = filtradas.reduce((s, c) => s + c.itens.length, 0);
  const filtrando = busca.trim() !== "" || filtros.length > 0;

  function alternarFiltro(chave: string) {
    setFiltros((f) => (f.includes(chave) ? f.filter((x) => x !== chave) : [...f, chave]));
  }

  return (
    <div>
      {/* ─── Navegação por categoria ─── */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-linha -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3 mb-8">
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
          {categorias.map((c) => (
            <a key={c.id} href={`#${c.slug}`}
              className="shrink-0 px-4 py-2 rounded-full border border-linha bg-white hover:bg-areia text-sm text-tinta whitespace-nowrap transition-marca">
              {c.icone && <span className="mr-1.5" aria-hidden>{c.icone}</span>}
              {c.nome}
            </a>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Buscar no cardápio</span>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden>🔍</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar prato, bebida, ingrediente…"
              className="w-full pl-9 pr-3 py-2.5 rounded-marca border border-linha text-sm bg-white focus:ring-2 focus:ring-marca outline-none"
            />
          </label>

          {marcadoresEmUso.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {marcadoresEmUso.map((m) => {
                const ativo = filtros.includes(m.chave);
                return (
                  <button key={m.chave} type="button" onClick={() => alternarFiltro(m.chave)}
                    aria-pressed={ativo}
                    className={`shrink-0 px-3 py-2 rounded-full border text-xs font-medium transition-marca ${
                      ativo ? "bg-marca text-marca-texto border-transparent" : "bg-white text-tinta border-linha hover:bg-areia"
                    }`}>
                    <span className="mr-1" aria-hidden>{m.icone}</span>{m.rotulo}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {filtrando && (
          <p className="text-xs text-tinta-suave mt-2">
            {totalEncontrado === 0
              ? "Nenhum item encontrado."
              : `${totalEncontrado} ${totalEncontrado === 1 ? "item encontrado" : "itens encontrados"}.`}{" "}
            <button type="button" onClick={() => { setBusca(""); setFiltros([]); }}
              className="text-marca font-medium hover:underline">
              limpar
            </button>
          </p>
        )}
      </div>

      {/* ─── Categorias ─── */}
      {filtradas.length === 0 ? (
        <div className="bg-areia rounded-marca p-10 text-center">
          <p className="text-tinta-suave">Nada encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="space-y-14">
          {filtradas.map((c) => (
            <section key={c.id} id={c.slug} className="scroll-mt-52">
              <div className="flex items-baseline gap-4 mb-1">
                <h2 className="font-titulo text-2xl font-bold text-tinta whitespace-nowrap">
                  {c.icone && <span className="mr-2" aria-hidden>{c.icone}</span>}
                  {c.nome}
                </h2>
                <span className="h-px flex-1 bg-linha" aria-hidden />
                {c.horario && (
                  <span className="text-xs text-tinta-suave whitespace-nowrap">🕐 {c.horario}</span>
                )}
              </div>
              {c.descricao && <p className="text-sm text-tinta-suave mb-6">{c.descricao}</p>}

              <div className="grid sm:grid-cols-2 gap-4 mt-6">
                {c.itens.map((i) => (
                  <ItemCard key={i.id} item={i} aoAbrir={(idx) => setAberto({ item: i, i: idx })} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <LightboxCardapio
        fotos={aberto?.item.fotos ?? []}
        nome={aberto?.item.nome ?? ""}
        aberto={aberto !== null}
        indiceInicial={aberto?.i ?? 0}
        aoFechar={() => setAberto(null)}
      />
    </div>
  );
}

function ItemCard({ item, aoAbrir }: { item: CategoriaCardapio["itens"][number]; aoAbrir: (i: number) => void }) {
  const promo = item.preco_promocional && Number(item.preco_promocional) > 0;
  const indisponivel = !item.disponivel;
  const fotos = item.fotos ?? [];
  const capa = fotos[0]?.url ?? item.foto_url ?? null;

  return (
    <article className={`flex gap-4 bg-white rounded-marca border border-linha/70 shadow-marca p-4 ${
      indisponivel ? "opacity-60" : ""
    }`}>
      {capa && (
        <button
          type="button"
          onClick={() => aoAbrir(0)}
          disabled={fotos.length === 0}
          aria-label={fotos.length > 1 ? `Ver as ${fotos.length} fotos de ${item.nome}` : `Ver foto de ${item.nome}`}
          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-marca overflow-hidden shrink-0 bg-areia group disabled:cursor-default"
        >
          <Image src={capa} alt={item.nome} fill sizes="(max-width: 640px) 96px, 112px"
            className="object-cover transition-transform duration-300 group-enabled:group-hover:scale-105" />
          {fotos.length > 1 && (
            <span className="absolute bottom-1 right-1 bg-black/65 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {fotos.length} fotos
            </span>
          )}
        </button>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-tinta leading-snug">{item.nome}</h3>
          {item.destaque && !indisponivel && (
            <span className="text-xs bg-marca text-marca-texto px-2 py-0.5 rounded-full shrink-0">★</span>
          )}
        </div>

        {item.descricao && (
          <p className="text-sm text-tinta-suave leading-relaxed mt-1">{item.descricao}</p>
        )}

        {(item.marcadores?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.marcadores!.map((chave) => {
              const m = marcador(chave);
              if (!m) return null;
              return (
                <span key={chave} className={`text-[11px] px-2 py-0.5 rounded-full border ${classesMarcador(m.cor)}`}>
                  <span aria-hidden>{m.icone}</span> {m.rotulo}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex items-end justify-between gap-3 mt-auto pt-3">
          <span className="text-xs text-tinta-suave">{item.porcao}</span>
          {indisponivel ? (
            <span className="text-xs bg-areia text-tinta-suave px-2.5 py-1 rounded-full border border-linha">
              Indisponível hoje
            </span>
          ) : item.preco ? (
            <span className="text-right leading-tight">
              {promo && (
                <span className="block text-xs text-tinta-suave line-through">{brl(Number(item.preco))}</span>
              )}
              <span className="font-bold text-marca text-lg">
                {brl(Number(promo ? item.preco_promocional : item.preco))}
              </span>
            </span>
          ) : (
            <span className="text-xs text-tinta-suave">consulte</span>
          )}
        </div>
      </div>
    </article>
  );
}
