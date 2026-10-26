"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, Hotel, LayoutGrid,
  LockKeyhole, Search, ShieldCheck, Waves, RefreshCw, Database, CircleAlert,
  CalendarCheck2, Users, Wallet, SlidersHorizontal, X, Phone, Mail,
} from "lucide-react";
import type { DadosMapaReservas, ReservaReal, SituacaoReserva } from "@/lib/reservas-dados";

const PALAVRAS: Record<SituacaoReserva, string> = {
  confirmada: "Confirmada", hospedado: "Hospedado", pendente: "Pendente",
  cancelada: "Cancelada", concluida: "Concluída",
};
const COR: Record<SituacaoReserva, string> = {
  confirmada: "bg-[#c9ebe1] text-[#085c55] border-[#b7dcd1]",
  hospedado: "bg-[#b8d5f5] text-[#174d82] border-[#9ec7f3]",
  pendente: "bg-[#ffecd0] text-[#955a16] border-[#f5dfb9]",
  cancelada: "bg-[#f7d8d7] text-[#8a3434] border-[#edc8c6]",
  concluida: "bg-[#e5e6eb] text-[#4f5664] border-[#d8dbe3]",
};
const classesBranco = "rounded-2xl border border-[#e8eeee] bg-white shadow-[0_8px_28px_-19px_rgba(15,45,51,.16)]";
const diasDaSemana = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

