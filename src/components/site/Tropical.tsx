/**
 * Elementos tropicais desenhados em SVG: folha de palmeira, onda e o selo
 * da Marimar.
 *
 * São vetores e não imagens de propósito: pesam quase nada, ficam nítidos
 * em qualquer tela (inclusive Retina) e herdam a cor do tema pelo
 * `currentColor` — se a pousada trocar a cor principal no editor visual,
 * as folhas e as ondas acompanham.
 *
 * Decoração pura: todos levam aria-hidden e nenhuma informação vive neles.
 */

/* ─────────────── folha de palmeira ─────────────── */

type Ponto = { x: number; y: number };

/** Ponto e ângulo na curva de Bézier quadrática do talo. */
function naCurva(t: number, a: Ponto, c: Ponto, b: Ponto) {
  const u = 1 - t;
  const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
  const y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
  const dx = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x);
  const dy = 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y);
  return { x, y, ang: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/* Os folíolos são calculados uma vez, no módulo: a folha é sempre a mesma,
   e recalcular a cada renderização seria trabalho à toa. */
const TALO = { a: { x: 12, y: 238 }, c: { x: 70, y: 70 }, b: { x: 236, y: 18 } };
const FOLIOLOS = (() => {
  const lista: { x: number; y: number; rot: number; rx: number; ry: number }[] = [];
  const n = 17;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const p = naCurva(t, TALO.a, TALO.c, TALO.b);
    const tam = 58 * Math.sin(Math.PI * (0.25 + t * 0.7)) + 10; // maiores no meio
    for (const lado of [-1, 1]) {
      const rot = p.ang + lado * (52 - t * 14);
      const rad = (rot * Math.PI) / 180;
      lista.push({
        x: p.x + Math.cos(rad) * (tam / 2),
        y: p.y + Math.sin(rad) * (tam / 2),
        rot,
        rx: tam / 2,
        ry: 4.2 - t * 1.6,
      });
    }
  }
  return lista;
})();

export function FolhaPalmeira({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 250 250" className={`folha-tropical ${className}`} style={style} aria-hidden focusable="false" fill="currentColor">
      <path
        d={`M${TALO.a.x} ${TALO.a.y} Q${TALO.c.x} ${TALO.c.y} ${TALO.b.x} ${TALO.b.y}`}
        fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
      />
      {FOLIOLOS.map((f, i) => (
        <ellipse key={i} cx={f.x} cy={f.y} rx={f.rx} ry={f.ry} transform={`rotate(${f.rot} ${f.x} ${f.y})`} />
      ))}
    </svg>
  );
}

/* ─────────────── onda divisória ─────────────── */

/* Ondas periódicas (período de 720 no eixo x), desenhadas com o dobro da
   largura da tela: deslizar 1440 e recomeçar não deixa costura. */
const ONDA_FRENTE = "M0 52C180 30 540 74 720 52S1260 74 1440 52S1980 74 2160 52S2700 74 2880 52V90H0z";
const ONDA_FUNDO = "M0 38C200 58 520 18 720 38S1240 18 1440 38S1960 18 2160 38S2680 18 2880 38V90H0z";
const ONDA_ESPUMA = "M0 46C180 34 540 58 720 46S1260 58 1440 46S1980 58 2160 46S2700 58 2880 46";

/**
 * Borda ondulada entre duas seções. A cor (`className="text-…"`) deve ser a
 * da seção SEGUINTE: a onda é o começo dela invadindo a anterior.
 *
 * Com "ondas animadas" ligado no editor visual (Identidade visual → Forma),
 * as camadas deslizam em velocidades e sentidos diferentes, como mar. A
 * decisão é do CSS (`html[data-mov-ondas]`), e "reduzir movimento" do
 * aparelho sempre vence.
 */
export function OndaDivisor({ className = "", virada = false }: { className?: string; virada?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={`onda-divisor block w-full h-[38px] sm:h-[56px] lg:h-[72px] ${virada ? "rotate-180" : ""} ${className}`}
      aria-hidden
      focusable="false"
    >
      <path className="onda-camada onda-camada--fundo" fill="currentColor" opacity="0.45" d={ONDA_FUNDO} />
      <path className="onda-camada onda-camada--espuma" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="2" d={ONDA_ESPUMA} />
      <path className="onda-camada onda-camada--frente" fill="currentColor" d={ONDA_FRENTE} />
    </svg>
  );
}

/* ─────────────── gaivotas e sol ─────────────── */

/**
 * Gaivotas cruzando o céu do topo. Três traços em "v", cada uma com o seu
 * atraso e altura. Só aparecem com "elementos decorativos" ligado.
 */
export function Gaivotas({ className = "" }: { className?: string }) {
  return (
    <div className={`gaivotas pointer-events-none ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 40 16" className={`gaivota gaivota--${i}`} focusable="false">
          <path d="M2 10C8 3 14 3 20 10C26 3 32 3 38 10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

/** Sol com raios que giram devagar — decoração do topo e da faixa final. */
export function SolRaios({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={`sol-raios pointer-events-none ${className}`} aria-hidden focusable="false">
      <g className="sol-raios__giro">
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x="97" y="6" width="6" height={i % 2 ? 26 : 38} rx="3" fill="currentColor" opacity={i % 2 ? 0.5 : 0.8}
            transform={`rotate(${i * 22.5} 100 100)`} />
        ))}
      </g>
      <circle cx="100" cy="100" r="44" fill="currentColor" className="sol-raios__nucleo" />
    </svg>
  );
}

/* ─────────────── selo da Marimar ─────────────── */

/**
 * Marca desenhada — sol nascendo atrás de uma palmeira, sobre o mar.
 * Aparece quando a pousada não cadastrou logo (antes era um emoji de ilha,
 * que cada sistema desenha de um jeito).
 */
export function SeloMarimar({ tamanho = 40, claro = false }: { tamanho?: number; claro?: boolean }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden focusable="false" className="selo-marimar shrink-0 overflow-hidden">
      <circle cx="24" cy="24" r="23" className={claro ? "fill-white/15" : "fill-marca"} />
      <circle cx="30" cy="22" r="8" className={`selo-marimar__sol ${claro ? "fill-white/70" : "fill-acento"}`} opacity="0.9" />
      <path className="selo-marimar__mar" d="M6 31c4-2 8-2 12 0s8 2 12 0 8-2 12 0v6a23 23 0 0 1-36 0z" fill="white" opacity="0.9" />
      <path d="M-6 35c4-2 8-2 12 0s8 2 12 0 8-2 12 0 8-2 12 0 8-2 12 0" fill="none" stroke="currentColor"
        className={`selo-marimar__onda ${claro ? "text-white/60" : "text-marca"}`} strokeWidth="1.4" />
      <path d="M20 31c.5-6 1.2-11 3.2-15.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path className="selo-marimar__folhas" d="M23.2 15.5c-3-2.5-7-2.6-10-.4 3.6-.2 6.6.9 8.7 2.9M23.2 15.5c1-3.5 4-5.6 7.8-5.5-2.9 1.1-5 3-6 5.6M23.2 15.5c3.2-.8 6.6.4 8.6 3.2-3-1.1-6-1.2-8.4-.4M23.2 15.5c-2.8-.3-5.6 1.2-7 3.9 2.2-1.6 4.8-2.2 7.2-1.9"
        fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
