import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import postgres from "postgres";
import { fetchTarifas } from "@/lib/worker";
import { PENDENTE_CONFIRMACAO } from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if ((session.user as any).mustReset) redirect("/admin/trocar-senha");

  // ─── Estatísticas ───
  let stats: Record<string, number> = {};
  let leadsRecentes: any[] = [];
  let semFoto = 0;
  let erroBanco = "";
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    const [r] = await sql`
      SELECT
        (SELECT count(*) FROM quartos WHERE ativo = true)::int      AS quartos,
        (SELECT count(*) FROM leads WHERE lido = false)::int        AS leads_novos,
        (SELECT count(*) FROM leads)::int                           AS leads_total,
        (SELECT count(*) FROM midias)::int                          AS midias,
        (SELECT count(*) FROM midias WHERE destaque = true AND quarto_id IS NULL)::int AS hero,
        (SELECT count(*) FROM pacotes WHERE ativo = true)::int      AS pacotes,
        (SELECT count(*) FROM faq WHERE ativo = true)::int          AS faq,
        (SELECT count(*) FROM depoimentos WHERE ativo = true)::int  AS depoimentos
    `;
    stats = r as any;
    leadsRecentes = await sql`SELECT nome, telefone, origem, lido, criado_em FROM leads ORDER BY criado_em DESC LIMIT 5`;
    const [f] = await sql`
      SELECT count(*)::int AS c FROM quartos q
      WHERE q.ativo = true AND NOT EXISTS (SELECT 1 FROM midias m WHERE m.quarto_id = q.id)
    `;
    semFoto = (f as any).c;
    await sql.end();
  } catch (e) {
    erroBanco = (e as Error).message;
  }

  // ─── Motor de reservas, de verdade (antes era "—" hardcoded) ───
  let motor: { ok: boolean; detalhe: string; ms: number } = { ok: false, detalhe: "", ms: 0 };
  try {
    const hoje = new Date();
    const ci = new Date(hoje.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const co = new Date(hoje.getTime() + 9 * 86400000).toISOString().slice(0, 10);
    const t0 = Date.now();
    const d = await fetchTarifas(ci, co, 2);
    motor = { ok: true, ms: Date.now() - t0, detalhe: `${d.total_disponiveis} tipos disponíveis` };
  } catch (e) {
    motor = { ok: false, ms: 0, detalhe: (e as Error).message.slice(0, 60) };
  }

  const avisos: { txt: string; href: string; acao: string }[] = [];
  if (stats.hero === 0) avisos.push({ txt: "Nenhuma foto de destaque para o topo do site — a home está usando uma foto de quarto.", href: "/admin/midias", acao: "Cadastrar foto" });
  if (semFoto > 0) avisos.push({ txt: `${semFoto} quarto(s) ativo(s) sem nenhuma foto cadastrada.`, href: "/admin/quartos", acao: "Ver quartos" });
  if (!motor.ok) avisos.push({ txt: "O motor de reservas não respondeu. O site fica no ar sem preços.", href: "/admin/diagnostico", acao: "Diagnosticar" });
  if (stats.leads_novos > 0) avisos.push({ txt: `${stats.leads_novos} contato(s) ainda não lido(s).`, href: "/admin/leads", acao: "Ler agora" });

  return (
    <div className="p-5 sm:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Painel</h1>
        <p className="text-sm text-gray-500 mt-1">Olá, {session.user.name || session.user.email}.</p>
      </div>

      {erroBanco && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800">
          Banco de dados indisponível: {erroBanco}
        </div>
      )}

      {/* ─── Precisa da sua atenção ─── */}
      {avisos.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Precisa da sua atenção</h2>
          <div className="space-y-2">
            {avisos.map((a) => (
              <div key={a.txt} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-amber-900">{a.txt}</p>
                <Link href={a.href} className="text-xs font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                  {a.acao} →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Status ─── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Status label="Motor de reservas" ok={motor.ok}
            valor={motor.ok ? "Online" : "Offline"}
            detalhe={motor.ok ? `${motor.ms}ms · ${motor.detalhe}` : motor.detalhe} />
          <Status label="Banco de dados" ok={!erroBanco}
            valor={erroBanco ? "Offline" : "Online"}
            detalhe={erroBanco ? "" : `${stats.quartos} quartos ativos`} />
          <Status label="Fotos" ok={stats.midias > 0}
            valor={String(stats.midias ?? 0)}
            detalhe={stats.hero > 0 ? "topo do site definido" : "sem foto de topo"} />
          <Status label="Contatos" ok={true}
            valor={String(stats.leads_total ?? 0)}
            detalhe={stats.leads_novos > 0 ? `${stats.leads_novos} não lidos` : "todos lidos"} />
        </div>
      </section>

      {/* ─── Conteúdo ─── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conteúdo publicado</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Mini href="/admin/quartos" label="Quartos" valor={stats.quartos ?? 0} />
          <Mini href="/admin/pacotes" label="Pacotes" valor={stats.pacotes ?? 0} />
          <Mini href="/admin/faq" label="Perguntas" valor={stats.faq ?? 0} />
          <Mini href="/admin/depoimentos" label="Depoimentos" valor={stats.depoimentos ?? 0} />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ─── Últimos contatos ─── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Últimos contatos</h2>
            <Link href="/admin/leads" className="text-xs text-gray-500 hover:text-gray-900">ver todos →</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {leadsRecentes.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">Nenhum contato recebido ainda.</p>
            ) : leadsRecentes.map((l: any, i: number) => (
              <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{l.nome}</p>
                  <p className="text-xs text-gray-400 truncate">{l.telefone || "sem telefone"} · {l.origem}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full shrink-0 ${l.lido ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700 font-medium"}`}>
                  {l.lido ? "lido" : "novo"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Pendências do briefing ─── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            A confirmar com a administração
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Informações que o site ainda não publica porque dependem de confirmação interna:
            </p>
            <ul className="space-y-1.5 max-h-56 overflow-y-auto">
              {PENDENTE_CONFIRMACAO.map((p) => (
                <li key={p} className="text-xs text-gray-600 flex gap-2 leading-relaxed">
                  <span className="text-amber-500 shrink-0">•</span> {p}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function Status({ label, ok, valor, detalhe }: { label: string; ok: boolean; valor: string; detalhe: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`} />
        <p className="text-xs text-gray-500 truncate">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900">{valor}</p>
      {detalhe && <p className="text-xs text-gray-400 mt-0.5 truncate">{detalhe}</p>}
    </div>
  );
}

function Mini({ href, label, valor }: { href: string; label: string; valor: number }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all">
      <p className="text-2xl font-bold text-gray-900">{valor}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Link>
  );
}
