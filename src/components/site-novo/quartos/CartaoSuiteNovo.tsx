import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { brl, tituloQuarto } from "@/lib/format";
import type { WorkerResponse } from "@/lib/worker";
import { acharNoMotor, tarifasDeReferencia, temDiaria } from "../tarifas";
import { linhaCapacidade } from "./preco";
import type { SuiteResumo } from "./dados";

/**
 * Cartão de suíte do site novo: foto inteira, texto FORA da foto, preço
 * embaixo. O preço vem de uma de duas fontes, sempre dita na página:
 *  - `precos` (a consulta das datas da pessoa, na página de outra suíte);
 *  - ou a referência do dia (../tarifas: daqui a uma semana, 2 noites).
 */
export function CartaoSuiteNovo({
  q, sizes, nivel = "h3", consulta = "", adultosReferencia = 2, precos,
}: {
  q: SuiteResumo; sizes: string; nivel?: "h2" | "h3";
  /** Querystring das datas escolhidas, levada para a página da suíte. */
  consulta?: string;
  adultosReferencia?: number;
  precos?: Promise<{ ok: boolean; dados?: WorkerResponse | null }>;
}) {
  const Titulo = nivel;
  const nome = tituloQuarto(q.nome);
  return (
    <Link href={`/quartos/${q.slug}${consulta}`} className="group block rounded-[16px] outline-offset-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-sn-areia">
        {q.foto
          ? <Image src={q.foto} alt={q.foto_alt || nome} fill sizes={sizes} className="object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-[0.95rem] text-sn-texto-2">Fotos em breve</span>}
      </div>
      <Titulo className="sn-h3 mt-3 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{nome}</Titulo>
      <p className="mt-0.5 text-[0.93rem] text-sn-texto-2">{linhaCapacidade(q)}</p>
      <Suspense fallback={<p className="mt-2 text-[0.92rem] text-sn-texto-2">Consultando o preço…</p>}>
        {precos
          ? <PrecoDasDatas codigo={q.desbravador_room_id} precos={precos} />
          : <PrecoReferencia codigo={q.desbravador_room_id} adultos={adultosReferencia} />}
      </Suspense>
    </Link>
  );
}

async function PrecoReferencia({ codigo, adultos }: { codigo: string | null; adultos: number }) {
  const r = codigo ? acharNoMotor(await tarifasDeReferencia(adultos), codigo) : null;
  if (!temDiaria(r)) return <p className="mt-2 text-[0.92rem] text-sn-texto-2">Preço para as suas datas na busca</p>;
  return (
    <p className="mt-2 text-[0.95rem]">
      <span className="font-semibold tabular-nums">{brl(r.diaria)}</span>
      <span className="text-sn-texto-2"> por noite</span>
    </p>
  );
}

async function PrecoDasDatas({ codigo, precos }: { codigo: string | null; precos: Promise<{ ok: boolean; dados?: WorkerResponse | null }> }) {
  const resposta = await precos;
  const r = resposta.ok && codigo ? acharNoMotor(resposta.dados ?? null, codigo) : null;
  if (!r) return <p className="mt-2 text-[0.92rem] text-sn-texto-2">Veja o preço destas datas na suíte</p>;
  if (!r.disponivel) return <p className="mt-2 text-[0.92rem] text-sn-texto-2">Sem vaga nestas datas</p>;
  if (!temDiaria(r)) return <p className="mt-2 text-[0.92rem] text-sn-texto-2">Sem tarifa publicada nestas datas</p>;
  return (
    <p className="mt-2 text-[0.95rem]">
      <span className="font-semibold tabular-nums">{brl(r.diaria)}</span>
      <span className="text-sn-texto-2"> por noite nestas datas</span>
    </p>
  );
}
