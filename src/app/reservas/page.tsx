import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CalendarDays, LockKeyhole, ShieldCheck, Waves, ArrowRight, KeyRound, AlertCircle } from "lucide-react";
import { COOKIE_RESERVAS, loginConfigurado, sessaoValida } from "@/lib/reservas-acesso";
import { carregarMapaReservas } from "@/lib/reservas-dados";
import { MapaReservas } from "./MapaReservas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Central de Reservas | Pousada Marimar",
  robots: { index: false, follow: false, nocache: true },
};

function hojeSaoPaulo(): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const v = (k: string) => p.find((x) => x.type === k)?.value || "";
  return v("year") + "-" + v("month") + "-" + v("day");
}

export default async function ReservasPage({
  searchParams,
}: { searchParams: Promise<{ erro?: string }> }) {
  const autenticado = sessaoValida((await cookies()).get(COOKIE_RESERVAS)?.value);
  if (autenticado) {
    const dados = await carregarMapaReservas();
    return <MapaReservas dados={dados} hoje={hojeSaoPaulo()} />;
  }

  const erro = (await searchParams).erro;
  const configurado = loginConfigurado();
  return (
    <div className="min-h-screen bg-[#f5f8f8] text-[#20383d] lg:grid lg:grid-cols-2">
      <aside className="relative isolate hidden min-h-screen overflow-hidden bg-[#102e37] px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-28 h-[470px] w-[470px] rounded-full border-[75px] border-[#8dd8c6]/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-52 bottom-6 h-[430px] w-[430px] rounded-full bg-[#087e7e]/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#247f82]"><Waves size={25}/></span>
          <div><p className="text-lg font-bold tracking-tight">MARIMAR</p><p className="text-xs tracking-[.22em] text-[#a8d3cc]">ILHA DO MEL</p></div>
        </div>
        <div className="relative max-w-lg">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-widest text-[#bfece2]">
            <ShieldCheck size={15}/> ÁREA PRIVATIVA
          </span>
          <h1 className="text-5xl font-bold leading-[1.15] tracking-tight xl:text-6xl">Uma visão clara de cada hospedagem.</h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-[#c1d4d4]">
            Calendário de ocupação, organização das suítes e detalhes das reservas, em um espaço reservado à equipe.
          </p>
          <div className="mt-10 flex items-center gap-4 border-t border-white/20 pt-7 text-sm text-[#c4dfd9]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><CalendarDays size={21}/></span>
            Controle de reservas • Visualização somente leitura
          </div>
        </div>
        <p className="relative text-xs text-white/45">Pousada Marimar · Encantadas, Paranaguá/PR</p>
      </aside>
      <main className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#147b76] text-white"><Waves size={24}/></span>
            <div><p className="text-lg font-bold">Pousada Marimar</p><p className="text-xs text-slate-500">Central de reservas</p></div>
          </div>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#e7f4f1] px-3 py-1.5 text-xs font-semibold text-[#147b76]">
            <LockKeyhole size={14}/> Acesso protegido
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-[#142f38]">Bem-vinda, Cecília.</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Entre para abrir o mapa privado de reservas da pousada.</p>
          {erro && <p role="alert" className="mt-6 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="shrink-0"/>
            {erro === "limite" ? "Muitas tentativas. Tente novamente em alguns minutos." :
              erro === "configuracao" ? "O acesso ainda não foi configurado no servidor." : "Usuário ou senha incorretos."}
          </p>}
          {!configurado && <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Configuração de acesso pendente. Entre em contato com a administração técnica.
          </p>}
          <form action="/reservas/entrar" method="post" className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#365157]">Usuário</span>
              <input autoComplete="username" name="usuario" required maxLength={100} placeholder="Digite seu usuário"
                className="w-full rounded-xl border border-[#dbe5e5] bg-white px-4 py-3.5 text-base outline-none transition focus:border-[#147b76] focus:ring-4 focus:ring-[#147b76]/10" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#365157]">Senha</span>
              <input type="password" autoComplete="current-password" name="senha" required maxLength={128} placeholder="Digite sua senha"
                className="w-full rounded-xl border border-[#dbe5e5] bg-white px-4 py-3.5 text-base outline-none transition focus:border-[#147b76] focus:ring-4 focus:ring-[#147b76]/10" />
            </label>
            <button type="submit" disabled={!configurado}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#147b76] px-5 py-4 font-semibold text-white shadow-lg shadow-[#147b76]/15 transition hover:bg-[#116a66] disabled:cursor-not-allowed disabled:opacity-50">
              Entrar na central <ArrowRight size={18}/>
            </button>
          </form>
          <div className="mt-8 flex items-start gap-3 rounded-xl bg-white p-4 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200">
            <KeyRound size={18} className="shrink-0 text-[#147b76]"/>
            Os registros dos hóspedes são privados. Sua sessão usa conexão segura e expira automaticamente.
          </div>
          <p className="mt-7 text-center text-xs text-slate-400">Acesso exclusivo da administração da Pousada Marimar</p>
        </div>
      </main>
    </div>
  );
}
