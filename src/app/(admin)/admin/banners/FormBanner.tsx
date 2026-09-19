"use client";

import { useState } from "react";
import { UploadImagem } from "@/components/admin/UploadImagem";
import { BannerCamadas } from "@/components/site/BannerCamadas";
import { BANNER_PADRAO, POSICOES, type Banner, type Posicao } from "@/lib/banners";
import { salvarBanner } from "./actions";

/** O que a tela do admin recebe: o banner + os campos que só ela usa. */
export type BannerAdmin = Banner & {
  imagem_pathname: string | null;
  video_pathname: string | null;
  ordem: number;
  ativo: boolean;
  inicia_em: string | null;
  termina_em: string | null;
};

const ABAS = [
  { id: "midia", nome: "Mídia", icone: "🖼" },
  { id: "texto", nome: "Texto", icone: "✍" },
  { id: "layout", nome: "Layout", icone: "⇹" },
  { id: "camadas", nome: "Camadas", icone: "◧" },
  { id: "movimento", nome: "Movimento", icone: "✨" },
  { id: "agenda", nome: "Agenda", icone: "📅" },
];

const TELAS = [
  { id: "celular", nome: "Celular", largura: 390 },
  { id: "tablet", nome: "Tablet", largura: 820 },
  { id: "desktop", nome: "Desktop", largura: 1280 },
];

