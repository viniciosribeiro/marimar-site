"use client";

import { useState } from "react";
import Link from "next/link";
import { Icone } from "./Icone";
import { POLITICAS, CAFE_DA_MANHA } from "@/lib/conteudo-pousada";

type Pacote = { slug: string; nome: string; resumo: string | null };

/**
 * A caixa de busca do topo.
 *
 * As abas existem porque o topo recebe três perguntas diferentes, e antes
 * só respondia a uma. Quem chega decidido quer datas; quem está comparando
 * quer ofertas; e quem já decidiu quer saber horário de check-in e se pode
 * levar o cachorro — e ia procurar isso rolando a página inteira.
 *
 * A aba de datas é a MESMA de antes, com os mesmos campos e a mesma ação:
 * ela manda para /reservar, que consulta o motor. Nada aqui toca nisso.
 */
export function BuscaHome({ pacotes = [] }: { pacotes?: Pacote[] }) {
  const [aba, setAba] = useState<"datas" | "pacotes" | "info">("datas");

  /* No celular os rotulos longos nao cabem lado a lado, e uma fila que rola
     escondendo a terceira aba e uma aba que ninguem acha. Nomes curtos
     abaixo de `sm`; os completos a partir dali. */
  const ABAS = [
    { id: "datas" as const, nome: "Hospedagem", curto: "Datas", icone: "calendario" },
    { id: "pacotes" as const, nome: "Pacotes e ofertas", curto: "Pacotes", icone: "estrela" },
    { id: "info" as const, nome: "Informações importantes", curto: "Informações", icone: "check" },
  ];

  return (
    /* `w-full min-w-0` e o que impede a caixa de crescer ate o conteudo:
       sem isso a fila de abas define a largura, a caixa passa da tela e a
       PAGINA INTEIRA ganha rolagem horizontal — foi o que quebrou no
       celular. */
    <div className="w-full min-w-0 bg-white rounded-marca shadow-2xl max-w-3xl mx-auto overflow-hidden text-left">
      <div className="flex border-b border-linha overflow-x-auto min-w-0">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            aria-pressed={aba === a.id}
            className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-2.5 sm:px-5 py-3 text-xs sm:text-sm font-medium whitespace-nowrap min-w-0 transition-marca ${
              aba === a.id
                ? "bg-marca text-marca-texto"
                : "text-tinta-suave hover:bg-areia"
            }`}
          >
            <span className="shrink-0"><Icone nome={a.icone} tamanho={16} /></span>
            <span className="truncate sm:hidden">{a.curto}</span>
            <span className="hidden sm:inline">{a.nome}</span>
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        {aba === "datas" && (
          <>
            <form action="/reservar" className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <label className="col-span-2 sm:col-span-1">
                <span className="block text-[11px] font-medium text-tinta-suave px-1 mb-1">Check-in</span>
                <input type="date" name="check_in" required
                  className="w-full px-3 py-2.5 rounded-lg border border-linha text-tinta text-sm focus:ring-2 focus:ring-marca outline-none" />
              </label>
              <label className="col-span-2 sm:col-span-1">
                <span className="block text-[11px] font-medium text-tinta-suave px-1 mb-1">Check-out</span>
                <input type="date" name="check_out" required
                  className="w-full px-3 py-2.5 rounded-lg border border-linha text-tinta text-sm focus:ring-2 focus:ring-marca outline-none" />
              </label>
              <label>
                <span className="block text-[11px] font-medium text-tinta-suave px-1 mb-1">Adultos</span>
                <select name="adultos" defaultValue="2"
                  className="w-full px-3 py-2.5 rounded-lg border border-linha text-tinta text-sm focus:ring-2 focus:ring-marca outline-none">
                  <option>1</option><option>2</option><option>3</option><option>4</option>
                </select>
              </label>
              <label>
                <span className="block text-[11px] font-medium text-tinta-suave px-1 mb-1">Crianças</span>
                <select name="criancas" defaultValue="0"
                  className="w-full px-3 py-2.5 rounded-lg border border-linha text-tinta text-sm focus:ring-2 focus:ring-marca outline-none">
                  <option>0</option><option>1</option><option>2</option><option>3</option>
                </select>
              </label>
              <button type="submit"
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 bg-marca hover:bg-marca-hover text-marca-texto px-4 py-2.5 rounded-lg font-semibold transition-marca text-sm self-end">
                <Icone nome="check" tamanho={16} />
                Ver disponibilidade
              </button>
            </form>

            {/* Factual, não promessa: a reserva é feita no sistema da própria
                pousada. "Melhor preço garantido" seria uma garantia que a
                pousada não deu — e o briefing proíbe publicar o que não foi
                confirmado. */}
            <p className="flex items-center justify-center gap-2 text-[11px] text-tinta-suave mt-3 text-center">
              <span className="text-marca shrink-0"><Icone nome="escudo" tamanho={14} /></span>
              <span className="min-w-0">Disponibilidade e tarifas em tempo real, direto com a pousada.</span>
            </p>
          </>
        )}

        {aba === "pacotes" && (
          <div className="py-1">
            {pacotes.length > 0 ? (
              <ul className="divide-y divide-linha">
                {pacotes.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/pacotes/${p.slug}`}
                      className="flex items-center gap-3 py-3 px-1 hover:bg-areia rounded-lg transition-marca">
                      <span className="text-acento shrink-0"><Icone nome="estrela" tamanho={18} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-tinta">{p.nome}</span>
                        {p.resumo && (
                          <span className="block text-xs text-tinta-suave leading-snug line-clamp-1">{p.resumo}</span>
                        )}
                      </span>
                      <span className="ml-auto text-marca shrink-0" aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-tinta-suave px-1 py-3">
                Nenhum pacote publicado no momento. Fale com a pousada para montar a sua estadia.
              </p>
            )}
            <Link href="/pacotes"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:gap-2.5 transition-all mt-2 px-1">
              Ver todos os pacotes <span aria-hidden>→</span>
            </Link>
          </div>
        )}

        {aba === "info" && (
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 py-1 px-1">
            <Info icone="relogio" termo="Check-in e check-out">
              A partir das {POLITICAS.checkIn} · até as {POLITICAS.checkOut}
            </Info>
            <Info icone="cafe" termo="Café da manhã">
              Incluso, {CAFE_DA_MANHA.horario}
            </Info>
            <Info icone="pet" termo="Pets">
              {POLITICAS.petsTexto}
            </Info>
            <Info icone="familia" termo="Crianças">
              {POLITICAS.criancas}
            </Info>
            <div className="sm:col-span-2 pt-1">
              <Link href="/politicas"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca hover:gap-2.5 transition-all">
                Ver todas as políticas <span aria-hidden>→</span>
              </Link>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

function Info({ icone, termo, children }: { icone: string; termo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="text-marca shrink-0 mt-0.5"><Icone nome={icone} tamanho={17} /></span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-tinta">{termo}</dt>
        <dd className="text-xs text-tinta-suave leading-snug">{children}</dd>
      </div>
    </div>
  );
}
