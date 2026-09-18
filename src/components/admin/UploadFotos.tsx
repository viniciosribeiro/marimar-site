"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { registrarFoto } from "@/app/(admin)/admin/cardapio/actions";

/**
 * Envio de fotos direto para o Vercel Blob.
 *
 * O arquivo vai do navegador para o storage sem passar pela funcao
 * serverless — que tem limite de ~4,5 MB de corpo e rejeitaria foto de
 * celular. A rota /api/admin/upload so emite o token, conferindo a sessao.
 *
 * Aceita arrastar-e-soltar, selecionar varios de uma vez e colar do
 * clipboard. Mostra progresso por arquivo, porque no 4G da ilha um envio
 * de 8 MB leva tempo e sem barra parece travado.
 */

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const LIMITE = 12 * 1024 * 1024;

type EmEnvio = { nome: string; progresso: number; erro?: string };

export function UploadFotos({
  itemId, nomeItem, configurado,
}: { itemId: string; nomeItem: string; configurado: boolean }) {
  const [fila, setFila] = useState<EmEnvio[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const enviar = useCallback(async (arquivos: File[]) => {
    const validos = arquivos.filter((f) => {
      if (!TIPOS.includes(f.type)) return false;
      if (f.size > LIMITE) return false;
      return true;
    });

    const rejeitados = arquivos.filter((f) => !validos.includes(f));
    if (rejeitados.length > 0) {
      setFila((q) => [
        ...q,
        ...rejeitados.map((f) => ({
          nome: f.name,
          progresso: 0,
          erro: f.size > LIMITE
            ? `Muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). O limite é 12 MB.`
            : "Formato não aceito. Use JPG, PNG ou WebP.",
        })),
      ]);
    }
    if (validos.length === 0) return;

    setFila((q) => [...q, ...validos.map((f) => ({ nome: f.name, progresso: 0 }))]);

    // import dinamico: o SDK so e baixado quando realmente vai enviar algo
    const { upload } = await import("@vercel/blob/client");

    for (const arquivo of validos) {
      try {
        const limpo = arquivo.name
          .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9.]+/g, "-").slice(-60);

        const blob = await upload(`cardapio/${itemId}/${limpo}`, arquivo, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
          onUploadProgress: ({ percentage }) => {
            setFila((q) => q.map((e) => (e.nome === arquivo.name ? { ...e, progresso: percentage } : e)));
          },
        });

        const r = await registrarFoto({
          itemId, url: blob.url, pathname: blob.pathname,
          alt: nomeItem, bytes: arquivo.size,
        });
        if (!r.ok) throw new Error(r.erro ?? "Falha ao gravar no banco");

        setFila((q) => q.filter((e) => e.nome !== arquivo.name));
      } catch (e) {
        const msg = (e as Error).message;
        setFila((q) => q.map((x) => (x.nome === arquivo.name ? { ...x, erro: msg } : x)));
      }
    }

    router.refresh();
  }, [itemId, nomeItem, router]);

  if (!configurado) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium mb-1">Armazenamento de imagens não configurado</p>
        <p className="text-xs leading-relaxed">
          Falta a variável <code className="bg-amber-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code>.
          Na Vercel: aba <strong>Storage</strong> → criar um Blob store → conectar ao projeto.
          Depois rode <code className="bg-amber-100 px-1 rounded">npx vercel env pull .env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault(); setArrastando(false);
          enviar(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
          if (imgs.length) enviar(imgs);
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          arrastando ? "border-gray-900 bg-gray-50" : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <p className="text-3xl mb-2" aria-hidden>📷</p>
        <p className="text-sm text-gray-700 mb-1">
          Arraste as fotos aqui, cole com Ctrl+V ou
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm font-semibold text-gray-900 underline underline-offset-2"
        >
          escolher do computador
        </button>
        <p className="text-xs text-gray-400 mt-2">JPG, PNG ou WebP · até 12 MB cada · várias de uma vez</p>

        <input
          ref={inputRef}
          type="file"
          accept={TIPOS.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => {
            enviar(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {fila.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fila.map((e) => (
            <li key={e.nome} className="text-xs">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="truncate text-gray-700">{e.nome}</span>
                <span className={e.erro ? "text-red-600 shrink-0" : "text-gray-400 shrink-0"}>
                  {e.erro ? "falhou" : `${Math.round(e.progresso)}%`}
                </span>
              </div>
              {e.erro ? (
                <p className="text-red-600 leading-snug">{e.erro}</p>
              ) : (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${e.progresso}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
