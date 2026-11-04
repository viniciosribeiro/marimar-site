"use client";

import { useId, useState } from "react";
import { SeletorDatas } from "@/components/site/SeletorDatas";
import { FormularioBuscaDisponibilidade } from "@/components/site/FormularioBuscaDisponibilidade";
import { rotuloBebes, rotuloCriancas } from "@/lib/regras-hospedagem-base";

/**
 * "Quando você vem?" — a busca do site novo.
 *
 * Por baixo é a MESMA busca do Clássico: o calendário aprovado (SeletorDatas),
 * o formulário que mostra "Buscando suas suítes" e manda para /reservar com
 * check_in, check_out, adultos, criancas e bebes. Muda só a forma: datas e
 * hóspedes em dois toques, com contadores no lugar das listas de números.
 * Limites iguais aos da busca do Clássico (1–4 adultos, 0–3 crianças, 0–2 bebês).
 */
export type BuscaInicial = { checkIn?: string | null; checkOut?: string | null; adultos?: number; criancas?: number; bebes?: number };

export function BuscaNovo({
  regra, className = "", action = "/reservar", titulo = "Quando você vem?", rotuloBotao, espera, inicial, estilo = "flutuante",
  nota = "Preços do sistema de reservas da pousada, na hora. Reserva direta.",
}: {
  regra: { idadeColoMax: number } | null; className?: string;
  /** Para onde a busca vai (padrão: /reservar; a página da suíte manda para ela mesma). */
  action?: string; titulo?: string; rotuloBotao?: string; espera?: { titulo: string; texto: string };
  /** Datas e hóspedes já escolhidos (vindos do endereço). */
  inicial?: BuscaInicial;
  /** flutuante: cartão com sombra (sobre foto); contorno: cartão com borda; plano: só os campos (dentro de outro cartão). */
  estilo?: "flutuante" | "contorno" | "plano"; nota?: string | null;
}) {
  return (
    <FormularioBuscaDisponibilidade action={action} variante="novo" rotuloBotao={rotuloBotao} espera={espera}
      className={`grid grid-cols-2 gap-x-2.5 gap-y-3 text-sn-texto ${CARTAO[estilo]} ${className}`}
      rodape={nota ? <p className="col-span-full -mt-1 text-center text-[0.8rem] leading-snug text-sn-texto-2">{nota}</p> : undefined}>
      <p className="col-span-full font-titulo text-[1.3rem] leading-tight">{titulo}</p>
      <SeletorDatas variante="novo" entradaInicial={inicial?.checkIn} saidaInicial={inicial?.checkOut} />
      <Hospedes regra={regra} inicial={inicial} />
    </FormularioBuscaDisponibilidade>
  );
}

const CARTAO = {
  flutuante: "rounded-[20px] bg-white p-4 sm:p-5 shadow-[0_28px_60px_-28px_rgb(14_42_62/0.55)]",
  contorno: "rounded-[20px] bg-white p-4 sm:p-5 ring-1 ring-sn-linha",
  plano: "",
} as const;

const entre = (n: number | undefined, min: number, max: number, padrao: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;

function Hospedes({ regra, inicial }: { regra: { idadeColoMax: number } | null; inicial?: BuscaInicial }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [adultos, setAdultos] = useState(() => entre(inicial?.adultos, 1, 4, 2));
  const [criancas, setCriancas] = useState(() => entre(inicial?.criancas, 0, 3, 0));
  const [bebes, setBebes] = useState(() => (regra ? entre(inicial?.bebes, 0, 2, 0) : 0));
  const partes = [`${adultos} ${adultos === 1 ? "adulto" : "adultos"}`];
  if (criancas) partes.push(`${criancas} ${criancas === 1 ? "criança" : "crianças"}`);
  if (bebes) partes.push(`${bebes} ${bebes === 1 ? "bebê" : "bebês"}`);

  return (
    <div className="col-span-full min-w-0">
      <span id={`${id}-rotulo`} className="mb-1 block px-0.5 text-[0.8rem] font-medium text-sn-texto-2">Hóspedes</span>
      <button type="button" aria-expanded={aberto} aria-controls={`${id}-painel`} aria-labelledby={`${id}-rotulo ${id}-valor`}
        onClick={() => setAberto((v) => !v)}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-sn-linha bg-white px-3 text-left text-[0.97rem] outline-none focus-visible:ring-2 focus-visible:ring-sn-mare-forte">
        <span id={`${id}-valor`} className="truncate">{partes.join(", ")}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden
          className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {aberto && (
        <div id={`${id}-painel`} role="group" aria-label="Quantas pessoas" className="mt-2 rounded-xl bg-sn-espuma px-3 py-1">
          <Contador rotulo="Adultos" valor={adultos} min={1} max={4} mudar={setAdultos} />
          <Contador rotulo={regra ? rotuloCriancas(regra) : "Crianças"} valor={criancas} min={0} max={3} mudar={setCriancas} />
          {regra && <Contador rotulo={rotuloBebes(regra)} valor={bebes} min={0} max={2} mudar={setBebes} />}
        </div>
      )}
      <input type="hidden" name="adultos" value={adultos} />
      <input type="hidden" name="criancas" value={criancas} />
      {regra && <input type="hidden" name="bebes" value={bebes} />}
    </div>
  );
}

function Contador({ rotulo, valor, min, max, mudar }: {
  rotulo: string; valor: number; min: number; max: number; mudar: (n: number) => void;
}) {
  const botao = "inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[1.3rem] leading-none ring-1 ring-sn-linha disabled:opacity-35";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-sn-linha py-2 last:border-0">
      <span className="text-[0.95rem]">{rotulo}</span>
      <span className="flex items-center gap-3">
        <button type="button" className={botao} onClick={() => mudar(Math.max(min, valor - 1))} disabled={valor <= min} aria-label={`Menos: ${rotulo}`}>−</button>
        <output className="w-5 text-center text-[1.05rem] font-semibold tabular-nums" aria-live="polite">{valor}</output>
        <button type="button" className={botao} onClick={() => mudar(Math.min(max, valor + 1))} disabled={valor >= max} aria-label={`Mais: ${rotulo}`}>+</button>
      </span>
    </div>
  );
}
