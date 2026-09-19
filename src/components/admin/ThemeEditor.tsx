"use client";

import { useState, useMemo, useTransition } from "react";
import { salvarTema } from "@/app/(admin)/admin/identidade-visual/actions";
import { PreviaSite } from "./PreviaSite";
import { UploadImagem } from "./UploadImagem";
import { avaliarCorDeMarca, textoIdeal, razaoContraste } from "@/lib/contraste";
import {
  lerTema, CONJUNTOS, FONTES_TITULO, FONTES_CORPO, FONTES_MANUSCRITA,
  ESCALAS, TODAS_AS_FONTES, type Tema,
} from "@/lib/tema";

const ABAS = [
  { id: "estilo", nome: "Estilo", icone: "✨" },
  { id: "cores", nome: "Cores", icone: "🎨" },
  { id: "tipografia", nome: "Tipografia", icone: "🔤" },
  { id: "forma", nome: "Forma", icone: "⬜" },
  { id: "marca", nome: "Marca", icone: "🏷" },
  { id: "faixa", nome: "Faixa", icone: "📢" },
  { id: "seo", nome: "Busca", icone: "🔍" },
  { id: "acesso", nome: "Acessibilidade", icone: "♿" },
] as const;

export function ThemeEditor({ initial, blobOk }: { initial: any; blobOk: boolean }) {
  const salvo = useMemo(() => lerTema(initial), [initial]);

  // Rascunho separado do que esta publicado: a Cecilia mexe a vontade e so
  // o que ela publicar chega ao site.
  const [tema, setTema] = useState<Tema>(salvo);
  const [logo, setLogo] = useState<string>(initial?.logo_url ?? "");
  const [favicon, setFavicon] = useState<string>(initial?.favicon_url ?? "");
  const [og, setOg] = useState<string>(initial?.og_image_url ?? "");
  const [seoTitle, setSeoTitle] = useState<string>(initial?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState<string>(initial?.seo_description ?? "");
  const [aba, setAba] = useState<string>("estilo");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [enviando, iniciarEnvio] = useTransition();

  const set = <K extends keyof Tema>(k: K, v: Tema[K]) => setTema((t) => ({ ...t, [k]: v }));

  const mudou = useMemo(() =>
    JSON.stringify(tema) !== JSON.stringify(salvo) ||
    logo !== (initial?.logo_url ?? "") ||
    favicon !== (initial?.favicon_url ?? "") ||
    og !== (initial?.og_image_url ?? "") ||
    seoTitle !== (initial?.seo_title ?? "") ||
    seoDesc !== (initial?.seo_description ?? ""),
  [tema, salvo, logo, favicon, og, seoTitle, seoDesc, initial]);

  const fontesUsadas = [tema.fonteTitulo, tema.fonteCorpo, tema.fonteManuscrita]
    .filter((f) => TODAS_AS_FONTES.has(f));

  const temaFaltando = initial && initial.tema === undefined;

  function publicar() {
    const fd = new FormData();
    fd.set("tema", JSON.stringify(tema));
    fd.set("logo_url", logo);
    fd.set("favicon_url", favicon);
    fd.set("og_image_url", og);
    fd.set("seo_title", seoTitle);
    fd.set("seo_description", seoDesc);
    iniciarEnvio(() => { salvarTema(fd); });
  }

  function exportar() {
    const dados = { tema, logo_url: logo, favicon_url: favicon, og_image_url: og, seo_title: seoTitle, seo_description: seoDesc };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tema-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importar(arquivo: File) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const d = JSON.parse(String(leitor.result));
        if (d.tema) setTema({ ...salvo, ...d.tema });
        if (typeof d.logo_url === "string") setLogo(d.logo_url);
        if (typeof d.favicon_url === "string") setFavicon(d.favicon_url);
        if (typeof d.og_image_url === "string") setOg(d.og_image_url);
        if (typeof d.seo_title === "string") setSeoTitle(d.seo_title);
        if (typeof d.seo_description === "string") setSeoDesc(d.seo_description);
      } catch { alert("Arquivo de tema inválido."); }
    };
    leitor.readAsText(arquivo);
  }

  // minmax(0,...) nas duas colunas + min-w-0 nos filhos: em grid, o filho
  // tem min-width:auto por padrao e se recusa a encolher abaixo do proprio
  // conteudo. Era o que fazia a previa de 1280px estourar o layout.
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 items-start">
      {/* ═══════════ COLUNA DE CONTROLES ═══════════ */}
      <div className="min-w-0">
        {temaFaltando && (
          <Alerta>
            A coluna <code>tema</code> não existe no banco. Rode <code>npm run db:migrate</code> —
            sem ela, Forma, Tipografia e Faixa não salvam.
          </Alerta>
        )}

        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {ABAS.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                aba === a.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}>
              <span aria-hidden className="mr-1">{a.icone}</span>{a.nome}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {aba === "estilo" && (
            <Card titulo="Conjuntos prontos" ajuda="Aplica cor, fontes, escala e forma de uma vez. Depois dá para ajustar cada item.">
              <div className="grid sm:grid-cols-2 gap-2.5">
                {CONJUNTOS.map((c) => {
                  const ativo = tema.marca === c.tema.marca && tema.fonteTitulo === c.tema.fonteTitulo;
                  return (
                    <button key={c.id} type="button" onClick={() => setTema((t) => ({ ...t, ...c.tema }))}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        ativo ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <div className="flex gap-1 mb-2">
                        <span className="flex-1 h-5 rounded" style={{ background: c.tema.marca }} />
                        <span className="w-4 h-5 rounded" style={{ background: c.tema.acento }} />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{c.nome}</p>
                      <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{c.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                <button type="button" onClick={exportar}
                  className="text-xs border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">
                  ⬇ Exportar tema
                </button>
                <label className="text-xs border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  ⬆ Importar tema
                  <input type="file" accept="application/json" className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
                </label>
                <button type="button" onClick={() => setTema(salvo)} disabled={!mudou}
                  className="text-xs border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                  ↩ Descartar mudanças
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Exportar serve para repetir esta identidade em outra propriedade, ou guardar
                um estado antes de experimentar.
              </p>
            </Card>
          )}

          {aba === "cores" && (
            <>
              <Card titulo="Cores da marca" ajuda="A cor principal gera sozinha os tons de hover, fundo e borda usados no site inteiro.">
                <Cor rotulo="Cor principal" valor={tema.marca} aoMudar={(v) => set("marca", v)} />
                <Contraste cor={tema.marca} />
                <Cor rotulo="Cor de destaque" valor={tema.acento} aoMudar={(v) => set("acento", v)} />
                <Contraste cor={tema.acento} />

                {sugestoes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">Cores encontradas na logo</p>
                    <div className="flex flex-wrap gap-2">
                      {sugestoes.map((c) => (
                        <button key={c} type="button" onClick={() => set("marca", c)}
                          title={`Usar ${c} como cor principal`}
                          className="w-9 h-9 rounded-lg border-2 border-white shadow ring-1 ring-gray-200"
                          style={{ background: c }} />
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Clique para usar como cor principal.</p>
                  </div>
                )}
              </Card>

              <Card titulo="Escala gerada" ajuda="Derivada da cor principal. É o que o site usa em hover, fundos e bordas.">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    ["sutil", 95], ["suave", 88], ["borda", 72],
                    ["base", 0], ["hover", -12], ["escura", -38],
                  ].map(([nome, mix]) => (
                    <div key={nome as string} className="text-center">
                      <div className="h-10 rounded-lg border border-gray-200 mb-1"
                        style={{ background: `color-mix(in oklab, ${tema.marca}, ${Number(mix) > 0 ? "white" : "black"} ${Math.abs(Number(mix))}%)` }} />
                      <span className="text-[9px] text-gray-500">{nome}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {aba === "tipografia" && (
            <>
              <Card titulo="Famílias">
                <Selecao rotulo="Títulos" valor={tema.fonteTitulo} aoMudar={(v) => set("fonteTitulo", v)} opcoes={FONTES_TITULO} />
                <p style={{ fontFamily: tema.fonteTitulo, fontWeight: tema.pesoTitulo }}
                  className="text-2xl text-gray-900 my-3 py-3 border-y border-gray-100">
                  Pousada Marimar
                </p>
                <Selecao rotulo="Corpo do texto" valor={tema.fonteCorpo} aoMudar={(v) => set("fonteCorpo", v)} opcoes={FONTES_CORPO} />
                <p style={{ fontFamily: tema.fonteCorpo, lineHeight: tema.alturaLinha }} className="text-sm text-gray-600 mt-2 mb-5">
                  O Marimar Café Bistrô Bar fica em frente ao mar, e a pousada logo aos fundos.
                </p>
                <div className="border-t border-gray-100 pt-4">
                  <Selecao rotulo="Anotações à mão" valor={tema.fonteManuscrita} aoMudar={(v) => set("fonteManuscrita", v)} opcoes={FONTES_MANUSCRITA} />
                  <p className="text-[11px] text-gray-500 leading-relaxed mt-1">
                    Frases decorativas ao lado dos títulos. <strong>nenhuma</strong> desliga —
                    o site continua completo, só sem elas.
                  </p>
                  {tema.fonteManuscrita !== "nenhuma" && (
                    <p style={{ fontFamily: tema.fonteManuscrita }} className="text-2xl text-gray-700 mt-2">
                      Um paraíso sem pressa
                    </p>
                  )}
                </div>
              </Card>

              <Card titulo="Hierarquia" ajuda="A escala define a razão entre um nível de título e o seguinte. Mudar aqui reescala o site inteiro de forma coerente.">
                <div className="space-y-2 mb-4">
                  {ESCALAS.map((e) => (
                    <button key={e.v} type="button" onClick={() => set("escala", e.v)}
                      className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                        tema.escala === e.v ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">{e.nome}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{e.v}</span>
                      </span>
                      <span className="block text-[11px] text-gray-500">{e.desc}</span>
                    </button>
                  ))}
                </div>

                <Faixa rotulo="Tamanho do texto" valor={tema.textoBase} min={14} max={20} passo={1}
                  formato={(v) => `${v}px`} aoMudar={(v) => set("textoBase", v)} />
                <Faixa rotulo="Altura da linha" valor={tema.alturaLinha} min={1.3} max={1.9} passo={0.05}
                  formato={(v) => v.toFixed(2)} aoMudar={(v) => set("alturaLinha", v)} />
                <Faixa rotulo="Peso dos títulos" valor={tema.pesoTitulo} min={500} max={800} passo={100}
                  formato={(v) => String(v)} aoMudar={(v) => set("pesoTitulo", v)} />

                <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5"
                  style={{ fontFamily: tema.fonteTitulo, fontWeight: tema.pesoTitulo }}>
                  {[4, 3, 2, 1].map((n) => (
                    <p key={n} className="text-gray-900 truncate"
                      style={{ fontSize: `${tema.textoBase * Math.pow(tema.escala, n)}px`, lineHeight: 1.1 }}>
                      Título {n}
                    </p>
                  ))}
                </div>
              </Card>
            </>
          )}

          {aba === "forma" && (
            <Card titulo="Forma e ritmo" ajuda="Vale para cartões, botões e campos do site inteiro.">
              <p className="text-xs font-medium text-gray-600 mb-2">Arredondamento</p>
              <div className="flex gap-2 mb-5">
                {[0, 6, 12, 20].map((v) => (
                  <button key={v} type="button" onClick={() => set("raio", v)}
                    className={`flex-1 py-3 text-xs border-2 transition-all ${
                      tema.raio === v ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
                    }`} style={{ borderRadius: `${v}px` }}>
                    {v === 0 ? "Reto" : v === 6 ? "Suave" : v === 12 ? "Médio" : "Redondo"}
                  </button>
                ))}
              </div>

              <Selecao rotulo="Sombra dos cartões" valor={tema.sombra} aoMudar={(v) => set("sombra", v as Tema["sombra"])}
                opcoes={[["none", "Sem sombra"], ["sm", "Leve"], ["md", "Média"], ["lg", "Forte"]]} />

              <Faixa rotulo="Respiro entre seções" valor={tema.densidade} min={0.7} max={1.4} passo={0.05}
                formato={(v) => v < 0.9 ? "compacto" : v > 1.15 ? "espaçoso" : "confortável"}
                aoMudar={(v) => set("densidade", v)} />
              <p className="text-[11px] text-gray-400 -mt-2 mb-3 leading-relaxed">
                Site com muita foto pede mais ar; site com muito texto pede menos.
              </p>

              <Interruptor rotulo="Animações e transições" descricao="Desligue para um site mais direto."
                ligado={tema.animacoes} aoMudar={(v) => set("animacoes", v)} />
            </Card>
          )}

          {aba === "marca" && (
            <Card titulo="Logo e imagens" ajuda="Arquivos enviados ficam no armazenamento da Vercel, servidos por CDN.">
              <UploadImagem rotulo="Logo" valor={logo} aoEnviar={setLogo} pasta="marca" configurado={blobOk}
                previewClasse="h-12" ajuda="Aparece no topo e no rodapé. PNG com fundo transparente funciona melhor."
                aoExtrairCores={setSugestoes} />
              <UploadImagem rotulo="Favicon" valor={favicon} aoEnviar={setFavicon} pasta="marca" configurado={blobOk}
                previewClasse="h-8" ajuda="Ícone da aba do navegador. Quadrado, 512×512." />
              <UploadImagem rotulo="Imagem de compartilhamento" valor={og} aoEnviar={setOg} pasta="marca" configurado={blobOk}
                previewClasse="h-20" ajuda="Aparece quando o link é enviado no WhatsApp. Ideal 1200×630." />
              <p className="text-[11px] text-gray-400 leading-relaxed">
                A foto grande do topo do site não sai daqui: vem de <strong>Fotos</strong>,
                da imagem marcada como destaque e sem quarto vinculado.
              </p>
            </Card>
          )}

          {aba === "faixa" && (
            <Card titulo="Faixa de aviso" ajuda="Aparece acima do menu, em todas as páginas.">
              <Interruptor rotulo="Exibir a faixa" descricao="Desligada, não aparece nada no site."
                ligado={tema.banner.ativo} aoMudar={(v) => set("banner", { ...tema.banner, ativo: v })} />
              <Campo rotulo="Texto" valor={tema.banner.texto ?? ""} placeholder="Ex.: Reservas de fim de ano abertas"
                aoMudar={(v) => set("banner", { ...tema.banner, texto: v || null })} />
              <Campo rotulo="Texto secundário" valor={tema.banner.subtexto ?? ""} placeholder="Opcional"
                aoMudar={(v) => set("banner", { ...tema.banner, subtexto: v || null })} />
              <Interruptor rotulo="Efeito de movimento" descricao="Uma animação sutil para chamar atenção."
                ligado={tema.banner.animado} aoMudar={(v) => set("banner", { ...tema.banner, animado: v })} />
            </Card>
          )}

          {aba === "seo" && (
            <Card titulo="Busca e compartilhamento" ajuda="É o que aparece no Google e ao enviar o link no WhatsApp.">
              <Campo rotulo="Título da página" valor={seoTitle} aoMudar={setSeoTitle} max={60}
                placeholder="Pousada Marimar — Reserva Oficial" />
              <Campo rotulo="Descrição" valor={seoDesc} aoMudar={setSeoDesc} max={160} textarea
                placeholder="Pousada em Encantadas, Ilha do Mel…" />
              <div className="mt-4 border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-[10px] text-gray-400 mb-1">Prévia no Google</p>
                <p className="text-[#1a0dab] text-sm truncate">{seoTitle || "Pousada Marimar — Reserva Oficial"}</p>
                <p className="text-[#006621] text-xs">pousadamarimarilhadomel.com.br</p>
                <p className="text-gray-600 text-xs line-clamp-2">{seoDesc || "Adicione uma descrição."}</p>
              </div>
            </Card>
          )}

          {aba === "acesso" && <RelatorioAcessibilidade tema={tema} />}
        </div>
      </div>

      {/* ═══════════ PRÉVIA ═══════════ */}
      <div className="min-w-0 xl:sticky xl:top-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prévia ao vivo</p>
          {mudou && <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">não publicado</span>}
        </div>

        <PreviaSite tema={tema} fontesUsadas={fontesUsadas} />

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={publicar} disabled={!mudou || enviando}
            className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
            {enviando ? "Publicando…" : mudou ? "Publicar no site" : "Nada para publicar"}
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap">
            Abrir site ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/* ═════════ Relatório de acessibilidade ═════════ */
function RelatorioAcessibilidade({ tema }: { tema: Tema }) {
  const checagens = [
    { nome: "Texto sobre a cor principal", a: tema.marca, b: textoIdeal(tema.marca), minimo: 4.5 },
    { nome: "Texto sobre a cor de destaque", a: tema.acento, b: textoIdeal(tema.acento), minimo: 4.5 },
    { nome: "Cor principal sobre fundo branco", a: tema.marca, b: "#ffffff", minimo: 3 },
    { nome: "Texto do site sobre o fundo", a: "#1f2937", b: "#ffffff", minimo: 4.5 },
    { nome: "Títulos sobre o fundo", a: "#12324f", b: "#ffffff", minimo: 4.5 },
    { nome: "Texto de apoio sobre areia", a: "#4b5c6b", b: "#faf0e3", minimo: 4.5 },
  ].map((c) => {
    const r = razaoContraste(c.a, c.b) ?? 0;
    return { ...c, razao: Math.round(r * 10) / 10, passa: r >= c.minimo };
  });

  const falhas = checagens.filter((c) => !c.passa);
  const textoPequeno = tema.textoBase < 15;

  return (
    <Card titulo="Acessibilidade" ajuda="Regras da WCAG 2.1. Hóspede lê no celular, muitas vezes na praia sob o sol.">
      <ul className="space-y-2 mb-4">
        {checagens.map((c) => (
          <li key={c.nome} className="flex items-center gap-3 text-xs">
            <span className={c.passa ? "text-green-600" : "text-amber-600"} aria-hidden>{c.passa ? "✓" : "⚠"}</span>
            <span className="flex-1 text-gray-700">{c.nome}</span>
            <span className={`font-mono ${c.passa ? "text-gray-500" : "text-amber-700 font-semibold"}`}>
              {c.razao}:1
            </span>
          </li>
        ))}
      </ul>

      {textoPequeno && (
        <Alerta>
          Texto base em {tema.textoBase}px. Abaixo de 15px fica difícil de ler no celular —
          principalmente para hóspedes mais velhos.
        </Alerta>
      )}

      {falhas.length === 0 && !textoPequeno ? (
        <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg p-3 leading-relaxed">
          Todas as combinações passam no mínimo exigido. Boa escolha de cores.
        </p>
      ) : falhas.length > 0 && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
          {falhas.length === 1 ? "Uma combinação está" : `${falhas.length} combinações estão`} abaixo do
          mínimo. Escurecer um pouco a cor costuma resolver sem mudar a identidade.
        </p>
      )}
    </Card>
  );
}

/* ═════════ Peças de formulário ═════════ */
function Card({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1">{titulo}</h3>
      {ajuda && <p className="text-xs text-gray-500 mb-4 leading-relaxed">{ajuda}</p>}
      {children}
    </div>
  );
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900 leading-relaxed">
      {children}
    </div>
  );
}

function Contraste({ cor }: { cor: string }) {
  const d = avaliarCorDeMarca(cor);
  if (!d) return null;
  return (
    <div className={`flex items-start gap-3 rounded-lg p-2.5 mb-3 text-[11px] leading-relaxed ${
      d.ok ? "bg-green-50 border border-green-200 text-green-900" : "bg-amber-50 border border-amber-200 text-amber-900"
    }`}>
      <span className="px-2 py-1 rounded font-semibold shrink-0" style={{ background: cor, color: textoIdeal(cor) }}>
        Botão
      </span>
      <span>{d.ok ? "✓" : "⚠"} {d.mensagem}</span>
    </div>
  );
}

function Cor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <input type="color" value={valor} onChange={(e) => aoMudar(e.target.value)}
        className="w-11 h-11 rounded-lg border border-gray-200 cursor-pointer shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-600 mb-1">{rotulo}</p>
        <input value={valor} onChange={(e) => aoMudar(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono" />
      </div>
    </div>
  );
}

function Selecao({ rotulo, valor, aoMudar, opcoes }: { rotulo: string; valor: string; aoMudar: (v: string) => void; opcoes: any[] }) {
  const norm: [string, string][] = opcoes.map((o) =>
    Array.isArray(o) ? ([o[0], o[1]] as [string, string]) : ([o, o] as [string, string]));
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{rotulo}</label>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
        {norm.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
        onChange={(e) => aoMudar(Number(e.target.value))}
        className="w-full accent-gray-900" />
    </div>
  );
}

function Campo({ rotulo, valor, aoMudar, placeholder, max, textarea }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void;
  placeholder?: string; max?: number; textarea?: boolean;
}) {
  const Tag: any = textarea ? "textarea" : "input";
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-xs font-medium text-gray-600">{rotulo}</label>
        {max && <span className={`text-[10px] ${valor.length > max ? "text-red-500 font-medium" : "text-gray-400"}`}>{valor.length}/{max}</span>}
      </div>
      <Tag value={valor} onChange={(e: any) => aoMudar(e.target.value)} placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}

function Interruptor({ rotulo, descricao, ligado, aoMudar }: {
  rotulo: string; descricao?: string; ligado: boolean; aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">{rotulo}</span>
        {descricao && <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{descricao}</span>}
      </span>
      <input type="checkbox" checked={ligado} onChange={(e) => aoMudar(e.target.checked)} className="sr-only" />
      <span className={`w-11 h-6 rounded-full transition-colors relative shrink-0 mt-0.5 ${ligado ? "bg-gray-900" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${ligado ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </label>
  );
}
