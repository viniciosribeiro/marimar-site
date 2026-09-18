"use client";

import { useState } from "react";
import { salvarTema } from "@/app/(admin)/admin/identidade-visual/actions";

const FONTES = ["Geist", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Playfair Display", "Merriweather", "Poppins", "Nunito", "Raleway"];

const PALETAS = [
  { n: "Oceano", p: "#0D9488", s: "#0EA5E9" }, { n: "Tropical", p: "#059669", s: "#D97706" },
  { n: "Praia", p: "#0891B2", s: "#F59E0B" },  { n: "Elegante", p: "#1E293B", s: "#B45309" },
  { n: "Verão", p: "#2563EB", s: "#F97316" },  { n: "Natureza", p: "#166534", s: "#CA8A04" },
  { n: "Rosa", p: "#BE185D", s: "#EC4899" },   { n: "Âmbar", p: "#B45309", s: "#F59E0B" },
];

const ABAS = [
  { id: "cores", label: "Cores" },
  { id: "tipografia", label: "Fontes" },
  { id: "forma", label: "Forma" },
  { id: "imagens", label: "Imagens" },
  { id: "banner", label: "Banner" },
  { id: "seo", label: "SEO" },
];

export function ThemeEditor({ initial }: { initial: any }) {
  const t = initial?.tema ?? {};
  const banner = t.banner ?? {};

  const [aba, setAba] = useState("cores");
  const [primaria, setPrimaria] = useState(initial?.cor_primaria || "#0D9488");
  const [secundaria, setSecundaria] = useState(initial?.cor_secundaria || "#0EA5E9");
  const [fonteT, setFonteT] = useState(initial?.fonte_titulo || "Geist");
  const [fonteC, setFonteC] = useState(initial?.fonte_corpo || "Geist");
  const [logo, setLogo] = useState(initial?.logo_url || "");
  const [favicon, setFavicon] = useState(initial?.favicon_url || "");
  const [ogImage, setOgImage] = useState(initial?.og_image_url || "");
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title || "");
  const [seoDesc, setSeoDesc] = useState(initial?.seo_description || "");
  const [raio, setRaio] = useState(String(t.raio ?? "12"));
  const [sombra, setSombra] = useState(t.sombra ?? "sm");
  const [animacoes, setAnimacoes] = useState(t.animacoes !== false);
  const [bannerAtivo, setBannerAtivo] = useState(banner.ativo === true);
  const [bannerTexto, setBannerTexto] = useState(banner.texto || "");
  const [bannerSubtexto, setBannerSubtexto] = useState(banner.subtexto || "");
  const [bannerAnimado, setBannerAnimado] = useState(banner.animado !== false);

  const temaFaltando = initial && initial.tema === undefined;

  return (
    <form action={salvarTema} className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* ─────────── EDITOR ─────────── */}
      <div className="xl:col-span-3">
        {temaFaltando && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
            A coluna <code className="bg-amber-100 px-1 rounded">tema</code> ainda não existe no banco.
            Rode <code className="bg-amber-100 px-1 rounded">npm run db:migrate</code> — sem ela, Forma e Banner não salvam.
          </div>
        )}

        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {ABAS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                aba === a.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}>
              {a.label}
            </button>
          ))}
        </div>

        {aba === "cores" && (
          <Card titulo="Cores da marca" ajuda="A cor principal gera sozinha os tons de hover, fundo e borda usados em todo o site.">
            <p className="text-xs font-medium text-gray-500 mb-2">Paletas prontas</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {PALETAS.map((pl) => (
                <button key={pl.n} type="button" onClick={() => { setPrimaria(pl.p); setSecundaria(pl.s); }}
                  className={`p-2 rounded-lg border-2 transition-all ${primaria === pl.p ? "border-gray-900" : "border-transparent hover:border-gray-200"}`}>
                  <div className="flex gap-1 mb-1.5">
                    <span className="flex-1 h-6 rounded" style={{ background: pl.p }} />
                    <span className="w-3 h-6 rounded" style={{ background: pl.s }} />
                  </div>
                  <span className="text-[10px] text-gray-600">{pl.n}</span>
                </button>
              ))}
            </div>
            <Cor rotulo="Cor principal" valor={primaria} onChange={setPrimaria} nome="cor_primaria" />
            <Cor rotulo="Cor de destaque" valor={secundaria} onChange={setSecundaria} nome="cor_secundaria" />
          </Card>
        )}

        {aba === "tipografia" && (
          <Card titulo="Fontes" ajuda="Geist já vem no site. As demais são buscadas no Google Fonts só quando escolhidas.">
            <Select rotulo="Títulos" nome="fonte_titulo" valor={fonteT} onChange={setFonteT} opcoes={FONTES} />
            <div style={{ fontFamily: fonteT }} className="text-2xl font-bold text-gray-900 my-3 py-3 border-y border-gray-100">
              Pousada Marimar
            </div>
            <Select rotulo="Corpo do texto" nome="fonte_corpo" valor={fonteC} onChange={setFonteC} opcoes={FONTES} />
            <p style={{ fontFamily: fonteC }} className="text-sm text-gray-600 mt-3">
              O Marimar Café Bistrô Bar fica em frente ao mar, e a pousada logo aos fundos.
            </p>
          </Card>
        )}

        {aba === "forma" && (
          <Card titulo="Forma dos elementos" ajuda="Vale para cartões, botões e campos do site inteiro.">
            <p className="text-xs font-medium text-gray-500 mb-2">Arredondamento das bordas</p>
            <div className="flex gap-2 mb-5">
              {["0", "6", "12", "20"].map((v) => (
                <button key={v} type="button" onClick={() => setRaio(v)}
                  className={`flex-1 py-3 text-xs border-2 transition-all ${raio === v ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
                  style={{ borderRadius: `${v}px` }}>
                  {v === "0" ? "Reto" : v === "6" ? "Suave" : v === "12" ? "Médio" : "Redondo"}
                </button>
              ))}
            </div>
            <input type="hidden" name="raio" value={raio} />

            <Select rotulo="Sombra dos cartões" nome="sombra" valor={sombra} onChange={setSombra}
              opcoes={[["none", "Sem sombra"], ["sm", "Leve"], ["md", "Média"], ["lg", "Forte"]]} />

            <Toggle rotulo="Animações e transições" descricao="Desligue para um site mais direto e rápido."
              nome="animacoes" ligado={animacoes} onChange={setAnimacoes} />
          </Card>
        )}

        {aba === "imagens" && (
          <Card titulo="Logo e imagens" ajuda="Informe o endereço (URL) da imagem já hospedada. Enviar arquivo direto ainda não está disponível.">
            <Url rotulo="Logo" nome="logo_url" valor={logo} onChange={setLogo} preview="h-12" />
            <Url rotulo="Favicon (ícone da aba)" nome="favicon_url" valor={favicon} onChange={setFavicon} preview="h-8 w-8" />
            <Url rotulo="Imagem de compartilhamento" nome="og_image_url" valor={ogImage} onChange={setOgImage} preview="h-20" />
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              A foto grande do topo do site não sai daqui: ela vem de <strong>Fotos</strong>, da imagem marcada
              como destaque e <strong>sem quarto vinculado</strong>.
            </p>
          </Card>
        )}

        {aba === "banner" && (
          <Card titulo="Faixa de aviso" ajuda="Aparece acima do menu, no site inteiro. Útil para avisos temporários.">
            <Toggle rotulo="Exibir a faixa" descricao="Quando desligada, nada aparece no site."
              nome="banner_ativo" ligado={bannerAtivo} onChange={setBannerAtivo} />
            <Campo rotulo="Texto" nome="banner_texto" valor={bannerTexto} onChange={setBannerTexto}
              placeholder="Ex.: Reservas de fim de ano abertas" />
            <Campo rotulo="Texto secundário" nome="banner_subtexto" valor={bannerSubtexto} onChange={setBannerSubtexto}
              placeholder="Opcional" />
            <Toggle rotulo="Efeito de movimento" descricao="Uma animação sutil para chamar atenção."
              nome="banner_animado" ligado={bannerAnimado} onChange={setBannerAnimado} />
          </Card>
        )}

        {aba === "seo" && (
          <Card titulo="Busca e compartilhamento" ajuda="É o que aparece no Google e ao enviar o link no WhatsApp.">
            <Campo rotulo="Título da página" nome="seo_title" valor={seoTitle} onChange={setSeoTitle}
              placeholder="Pousada Marimar — Reserva Oficial" max={60} />
            <Campo rotulo="Descrição" nome="seo_description" valor={seoDesc} onChange={setSeoDesc}
              placeholder="Pousada em Encantadas, Ilha do Mel..." max={160} textarea />
            <div className="mt-4 border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-[10px] text-gray-400 mb-1">Prévia no Google</p>
              <p className="text-[#1a0dab] text-sm truncate">{seoTitle || "Pousada Marimar — Reserva Oficial"}</p>
              <p className="text-[#006621] text-xs">pousadamarimarilhadomel.com.br</p>
              <p className="text-gray-600 text-xs line-clamp-2">{seoDesc || "Adicione uma descrição."}</p>
            </div>
          </Card>
        )}
      </div>

      {/* ─────────── PRÉVIA AO VIVO ─────────── */}
      <div className="xl:col-span-2">
        <div className="sticky top-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Prévia</p>
          <Previa primaria={primaria} secundaria={secundaria} fonteT={fonteT} fonteC={fonteC}
            raio={raio} sombra={sombra} logo={logo}
            banner={bannerAtivo ? { texto: bannerTexto, subtexto: bannerSubtexto } : null} />

          <button type="submit"
            className="w-full mt-4 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
            Aplicar ao site
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-2 leading-relaxed">
            Todas as abas são salvas de uma vez.
          </p>
        </div>
      </div>
    </form>
  );
}

/* ─────────── Prévia ─────────── */
function Previa({ primaria, secundaria, fonteT, fonteC, raio, sombra, logo, banner }: any) {
  const sombras: Record<string, string> = {
    none: "none", sm: "0 1px 3px rgb(0 0 0 / .08)",
    md: "0 4px 6px -1px rgb(0 0 0 / .1)", lg: "0 10px 15px -3px rgb(0 0 0 / .1)",
  };
  const r = `${raio}px`;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white" style={{ fontFamily: fonteC }}>
      {banner && (
        <div className="px-3 py-2 text-center text-[11px] text-white" style={{ background: secundaria }}>
          {banner.texto || "Texto da faixa"}
          {banner.subtexto && <span className="opacity-80"> · {banner.subtexto}</span>}
        </div>
      )}
      <div className="h-12 border-b border-gray-100 flex items-center justify-between px-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {logo && !logo.startsWith("data:")
            ? <img src={logo} alt="" className="h-5 w-auto" />
            : <span className="text-base">🏝️</span>}
          <span className="font-bold text-[11px] truncate" style={{ fontFamily: fonteT }}>Pousada Marimar</span>
        </div>
        <span className="text-[10px] text-white px-2.5 py-1" style={{ background: primaria, borderRadius: r }}>Reservar</span>
      </div>

      <div className="px-4 py-6 text-center text-white" style={{ background: `linear-gradient(135deg, ${primaria}, ${secundaria})` }}>
        <p className="font-bold text-sm mb-1" style={{ fontFamily: fonteT }}>Pousada Marimar</p>
        <p className="text-[10px] opacity-90">Encantadas · Ilha do Mel</p>
      </div>

      <div className="p-3 space-y-2" style={{ background: "#f8fafc" }}>
        <div className="bg-white p-2.5" style={{ borderRadius: r, boxShadow: sombras[sombra] }}>
          <div className="h-10 mb-2" style={{ background: `${primaria}22`, borderRadius: `calc(${r} / 1.5)` }} />
          <p className="text-[11px] font-semibold" style={{ fontFamily: fonteT }}>Suíte King</p>
          <p className="text-[10px] text-gray-500">Até 2 pessoas</p>
          <p className="text-[11px] font-bold mt-1" style={{ color: primaria }}>R$ 550</p>
        </div>
        <div className="text-center text-[10px] text-white py-2" style={{ background: primaria, borderRadius: r }}>
          Ver disponibilidade
        </div>
      </div>
    </div>
  );
}

/* ─────────── Campos ─────────── */
function Card({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1">{titulo}</h3>
      {ajuda && <p className="text-xs text-gray-500 mb-4 leading-relaxed">{ajuda}</p>}
      {children}
    </div>
  );
}

function Cor({ rotulo, valor, onChange, nome }: any) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <input type="color" value={valor} onChange={(e) => onChange(e.target.value)}
        className="w-11 h-11 rounded-lg border border-gray-200 cursor-pointer shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-600 mb-1">{rotulo}</p>
        <input name={nome} value={valor} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono" />
      </div>
    </div>
  );
}

function Select({ rotulo, nome, valor, onChange, opcoes }: any) {
  const norm: [string, string][] = opcoes.map((o: any) => Array.isArray(o) ? o : [o, o]);
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{rotulo}</label>
      <select name={nome} value={valor} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
        {norm.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Campo({ rotulo, nome, valor, onChange, placeholder, max, textarea }: any) {
  const Tag: any = textarea ? "textarea" : "input";
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-xs font-medium text-gray-600">{rotulo}</label>
        {max && <span className={`text-[10px] ${valor.length > max ? "text-red-500 font-medium" : "text-gray-400"}`}>{valor.length}/{max}</span>}
      </div>
      <Tag name={nome} value={valor} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}

function Url({ rotulo, nome, valor, onChange, preview }: any) {
  const base64 = valor.startsWith("data:");
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-600 mb-1">{rotulo}</label>
      <input name={nome} value={valor} onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      {base64 && (
        <p className="text-[11px] text-red-600 mt-1.5 leading-relaxed">
          Esta imagem está gravada dentro do banco (base64). Isso deixa o site lento — ela é carregada
          em toda página. Substitua por um endereço de imagem e salve.
        </p>
      )}
      {valor && !base64 && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg flex justify-center">
          <img src={valor} alt="" className={`${preview} object-contain`} />
        </div>
      )}
    </div>
  );
}

function Toggle({ rotulo, descricao, nome, ligado, onChange }: any) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">{rotulo}</span>
        {descricao && <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{descricao}</span>}
      </span>
      <input type="checkbox" name={nome} checked={ligado} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className={`w-11 h-6 rounded-full transition-colors relative shrink-0 mt-0.5 ${ligado ? "bg-gray-900" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${ligado ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}
