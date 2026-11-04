/**
 * A linha da travessia — a assinatura do site novo (docs/plano-site-novo.md §4):
 * do continente à porta da pousada, parada por parada, com as ondas no trecho
 * de barco. Desenha-se ao rolar (novo.css: .sn-linha / .sn-parada), parada
 * com quem pediu menos movimento. Usada sobre fundo escuro (texto branco).
 *
 * Computador: as paradas lado a lado e uma linha só, do centro da primeira ao
 * centro da última. Celular: uma embaixo da outra, um trecho entre cada par.
 */
export type Parada = { titulo: string; texto: string; onda?: boolean; fim?: boolean };

/** O desenho da linha do computador para N paradas (viewBox 1000×24), com ondas no trecho que sai da parada marcada. */
export function caminhoDaLinha(n: number, ondaEm: number): string {
  if (n < 2) return "M0 12 H1000";
  const x = (i: number) => Math.round((i * 1000) / (n - 1));
  if (ondaEm < 0 || ondaEm > n - 2) return "M0 12 H1000";
  const a = x(ondaEm), b = x(ondaEm + 1), L = b - a;
  const p = (f: number) => Math.round(a + f * L);
  return `M0 12 H${a} C${p(0.111)} 12 ${p(0.141)} 3 ${p(0.231)} 3 S${p(0.35)} 21 ${p(0.44)} 21 S${p(0.56)} 3 ${p(0.65)} 3 S${p(0.77)} 21 ${p(0.86)} 21 S${p(0.95)} 12 ${b} 12 H1000`;
}

export function LinhaTravessia({ paradas, nivel = "h3", className = "" }: { paradas: Parada[]; nivel?: "h2" | "h3"; className?: string }) {
  const n = paradas.length;
  const Titulo = nivel;
  const colunas = n === 3 ? "lg:grid-cols-3" : n === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  const margem = 50 / n;
  return (
    <ol className={`relative grid gap-9 lg:gap-x-0 lg:gap-y-6 ${colunas} ${className}`}>
      {/* Largura explícita: num <svg> absoluto o navegador ignora o "right" e usaria a largura do desenho (1000 px). */}
      <svg aria-hidden className="sn-linha pointer-events-none absolute top-[11px] hidden h-6 lg:block" viewBox="0 0 1000 24" preserveAspectRatio="none"
        style={{ left: `${margem}%`, width: `${100 - 2 * margem}%` }}>
        <path pathLength={1} d={caminhoDaLinha(n, paradas.findIndex((p) => p.onda))}
          fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      {paradas.map((parada, i) => (
        <li key={parada.titulo} className="relative pl-12 lg:px-4 lg:pt-12 lg:text-center">
          {/* Linha do celular: um trecho até a próxima parada. */}
          {i < n - 1 && (
            <svg aria-hidden className="sn-linha pointer-events-none absolute left-[11px] top-7 h-[calc(100%+0.75rem)] w-6 lg:hidden" viewBox="0 0 24 100" preserveAspectRatio="none">
              <path pathLength={1} d={parada.onda ? "M12 0 C12 10 3 15 3 25 S21 40 21 50 S3 65 3 75 S12 90 12 100" : "M12 0 V100"}
                fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          <span aria-hidden className={`sn-parada absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full lg:left-1/2 lg:-translate-x-1/2 ${parada.fim ? "bg-white ring-4 ring-white/20" : "border-2 border-white/80 bg-sn-mar"}`}>
            <span className={`h-2 w-2 rounded-full ${parada.fim ? "bg-sn-mar" : "bg-white/80"}`} />
          </span>
          <Titulo className="sn-h3 text-white">{parada.titulo}</Titulo>
          <p className={`mt-1.5 text-[0.97rem] leading-relaxed text-white/75 lg:mx-auto ${n >= 4 ? "lg:max-w-[15rem]" : "lg:max-w-[20rem]"}`}>{parada.texto}</p>
        </li>
      ))}
    </ol>
  );
}