function dataMais(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function dataLonga(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
}
function mesAno(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
}
function moeda(v: number | null) {
  return v == null ? "Não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function diasReserva(r: ReservaReal) {
  return Math.max(0, Math.round((Date.parse(r.checkOut) - Date.parse(r.checkIn)) / 86400000));
}

function Detalhe({ reserva, fechar }: { reserva: ReservaReal; fechar: () => void }) {
  const informacoes = [
    ["Número", reserva.codigo], ["Titular", reserva.titular], ["Suíte", reserva.quarto],
    ["Entrada", dataLonga(reserva.checkIn)], ["Saída", dataLonga(reserva.checkOut)],
    ["Diárias", String(diasReserva(reserva))], ["Adultos", reserva.adultos == null ? "—" : String(reserva.adultos)],
    ["Crianças", reserva.criancas == null ? "—" : String(reserva.criancas)],
    ["Canal", reserva.canal || "Não informado"],
    ["Valor contratado", moeda(reserva.valorTotal)], ["Valor pago", moeda(reserva.valorPago)],
    ["Saldo", reserva.valorTotal !== null && reserva.valorPago !== null ? moeda(reserva.valorTotal - reserva.valorPago) : "Não informado"],
    ["Telefone", reserva.telefone || "Não informado"], ["E-mail", reserva.email || "Não informado"],
    ["Observações", reserva.observacoes || "Nenhuma"],
  ];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reserva-titulo" className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b2b32]/55 p-0 sm:items-center sm:p-6" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={"inline-flex rounded-full border px-3 py-1 text-xs font-semibold " + COR[reserva.situacao]}>{PALAVRAS[reserva.situacao]}</span>
            <h2 id="reserva-titulo" className="mt-3 text-2xl font-bold text-[#14363d]">Reserva {reserva.codigo}</h2>
            <p className="mt-1 text-sm text-slate-500">Detalhes registrados pelo sistema de origem</p>
          </div>
          <button type="button" aria-label="Fechar detalhes" onClick={fechar} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {informacoes.map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0 rounded-xl bg-[#f6f9f8] px-4 py-3">
              <dt className="mb-1 text-xs font-medium text-slate-500">{rotulo}</dt>
              <dd className="break-words text-sm font-semibold text-[#24434a]">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14}/> Informações restritas à administração.</p>
      </div>
    </div>
  );
}

export function MapaReservas({ dados, hoje }: { dados: DadosMapaReservas; hoje: string }) {
  const router = useRouter();
  const [inicio, setInicio] = useState(hoje);
  const [totalDias, setTotalDias] = useState(14);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todas");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const conectado = dados.fonte === "conectado";
  const dias = useMemo(() => Array.from({ length: totalDias }, (_, i) => dataMais(inicio, i)), [inicio, totalDias]);
  const reservasVisiveis = useMemo(() => dados.reservas.filter((r) => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (situacao === "todas" || situacao === r.situacao) &&
      (!termo || [r.titular, r.codigo, r.quarto, r.canal || ""].some((x) => x.toLocaleLowerCase("pt-BR").includes(termo)));
  }), [dados.reservas, busca, situacao]);
  const quartoVisiveis = useMemo(() => (dados.quartos || []).filter((q) => {
    if (!busca.trim()) return true;
    const termo = busca.toLocaleLowerCase("pt-BR").trim();
    return q.nome.toLocaleLowerCase("pt-BR").includes(termo) || reservasVisiveis.some((r) => r.quartoId === q.id);
  }), [dados.quartos, reservasVisiveis, busca]);
  const detalhes = dados.reservas.find((r) => r.id === selecionada) || null;

  function doQuarto(r: ReservaReal, id: string) {
    return r.quartoId === id && r.situacao !== "cancelada";
  }
  const confirmado = dados.reservas.filter((r) => r.situacao === "confirmada" || r.situacao === "hospedado");
  const saldo = dados.reservas.reduce((total, r) => total + (r.valorTotal ?? 0), 0);
  const inicioMes = mesAno(inicio);
  const ultimoDia = dias.at(-1) || inicio;
  return (
    <div className="min-h-screen bg-[#f6f9f9] text-[#18363d]">
      <div className="border-b border-[#dbe9e8] bg-white">
        <header className="mx-auto flex max-w-[1560px] items-center justify-between gap-3 px-4 py-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#157a74] text-white"><Waves size={23}/></span>
            <div><h1 className="text-[15px] font-bold leading-tight tracking-wide sm:text-lg">MARIMAR <span className="font-medium text-[#6e9190]">/ Reservas</span></h1><p className="text-[11px] text-slate-500">Encantadas · Ilha do Mel</p></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-2 rounded-full bg-[#ecf7f4] px-3 py-2 text-xs font-semibold text-[#147971] sm:inline-flex"><ShieldCheck size={14}/> Área privada</span>
            <span className="hidden text-sm font-semibold text-[#30565a] sm:inline">Cecília</span>
            <form method="post" action="/reservas/sair">
              <button type="submit" className="rounded-xl border border-[#e0e8e8] px-4 py-2.5 text-xs font-semibold text-[#2e5a60] transition hover:bg-[#f0f6f5]">Sair <span aria-hidden="true">↗</span></button>
            </form>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-[1560px] space-y-6 px-4 pb-16 pt-8 sm:px-7 lg:px-10">
        <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.17em] text-[#16827a]"><LayoutGrid size={15}/> Gestão de hospedagens</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#113840] sm:text-4xl">Mapa de reservas</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#6c8288]">Acompanhe as acomodações e consulte o calendário de ocupação da pousada em um único lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={"inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold " + (conectado ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800")}>
              <span className={"h-2 w-2 rounded-full " + (conectado ? "bg-emerald-500" : "bg-amber-500")} />
              {conectado ? "Fonte de reservas conectada" : "Aguardando integração do Desbravador"}
            </div>
            <button type="button" onClick={() => router.refresh()} className="flex items-center gap-2 rounded-xl border border-[#dbe6e5] bg-white px-4 py-2.5 text-xs font-semibold text-[#275b5c] hover:bg-slate-50"><RefreshCw size={15}/> Atualizar</button>
          </div>
        </section>

        {!conectado && (
          <section role="status" className="flex flex-col gap-4 rounded-2xl border border-[#f2dfb8] bg-[#fffbef] px-5 py-5 sm:flex-row sm:items-start sm:gap-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff1c9] text-[#946020]"><CircleAlert size={23}/></span>
            <div className="flex-1">
              <h3 className="font-bold text-[#795016]">A fonte de reservas identificadas ainda não está conectada</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#7d6845]">
                A integração atual com o Desbravador informa tarifas e disponibilidade, mas não disponibiliza nomes dos hóspedes,
                reservas confirmadas ou pagamentos. Por segurança, o calendário abaixo não interpreta dias sem registros como dias livres.
                A conexão de leitura ao ROL/PMS poderá alimentar este painel sem alterar reservas existentes.
              </p>
              <p className="mt-2 text-xs font-medium text-[#8e7142]">Fonte necessária: {dados.sistema}</p>
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { titulo: "Reservas ativas", valor: conectado ? String(confirmado.length) : "—", desc: conectado ? "Confirmadas e hospedadas" : "Dados ainda não conectados", Icon: CalendarCheck2 },
            { titulo: "Hóspedes previstos", valor: conectado ? String(confirmado.reduce((n, r) => n + (r.adultos ?? 0) + (r.criancas ?? 0), 0)) : "—", desc: "Para o período consultado", Icon: Users },
            { titulo: "Valor das reservas", valor: conectado ? moeda(saldo) : "—", desc: "Total informado pela origem", Icon: Wallet },
            { titulo: "Suítes cadastradas", valor: dados.quartos === null ? "—" : String(dados.quartos.length), desc: "Catálogo da Marimar", Icon: Hotel },
          ].map(({ titulo, valor, desc, Icon }) => (
            <div key={titulo} className={classesBranco + " p-4 sm:p-5"}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#6a8589]">{titulo}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef7f4] text-[#147a72]"><Icon size={18}/></span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-[#133841] sm:text-3xl">{valor}</p>
              <p className="mt-1 text-[11px] text-[#8b9a9e]">{desc}</p>
            </div>
          ))}
        </section>

        <section className={classesBranco + " overflow-hidden"}>
          <div className="flex flex-col gap-4 border-b border-[#e9efef] px-4 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
            <div><h3 className="flex items-center gap-2 text-lg font-bold text-[#133a40]"><CalendarDays size={19} className="text-[#188078]"/> Calendário de ocupação</h3><p className="mt-1 text-xs text-[#8b9b9f]">Organizado por suíte e data de hospedagem</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setInicio(hoje)} className="rounded-lg border border-[#dfe9e8] px-3 py-2 text-xs font-semibold text-[#24645e] hover:bg-[#f4f9f8]">Hoje</button>
              <div className="flex items-center gap-1 rounded-lg border border-[#dfe9e8] bg-[#f9fbfa] p-1">
                <button type="button" aria-label="Período anterior" onClick={() => setInicio(dataMais(inicio, -totalDias))} className="rounded-md p-1.5 hover:bg-white"><ChevronLeft size={18}/></button>
                <span className="min-w-[125px] px-1 text-center text-xs font-semibold capitalize text-[#28585d]">{inicioMes}</span>
                <button type="button" aria-label="Próximo período" onClick={() => setInicio(dataMais(inicio, totalDias))} className="rounded-md p-1.5 hover:bg-white"><ChevronRight size={18}/></button>
              </div>
              <select aria-label="Dias visíveis" value={totalDias} onChange={(e) => setTotalDias(Number(e.target.value))}
                className="rounded-lg border border-[#dfe9e8] bg-white px-2 py-2 text-xs font-semibold text-[#32666a]">
                <option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#eef1f1] px-4 py-3 text-[11px] text-[#71888c] sm:px-6">
            {[
              ["bg-[#c9ebe1]", "Confirmada"], ["bg-[#b8d5f5]", "Hospedado"],
              ["bg-[#ffecd0]", "Pendente"], ["bg-[#e6ebed]", "Sem informação"],
            ].map(([cor, nome]) => <span key={nome} className="inline-flex items-center gap-2"><span className={"h-3 w-3 rounded-sm " + cor}/>{nome}</span>)}
            <span className="ml-auto hidden font-medium text-[#96a4a6] sm:inline">{dataLonga(inicio)} a {dataLonga(ultimoDia)}</span>
          </div>
          {dados.erroCatalogo ? (
            <div className="px-6 py-16 text-center text-sm text-red-700">Não foi possível acessar o catálogo de suítes. Tente atualizar a página.</div>
          ) : quartoVisiveis.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">Nenhuma suíte corresponde ao filtro aplicado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-max min-w-full border-separate border-spacing-0 text-left" aria-label="Mapa de quartos por dia">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 min-w-[152px] border-b border-r border-[#e5eeee] bg-[#f6faf9] px-4 py-3 text-xs font-semibold text-[#275056] sm:min-w-[192px]">Acomodação</th>
                    {dias.map((dia) => {
                      const d = new Date(dia + "T12:00:00Z"), fimDeSemana = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                      return <th key={dia} className={"min-w-[64px] border-b border-r border-[#e5eeee] px-1 py-3 text-center " + (dia === hoje ? "bg-[#e3f4ed]" : fimDeSemana ? "bg-[#f3f7f6]" : "bg-[#f9fbfa]")}>
                        <span className="block text-[10px] font-medium text-[#90a0a2]">{diasDaSemana[d.getUTCDay()]}</span>
                        <span className={"mt-1 block text-sm font-bold " + (dia === hoje ? "text-[#147a72]" : "text-[#365960]")}>{d.getUTCDate()}</span>
                      </th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {quartoVisiveis.map((q) => (
                    <tr key={q.id}>
                      <th scope="row" className="sticky left-0 z-10 border-b border-r border-[#e8f0ef] bg-white px-4 py-3">
                        <span className="block max-w-[155px] truncate text-xs font-bold text-[#254a4f]">{q.nome}</span>
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-normal text-[#92a0a1]"><Users size={11}/> Até {q.capacidade} hóspedes</span>
                      </th>
                      {dias.map((dia) => {
                        const reserva = reservasVisiveis.find((r) => doQuarto(r, q.id) && r.checkIn <= dia && r.checkOut > dia);
                        return <td key={dia} className={"h-[62px] min-w-[64px] border-b border-r border-[#ebf0ef] p-1 " + (dia === hoje ? "bg-[#f5fcf9]" : "bg-white")}>
                          {reserva ? (
                            <button type="button" onClick={() => setSelecionada(reserva.id)}
                              title={reserva.codigo + " · " + reserva.titular + " · " + PALAVRAS[reserva.situacao]}
                              className={"flex h-10 w-full items-center justify-center overflow-hidden rounded-lg border px-1 text-center text-[10px] font-bold transition hover:ring-2 hover:ring-[#19827d]/30 " + COR[reserva.situacao]}>
                              {reserva.checkIn === dia || dia === inicio ? reserva.titular.split(" ")[0] : "●"}
                            </button>
                          ) : (
                            <span title={conectado ? "Sem reserva registrada nesta fonte (não garante vaga livre)" : "Ocupação desconhecida: fonte de reservas não conectada"} className="flex h-10 items-center justify-center rounded-lg border border-dashed border-[#f0f1f0] bg-[#fafbfa] text-xs text-[#cbd3d2]">·</span>
                          )}
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-start gap-2 bg-[#fbfcfc] px-5 py-3 text-[11px] leading-relaxed text-[#819398]">
            <Clock3 size={15} className="shrink-0"/> O mapa mostra reservas confirmadas apenas quando há fonte autorizada de registros; células vazias não comprovam disponibilidade.
          </div>
        </section>

        <section className={classesBranco + " overflow-hidden"}>
          <div className="flex flex-col gap-4 border-b border-[#e8efee] p-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
            <div><h3 className="text-lg font-bold text-[#143a41]">Registros de reservas</h3><p className="mt-1 text-xs text-[#8b9da0]">Busque por hóspede, código, suíte ou canal de venda</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9fa1]"/>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar registros…" aria-label="Pesquisar reservas" className="w-full rounded-xl border border-[#dce7e6] bg-[#fcfefe] py-2.5 pl-10 pr-3 text-sm text-[#305c63] outline-none focus:border-[#16827a] sm:w-[240px]"/>
              </label>
              <label className="relative block"><SlidersHorizontal size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8e9fa1]"/>
                <select value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Filtrar situação" className="w-full appearance-none rounded-xl border border-[#dce7e6] bg-white py-2.5 pl-9 pr-7 text-sm text-[#305c63] sm:w-auto">
                  <option value="todas">Todas as situações</option>
                  {Object.entries(PALAVRAS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
          </div>

          {reservasVisiveis.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf6f3] text-[#16827a]"><Database size={30}/></span>
              <h4 className="mt-5 text-lg font-bold text-[#29494e]">{conectado ? "Nenhuma reserva encontrada" : "Aguardando os registros do Desbravador"}</h4>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#88999c]">
                {conectado ? "Altere os filtros para consultar outros registros." :
                  "O painel está preparado para mostrar titulares, datas, suítes, valores, pagamentos e situação de cada reserva assim que a integração administrativa de leitura for conectada."}
              </p>
              {!conectado && <span className="mt-5 rounded-full bg-[#f6f7f7] px-4 py-2 text-xs font-semibold text-[#657a7e]">Nenhuma reserva fictícia foi inserida</span>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[850px] w-full text-left text-sm">
                <thead className="bg-[#f6faf9] text-[11px] uppercase tracking-wide text-[#83989a]">
                  <tr>{["Reserva","Hóspede","Suíte","Entrada","Saída","Valor","Situação"].map(x=><th className="px-5 py-3" key={x}>{x}</th>)}</tr>
                </thead>
                <tbody>{reservasVisiveis.map(r=> <tr key={r.id} className="border-t border-[#edf1f1] hover:bg-[#fbfdfd]">
                  <td className="px-5 py-4"><button type="button" onClick={()=>setSelecionada(r.id)} className="font-bold text-[#127e78] hover:underline">{r.codigo}</button></td>
                  <td className="px-5 py-4 font-semibold text-[#294b50]">{r.titular}</td><td className="px-5 py-4">{r.quarto}</td>
                  <td className="px-5 py-4">{dataLonga(r.checkIn)}</td><td className="px-5 py-4">{dataLonga(r.checkOut)}</td>
                  <td className="px-5 py-4 font-semibold">{moeda(r.valorTotal)}</td>
                  <td className="px-5 py-4"><span className={"inline-flex rounded-full border px-2 py-1 text-xs font-semibold " + COR[r.situacao]}>{PALAVRAS[r.situacao]}</span></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="flex flex-col items-start justify-between gap-3 pt-3 text-xs text-[#9aaaac] sm:flex-row">
          <span className="flex items-center gap-2"><LockKeyhole size={14}/> Acesso privado • Somente leitura • Sem ações de alteração ou cancelamento</span>
          <span>Atualização da página: {new Date(dados.consultadoEm).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</span>
        </footer>
      </main>
      {detalhes && <Detalhe reserva={detalhes} fechar={() => setSelecionada(null)}/>}
    </div>
  );
}
