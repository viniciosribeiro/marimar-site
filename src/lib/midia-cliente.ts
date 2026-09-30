"use client";

import { upload } from "@vercel/blob/client";

/**
 * Processamento de mídia NO NAVEGADOR, antes de enviar.
 *
 * Por que no navegador (decisão documentada em docs/fluxo-midia.md):
 * - O projeto roda na Vercel; uma função serverless não recebe corpo acima
 *   de ~4,5 MB nem roda ffmpeg por minutos. Transcodificar no servidor
 *   exigiria outro serviço (Mux, Cloudinary), com custo mensal.
 * - O celular de quem filma tem codificador de vídeo em hardware (WebCodecs):
 *   comprimir ali é rápido, não custa nada e o arquivo já sobe pequeno —
 *   o que também economiza o 4G da recepção.
 * - Biblioteca `mediabunny` (WebCodecs, sem WASM gigante, sem exigir
 *   cabeçalhos COOP/COEP que quebrariam o resto do site).
 *
 * Tudo aqui é carregado sob demanda (`import()`): quem só abre o painel não
 * baixa a biblioteca de vídeo nem a de HEIC.
 */

export const LIMITES = {
  /** Vídeo de até 5 minutos. */
  videoMaxSegundos: 300,
  /** Maior lado da foto otimizada. */
  fotoMaxLado: 2400,
  /** Maior lado do vídeo do site (720p). */
  videoMaxLado: 1280,
  /** O WhatsApp recusa vídeo acima de 16 MB; margem para cabeçalhos. */
  whatsappMaxBytes: 15.5 * 1024 * 1024,
  /** Sem compressão possível, o original só sobe até este tamanho. */
  originalMaxBytes: 200 * 1024 * 1024,
};

export class ErroMidia extends Error {}

const nomeSemExtensao = (n: string) => n.replace(/\.[^.]+$/, "");
export const ehHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
export const ehVideo = (f: File) => f.type.startsWith("video/") || /\.(mov|mp4|m4v|webm|3gp|mkv|avi)$/i.test(f.name);
export const ehImagem = (f: File) => f.type.startsWith("image/") || ehHeic(f);

/* ── fotos ───────────────────────────────────────────────────────── */

export type FotoPronta = { blob: Blob; largura: number; altura: number; nome: string; tipo: string };

/**
 * HEIC → JPEG, orientação corrigida, redimensionada e comprimida.
 *
 * O iPhone às vezes já converte ao enviar; quando não converte (ou quando o
 * arquivo vem do computador), a conversão acontece aqui. JPEG porque é o
 * único formato que todo navegador e o WhatsApp abrem sem surpresa.
 */
