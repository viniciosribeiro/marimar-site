import { brl } from "@/lib/format";
import type { Travessia } from "@/lib/conteudo-editavel";
import { ATUALIZADO_EM } from "@/lib/conteudo-pousada";

/** Ida, volta e ida e volta da travessia (Admin → Ilha, chegada e eventos), com a data da consulta. */
export function ValoresTravessia({ T }: { T: Travessia }) {
  return (
    <div>
      <dl className="grid max-w-[34rem] grid-cols-3 gap-4 border-y border-sn-linha py-4">
        {([["Ida", T.precos.ida], ["Volta", T.precos.volta], ["Ida e volta", T.precos.idaEVolta]] as const).map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-[0.9rem] text-sn-texto-2">{rotulo}</dt>
            <dd className="mt-0.5 font-titulo text-[1.5rem] leading-tight tabular-nums">{brl(valor)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3">{T.precos.gratuidade} não pagam.</p>
      <p className="mt-2 max-w-[38rem] text-[0.93rem] leading-relaxed text-sn-texto-2">
        Valores consultados em {T.precos.consultadoEm || ATUALIZADO_EM}. Horários e preços são da operadora e podem mudar sem aviso: confira antes de viajar.
      </p>
      {T.site && <a href={T.site} target="_blank" rel="noopener noreferrer" className="sn-link mt-3 inline-flex min-h-11 items-center">Ver horários no site da {T.operadora}</a>}
    </div>
  );
}
