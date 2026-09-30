"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Video, FolderUp, CheckCircle2, AlertCircle, X } from "lucide-react";
import {
  prepararFoto, prepararVideo, enviar, caminho, ehVideo, ehImagem, ErroMidia,
  formatarBytes, formatarDuracao, type Fase,
} from "@/lib/midia-cliente";
import { registrarMidia } from "@/app/(admin)/admin/midias/actions";
import { botao, cn } from "./ui";
import { avisar } from "./ui-cliente";

/**
 * Enviar fotos e vídeos — o mesmo componente em toda a aplicação.
 *
 * Três jeitos de enviar, com botões grandes:
 * - "Tirar foto" / "Gravar vídeo": abrem a câmera do celular direto
 *   (atributo `capture`). No computador, abrem o seletor de arquivos.
 * - "Escolher arquivos": galeria do celular ou pasta do computador, vários
 *   de uma vez.
 * - Arrastar e soltar (computador).
 *
 * Cada arquivo passa por `midia-cliente.ts` antes de subir: HEIC vira JPEG,
 * foto é otimizada, vídeo é conferido (≤ 5 min), comprimido, ganha miniatura
 * e, se precisar, uma versão de até 16 MB para o WhatsApp.
 */

type Item = {
  id: number; nome: string; tipo: "foto" | "video";
  fase: Fase | "pronto" | "erro"; progresso: number; erro?: string; detalhe?: string;
};

const ROTULO_FASE: Record<Item["fase"], string> = {
  lendo: "Lendo…", comprimindo: "Comprimindo", whatsapp: "Versão para WhatsApp", miniatura: "Gerando miniatura",
  enviando: "Enviando", pronto: "Pronto", erro: "Não deu certo",
};

