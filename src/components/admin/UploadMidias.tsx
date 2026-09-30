"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarMidia } from "@/app/(admin)/admin/midias/actions";

/**
 * Envio de fotos do site direto para o Vercel Blob.
 *
 * Mesmo desenho do envio do cardápio: o arquivo vai do navegador para o
 * storage (função serverless recusa corpo acima de ~4,5 MB, e foto de
 * celular passa disso), e a rota /api/admin/upload só emite o token depois
 * de conferir a sessão. Várias de uma vez, arrastando, colando ou tocando —
 * no celular o botão abre a câmera ou a galeria do aparelho.
 */

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const LIMITE = 12 * 1024 * 1024;

type EmEnvio = { nome: string; progresso: number; erro?: string };

function limparNome(nome: string) {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60);
}

/** "IMG_2034 cafe-da-manha.jpg" → "IMG 2034 cafe da manha" — ponto de partida para a descrição. */
function descricaoInicial(nome: string, padrao: string) {
  const base = nome.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return /^(img|dsc|pxl|photo|foto|whatsapp)\b/i.test(base) || base.length < 3 ? padrao : base;
}

export function UploadMidias({
  secao, quartoId, rotulo, configurado,
}: {
  secao: string;
  quartoId: string | null;
  /** Nome da seção ou da suíte — vira a descrição inicial da foto. */
  rotulo: string;
  configurado: boolean;
}) {
  const [fila, setFila] = useState<EmEnvio[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const enviar = useCallback(async (arquivos: File[]) => {
    const recusados = arquivos.filter((f) => !TIPOS.includes(f.type) || f.size > LIMITE);
    const validos = arquivos.filter((f) => !recusados.includes(f));
    setFila((q) => [
      ...q,
      ...recusados.map((f) => ({
        nome: f.name, progresso: 0,
        erro: f.size > LIMITE
          ? `Muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB). O limite é 12 MB.`
          : "Formato não aceito. Use JPG, PNG ou WebP.",
      })),
      ...validos.map((f) => ({ nome: f.name, progresso: 0 })),
    ]);
    if (!validos.length) return;

    const { upload } = await import("@vercel/blob/client");
    const pasta = quartoId ? `quartos/${quartoId}` : `galeria/${secao}`;

    for (const arquivo of validos) {
      try {
        const blob = await upload(`${pasta}/${limparNome(arquivo.name)}`, arquivo, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
          onUploadProgress: ({ percentage }) =>
            setFila((q) => q.map((e) => (e.nome === arquivo.name ? { ...e, progresso: percentage } : e))),
        });
        const r = await registrarMidia({
          url: blob.url, pathname: blob.pathname,
          alt: descricaoInicial(arquivo.name, rotulo), secao, quartoId,
        });
        if (!r.ok) throw new Error(r.erro);
        setFila((q) => q.filter((e) => e.nome !== arquivo.name));
      } catch (e) {
        const msg = (e as Error).message;
        setFila((q) => q.map((x) => (x.nome === arquivo.name ? { ...x, erro: msg } : x)));
      }
    }
    router.refresh();
  }, [secao, quartoId, rotulo, router]);

  if (!configurado) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium mb-1">Envio de fotos ainda não configurado</p>
        <p className="text-xs leading-relaxed">
          Falta a variável <code className="bg-amber-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code> na Vercel
          (aba Storage → criar um Blob store → conectar ao projeto). Enquanto isso, dá para adicionar
          uma foto pelo endereço, logo abaixo.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); enviar(Array.from(e.dataTransfer.files)); }}
        onPaste={(e) => {
          const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
          if (imgs.length) enviar(imgs);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
          arrastando ? "border-teal-600 bg-teal-50" : "border-linha bg-white hover:border-gray-400"
        }`}
      >
        <p className="text-3xl mb-2" aria-hidden>📷</p>
        <p className="text-sm text-tinta">
          Arraste as fotos de <strong>{rotulo}</strong> para cá
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-marca text-marca-texto text-sm font-semibold px-5 py-2.5 hover:bg-gray-700"
        >
          Escolher fotos
        </button>
        <p className="text-xs text-tinta-suave/80 mt-3">JPG, PNG ou WebP · até 12 MB cada · várias de uma vez</p>
        <input
          ref={inputRef}
          type="file"
          accept={TIPOS.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => { enviar(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>

      {fila.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fila.map((e) => (
            <li key={e.nome} className="text-xs">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="truncate text-tinta">{e.nome}</span>
                <span className={e.erro ? "text-red-600 shrink-0" : "text-tinta-suave/80 shrink-0"}>
                  {e.erro ? "falhou" : `${Math.round(e.progresso)}%`}
                </span>
              </div>
              {e.erro ? (
                <p className="text-red-600 leading-snug">{e.erro}</p>
              ) : (
                <div className="h-1.5 bg-areia/70 rounded-full overflow-hidden">
                  <div className="h-full bg-marca rounded-full transition-all" style={{ width: `${e.progresso}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