export function FormBanner({ banner, blobOk, aoFechar }: {
  banner: BannerAdmin | null;
  blobOk: boolean;
  aoFechar: () => void;
}) {
  const [b, setB] = useState<BannerAdmin>(() => ({
    ...(BANNER_PADRAO as Banner),
    id: banner?.id ?? "novo",
    imagem_pathname: null, video_pathname: null,
    ordem: 999, ativo: true, inicia_em: null, termina_em: null,
    ...(banner ?? {}),
  }));
  const [aba, setAba] = useState("midia");
  const [tela, setTela] = useState("desktop");

  const set = <K extends keyof BannerAdmin>(k: K, v: BannerAdmin[K]) =>
    setB((x) => ({ ...x, [k]: v }));

  const larguraAlvo = TELAS.find((t) => t.id === tela)!.largura;

  return (
    <form action={salvarBanner} className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      {/* Os valores viajam em campos ocultos: a tela é controlada em React,
          mas quem salva é uma server action com FormData. */}
      {banner && <input type="hidden" name="id" value={banner.id} />}
      {Object.entries({
        imagem_url: b.imagem_url, imagem_pathname: b.imagem_pathname ?? "",
        video_url: b.video_url ?? "", video_pathname: b.video_pathname ?? "",
        tipo_midia: b.tipo_midia, alt: b.alt ?? "",
        foco_x: b.foco_x, foco_y: b.foco_y, video_no_celular: b.video_no_celular ? "1" : "",
        altura: b.altura, posicao: b.posicao, largura_texto: b.largura_texto,
        centralizar_celular: b.centralizar_celular ? "1" : "",
        veu: b.veu, veu_forca: b.veu_forca, textura: b.textura, textura_forca: b.textura_forca,
        rotulo: b.rotulo ?? "", titulo: b.titulo ?? "", subtitulo: b.subtitulo ?? "", texto: b.texto ?? "",
        cta_texto: b.cta_texto ?? "", cta_href: b.cta_href ?? "",
        cta2_texto: b.cta2_texto ?? "", cta2_href: b.cta2_href ?? "",
        cor_texto: b.cor_texto, sombra_texto: b.sombra_texto ? "1" : "",
        animacao: b.animacao, ken_burns: b.ken_burns ? "1" : "",
        ordem: b.ordem, ativo: b.ativo ? "1" : "",
        inicia_em: b.inicia_em ?? "", termina_em: b.termina_em ?? "",
      }).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}

      {/* ══════════ controles ══════════ */}
      <div className="min-w-0">
        <div className="flex gap-1 mb-4 overflow-x-auto bg-gray-100 p-1 rounded-lg">
          {ABAS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-md text-xs font-medium transition-all ${
                aba === a.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}>
              <span className="mr-1.5" aria-hidden>{a.icone}</span>{a.nome}
            </button>
          ))}
        </div>

        {aba === "midia" && (
          <Bloco titulo="Imagem de fundo"
            ajuda="Horizontal, pelo menos 1600px. É ela que aparece no celular mesmo quando há vídeo.">
            <UploadImagem rotulo="" valor={b.imagem_url} pasta="banners" configurado={blobOk}
              previewClasse="h-28"
              aoEnviar={(url, path) => { set("imagem_url", url); if (path) set("imagem_pathname", path); }} />

            <Campo rotulo="Texto alternativo" valor={b.alt ?? ""} aoMudar={(v) => set("alt", v || null)}
              placeholder="Descreva a foto para quem não a vê"
              ajuda="Lido por leitores de tela e exibido se a imagem não carregar." />

            <Foco x={b.foco_x} y={b.foco_y} imagem={b.imagem_url}
              aoMudar={(x, y) => { set("foco_x", x); set("foco_y", y); }} />

            <div className="border-t border-gray-100 pt-4 mt-4">
              <Selecao rotulo="Tipo de mídia" valor={b.tipo_midia}
                aoMudar={(v) => set("tipo_midia", v as Banner["tipo_midia"])}
                opcoes={[["imagem", "Só imagem"], ["video", "Vídeo com a imagem de cartaz"]]} />

              {b.tipo_midia === "video" && (
                <>
                  <UploadVideo valor={b.video_url ?? ""} configurado={blobOk}
                    aoEnviar={(url, path) => { set("video_url", url); if (path) set("video_pathname", path); }} />
                  <Interruptor rotulo="Tocar o vídeo no celular"
                    descricao="Desligado, o celular mostra só a imagem — economiza dados de quem está na ilha com sinal fraco."
                    ligado={b.video_no_celular} aoMudar={(v) => set("video_no_celular", v)} />
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    O vídeo entra sem som e em laço. Quem tiver pedido menos
                    animação no aparelho vê a imagem no lugar dele.
                  </p>
                </>
              )}
            </div>
          </Bloco>
        )}

        {aba === "texto" && (
          <Bloco titulo="Conteúdo">
            <Campo rotulo="Rótulo" valor={b.rotulo ?? ""} aoMudar={(v) => set("rotulo", v || null)}
              placeholder="Ex.: Temporada 2027" ajuda="A linha pequena em maiúsculas, acima do título." />
            <Campo rotulo="Título" valor={b.titulo ?? ""} aoMudar={(v) => set("titulo", v || null)}
              placeholder="Ex.: Réveillon em Encantadas" />
            <Campo rotulo="Chamada" valor={b.subtitulo ?? ""} aoMudar={(v) => set("subtitulo", v || null)}
              textarea placeholder="Uma linha explicando a oferta ou o convite" />
            <Campo rotulo="Texto de apoio" valor={b.texto ?? ""} aoMudar={(v) => set("texto", v || null)}
              textarea placeholder="Parágrafo com os detalhes, se precisar"
              ajuda="Opcional. Aparece menor, abaixo da chamada." />

            <div className="grid sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              <Campo rotulo="Botão principal" valor={b.cta_texto ?? ""} aoMudar={(v) => set("cta_texto", v || null)}
                placeholder="Ver disponibilidade" />
              <Campo rotulo="Link" valor={b.cta_href ?? ""} aoMudar={(v) => set("cta_href", v || null)}
                placeholder="/reservar" />
              <Campo rotulo="Botão secundário" valor={b.cta2_texto ?? ""} aoMudar={(v) => set("cta2_texto", v || null)}
                placeholder="Ver o cardápio" />
              <Campo rotulo="Link" valor={b.cta2_href ?? ""} aoMudar={(v) => set("cta2_href", v || null)}
                placeholder="/restaurante" />
            </div>
          </Bloco>
        )}

        {aba === "layout" && (
          <Bloco titulo="Posição e tamanho">
            <p className="text-xs font-medium text-gray-600 mb-2">Onde o texto fica</p>
            <GradePosicao valor={b.posicao} aoMudar={(v) => set("posicao", v)} />

            <Interruptor rotulo="Centralizar no celular"
              descricao="Numa coluna estreita, texto encostado num canto parece erro de layout — não intenção."
              ligado={b.centralizar_celular} aoMudar={(v) => set("centralizar_celular", v)} />

            <Selecao rotulo="Altura do banner" valor={b.altura}
              aoMudar={(v) => set("altura", v as Banner["altura"])}
              opcoes={[["compacto", "Compacto"], ["medio", "Médio"], ["alto", "Alto"], ["tela", "Tela cheia"]]} />

            <Selecao rotulo="Largura do bloco de texto" valor={b.largura_texto}
              aoMudar={(v) => set("largura_texto", v as Banner["largura_texto"])}
              opcoes={[["estreita", "Estreita"], ["media", "Média"], ["larga", "Larga"]]} />
          </Bloco>
        )}

        {aba === "camadas" && (
          <Bloco titulo="Véu" ajuda="O que garante que o texto seja legível sobre a foto.">
            <Selecao rotulo="Tipo" valor={b.veu} aoMudar={(v) => set("veu", v as Banner["veu"])}
              opcoes={[
                ["escuro-baixo", "Escurece de cima para baixo"],
                ["escuro", "Escurece tudo por igual"],
                ["claro-esquerda", "Clareia da esquerda"],
                ["vinheta", "Vinheta (escurece as bordas)"],
                ["nenhum", "Nenhum"],
              ]} />
            {b.veu !== "nenhum" && (
              <Faixa rotulo="Intensidade" valor={b.veu_forca} min={10} max={100} passo={5}
                formato={(v) => `${v}%`} aoMudar={(v) => set("veu_forca", v)} />
            )}
            <p className="text-[11px] text-gray-400 -mt-1 mb-4 leading-relaxed">
              O erro mais comum em banner é matar a foto para salvar o texto.
              Se precisar passar de 80%, provavelmente a foto é que não serve.
            </p>

            <div className="border-t border-gray-100 pt-4">
              <Selecao rotulo="Textura" valor={b.textura}
                aoMudar={(v) => set("textura", v as Banner["textura"])}
                opcoes={[["nenhuma", "Nenhuma"], ["grao", "Grão (filme)"], ["pontos", "Pontos"], ["linhas", "Linhas diagonais"]]} />
              {b.textura !== "nenhuma" && (
                <Faixa rotulo="Intensidade" valor={b.textura_forca} min={5} max={60} passo={5}
                  formato={(v) => `${v}%`} aoMudar={(v) => set("textura_forca", v)} />
              )}
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Desenhada em CSS — não baixa nenhum arquivo.
              </p>
            </div>

            <div className="border-t border-gray-100 pt-4 mt-4">
              <Selecao rotulo="Cor do texto" valor={b.cor_texto}
                aoMudar={(v) => set("cor_texto", v as Banner["cor_texto"])}
                opcoes={[["claro", "Claro (foto escura)"], ["escuro", "Escuro (foto clara)"]]} />
              <Interruptor rotulo="Sombra no texto"
                descricao="Segura a legibilidade quando a foto tem uma área clara inesperada."
                ligado={b.sombra_texto} aoMudar={(v) => set("sombra_texto", v)} />
            </div>
          </Bloco>
        )}

        {aba === "movimento" && (
          <Bloco titulo="Movimento"
            ajuda="Tudo aqui é ignorado para quem pediu menos animação no aparelho, e quando as animações estão desligadas na Identidade visual.">
            <Selecao rotulo="Entrada do texto" valor={b.animacao}
              aoMudar={(v) => set("animacao", v as Banner["animacao"])}
              opcoes={[["subir", "Sobe suavemente"], ["fade", "Aparece"], ["zoom", "Aproxima"], ["nenhuma", "Sem animação"]]} />
            <Interruptor rotulo="Movimento lento na foto (Ken Burns)"
              descricao="A foto aproxima e afasta ao longo de 28 segundos. Dá vida sem pedir atenção."
              ligado={b.ken_burns} aoMudar={(v) => set("ken_burns", v)} />
          </Bloco>
        )}

        {aba === "agenda" && (
          <Bloco titulo="Período de exibição"
            ajuda="Em branco: fica no ar sempre. Preenchido, entra e sai sozinho.">
            <Campo rotulo="A partir de" tipo="datetime-local" valor={paraInput(b.inicia_em)}
              aoMudar={(v) => set("inicia_em", v || null)} />
            <Campo rotulo="Até" tipo="datetime-local" valor={paraInput(b.termina_em)}
              aoMudar={(v) => set("termina_em", v || null)} />
            <Interruptor rotulo="Ativo" descricao="Desligado, não aparece mesmo dentro do período."
              ligado={b.ativo} aoMudar={(v) => set("ativo", v)} />
          </Bloco>
        )}

        <div className="flex gap-2 mt-5">
          <button type="submit" disabled={!b.imagem_url}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40">
            {banner ? "Salvar alterações" : "Criar banner"}
          </button>
          <button type="button" onClick={aoFechar}
            className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200">
            Cancelar
          </button>
        </div>
      </div>

      {/* ══════════ prévia ══════════ */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-medium text-gray-600">Prévia</p>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {TELAS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTela(t.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                  tela === t.id ? "bg-white shadow text-gray-900" : "text-gray-500"
                }`}>
                {t.nome}
              </button>
            ))}
          </div>
        </div>

        {/* O MESMO componente do site, em escala. Não existe um segundo
            renderizador aqui — por isso a prévia não pode mentir. */}
        <PreviaEscalada largura={larguraAlvo}>
          <BannerCamadas b={b} ativo previa />
        </PreviaEscalada>

        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          A busca de disponibilidade aparece por cima deste banner na home —
          por isso vale deixar espaço embaixo.
        </p>
      </div>
    </form>
  );
}

/* ─────────────────── prévia em escala ─────────────────── */

/**
 * Renderiza numa largura fixa e encolhe com `transform`.
 *
 * O `transform` NÃO reduz o espaço ocupado no layout — por isso a caixa de
 * fora tem a altura já multiplicada e recorta o resto. Foi exatamente o que
 * estourou a prévia da Identidade visual antes.
 */
function PreviaEscalada({ largura, children }: { largura: number; children: React.ReactNode }) {
  const [escala, setEscala] = useState(1);
  const [altura, setAltura] = useState(600);

  return (
    <div
      ref={(el) => {
        if (!el) return;
        const medir = () => {
          const disp = el.clientWidth;
          if (disp > 0) setEscala(Math.min(1, disp / largura));
        };
        medir();
        const obs = new ResizeObserver(medir);
        obs.observe(el);
      }}
      className="relative w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
      style={{ height: Math.round(altura * escala) }}
    >
      <div
        ref={(el) => { if (el) setAltura(el.offsetHeight || 600); }}
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: largura, transform: `scale(${escala})` }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────────────── controles ─────────────────── */

/** Clicar na foto define o ponto focal — mais direto que dois números. */
function Foco({ x, y, imagem, aoMudar }: {
  x: number; y: number; imagem: string; aoMudar: (x: number, y: number) => void;
}) {
  if (!imagem) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-600 mb-1.5">Ponto focal</p>
      <button type="button"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          aoMudar(
            Math.round(((e.clientX - r.left) / r.width) * 100),
            Math.round(((e.clientY - r.top) / r.height) * 100),
          );
        }}
        className="relative block w-full h-28 rounded-lg overflow-hidden border border-gray-200 cursor-crosshair">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagem} alt="" className="w-full h-full object-cover" />
        <span className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg bg-black/30"
          style={{ left: `${x}%`, top: `${y}%` }} />
      </button>
      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
        Clique no que não pode sumir. No celular a foto é cortada nas laterais,
        e é este ponto que fica garantido no enquadramento.
      </p>
    </div>
  );
}

function GradePosicao({ valor, aoMudar }: { valor: Posicao; aoMudar: (v: Posicao) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 w-32 mb-4">
      {POSICOES.map((p) => (
        <button key={p} type="button" onClick={() => aoMudar(p)} title={p.replace("-", " · ")}
          aria-label={p.replace("-", " ")}
          className={`h-9 rounded border-2 transition-all ${
            valor === p ? "border-gray-900 bg-gray-900" : "border-gray-200 hover:border-gray-400 bg-white"
          }`} />
      ))}
    </div>
  );
}

function UploadVideo({ valor, aoEnviar, configurado }: {
  valor: string; aoEnviar: (url: string, pathname?: string) => void; configurado: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setErro(null);
    if (arquivo.size > 50 * 1024 * 1024) {
      setErro(`Muito grande (${(arquivo.size / 1024 / 1024).toFixed(0)} MB). O limite é 50 MB.`);
      return;
    }
    setEnviando(true);
    try {
      const { upload } = await import("@vercel/blob/client");
      const limpo = arquivo.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-50);
      const blob = await upload(`banners/${limpo}`, arquivo, {
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

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-600 mb-1.5">Vídeo</label>
      {!configurado ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Armazenamento não configurado (falta BLOB_READ_WRITE_TOKEN).
        </p>
      ) : (
        <>
          {valor && (
            <video src={valor} muted loop playsInline autoPlay
              className="w-full h-28 object-cover rounded-lg border border-gray-200 mb-2" />
          )}
          <input type="file" accept="video/mp4,video/webm" disabled={enviando}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-gray-900 file:text-white" />
          {enviando && (
            <div className="h-1 bg-gray-100 rounded mt-2 overflow-hidden">
              <div className="h-full bg-gray-900 transition-all" style={{ width: `${progresso}%` }} />
            </div>
          )}
          {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
            MP4 ou WebM, até 50 MB. Sem som — vídeo de fundo com áudio é
            bloqueado pelos navegadores e incomoda quem está no escritório.
          </p>
        </>
      )}
    </div>
  );
}

function paraInput(v: string | null) {
  return v ? String(v).replace(" ", "T").slice(0, 16) : "";
}

/* ─────────────────── peças de formulário ─────────────────── */

function Bloco({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
      <h3 className="font-semibold text-gray-900 text-sm">{titulo}</h3>
      {ajuda && <p className="text-[11px] text-gray-400 mt-1 mb-4 leading-relaxed">{ajuda}</p>}
      <div className={ajuda ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

function Campo({ rotulo, valor, aoMudar, placeholder, ajuda, textarea, tipo = "text" }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void;
  placeholder?: string; ajuda?: string; textarea?: boolean; tipo?: string;
}) {
  const Tag: any = textarea ? "textarea" : "input";
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{rotulo}</label>
      <Tag value={valor} onChange={(e: any) => aoMudar(e.target.value)}
        type={textarea ? undefined : tipo} placeholder={placeholder} rows={textarea ? 2 : undefined}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400" />
      {ajuda && <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{ajuda}</p>}
    </div>
  );
}

function Selecao({ rotulo, valor, aoMudar, opcoes }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; opcoes: [string, string][];
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{rotulo}</label>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10">
        {opcoes.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
    </div>
  );
}

function Faixa({ rotulo, valor, min, max, passo, formato, aoMudar }: {
  rotulo: string; valor: number; min: number; max: number; passo: number;
  formato: (v: number) => string; aoMudar: (v: number) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="text-xs font-medium text-gray-600">{rotulo}</label>
        <span className="text-xs text-gray-500 font-medium">{formato(valor)}</span>
      </div>
      <input type="range" min={min} max={max} step={passo} value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))} className="w-full accent-gray-900" />
    </div>
  );
}

function Interruptor({ rotulo, descricao, ligado, aoMudar }: {
  rotulo: string; descricao?: string; ligado: boolean; aoMudar: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => aoMudar(!ligado)}
      className="w-full flex items-start gap-3 text-left mb-4">
      <span className={`mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors relative ${
        ligado ? "bg-gray-900" : "bg-gray-300"
      }`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
          ligado ? "left-[1.15rem]" : "left-0.5"
        }`} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-gray-700">{rotulo}</span>
        {descricao && <span className="block text-[11px] text-gray-400 leading-relaxed mt-0.5">{descricao}</span>}
      </span>
    </button>
  );
}
