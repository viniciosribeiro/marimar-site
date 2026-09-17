"use client";

import { useState, useRef } from "react";
import { salvarTema } from "@/app/(admin)/admin/identidade-visual/actions";

const FONTES = ["Inter","Geist","Roboto","Open Sans","Lato","Montserrat","Playfair Display","Merriweather","Poppins","Nunito","Raleway"];
const PALETAS = [
  { n:"Oceano", p:"#0D9488", s:"#0EA5E9" },{ n:"Tropical", p:"#059669", s:"#D97706" },
  { n:"Praia", p:"#0891B2", s:"#F59E0B" },{ n:"Elegante", p:"#1E293B", s:"#B45309" },
  { n:"Verão", p:"#2563EB", s:"#F97316" },{ n:"Natureza", p:"#166534", s:"#CA8A04" },
  { n:"Rosa", p:"#BE185D", s:"#EC4899" },{ n:"Âmbar", p:"#B45309", s:"#F59E0B" },
];

export function ThemeEditor({ initial }: { initial: any }) {
  const [tab, setTab] = useState("cores");
  const [primaria, setPrimaria] = useState(initial?.cor_primaria||"#0D9488");
  const [secundaria, setSecundaria] = useState(initial?.cor_secundaria||"#0EA5E9");
  const [fonteT, setFonteT] = useState(initial?.fonte_titulo||"Inter");
  const [fonteC, setFonteC] = useState(initial?.fonte_corpo||"Inter");
  const [logo, setLogo] = useState(initial?.logo_url||"");
  const [favicon, setFavicon] = useState(initial?.favicon_url||"");
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title||"");
  const [seoDesc, setSeoDesc] = useState(initial?.seo_description||"");
  const [arredondamento, setArredondamento] = useState("12");
  const [sombra, setSombra] = useState("sm");
  const [animacoes, setAnimacoes] = useState(true);
  const [bannerAtivo, setBannerAtivo] = useState(true);
  const [bannerTexto, setBannerTexto] = useState("Bem-vindo à Pousada Marimar");
  const [bannerSubtexto, setBannerSubtexto] = useState("Seu refúgio na Ilha do Mel");
  const [bannerAnimado, setBannerAnimado] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const favInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFavUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setFavicon(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const tabs = [
    { id:"cores", label:"🎨 Cores", icon:"🎨" },
    { id:"tipografia", label:"🔤 Fontes", icon:"🔤" },
    { id:"logos", label:"🖼️ Logos", icon:"🖼️" },
    { id:"banner", label:"🎬 Banner", icon:"🎬" },
    { id:"avancado", label:"⚙️ Avançado", icon:"⚙️" },
    { id:"seo", label:"🔍 SEO", icon:"🔍" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Editor */}
      <div className="lg:col-span-3">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                tab === t.id ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Tab: Cores */}
        {tab === "cores" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-sm mb-3">Paletas prontas</h3>
              <div className="grid grid-cols-4 gap-2">
                {PALETAS.map((p) => (
                  <button key={p.n} onClick={() => { setPrimaria(p.p); setSecundaria(p.s); }}
                    className="p-2 rounded-xl border-2 hover:border-teal-400 transition-all text-center"
                    style={{ borderColor: primaria===p.p ? p.p : "transparent" }}>
                    <div className="flex rounded-lg overflow-hidden h-8 mb-1">
                      <div className="flex-1" style={{backgroundColor:p.p}}/>
                      <div className="flex-1" style={{backgroundColor:p.s}}/>
                    </div>
                    <span className="text-2xs text-gray-500">{p.n}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-sm mb-4">Cores personalizadas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Primária</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaria} onChange={(e) => setPrimaria(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer"/>
                    <input type="text" value={primaria} onChange={(e) => setPrimaria(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Secundária</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={secundaria} onChange={(e) => setSecundaria(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer"/>
                    <input type="text" value={secundaria} onChange={(e) => setSecundaria(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"/>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-1">
                {["50","100","200","300","400","500","600","700","800","900"].map((s,i) => (
                  <div key={s} className="text-center">
                    <div className="h-8 rounded" style={{backgroundColor:primaria, opacity:0.1+(i*0.1)}}/>
                    <span className="text-2xs text-gray-400">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Fontes */}
        {tab === "tipografia" && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fonte dos Títulos</label>
              <select value={fonteT} onChange={(e) => setFonteT(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                {FONTES.map((f) => <option key={f}>{f}</option>)}
              </select>
              <p className="mt-2 text-lg font-bold" style={{fontFamily:fonteT}}>Título de Exemplo — 28px Bold</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Fonte do Corpo</label>
              <select value={fonteC} onChange={(e) => setFonteC(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                {FONTES.map((f) => <option key={f}>{f}</option>)}
              </select>
              <p className="mt-2 text-sm" style={{fontFamily:fonteC}}>Texto de exemplo para corpo. Lorem ipsum dolor sit amet consectetur.</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tamanhos</label>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Texto pequeno (xs) — 12px</p>
                <p className="text-sm text-gray-600">Texto normal (sm) — 14px</p>
                <p className="text-base text-gray-700">Texto base — 16px</p>
                <p className="text-lg text-gray-800">Texto grande (lg) — 18px</p>
                <p className="text-xl font-bold text-gray-900">Título (xl) — 20px</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Logos */}
        {tab === "logos" && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-6">
            <div>
              <label className="text-sm font-medium mb-3 block">Logo Principal</label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
                onClick={() => logoInputRef.current?.click()}>
                {logo ? (
                  <img src={logo} alt="Logo preview" className="max-h-20 mx-auto" />
                ) : (
                  <div className="text-gray-400">
                    <span className="text-3xl block mb-2">🖼️</span>
                    <span className="text-sm">Clique para fazer upload</span>
                    <p className="text-xs text-gray-300 mt-1">PNG, SVG ou JPG • máx 2MB</p>
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </div>
              {logo && <button onClick={() => setLogo("")} className="text-xs text-red-500 mt-2 hover:underline">Remover logo</button>}
            </div>
            <div>
              <label className="text-sm font-medium mb-3 block">Favicon</label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer"
                onClick={() => favInputRef.current?.click()}>
                {favicon ? (
                  <img src={favicon} alt="Favicon preview" className="w-12 h-12 mx-auto rounded" />
                ) : (
                  <div className="text-gray-400">
                    <span className="text-2xl block mb-1">🔖</span>
                    <span className="text-sm">Upload do favicon</span>
                    <p className="text-xs text-gray-300 mt-1">ICO ou PNG • 32x32px</p>
                  </div>
                )}
                <input ref={favInputRef} type="file" accept="image/*" onChange={handleFavUpload} className="hidden" />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Banner */}
        {tab === "banner" && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Banner da Home</h3>
              <button onClick={() => setBannerAtivo(!bannerAtivo)}
                className={`w-10 h-5 rounded-full transition-colors ${bannerAtivo?"bg-teal-500":"bg-gray-300"}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform m-0.5 ${bannerAtivo?"translate-x-5":""}`}/>
              </button>
            </div>
            {bannerAtivo && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Texto principal</label>
                  <input value={bannerTexto} onChange={(e) => setBannerTexto(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subtexto</label>
                  <input value={bannerSubtexto} onChange={(e) => setBannerSubtexto(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Animação do banner</span>
                  <button onClick={() => setBannerAnimado(!bannerAnimado)}
                    className={`w-10 h-5 rounded-full transition-colors ${bannerAnimado?"bg-teal-500":"bg-gray-300"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform m-0.5 ${bannerAnimado?"translate-x-5":""}`}/>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-2">Preview do banner:</p>
                  <div className={`rounded-xl p-6 text-center text-white ${bannerAnimado?"animate-pulse":""}`}
                    style={{background:`linear-gradient(135deg,${primaria},${secundaria})`}}>
                    <h2 className="text-xl font-bold" style={{fontFamily:fonteT}}>{bannerTexto}</h2>
                    <p className="text-sm opacity-80 mt-1">{bannerSubtexto}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Avançado */}
        {tab === "avancado" && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Arredondamento dos elementos</label>
              <div className="flex gap-2">
                {["4","8","12","16","24"].map((v) => (
                  <button key={v} onClick={() => setArredondamento(v)}
                    className={`w-10 h-10 rounded-${v} border-2 flex items-center justify-center text-xs ${
                      arredondamento===v?"border-teal-500 bg-teal-50":"border-gray-200"
                    }`}>{v}px</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sombras</label>
              <select value={sombra} onChange={(e) => setSombra(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="none">Sem sombra</option>
                <option value="sm">Suave</option>
                <option value="md">Média</option>
                <option value="lg">Forte</option>
                <option value="xl">Extra</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium block">Animações no site</span>
                <span className="text-xs text-gray-400">Transições, hover effects, loading</span>
              </div>
              <button onClick={() => setAnimacoes(!animacoes)}
                className={`w-10 h-5 rounded-full transition-colors ${animacoes?"bg-teal-500":"bg-gray-300"}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform m-0.5 ${animacoes?"translate-x-5":""}`}/>
              </button>
            </div>
          </div>
        )}

        {/* Tab: SEO */}
        {tab === "seo" && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Título SEO ({seoTitle.length}/60)</label>
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={60} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição SEO ({seoDesc.length}/160)</label>
              <textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)}
                maxLength={160} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Preview no Google:</p>
              <p className="text-sm font-medium text-blue-700" style={{fontFamily:fonteT}}>{seoTitle||"Pousada Ilha do Mel Marimar"}</p>
              <p className="text-xs text-green-700">https://www.pousadamarimarilhadomel.com.br</p>
              <p className="text-xs text-gray-600 mt-1">{seoDesc||"Sua pousada na Ilha do Mel..."}</p>
            </div>
          </div>
        )}

        {/* Form escondido */}
        <form id="theme-form" className="hidden">
          <input type="hidden" name="cor_primaria" value={primaria} />
          <input type="hidden" name="cor_secundaria" value={secundaria} />
          <input type="hidden" name="fonte_titulo" value={fonteT} />
          <input type="hidden" name="fonte_corpo" value={fonteC} />
          <input type="hidden" name="logo_url" value={logo} />
          <input type="hidden" name="favicon_url" value={favicon} />
          <input type="hidden" name="seo_title" value={seoTitle} />
          <input type="hidden" name="seo_description" value={seoDesc} />
        </form>
      </div>

      {/* Preview */}
      <div className="lg:col-span-2">
        <div className="sticky top-24 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sm mb-3">👁️ Preview ao vivo</h3>
            <div className="rounded-xl overflow-hidden border shadow-sm text-xs" style={{fontFamily:fonteC}}>
              {/* Header */}
              <div className="p-2 flex items-center justify-between" style={{backgroundColor:primaria}}>
                {logo?<img src={logo} className="h-5"/>:<span className="text-white font-bold" style={{fontFamily:fonteT}}>🏝️ Marimar</span>}
                <span className="text-white/60">Home • Quartos • Contato</span>
              </div>
              {/* Hero */}
              <div className="p-5 text-center text-white" style={{background:`linear-gradient(135deg,${primaria},${secundaria})`}}>
                <h2 className="font-bold mb-1" style={{fontFamily:fonteT}}>{bannerTexto}</h2>
                <p className="opacity-80">{bannerSubtexto}</p>
                <button className="mt-2 bg-white px-3 py-1 rounded-lg font-medium" style={{color:primaria}}>Reservar</button>
              </div>
              {/* Cards */}
              <div className="p-2 grid grid-cols-3 gap-1.5">
                {[1,2,3].map((i) => (
                  <div key={i} className="border rounded-lg p-1.5 text-center">
                    <div className="h-10 rounded mb-1" style={{background:`linear-gradient(135deg,${primaria}20,${secundaria}20)`}}/>
                    <div className="font-medium" style={{fontFamily:fonteT}}>Suíte</div>
                    <div style={{color:primaria}}>R$ 390</div>
                  </div>
                ))}
              </div>
              {/* Buttons */}
              <div className="p-2 flex gap-1.5">
                <button className="flex-1 py-1.5 rounded-lg text-white font-medium" style={{backgroundColor:primaria}}>Primário</button>
                <button className="flex-1 py-1.5 rounded-lg font-medium border-2" style={{borderColor:primaria,color:primaria}}>Outline</button>
              </div>
            </div>
          </div>
          <button type="submit" form="theme-form" formAction={salvarTema as any}
            className="w-full py-3 rounded-xl text-white font-medium hover:opacity-90 transition-opacity"
            style={{backgroundColor:primaria}}>
            💾 Aplicar tema ao site
          </button>
        </div>
      </div>
    </div>
  );
}