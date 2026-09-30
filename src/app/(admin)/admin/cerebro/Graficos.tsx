"use client";

import { useEffect, useRef, useState } from "react";
import type { Area, Ligacao, Ponto } from "@/lib/cerebro";

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

const CURTO: Record<string, string> = {
  pousada: "A pousada", quartos: "Quartos", politicas: "Políticas", checkin: "Check-in", pagamentos: "Pagamentos",
  ilha: "Ilha do Mel", passeios: "Passeios", barcos: "Barcos", faq: "Frequentes", geral: "Outros",
};

/* Coordenadas arredondadas: o seno/cosseno do servidor e o do navegador
   diferem na última casa, e isso quebra a hidratação do SVG. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/* No mapa, "Qualquer assunto" vira "Geral": cabe no anel sem encostar nas áreas. */
const rotuloMapa = (s?: { id: string; rotulo: string }) => (s ? (s.id === "geral" ? "Geral" : s.rotulo) : "");

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

/* ── mapa: Marina no centro, áreas em volta, setores da equipe por fora ─ */

export function MapaCerebro({ areas, ligacoes, setores }: { areas: Area[]; ligacoes: Ligacao[]; setores: { id: string; rotulo: string; chamados: number }[] }) {
  const [foco, setFoco] = useState<string | null>(null);
  const L = 480, c = L / 2;
  const max = Math.max(1, ...areas.map((a) => a.total));
  const posArea = new Map(areas.map((a, i) => {
    const ang = -Math.PI / 2 + (i / areas.length) * Math.PI * 2;
    return [a.id, { x: r2(c + Math.cos(ang) * 150), y: r2(c + Math.sin(ang) * 150), ang, r: r2(12 + 15 * Math.sqrt(a.total / max)) }];
  }));
  /* Cada setor fica do lado das áreas que ele mais atende — mas em vagas
     igualmente espaçadas no anel de fora, para os rótulos não se encavalarem. */
  const desejado = setores.map((s, i) => {
    const minhas = ligacoes.filter((l) => l.setor === s.id);
    if (!minhas.length) return { id: s.id, ang: Math.PI / 4 + i };
    const sx = minhas.reduce((t, l) => t + Math.cos(posArea.get(l.area)?.ang ?? 0) * l.peso, 0);
    const sy = minhas.reduce((t, l) => t + Math.sin(posArea.get(l.area)?.ang ?? 0) * l.peso, 0);
    return { id: s.id, ang: Math.atan2(sy, sx) };
  }).sort((a, b) => a.ang - b.ang);
  /* Vagas: os vãos ENTRE as áreas (nunca em cima de uma). Cada setor pega
     o vão livre mais perto de onde "quer" ficar. */
  const n = Math.max(1, areas.length);
  const vagas = Array.from({ length: n }, (_, k) => -Math.PI / 2 + ((k + 0.5) / n) * Math.PI * 2);
  const livres = new Set(vagas.map((_, k) => k));
  const distAng = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const posSetor = new Map(desejado.map((d) => {
    let melhor = [...livres][0] ?? 0;
    for (const k of livres) if (distAng(vagas[k], d.ang) < distAng(vagas[melhor], d.ang)) melhor = k;
    livres.delete(melhor);
    const ang = vagas[melhor] ?? d.ang;
    const rotulo = rotuloMapa(setores.find((x) => x.id === d.id));
    const meia = Math.max(28, rotulo.length * 3.6 + 8);
    return [d.id, {
      x: r2(Math.min(L - meia - 4, Math.max(meia + 4, c + Math.cos(ang) * 214))),
      y: r2(Math.min(L - 16, Math.max(16, c + Math.sin(ang) * 214))),
    }];
  }));
  const maxLig = Math.max(1, ...ligacoes.map((l) => l.peso));
  const apagado = (ids: string[]) => (foco && !ids.includes(foco) ? 0.18 : 1);
  const areaFoco = areas.find((a) => a.id === foco);

  return (
    <div className="relative">
      {/* Celular: o mesmo mapa em lista — o desenho ficaria com letra de 6 px. */}
      <ul className="space-y-2 sm:hidden">
        {[...areas].sort((a, b) => b.total - a.total).filter((a) => a.total || ligacoes.some((l) => l.area === a.id)).map((a) => (
          <li key={a.id} className="rounded-xl border border-linha/70 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-tinta">{a.rotulo}</span>
              <span className="ml-auto text-sm font-bold tabular-nums text-tinta">{a.total}</span>
            </div>
            <span className="mt-1.5 flex h-2 gap-[2px] overflow-hidden rounded-full bg-areia/50">
              {(["manual", "aprendido", "midias"] as Fonte[]).map((f) => a[f] > 0 && <span key={f} style={{ flexGrow: a[f], background: CORES[f] }} />)}
            </span>
            <span className="mt-1 block text-xs text-tinta-suave">{a.manual} cadastrado(s) · {a.aprendido} aprendido(s) · {a.midias} mídia(s)</span>
            {ligacoes.some((l) => l.area === a.id) && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {ligacoes.filter((l) => l.area === a.id).sort((x, y) => y.peso - x.peso).map((l) => (
                  <span key={l.setor} className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] text-tinta">
                    → {rotuloMapa(setores.find((x) => x.id === l.setor))} · {l.peso}
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${L} ${L}`} className="mx-auto hidden w-full max-w-[520px] sm:block" role="img"
        aria-label={`Mapa do conhecimento: ${areas.filter((a) => a.total).map((a) => `${a.rotulo} ${a.total}`).join(", ")}`}>
        {/* raios Marina → área: espessura pelo volume */}
        {areas.map((a) => { const p = posArea.get(a.id)!; return (
          <line key={a.id} x1={c} y1={c} x2={p.x} y2={p.y} stroke="#cbd5e1" strokeWidth={a.total ? r2(1 + 3 * (a.total / max)) : 1} strokeDasharray={a.total ? undefined : "3 4"} opacity={apagado([a.id])} />
        ); })}
        {/* área → setor da equipe que responde os chamados dela */}
        {ligacoes.map((l) => { const a = posArea.get(l.area), s = posSetor.get(l.setor); if (!a || !s) return null; return (
          <path key={`${l.area}-${l.setor}`} d={`M${a.x},${a.y} Q${r2((a.x + s.x) / 2 + (c - (a.x + s.x) / 2) * 0.25)},${r2((a.y + s.y) / 2 + (c - (a.y + s.y) / 2) * 0.25)} ${s.x},${s.y}`}
            fill="none" stroke={CORES.aprendido} strokeWidth={r2(1 + 3 * (l.peso / maxLig))} strokeOpacity={0.4} opacity={apagado([l.area, l.setor])} />
        ); })}
        {/* centro */}
        <circle cx={c} cy={c} r={30} fill="var(--color-marca, #0f766e)" />
        <text x={c} y={c + 5} textAnchor="middle" className="fill-white text-[15px] font-bold">Marina</text>
        {/* áreas: anel com a composição (cadastrado / aprendido / mídias) */}
        {areas.map((a) => {
          const p = posArea.get(a.id)!;
          const circ = 2 * Math.PI * p.r;
          let desloc = 0;
          const fontes = (["manual", "aprendido", "midias"] as Fonte[]).filter((f) => a[f] > 0);
          return (
            <g key={a.id} opacity={apagado([a.id, ...ligacoes.filter((l) => l.area === a.id).map((l) => l.setor)])}
              onPointerEnter={() => setFoco(a.id)} onPointerLeave={() => setFoco(null)} tabIndex={0} onFocus={() => setFoco(a.id)} onBlur={() => setFoco(null)}
              className="cursor-default outline-none">
              <circle cx={p.x} cy={p.y} r={p.r + 10} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={p.r} fill="white" stroke={a.total ? "none" : "#cbd5e1"} strokeDasharray={a.total ? undefined : "3 3"} />
              {fontes.map((f) => {
                const parte = (a[f] / a.total) * circ;
                const el = <circle key={f} cx={p.x} cy={p.y} r={p.r} fill="none" stroke={CORES[f]} strokeWidth={5}
                  strokeDasharray={`${r2(Math.max(0, parte - 2))} ${r2(circ)}`} strokeDashoffset={r2(-desloc)} transform={`rotate(-90 ${p.x} ${p.y})`} />;
                desloc += parte;
                return el;
              })}
              <text x={p.x} y={p.y + 5} textAnchor="middle" className="fill-tinta text-[14px] font-bold tabular-nums">{a.total}</text>
              {/* Nome do lado de dentro (voltado para a Marina): o lado de fora é dos setores. */}
              <text x={r2(p.x - Math.cos(p.ang) * (p.r + 10))} y={r2(p.y - Math.sin(p.ang) * (p.r + 10) + 4)}
                textAnchor={Math.abs(Math.cos(p.ang)) < 0.3 ? "middle" : Math.cos(p.ang) > 0 ? "end" : "start"}
                className="fill-tinta-suave text-[13px]">{CURTO[a.id] ?? a.rotulo}</text>
            </g>
          );
        })}
        {/* setores da equipe */}
        {setores.map((s) => { const p = posSetor.get(s.id)!; const largura = Math.max(56, rotuloMapa(s).length * 7.2 + 16); return (
          <g key={s.id} opacity={apagado([s.id, ...ligacoes.filter((l) => l.setor === s.id).map((l) => l.area)])}
            onPointerEnter={() => setFoco(s.id)} onPointerLeave={() => setFoco(null)}>
            <rect x={r2(p.x - largura / 2)} y={p.y - 12} width={r2(largura)} height={24} rx={12} fill="#fff7ed" stroke={CORES.aprendido} strokeOpacity={0.6} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" className="fill-tinta text-[12px] font-semibold">{rotuloMapa(s)}</text>
          </g>
        ); })}
      </svg>
      {areaFoco && (
        <div className="pointer-events-none absolute left-2 top-2 hidden sm:block rounded-lg border border-linha bg-white px-3 py-2 text-xs shadow-lg">
          <b className="block text-tinta">{areaFoco.rotulo}</b>
          {(["manual", "aprendido", "midias"] as Fonte[]).map((f) => (
            <span key={f} className="flex items-center gap-1.5 text-tinta-suave"><span className="h-2 w-2 rounded-sm" style={{ background: CORES[f] }} />{ROTULOS[f]}: <b className="text-tinta tabular-nums">{areaFoco[f]}</b></span>
          ))}
          {ligacoes.filter((l) => l.area === areaFoco.id).map((l) => (
            <span key={l.setor} className="block text-tinta-suave">→ {setores.find((s) => s.id === l.setor)?.rotulo}: <b className="text-tinta">{l.peso}</b> chamado(s)</span>
          ))}
        </div>
      )}
    </div>
  );
}
