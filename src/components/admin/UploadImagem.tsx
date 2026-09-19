"use client";

import { useState, useRef } from "react";

/**
 * Envio de UMA imagem (logo, favicon, imagem de compartilhamento).
 *
 * Diferente de <UploadFotos>, que monta galeria: aqui o resultado e uma url
 * so, devolvida por `aoEnviar` para o formulario guardar num campo oculto.
 * O arquivo vai direto do navegador para o Blob, sem passar pela funcao
 * serverless — mesmo motivo do cardapio: limite de corpo de ~4,5 MB.
 */
export function UploadImagem({
  valor, aoEnviar, pasta, rotulo, ajuda, previewClasse = "h-12", configurado, aoExtrairCores,
}: {
  valor: string;
  /**
   * O segundo argumento e o `pathname` do Blob. So ele permite APAGAR o
   * arquivo depois: sem guardar isso, excluir o registro deixaria a imagem
   * orfa no storage, sendo cobrada para sempre. Opcional porque nem todo
   * uso (logo, favicon) chega a excluir.
   */
  aoEnviar: (url: string, pathname?: string) => void;
  pasta: string;
  rotulo: string;
  ajuda?: string;
  previewClasse?: string;
  configurado: boolean;
  /** Quando presente, oferece extrair a paleta da imagem enviada. */
  aoExtrairCores?: (cores: string[]) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const base64 = valor.startsWith("data:");

  async function enviar(arquivo: File) {
    setErro(null);
    if (arquivo.size > 12 * 1024 * 1024) {
      setErro(`Muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)} MB). O limite é 12 MB.`);
      return;
    }
    setEnviando(true);
    setProgresso(0);
    try {
      const { upload } = await import("@vercel/blob/client");
      const limpo = arquivo.name
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9.]+/g, "-").slice(-50);

      const blob = await upload(`${pasta}/${limpo}`, arquivo, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        onUploadProgress: ({ percentage }) => setProgresso(percentage),
      });
      aoEnviar(blob.url, blob.pathname);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Extrai as cores dominantes da imagem, no proprio navegador.
   *
   * Agrupa em caixas de 32 niveis por canal para nao devolver 40 variacoes
   * do mesmo tom, e descarta o que estiver quase branco ou quase preto —
   * numa logo isso costuma ser fundo e contorno, nao cor de marca.
   */
  async function extrair() {
    if (!valor || !aoExtrairCores) return;
    try {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = valor;
      await img.decode();

      const c = document.createElement("canvas");
      const lado = 120;
      c.width = lado; c.height = lado;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, lado, lado);

      const { data } = ctx.getImageData(0, 0, lado, lado);
      const caixas = new Map<string, { n: number; r: number; g: number; b: number }>();

      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (a < 200) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max > 240 && min > 240) continue;   // quase branco
        if (max < 28) continue;                 // quase preto
        if (max - min < 18) continue;           // cinza sem identidade
        const chave = `${r >> 5}-${g >> 5}-${b >> 5}`;
        const atual = caixas.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
        caixas.set(chave, { n: atual.n + 1, r: atual.r + r, g: atual.g + g, b: atual.b + b });
      }

      const hex = (n: number) => n.toString(16).padStart(2, "0");
      const cores = [...caixas.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 6)
        .map((c) => `#${hex(Math.round(c.r / c.n))}${hex(Math.round(c.g / c.n))}${hex(Math.round(c.b / c.n))}`);

      aoExtrairCores(cores);
    } catch {
      setErro("Não consegui ler as cores desta imagem.");
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600">{rotulo}</label>
        {valor && !enviando && (
          <button type="button" onClick={() => aoEnviar("")}
            className="text-[11px] text-gray-400 hover:text-red-600">remover</button>
        )}
      </div>

      {valor && !base64 && (
        <div className="mb-2 p-3 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valor} alt="" className={`${previewClasse} w-auto object-contain`} />
        </div>
      )}

      {base64 && (
        <p className="text-[11px] text-red-600 mb-2 leading-relaxed">
          Esta imagem está gravada dentro do banco (base64), o que deixa o site lento —
          ela é carregada em toda página. Envie o arquivo de novo para substituir.
        </p>
      )}

      {!configurado ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
          Envio de arquivo indisponível: falta <code>BLOB_READ_WRITE_TOKEN</code>.
        </p>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
            className="flex-1 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50">
            {enviando ? `Enviando… ${Math.round(progresso)}%` : valor ? "Trocar imagem" : "Escolher arquivo"}
          </button>
          {valor && aoExtrairCores && (
            <button type="button" onClick={extrair}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 whitespace-nowrap">
              🎨 Cores da logo
            </button>
          )}
        </div>
      )}

      {enviando && (
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-gray-900 transition-all" style={{ width: `${progresso}%` }} />
        </div>
      )}
      {erro && <p className="text-[11px] text-red-600 mt-1.5">{erro}</p>}
      {ajuda && !erro && <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{ajuda}</p>}

      <input ref={inputRef} type="file" className="sr-only"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); e.target.value = ""; }} />
    </div>
  );
}
