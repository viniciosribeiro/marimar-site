"use client";

import { useEffect, useState } from "react";

/**
 * Abertura de rota no aparelho do hospede.
 *
 * O que faltava: a pagina so tinha um link "abrir no mapa", que mostra o
 * ponto mas nao traca rota. Aqui o destino ja vai montado com modo A PE —
 * o unico que faz sentido na Ilha do Mel, onde nao circulam carros. Um
 * link comum abre rota de carro e estima o tempo errado.
 *
 * Nao pedimos permissao de localizacao: o proprio app de mapas usa a
 * posicao atual como origem quando o link traz so o destino.
 */

type Props = { lat: number; lng: number; plusCode: string; rotulo: string };

type Plataforma = "ios" | "android" | "desktop";

function detectarPlataforma(): Plataforma {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function RotaInteligente({ lat, lng, plusCode, rotulo }: Props) {
  const [plataforma, setPlataforma] = useState<Plataforma>("desktop");
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => { setPlataforma(detectarPlataforma()); }, []);

  const destino = `${lat},${lng}`;
  const noCelular = plataforma !== "desktop";

  // travelmode=walking: na ilha o deslocamento e a pe
  const google = `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=walking`;
  const apple = `https://maps.apple.com/?daddr=${destino}&dirflg=w`;
  const waze = `https://waze.com/ul?ll=${destino}&navigate=yes`;
  const osm = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=;${lat},${lng}`;

  const principal = plataforma === "ios" ? apple : google;
  const nomePrincipal = plataforma === "ios" ? "Apple Maps" : "Google Maps";

  async function copiar(texto: string, qual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 2200);
    } catch {
      setCopiado("erro");
      setTimeout(() => setCopiado(null), 2200);
    }
  }

  async function compartilhar() {
    const texto = `${rotulo}\nPlus Code: ${plusCode}\n${google}`;
    // Web Share API: no celular abre a folha nativa de compartilhamento
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await (navigator as any).share({ title: rotulo, text: texto, url: google }); return; } catch { /* cancelou */ }
    }
    copiar(texto, "compartilhar");
  }

  return (
    <div className="space-y-3">
      <a
        href={principal}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 w-full bg-marca hover:bg-marca-hover text-marca-texto px-5 py-3.5 rounded-marca font-semibold transition-marca"
      >
        <span aria-hidden>🧭</span>
        Traçar rota a pé até a pousada
      </a>

      <p className="text-xs text-tinta-suave text-center leading-relaxed">
        {noCelular
          ? `Abre o ${nomePrincipal} com a rota a pé a partir de onde você estiver.`
          : "Abre o Google Maps com a rota a pé. No celular, abre direto o app de mapas."}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {plataforma !== "ios" && (
          <Secundario href={waze} icone="🚗">Waze</Secundario>
        )}
        {plataforma === "ios" && (
          <Secundario href={google} icone="🗺️">Google Maps</Secundario>
        )}
        <Secundario href={osm} icone="🌍">OpenStreetMap</Secundario>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          onClick={() => copiar(plusCode, "pluscode")}
          className="flex-1 flex items-center justify-center gap-2 border border-linha bg-white hover:bg-areia text-tinta px-4 py-2.5 rounded-marca text-sm font-medium transition-marca"
        >
          <span aria-hidden>📋</span>
          {copiado === "pluscode" ? "Plus Code copiado" : `Copiar Plus Code`}
        </button>
        <button
          type="button"
          onClick={compartilhar}
          className="flex-1 flex items-center justify-center gap-2 border border-linha bg-white hover:bg-areia text-tinta px-4 py-2.5 rounded-marca text-sm font-medium transition-marca"
        >
          <span aria-hidden>📤</span>
          {copiado === "compartilhar" ? "Copiado" : "Enviar para alguém"}
        </button>
      </div>

      {copiado === "erro" && (
        <p className="text-xs text-red-700 text-center">
          Não consegui copiar. O Plus Code é <strong>{plusCode}</strong>.
        </p>
      )}

      <p className="text-[11px] text-tinta-suave/80 leading-relaxed pt-1">
        <strong>Dica:</strong> o sinal de internet em Encantadas é irregular. Copie o Plus Code{" "}
        <span className="font-mono text-tinta">{plusCode}</span> e cole na busca do Google Maps —
        ele funciona mesmo com o mapa já baixado, sem precisar de conexão.
      </p>
    </div>
  );
}

function Secundario({ href, icone, children }: { href: string; icone: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 border border-linha bg-white hover:bg-areia text-tinta px-3 py-2.5 rounded-marca text-sm font-medium transition-marca"
    >
      <span aria-hidden>{icone}</span>
      {children}
    </a>
  );
}
