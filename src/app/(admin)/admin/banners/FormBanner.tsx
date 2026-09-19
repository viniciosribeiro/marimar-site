"use client";

import { useState } from "react";
import { UploadImagem } from "@/components/admin/UploadImagem";
import { salvarBanner } from "./actions";

export type Banner = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  imagem_url: string;
  imagem_pathname: string | null;
  alt: string | null;
  cta_texto: string | null;
  cta_href: string | null;
  ordem: number;
  ativo: boolean;
  inicia_em: string | null;
  termina_em: string | null;
};

/** `2026-12-24 18:00:00` → `2026-12-24T18:00`, que e o que o input aceita. */
function paraInput(v: string | null) {
  if (!v) return "";
  return String(v).replace(" ", "T").slice(0, 16);
}

export function FormBanner({ banner, blobOk, aoFechar }: {
  banner: Banner | null;
  blobOk: boolean;
  aoFechar: () => void;
}) {
  const [imagem, setImagem] = useState(banner?.imagem_url ?? "");
  const [pathname, setPathname] = useState(banner?.imagem_pathname ?? "");
  const [titulo, setTitulo] = useState(banner?.titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(banner?.subtitulo ?? "");
  const [ctaTexto, setCtaTexto] = useState(banner?.cta_texto ?? "");

  return (
    <form action={salvarBanner} className="space-y-5">
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <input type="hidden" name="imagem_url" value={imagem} />
      <input type="hidden" name="imagem_pathname" value={pathname} />

      <UploadImagem
        rotulo="Imagem do banner"
        valor={imagem}
        aoEnviar={(url, path) => { setImagem(url); if (path) setPathname(path); }}
        pasta="banners"
        configurado={blobOk}
        previewClasse="h-32"
        ajuda="Horizontal, pelo menos 1600px de largura. O texto fica por cima — prefira uma foto com espaço livre no meio."
      />

      {/* Prévia com o mesmo véu escuro do site: é olhando o texto SOBRE a
          foto que se percebe se a imagem serve. Uma miniatura limpa engana. */}
      {imagem && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Como fica no site</p>
          <div className="relative rounded-lg overflow-hidden h-40 bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagem} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
            <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
              <p className="text-white font-bold text-xl drop-shadow">{titulo || "Título do banner"}</p>
              {subtitulo && <p className="text-white/90 text-xs mt-1.5 max-w-sm">{subtitulo}</p>}
              {ctaTexto && (
                <span className="mt-3 text-[11px] bg-white text-gray-900 px-3 py-1.5 rounded font-medium">
                  {ctaTexto}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Título" nome="titulo" valor={titulo} aoMudar={setTitulo}
          placeholder="Ex.: Feriado de Natal na ilha" />
        <Campo rotulo="Texto alternativo" nome="alt" padrao={banner?.alt ?? ""}
          placeholder="Descreva a foto para quem não a vê"
          ajuda="Lido por leitores de tela e exibido se a imagem não carregar." />
      </div>

      <Campo rotulo="Chamada" nome="subtitulo" valor={subtitulo} aoMudar={setSubtitulo} textarea
        placeholder="Uma linha explicando a oferta ou o convite" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Texto do botão" nome="cta_texto" valor={ctaTexto} aoMudar={setCtaTexto}
          placeholder="Ex.: Ver disponibilidade" />
        <Campo rotulo="Link do botão" nome="cta_href" padrao={banner?.cta_href ?? ""}
          placeholder="/reservar"
          ajuda="Caminho do próprio site (/pacotes) ou endereço completo." />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-600 mb-1">Período de exibição</p>
        <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
          Deixe em branco para ficar no ar sempre. Preenchido, o banner entra e
          sai sozinho — ninguém precisa lembrar de desligar depois do feriado.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="A partir de" nome="inicia_em" tipo="datetime-local"
            padrao={paraInput(banner?.inicia_em ?? null)} />
          <Campo rotulo="Até" nome="termina_em" tipo="datetime-local"
            padrao={paraInput(banner?.termina_em ?? null)} />
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="ativo" defaultChecked={banner?.ativo ?? true}
            className="w-4 h-4 accent-gray-900" />
          Ativo
        </label>
        <input type="hidden" name="ordem" value={banner?.ordem ?? 999} />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!imagem}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40">
          {banner ? "Salvar alterações" : "Criar banner"}
        </button>
        <button type="button" onClick={aoFechar}
          className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({ rotulo, nome, valor, aoMudar, padrao, placeholder, ajuda, textarea, tipo = "text" }: {
  rotulo: string; nome: string;
  valor?: string; aoMudar?: (v: string) => void; padrao?: string;
  placeholder?: string; ajuda?: string; textarea?: boolean; tipo?: string;
}) {
  const Tag: any = textarea ? "textarea" : "input";
  // Campo controlado quando a prévia precisa acompanhar a digitação;
  // não controlado nos demais, para não re-renderizar a tela inteira à toa.
  const props = aoMudar
    ? { value: valor ?? "", onChange: (e: any) => aoMudar(e.target.value) }
    : { defaultValue: padrao ?? "" };
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{rotulo}</label>
      <Tag name={nome} type={textarea ? undefined : tipo} placeholder={placeholder} {...props}
        rows={textarea ? 2 : undefined}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400" />
      {ajuda && <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{ajuda}</p>}
    </div>
  );
}
