"use client";

import { useEffect, useRef, useState } from "react";
import type { Area, Ponto } from "@/lib/cerebro";

/*
 * Gráficos do Cérebro da Marina. Três fontes de conhecimento, cores fixas
 * por fonte (nunca pela posição): manual = azul, aprendido = laranja,
 * mídias e roteiros = verde-água. Paleta validada (validate_palette.js,
 * modo claro — o painel não tem tema escuro): o verde-água fica abaixo de
 * 3:1 contra o fundo, por isso todo valor também aparece escrito.
 */
export const CORES = { manual: "#2a78d6", aprendido: "#eb6834", midias: "#1baf7a" } as const;
export const ROTULOS = { manual: "Cadastrado", aprendido: "Aprendido com a equipe", midias: "Mídias e roteiros" } as const;
type Fonte = keyof typeof CORES;




function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

export function Legenda({ fontes = ["manual", "aprendido", "midias"] as Fonte[] }: { fontes?: Fonte[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
      {fontes.map((f) => (
        <li key={f} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CORES[f] }} aria-hidden />{ROTULOS[f]}
        </li>
      ))}
    </ul>
  );
}

/* ── áreas: barras empilhadas horizontais ───────────────────────── */

export function BarrasAreas({ areas }: { areas: Area[] }) {
  const max = Math.max(1, ...areas.map((a) => a.total));
  const [foco, setFoco] = useState<string | null>(null);
  const ordenadas = [...areas].sort((a, b) => b.total - a.total);
  return (
    <div>
      <Legenda />
      <ul className="mt-4 space-y-2.5">
        {ordenadas.map((a) => (
          <li key={a.id} className="relative grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 sm:grid-cols-[9rem_1fr_2.5rem]"
            onPointerEnter={() => setFoco(a.id)} onPointerLeave={() => setFoco(null)} onFocus={() => setFoco(a.id)} onBlur={() => setFoco(null)} tabIndex={0}
            aria-label={`${a.rotulo}: ${a.manual} cadastrados, ${a.aprendido} aprendidos, ${a.midias} mídias`}>
            <span className="truncate text-sm text-tinta">{a.rotulo}</span>
            <span className="flex h-3.5 items-stretch gap-[2px] overflow-hidden rounded-r-[4px] bg-areia/40" style={{ width: `${Math.max(a.total / max * 100, a.total ? 2 : 0)}%` }}>
              {(["manual", "aprendido", "midias"] as Fonte[]).map((f) => a[f] > 0 && (
                <span key={f} style={{ flexGrow: a[f], background: CORES[f], opacity: foco && foco !== a.id ? 0.45 : 1 }} className="min-w-[3px] transition-opacity" />
              ))}
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-tinta">{a.total}</span>
            {foco === a.id && a.total > 0 && (
              <span className="pointer-events-none absolute -top-2 left-28 z-10 -translate-y-full rounded-lg border border-linha bg-white px-3 py-2 text-xs shadow-lg sm:left-40">
                <b className="block text-tinta">{a.rotulo}</b>
                {(["manual", "aprendido", "midias"] as Fonte[]).map((f) => (
                  <span key={f} className="flex items-center gap-1.5 text-tinta-suave"><span className="h-2 w-2 rounded-sm" style={{ background: CORES[f] }} />{ROTULOS[f]}: <b className="text-tinta tabular-nums">{a[f]}</b></span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── taxa de resolução sozinha, no tempo ────────────────────────── */

export function LinhaTaxa({ serie }: { serie: Ponto[] }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const altura = 200, m = { t: 12, r: 12, b: 26, l: 38 };
  const w = Math.max(0, largura - m.l - m.r), h = altura - m.t - m.b;
  const x = (i: number) => m.l + (serie.length <= 1 ? w / 2 : (i / (serie.length - 1)) * w);
  const y = (v: number) => m.t + h - v * h;
  /* Linha com buracos onde não houve pergunta nenhuma (taxa indefinida). */
  const trechos: string[] = [];
  let atual = "";
  serie.forEach((p, i) => {
    if (p.taxa === null) { if (atual) trechos.push(atual); atual = ""; return; }
    atual += `${atual ? "L" : "M"}${x(i).toFixed(1)},${y(p.taxa).toFixed(1)}`;
  });
  if (atual) trechos.push(atual);
  const passoRotulo = Math.max(1, Math.ceil(serie.length / Math.max(2, Math.floor(w / 56))));
  const temDado = serie.some((p) => p.taxa !== null);

  return (
    <div ref={ref} className="relative">
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Taxa de perguntas novas que a Marina resolveu sozinha, por período"
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - r.left - m.l;
            setFoco(Math.max(0, Math.min(serie.length - 1, Math.round((px / Math.max(1, w)) * (serie.length - 1)))));
          }}
          onPointerLeave={() => setFoco(null)}>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-linha" strokeDasharray={v === 0 ? undefined : "2 4"} />
              <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="fill-tinta-suave text-[11px] tabular-nums">{v * 100}%</text>
            </g>
          ))}
          {serie.map((p, i) => i % passoRotulo === 0 && (
            <text key={i} x={x(i)} y={altura - 6} textAnchor="middle" className="fill-tinta-suave text-[11px]">{p.rotulo}</text>
          ))}
          {trechos.map((d, i) => <path key={i} d={d} fill="none" stroke={CORES.manual} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
          {serie.map((p, i) => p.taxa !== null && (
            <circle key={i} cx={x(i)} cy={y(p.taxa)} r={foco === i ? 5 : 3.5} fill={CORES.manual} stroke="white" strokeWidth={2} />
          ))}
          {foco !== null && <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={m.t + h} stroke="currentColor" className="text-tinta-suave/40" />}
        </svg>
      )}
      {!temDado && (
        <p className="absolute inset-0 flex items-center justify-center text-center text-sm text-tinta-suave">
          Ainda sem perguntas novas neste período.<br />A linha aparece quando ela usar algo aprendido ou chamar a equipe.
        </p>
      )}
      {foco !== null && largura > 0 && (
        <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-linha bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(0, x(foco) - 80), largura - 170), width: 160 }}>
          <b className="block text-tinta">{serie[foco].rotulo}</b>
          <span className="block text-tinta-suave">Resolveu sozinha: <b className="text-tinta">{serie[foco].taxa === null ? "—" : `${Math.round(serie[foco].taxa! * 100)}%`}</b></span>
          <span className="block text-tinta-suave">Com o aprendido: <b className="text-tinta tabular-nums">{serie[foco].sozinha}</b></span>
          <span className="block text-tinta-suave">Foi à equipe: <b className="text-tinta tabular-nums">{serie[foco].escaladas}</b></span>
          {serie[foco].lacunas > 0 && <span className="block text-tinta-suave">Ficou sem resposta: <b className="text-tinta tabular-nums">{serie[foco].lacunas}</b></span>}
        </div>
      )}
    </div>
  );
}