export function EnviarMidia({ album, aceitar = "ambos", configurado, aoConcluir, compacto }: {
  album: string;
  aceitar?: "foto" | "video" | "ambos";
  configurado: boolean;
  /** Recebe os ids criados (ex.: a etapa do roteiro liga o vídeo recém-enviado). */
  aoConcluir?: (ids: string[], tipo: "foto" | "video") => void;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [fila, setFila] = useState<Item[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const seq = useRef(0);
  const refFoto = useRef<HTMLInputElement>(null);
  const refVideo = useRef<HTMLInputElement>(null);
  const refArquivos = useRef<HTMLInputElement>(null);

  const atualizar = (id: number, dados: Partial<Item>) => setFila((f) => f.map((i) => (i.id === id ? { ...i, ...dados } : i)));

  const processar = useCallback(async (arquivo: File, id: number) => {
    const video = ehVideo(arquivo);
    try {
      if (video) {
        const v = await prepararVideo(arquivo, (fase, p) => atualizar(id, { fase, progresso: p }));
        atualizar(id, { fase: "enviando", progresso: 0 });
        const partes = 1 + (v.whatsapp ? 1 : 0) + (v.miniatura ? 1 : 0);
        let feitas = 0;
        const passo = (p: number) => atualizar(id, { progresso: (feitas + p) / partes });
        const principal = await enviar(v.blob, caminho("midias/videos", v.nome), passo); feitas++;
        const zap = v.whatsapp ? await enviar(v.whatsapp, caminho("midias/whatsapp", v.nome.replace(/\.\w+$/, "") + "-whatsapp.mp4"), passo) : null;
        if (zap) feitas++;
        const mini = v.miniatura ? await enviar(v.miniatura, caminho("midias/miniaturas", v.nome.replace(/\.\w+$/, "") + ".jpg"), passo) : null;
        const r = await registrarMidia({
          album, tipo: "video", url: principal.url, pathname: principal.pathname,
          titulo: arquivo.name.replace(/\.\w+$/, "").replace(/[-_]+/g, " ").slice(0, 80),
          largura: v.largura, altura: v.altura, bytes: v.blob.size, formato: v.tipo, duracao: v.duracao,
          thumbUrl: mini?.url ?? null, thumbPathname: mini?.pathname ?? null,
          whatsappUrl: zap?.url ?? null, whatsappPathname: zap?.pathname ?? null, whatsappBytes: v.whatsapp?.size ?? null,
        });
        if (!r.ok) throw new ErroMidia(r.mensagem);
        atualizar(id, {
          fase: "pronto", progresso: 1,
          detalhe: `${formatarDuracao(v.duracao)} · ${formatarBytes(v.blob.size)}${v.comprimido ? ` (era ${formatarBytes(arquivo.size)})` : ""}${v.observacao ? ` · ${v.observacao}` : ""}`,
        });
        aoConcluir?.(r.ids ?? [], "video");
      } else {
        atualizar(id, { fase: "lendo", progresso: 0 });
        const f = await prepararFoto(arquivo);
        atualizar(id, { fase: "enviando", progresso: 0 });
        const up = await enviar(f.blob, caminho("midias/fotos", f.nome), (p) => atualizar(id, { progresso: p }));
        const r = await registrarMidia({
          album, tipo: "foto", url: up.url, pathname: up.pathname,
          largura: f.largura, altura: f.altura, bytes: f.blob.size, formato: f.tipo,
        });
        if (!r.ok) throw new ErroMidia(r.mensagem);
        atualizar(id, { fase: "pronto", progresso: 1, detalhe: `${f.largura}×${f.altura} · ${formatarBytes(f.blob.size)}` });
        aoConcluir?.(r.ids ?? [], "foto");
      }
    } catch (e) {
      const msg = e instanceof ErroMidia ? e.message
        : /network|fetch|Failed/i.test((e as Error).message) ? "A conexão caiu durante o envio. Confira a internet e tente de novo."
        : (e as Error).message || "Não consegui enviar este arquivo.";
      atualizar(id, { fase: "erro", erro: msg });
    }
  }, [album, aoConcluir]);

  const receber = useCallback(async (lista: FileList | File[] | null) => {
    const arquivos = Array.from(lista ?? []).filter((f) => {
      if (aceitar === "foto") return ehImagem(f);
      if (aceitar === "video") return ehVideo(f);
      return ehImagem(f) || ehVideo(f);
    });
    const ignorados = Array.from(lista ?? []).length - arquivos.length;
    if (ignorados) avisar(`${ignorados} arquivo${ignorados > 1 ? "s" : ""} ignorado${ignorados > 1 ? "s" : ""}: formato não aceito aqui.`, "erro");
    if (!arquivos.length) return;
    const novos = arquivos.map((f) => ({ id: ++seq.current, nome: f.name, tipo: (ehVideo(f) ? "video" : "foto") as Item["tipo"], fase: "lendo" as Fase, progresso: 0 }));
    setFila((f) => [...novos, ...f.filter((i) => i.fase !== "pronto")]);
    /* Fotos, três por vez; vídeos, um por vez (comprimir dois vídeos juntos
       no celular esquenta o aparelho e não termina mais rápido). */
    const fotos = arquivos.map((f, i) => ({ f, id: novos[i].id })).filter((x) => !ehVideo(x.f));
    const videos = arquivos.map((f, i) => ({ f, id: novos[i].id })).filter((x) => ehVideo(x.f));
    const trabalhar = async (lista: typeof fotos, paralelo: number) => {
      const fila = [...lista];
      await Promise.all(Array.from({ length: paralelo }, async () => {
        for (let x = fila.shift(); x; x = fila.shift()) await processar(x.f, x.id);
      }));
    };
    await Promise.all([trabalhar(fotos, 3), trabalhar(videos, 1)]);
    router.refresh();
  }, [aceitar, processar, router]);

  if (!configurado) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Envio de arquivos ainda não configurado.</strong> Falta a variável <code>BLOB_READ_WRITE_TOKEN</code> na Vercel
        (Storage → Blob → conectar ao projeto).
      </div>
    );
  }

  const aceitaFoto = aceitar !== "video";
  const aceitaVideo = aceitar !== "foto";
  const accept = [aceitaFoto ? "image/*,.heic,.heif" : "", aceitaVideo ? "video/*,.mov,.mp4,.m4v,.webm" : ""].filter(Boolean).join(",");
  const emAndamento = fila.some((i) => i.fase !== "pronto" && i.fase !== "erro");

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer.files); }}
        className={cn(
          "rounded-2xl border-2 border-dashed p-4 transition-colors",
          compacto ? "p-3" : "sm:p-6",
          arrastando ? "border-marca bg-marca-sutil" : "border-linha bg-white",
        )}>
        <div className={cn("grid gap-2", aceitaFoto && aceitaVideo ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
          {aceitaFoto && (
            <button type="button" onClick={() => refFoto.current?.click()} className={botao("secundario", "lg", "w-full")}>
              <Camera className="h-5 w-5" /> Tirar foto
            </button>
          )}
          {aceitaVideo && (
            <button type="button" onClick={() => refVideo.current?.click()} className={botao("secundario", "lg", "w-full")}>
              <Video className="h-5 w-5" /> Gravar vídeo
            </button>
          )}
          <button type="button" onClick={() => refArquivos.current?.click()} className={botao("primario", "lg", "w-full")}>
            <FolderUp className="h-5 w-5" /> Escolher arquivos
          </button>
        </div>
        {!compacto && (
          <p className="mt-3 text-center text-xs text-tinta-suave">
            Ou arraste para cá. {aceitaFoto && "Fotos em JPG, PNG, WebP ou HEIC (iPhone). "}{aceitaVideo && "Vídeos de até 5 minutos — o sistema comprime sozinho."}
          </p>
        )}
        <input ref={refFoto} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { receber(e.target.files); e.target.value = ""; }} />
        <input ref={refVideo} type="file" accept="video/*" capture="environment" className="sr-only" onChange={(e) => { receber(e.target.files); e.target.value = ""; }} />
        <input ref={refArquivos} type="file" accept={accept} multiple className="sr-only" onChange={(e) => { receber(e.target.files); e.target.value = ""; }} />
      </div>

      {fila.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {fila.map((i) => (
            <li key={i.id} className={cn("rounded-xl border bg-white px-3 py-2.5", i.fase === "erro" ? "border-red-200" : "border-linha/80")}>
              <div className="flex items-center gap-2">
                {i.fase === "pronto" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  : i.fase === "erro" ? <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  : i.tipo === "video" ? <Video className="h-4 w-4 shrink-0 text-tinta-suave" /> : <Camera className="h-4 w-4 shrink-0 text-tinta-suave" />}
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-tinta">{i.nome}</p>
                <span className={cn("shrink-0 text-xs", i.fase === "erro" ? "text-red-700" : "text-tinta-suave")}>
                  {ROTULO_FASE[i.fase]}{i.fase !== "pronto" && i.fase !== "erro" && i.fase !== "lendo" ? ` ${Math.round(i.progresso * 100)}%` : ""}
                </span>
                {(i.fase === "pronto" || i.fase === "erro") && (
                  <button type="button" onClick={() => setFila((f) => f.filter((x) => x.id !== i.id))} aria-label="Tirar da lista"
                    className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-tinta-suave hover:bg-areia/60"><X className="h-4 w-4" /></button>
                )}
              </div>
              {i.fase !== "pronto" && i.fase !== "erro" && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-areia" role="progressbar" aria-valuenow={Math.round(i.progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-marca transition-[width] duration-300" style={{ width: `${Math.max(4, i.progresso * 100)}%` }} />
                </div>
              )}
              {i.erro && <p className="mt-1 text-xs leading-relaxed text-red-800">{i.erro}</p>}
              {i.detalhe && <p className="mt-1 text-xs text-tinta-suave">{i.detalhe}</p>}
            </li>
          ))}
        </ul>
      )}
      {emAndamento && <p className="text-xs text-tinta-suave">Não feche esta tela até terminar. Vídeos longos levam alguns minutos para comprimir.</p>}
    </div>
  );
}
