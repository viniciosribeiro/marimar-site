"use client";

import { useEffect, useRef, useState } from "react";
import { temaParaCss, pilhaFonte, pilhaManuscrita, type Tema } from "@/lib/tema";

/**
 * Previa do site REAL, com o tema em rascunho aplicado.
 *
 * Antes, a "previa" era um cartao desenhado a mao no editor: mostrava uma
 * aproximacao do que o site seria, e nao o site. Mudanca de espacamento,
 * escala tipografica ou densidade nao apareciam ali.
 *
 * Aqui o iframe carrega a pagina de verdade e injetamos os tokens dentro
 * dele. Mesma origem, entao da para alcancar o documento. E usamos a MESMA
 * funcao temaParaCss() que o layout raiz usa — duas implementacoes
 * divergiriam e a previa passaria a mentir.
 */

const PAGINAS = [
  { href: "/", nome: "Início" },
  { href: "/quartos", nome: "Acomodações" },
  { href: "/restaurante", nome: "Restaurante" },
  { href: "/como-chegar", nome: "Como chegar" },
  { href: "/reservar?check_in=2026-10-15&check_out=2026-10-17&adultos=2", nome: "Reserva" },
];

const TELAS = [
  { id: "celular", nome: "Celular", icone: "📱", largura: 390 },
  { id: "tablet", nome: "Tablet", icone: "📲", largura: 820 },
  { id: "computador", nome: "Computador", icone: "🖥", largura: 1280 },
] as const;

export function PreviaSite({ tema, fontesUsadas }: { tema: Tema; fontesUsadas: string[] }) {
  const [pagina, setPagina] = useState(PAGINAS[0].href);
  const [tela, setTela] = useState<(typeof TELAS)[number]["id"]>("computador");
  const [carregando, setCarregando] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  const larguraAlvo = TELAS.find((t) => t.id === tela)!.largura;

  // Encolhe a previa para caber na coluna, sem cortar o layout
  useEffect(() => {
    function medir() {
      const disponivel = caixaRef.current?.clientWidth ?? larguraAlvo;
      setEscala(Math.min(1, disponivel / larguraAlvo));
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [larguraAlvo]);

  /** Injeta (ou atualiza) o estilo do rascunho dentro do iframe. */
  function aplicar() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.head) return;

    const css = temaParaCss(tema, {
      titulo: pilhaFonte(tema.fonteTitulo),
      corpo: pilhaFonte(tema.fonteCorpo),
      manuscrita: pilhaManuscrita(tema.fonteManuscrita),
    });

    let estilo = doc.getElementById("previa-tema") as HTMLStyleElement | null;
    if (!estilo) {
      estilo = doc.createElement("style");
      estilo.id = "previa-tema";
      doc.head.appendChild(estilo);
    }
    // !important porque o layout raiz ja escreveu :root com os valores salvos
    estilo.textContent = `:root{${css.split(";").filter(Boolean).map((d) => `${d} !important`).join(";")};}`;

    // Garante que a fonte escolhida exista dentro do iframe
    const familias = fontesUsadas.filter(Boolean);
    if (familias.length) {
      let link = doc.getElementById("previa-fontes") as HTMLLinkElement | null;
      const href = `https://fonts.googleapis.com/css2?${familias
        .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
        .join("&")}&display=swap`;
      if (!link) {
        link = doc.createElement("link");
        link.id = "previa-fontes";
        link.rel = "stylesheet";
        doc.head.appendChild(link);
      }
      if (link.href !== href) link.href = href;
    }
  }

  // Reaplica a cada mudanca do rascunho
  useEffect(() => {
    aplicar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema, fontesUsadas.join(",")]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {TELAS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTela(t.id)}
              aria-pressed={tela === t.id}
              title={`${t.nome} — ${t.largura}px`}
              className={`px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                tela === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-800"
              }`}>
              <span aria-hidden>{t.icone}</span>
              <span className="sr-only sm:not-sr-only sm:ml-1.5">{t.nome}</span>
            </button>
          ))}
        </div>

        <select value={pagina} onChange={(e) => { setCarregando(true); setPagina(e.target.value); }}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white max-w-[10rem]">
          {PAGINAS.map((p) => <option key={p.href} value={p.href}>{p.nome}</option>)}
        </select>
      </div>

      <div ref={caixaRef} className="rounded-xl border border-gray-200 bg-gray-100 overflow-hidden relative">
        {carregando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
            <span className="text-xs text-gray-400">carregando a prévia…</span>
          </div>
        )}

        <div
          style={{
            width: larguraAlvo,
            height: 560 / escala,
            transform: `scale(${escala})`,
            transformOrigin: "top left",
          }}
        >
          <iframe
            ref={iframeRef}
            src={pagina}
            title="Prévia do site com o tema em rascunho"
            className="w-full h-full border-0 bg-white"
            onLoad={() => { setCarregando(false); aplicar(); }}
          />
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
        Site real, com as suas mudanças aplicadas em cima — nada foi salvo ainda.
        Largura simulada: {larguraAlvo}px{escala < 1 ? ` (reduzida a ${Math.round(escala * 100)}% para caber)` : ""}.
      </p>
    </div>
  );
}