export async function prepararFoto(arquivo: File): Promise<FotoPronta> {
  let fonte: Blob = arquivo;
  if (ehHeic(arquivo)) {
    try {
      const { heicTo } = await import("heic-to/next");
      fonte = await heicTo({ blob: arquivo, type: "image/jpeg", quality: 0.92 });
    } catch {
      throw new ErroMidia("Não consegui abrir esta foto HEIC. No iPhone, em Ajustes → Câmera → Formatos, escolha “Mais compatível” e tente de novo.");
    }
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fonte, { imageOrientation: "from-image" });
  } catch {
    throw new ErroMidia("Este arquivo não parece ser uma foto que o navegador consiga abrir.");
  }

  const escala = Math.min(1, LIMITES.fotoMaxLado / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  /* PNG pequeno (logo, ilustração com transparência) fica como está. */
  if (arquivo.type === "image/png" && escala === 1 && arquivo.size < 800_000) {
    bitmap.close();
    return { blob: arquivo, largura, altura, nome: arquivo.name, tipo: "image/png" };
  }

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ErroMidia("O navegador não deixou processar a foto.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new ErroMidia("Não consegui otimizar a foto.");
  /* Se a "otimizada" ficou maior (foto já bem comprimida), sobe a original. */
  const final = !ehHeic(arquivo) && arquivo.type === "image/jpeg" && blob.size > arquivo.size && escala === 1 ? arquivo : blob;
  return { blob: final, largura, altura, nome: nomeSemExtensao(arquivo.name) + ".jpg", tipo: "image/jpeg" };
}

/* ── vídeos ──────────────────────────────────────────────────────── */

export type Fase = "lendo" | "comprimindo" | "whatsapp" | "miniatura" | "enviando";

export type VideoPronto = {
  blob: Blob; tipo: string; nome: string;
  whatsapp: Blob | null;
  miniatura: Blob | null;
  duracao: number; largura: number; altura: number;
  comprimido: boolean;
  /** Por que não houve compressão ou versão de WhatsApp, em português. */
  observacao: string | null;
};

type Mediabunny = typeof import("mediabunny");

/** O codificador que este aparelho tem. H.264/AAC (MP4) sempre que possível. */
async function escolherCodec(mb: Mediabunny, largura: number, altura: number) {
  const dims = { width: largura, height: altura };
  if (await mb.canEncodeVideo("avc", dims) && await mb.canEncodeAudio("aac")) {
    return { video: "avc" as const, audio: "aac" as const, mp4: true };
  }
  if (await mb.canEncodeVideo("vp9", dims) && await mb.canEncodeAudio("opus")) {
    return { video: "vp9" as const, audio: "opus" as const, mp4: false };
  }
  return null;
}

/** Tamanho de saída: maior lado ≤ limite, sem aumentar, par (codificadores exigem). */
function dimensoes(w: number, h: number, maxLado: number) {
  const escala = Math.min(1, maxLado / Math.max(w, h));
  const par = (n: number) => Math.max(2, Math.round((n * escala) / 2) * 2);
  return { largura: par(w), altura: par(h) };
}

async function transcodificar(
  mb: Mediabunny, fonte: Blob,
  opcoes: { maxLado: number; bitrateVideo: number; bitrateAudio: number; codec: NonNullable<Awaited<ReturnType<typeof escolherCodec>>> },
  aoProgredir: (p: number) => void,
): Promise<Blob> {
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(fonte) });
  const trilha = await input.getPrimaryVideoTrack();
  if (!trilha) throw new ErroMidia("Não encontrei imagem neste vídeo.");
  const { largura, altura } = dimensoes(trilha.displayWidth, trilha.displayHeight, opcoes.maxLado);
  const target = new mb.BufferTarget();
  const output = new mb.Output({
    format: opcoes.codec.mp4 ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(),
    target,
  });
  const conversao = await mb.Conversion.init({
    input, output,
    video: { width: largura, height: altura, fit: "contain", codec: opcoes.codec.video, bitrate: opcoes.bitrateVideo, forceTranscode: true },
    audio: { codec: opcoes.codec.audio, bitrate: opcoes.bitrateAudio, numberOfChannels: 2, sampleRate: 48000, forceTranscode: true },
  });
  if (!conversao.isValid) {
    throw new ErroMidia("Este aparelho não consegue ler o formato deste vídeo. Tente gravar de novo pela câmera normal do celular.");
  }
  conversao.onProgress = (p) => aoProgredir(Math.min(1, p));
  await conversao.execute();
  if (!target.buffer) throw new ErroMidia("A compressão terminou sem gerar o arquivo.");
  return new Blob([target.buffer], { type: opcoes.codec.mp4 ? "video/mp4" : "video/webm" });
}

/** Lê duração e tamanho pelo próprio navegador; cai para o mediabunny se ele não abrir (HEVC no Chrome). */
async function lerMetadados(arquivo: Blob): Promise<{ duracao: number; largura: number; altura: number }> {
  const url = URL.createObjectURL(arquivo);
  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    await new Promise<void>((ok, erro) => {
      v.onloadedmetadata = () => ok();
      v.onerror = () => erro(new Error("sem metadados"));
      setTimeout(() => erro(new Error("tempo esgotado")), 15000);
    });
    if (Number.isFinite(v.duration) && v.duration > 0 && v.videoWidth) {
      return { duracao: v.duration, largura: v.videoWidth, altura: v.videoHeight };
    }
    throw new Error("sem duração");
  } catch {
    const mb = await import("mediabunny");
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(arquivo) });
    const trilha = await input.getPrimaryVideoTrack();
    const duracao = await input.computeDuration();
    return { duracao, largura: trilha?.displayWidth ?? 0, altura: trilha?.displayHeight ?? 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Um quadro do vídeo (a 1 s, ou no primeiro terço se for curto) como JPEG. */
export async function gerarMiniatura(video: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(video);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((ok, erro) => {
      v.onloadeddata = () => ok();
      v.onerror = () => erro(new Error("x"));
      setTimeout(() => erro(new Error("t")), 15000);
    });
    const alvo = Math.min(1, (v.duration || 3) / 3);
    await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = alvo; setTimeout(ok, 4000); });
    const { largura, altura } = dimensoes(v.videoWidth, v.videoHeight, 960);
    const c = document.createElement("canvas");
    c.width = largura; c.height = altura;
    c.getContext("2d")?.drawImage(v, 0, 0, largura, altura);
    return await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.82));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Prepara um vídeo: confere a duração, comprime para o site (720p) e, se
 * precisar, gera uma segunda versão de até 16 MB para o WhatsApp.
 */
