"use client";

import { useState } from "react";
import { FormBanner, type BannerAdmin as Banner } from "./FormBanner";
import { alternarBanner, moverBanner, excluirBanner } from "./actions";

export function PainelBanners({ banners, blobOk }: { banners: Banner[]; blobOk: boolean }) {
  const [editando, setEditando] = useState<Banner | null | undefined>(undefined);
  const aberto = editando !== undefined;

  if (aberto) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-5">
          {editando ? "Editar banner" : "Novo banner"}
        </h2>
        <FormBanner banner={editando} blobOk={blobOk} aoFechar={() => setEditando(undefined)} />
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setEditando(null)}
        className="mb-5 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
        Novo banner
      </button>

      {banners.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600 mb-1">Nenhum banner cadastrado.</p>
          <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
            Sem nenhum, o topo da home continua usando a foto marcada como
            destaque em <strong>Fotos</strong> — o comportamento antigo. O
            primeiro banner cadastrado assume o lugar dela.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {banners.map((b, i) => (
            <li key={b.id}
              className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row gap-4">
              <div className="relative w-full sm:w-44 h-28 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imagem_url} alt={b.alt ?? ""} className="w-full h-full object-cover" />
                {!b.ativo && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-gray-600">Desligado</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{b.titulo || "Sem título"}</p>
                {b.subtitulo && (
                  <p className="text-sm text-gray-500 line-clamp-2 leading-snug mt-0.5">{b.subtitulo}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {b.cta_texto && <Selo>{b.cta_texto} → {b.cta_href || "sem link"}</Selo>}
                  <Periodo inicia={b.inicia_em} termina={b.termina_em} />
                  {b.tipo_midia === "video" && <Selo>vídeo</Selo>}
                  {b.ken_burns && <Selo>movimento na foto</Selo>}
                  {b.textura !== "nenhuma" && <Selo>textura: {b.textura}</Selo>}
                  {!b.alt && <Selo tom="alerta">sem texto alternativo</Selo>}
                </div>
              </div>

              <div className="flex sm:flex-col gap-1.5 shrink-0">
                <Acao acao={moverBanner} id={b.id} extra={{ direcao: "cima" }} desabilitado={i === 0}>
                  ↑
                </Acao>
                <Acao acao={moverBanner} id={b.id} extra={{ direcao: "baixo" }}
                  desabilitado={i === banners.length - 1}>
                  ↓
                </Acao>
                <Acao acao={alternarBanner} id={b.id}>{b.ativo ? "Desligar" : "Ligar"}</Acao>
                <button onClick={() => setEditando(b)}
                  className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  Editar
                </button>
                <Acao acao={excluirBanner} id={b.id} perigo
                  confirmar="Excluir este banner? A imagem também sai do armazenamento.">
                  Excluir
                </Acao>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Selo({ children, tom = "normal" }: { children: React.ReactNode; tom?: "normal" | "alerta" }) {
  return (
    <span className={`text-[11px] px-2 py-1 rounded ${
      tom === "alerta" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-gray-100 text-gray-600"
    }`}>
      {children}
    </span>
  );
}

/**
 * Diz se a janela de exibicao ja passou, ainda vai comecar, ou esta valendo.
 * Um banner "ativo" com data vencida nao aparece no site — sem este aviso,
 * a tela diria "ativo" e o site nao mostraria nada, e ninguem entenderia.
 */
function Periodo({ inicia, termina }: { inicia: string | null; termina: string | null }) {
  if (!inicia && !termina) return <Selo>sempre no ar</Selo>;
  const agora = new Date().toISOString().slice(0, 16).replace("T", " ");
  const aindaNao = inicia && agora < inicia;
  const jaPassou = termina && agora > termina;
  const br = (v: string) => v.slice(8, 10) + "/" + v.slice(5, 7) + " " + v.slice(11);
  return (
    <Selo tom={aindaNao || jaPassou ? "alerta" : "normal"}>
      {jaPassou ? "encerrado em " + br(termina!)
        : aindaNao ? "começa em " + br(inicia!)
        : termina ? "no ar até " + br(termina) : "no ar desde " + br(inicia!)}
    </Selo>
  );
}

function Acao({ acao, id, extra, children, perigo, confirmar, desabilitado }: {
  acao: (fd: FormData) => Promise<void>;
  id: string;
  extra?: Record<string, string>;
  children: React.ReactNode;
  perigo?: boolean;
  confirmar?: string;
  desabilitado?: boolean;
}) {
  return (
    <form action={acao} onSubmit={(e) => { if (confirmar && !confirm(confirmar)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" disabled={desabilitado}
        className={`w-full px-2.5 py-1.5 text-xs border rounded-lg disabled:opacity-30 ${
          perigo ? "border-red-200 text-red-600 hover:bg-red-50" : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}>
        {children}
      </button>
    </form>
  );
}
