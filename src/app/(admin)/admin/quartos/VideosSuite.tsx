"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Film, Images } from "lucide-react";
import { EnviarMidia } from "@/components/admin/EnviarMidia";
import { botao, campo } from "@/components/admin/ui";
import { Girando, useAcao } from "@/components/admin/ui-cliente";
import { formatarDuracao } from "@/lib/midia-cliente";
import { editarMidia, reordenar } from "../midias/actions";

export type VideoSuite = { id: string; titulo: string | null; descricao: string | null; alt: string; thumb_url: string | null; duracao_seg: number | null; visivel_marina: boolean };

/**
 * Os vídeos de uma suíte, na ordem em que o hóspede (e a Marina) os vê:
 * entrada, interior, banheiro, vista. Setas em vez de arrastar porque isto
 * vive dentro de uma janela, e no celular arrastar dentro de janela rolável
 * é frustrante. A biblioteca (Fotos e vídeos) tem o arrastar completo.
 */
export function VideosSuite({ quartoId, videos, totalFotos, blobOk }: {
  quartoId: string; videos: VideoSuite[]; totalFotos: number; blobOk: boolean;
}) {
  const [ordem, setOrdem] = useState(videos.map((v) => v.id));
  const [chave, setChave] = useState(videos.map((v) => v.id).join());
  const { executar, pendente } = useAcao();
  /* A lista do servidor mudou (vídeo novo): recomeça da ordem dela. */
  const atual = videos.map((v) => v.id).join();
  if (atual !== chave) { setChave(atual); setOrdem(videos.map((v) => v.id)); }
  const porId = new Map(videos.map((v) => [v.id, v]));

  const mover = (i: number, d: -1 | 1) => {
    const n = [...ordem];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setOrdem(n);
    executar(() => reordenar(n), new FormData());
  };

  return (
    <section className="mt-6 space-y-3 border-t border-linha/70 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-tinta">Vídeos da suíte</h3>
          <p className="text-xs text-tinta-suave">Até 5 minutos cada. Nesta ordem no site e quando a Marina envia.</p>
        </div>
        <Link href={`/admin/midias?album=quarto:${quartoId}`} className={botao("secundario", "sm")}>
          <Images className="h-3.5 w-3.5" /> Fotos da suíte ({totalFotos})
        </Link>
      </div>

      {ordem.length > 0 && (
        <ol className="space-y-2">
          {ordem.map((id, i) => {
            const v = porId.get(id);
            if (!v) return null;
            return (
              <li key={id} className="rounded-xl border border-linha/80 bg-white p-2.5">
                <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                  <span className="mt-1 w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-tinta-suave">{i + 1}</span>
                  <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-areia">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {v.thumb_url ? <img src={v.thumb_url} alt="" className="h-full w-full object-cover" /> : <Film className="m-auto mt-4 h-5 w-5 text-tinta-suave" />}
                    {v.duracao_seg ? <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] text-white">{formatarDuracao(v.duracao_seg)}</span> : null}
                  </span>
                  <form className="order-last min-w-0 basis-full space-y-1.5 sm:order-none sm:basis-0 sm:flex-1" onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("id", v.id);
                    fd.set("alt", v.alt);
                    if (v.visivel_marina) fd.set("visivel_marina", "on");
                    executar(editarMidia, fd);
                  }}>
                    <input name="titulo" defaultValue={v.titulo ?? ""} placeholder="Título (ex.: Entrada, Banheiro, Vista)" aria-label="Título do vídeo" className={campo + " min-h-10 py-2 text-sm"} />
                    <div className="flex gap-1.5">
                      <input name="descricao" defaultValue={v.descricao ?? ""} placeholder="Descrição curta (opcional)" aria-label="Descrição do vídeo" className={campo + " min-h-10 min-w-0 flex-1 py-2 text-sm"} />
                      <button disabled={pendente} className={botao("secundario", "sm", "shrink-0")}>{pendente ? <Girando /> : "Salvar"}</button>
                    </div>
                  </form>
                  <div className="ml-auto flex shrink-0 gap-1 sm:ml-0 sm:flex-col">
                    <button type="button" disabled={i === 0 || pendente} onClick={() => mover(i, -1)} aria-label="Subir" className={botao("fantasma", "sm", "h-9 w-9 px-0")}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" disabled={i === ordem.length - 1 || pendente} onClick={() => mover(i, 1)} aria-label="Descer" className={botao("fantasma", "sm", "h-9 w-9 px-0")}><ArrowDown className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <EnviarMidia album={`quarto:${quartoId}`} aceitar="video" configurado={blobOk} compacto />
    </section>
  );
}