export async function prepararVideo(arquivo: File, aoAvancar: (fase: Fase, progresso: number) => void): Promise<VideoPronto> {
  aoAvancar("lendo", 0);
  const meta = await lerMetadados(arquivo).catch(() => null);
  if (!meta || !meta.duracao) throw new ErroMidia("Não consegui ler este vídeo. Ele pode estar corrompido ou num formato que este aparelho não abre.");
  if (meta.duracao > LIMITES.videoMaxSegundos + 1) {
    const min = Math.floor(meta.duracao / 60), seg = Math.round(meta.duracao % 60);
    throw new ErroMidia(`O vídeo tem ${min}min${String(seg).padStart(2, "0")}s. O limite é 5 minutos — corte no próprio celular (editar → cortar) e envie de novo.`);
  }

  const mb = typeof VideoEncoder === "undefined" ? null : await import("mediabunny").catch(() => null);
  const saida = mb ? dimensoes(meta.largura || 1280, meta.altura || 720, LIMITES.videoMaxLado) : null;
  const codec = mb && saida ? await escolherCodec(mb, saida.largura, saida.altura).catch(() => null) : null;

  /* Sem codificador (aparelho antigo): sobe o original, se couber. */
  if (!mb || !codec) {
    if (arquivo.size > LIMITES.originalMaxBytes) {
      throw new ErroMidia("Este aparelho não consegue comprimir vídeo e o arquivo passa de 200 MB. Envie de um celular mais novo ou do computador com o Chrome.");
    }
    aoAvancar("miniatura", 0);
    const miniatura = await gerarMiniatura(arquivo);
    return {
      blob: arquivo, tipo: arquivo.type || "video/mp4", nome: arquivo.name, whatsapp: null, miniatura,
      duracao: meta.duracao, largura: meta.largura, altura: meta.altura, comprimido: false,
      observacao: "Enviado sem compressão: este aparelho não tem codificador de vídeo. A Marina manda o link da página no lugar do vídeo.",
    };
  }

  aoAvancar("comprimindo", 0);
  const site = await transcodificar(mb, arquivo, {
    maxLado: LIMITES.videoMaxLado, bitrateVideo: 1_800_000, bitrateAudio: 128_000, codec,
  }, (p) => aoAvancar("comprimindo", p));

  let whatsapp: Blob | null = null;
  let observacao: string | null = null;
  if (!codec.mp4) {
    observacao = "Este aparelho não gera MP4 (H.264): o vídeo vale no site, e a Marina manda o link da página no WhatsApp.";
  } else if (site.size > LIMITES.whatsappMaxBytes) {
    /* Bitrate que cabe em 16 MB para esta duração, com margem de 8%. */
    let alvo = Math.floor((LIMITES.whatsappMaxBytes * 8 * 0.92) / meta.duracao) - 64_000;
    for (let tentativa = 0; tentativa < 2 && !whatsapp; tentativa++) {
      const bitrate = Math.max(220_000, Math.min(1_500_000, alvo));
      aoAvancar("whatsapp", 0);
      const b = await transcodificar(mb, site, {
        maxLado: bitrate < 450_000 ? 640 : bitrate < 900_000 ? 854 : 1280,
        bitrateVideo: bitrate, bitrateAudio: 64_000, codec,
      }, (p) => aoAvancar("whatsapp", p));
      if (b.size <= LIMITES.whatsappMaxBytes) whatsapp = b;
      else alvo = Math.floor(alvo * 0.7);
    }
    if (!whatsapp) observacao = "Não coube em 16 MB para o WhatsApp: a Marina manda o link da página no lugar do vídeo.";
  }

  aoAvancar("miniatura", 0);
  const miniatura = await gerarMiniatura(site);
  const s = saida!;
  return {
    blob: site, tipo: site.type, nome: nomeSemExtensao(arquivo.name) + (codec.mp4 ? ".mp4" : ".webm"),
    whatsapp, miniatura, duracao: meta.duracao, largura: s.largura, altura: s.altura, comprimido: true, observacao,
  };
}

/* ── envio ───────────────────────────────────────────────────────── */

/** Caminho no Blob: pasta/ano-mes/nome-limpo. O sufixo aleatório vem do Blob. */
export function caminho(pasta: string, nome: string) {
  const limpo = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "arquivo";
  const d = new Date();
  return `${pasta}/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}/${limpo}`;
}

export async function enviar(blob: Blob, pathname: string, aoProgredir?: (p: number) => void) {
  const r = await upload(pathname, blob, {
    access: "public",
    handleUploadUrl: "/api/admin/upload",
    contentType: blob.type || undefined,
    multipart: blob.size > 20 * 1024 * 1024,
    onUploadProgress: aoProgredir ? (e) => aoProgredir(e.percentage / 100) : undefined,
  });
  return { url: r.url, pathname: r.pathname };
}

export const formatarBytes = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export const formatarDuracao = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
