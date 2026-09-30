import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { fetchTarifas } from "@/lib/worker";
import { PENDENTE_CONFIRMACAO } from "@/lib/conteudo-pousada";
import { lerLeituras } from "@/lib/marina";
import { Pagina, Cabecalho, Cartao, Indicador, Aviso, Selo, Vazio, BotaoLink, quandoFoi } from "@/components/admin/ui";
import { MessageCircleHeart, Inbox, BedDouble, Gift, HelpCircle, Star } from "lucide-react";

export const dynamic = "force-dynamic";

/** Consulta real ao motor de reservas (daqui a 7 dias, 2 noites, 2 adultos). */
async function medirMotor(): Promise<{ ok: boolean; detalhe: string; ms: number }> {
  try {
    const hoje = new Date();
    const ci = new Date(hoje.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const co = new Date(hoje.getTime() + 9 * 86400000).toISOString().slice(0, 10);
    const t0 = Date.now();
    const d = await fetchTarifas(ci, co, 2);
    return { ok: true, ms: Date.now() - t0, detalhe: `${d.total_disponiveis} tipos disponíveis` };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, ms: 0, detalhe: /fetch failed|timeout|aborted/i.test(m) ? "não respondeu a tempo" : m.slice(0, 60) };
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if ((session.user as any).mustReset) redirect("/admin/trocar-senha");

  // ─── Estatísticas ───
  let stats: Record<string, number> = {};
  let leadsRecentes: any[] = [];
  let semFoto = 0;
  let erroBanco = "";
  let marina = { lacunas: 0, itens: 0, whatsapp: null as string | null, conversasHoje: 0 };
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    const [r] = await sql`
      SELECT
        (SELECT count(*) FROM quartos WHERE ativo = true)::int      AS quartos,
        (SELECT count(*) FROM leads WHERE lido = false)::int        AS leads_novos,
        (SELECT count(*) FROM leads)::int                           AS leads_total,
        (SELECT count(*) FROM midias)::int                          AS midias,
        (SELECT count(*) FROM midias WHERE destaque = true AND quarto_id IS NULL AND tipo = 'foto')::int AS hero,
        (SELECT count(*) FROM pacotes WHERE ativo = true)::int      AS pacotes,
        (SELECT count(*) FROM faq WHERE ativo = true)::int          AS faq,
        (SELECT count(*) FROM depoimentos WHERE ativo = true)::int  AS depoimentos
    `;
    stats = r as any;
    leadsRecentes = await sql`SELECT nome, telefone, origem, lido, criado_em FROM leads ORDER BY criado_em DESC LIMIT 5`;
    const [f] = await sql`
      SELECT count(*)::int AS c FROM quartos q
      WHERE q.ativo = true AND NOT EXISTS (SELECT 1 FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto')
    `;
    semFoto = (f as any).c;
    /* A Marina no painel inicial: é o que mais muda no dia a dia. Cada
       consulta isolada — antes da migration 0016 as tabelas não existem. */
    const [lac] = await sql`SELECT count(*)::int AS n FROM marina_lacunas WHERE status = 'aberta'`.catch(() => [{ n: 0 }]);
    const [ens] = await sql`SELECT count(*)::int AS n FROM marina_conhecimento WHERE ativo = true AND excluido_em IS NULL`
      .catch(() => sql`SELECT count(*)::int AS n FROM marina_conhecimento WHERE ativo = true`).catch(() => [{ n: 0 }]);
    const [hoje] = await sql`SELECT count(DISTINCT sessao)::int AS n FROM chat_mensagens WHERE criado_em > now() - interval '24 hours'`.catch(() => [{ n: 0 }]);
    const leituras = await lerLeituras(sql);
    marina = { lacunas: (lac as any).n, itens: (ens as any).n, whatsapp: leituras.whatsapp?.lido_em ?? null, conversasHoje: (hoje as any).n };
    await sql.end();
  } catch (e) {
    erroBanco = (e as Error).message;
  }

  // ─── Motor de reservas, de verdade (antes era "—" hardcoded) ───
  const motor = await medirMotor();

  const avisos: { txt: string; href: string; acao: string }[] = [];
  if (marina.lacunas > 0) avisos.push({ txt: marina.lacunas === 1 ? "A Marina não soube responder 1 pergunta de hóspede." : `A Marina não soube responder ${marina.lacunas} perguntas de hóspedes.`, href: "/admin/marina?aba=sem-resposta", acao: "Ensinar" });
  if (stats.hero === 0) avisos.push({ txt: "Nenhuma foto de destaque para o topo do site — a home está usando uma foto de quarto.", href: "/admin/midias", acao: "Cadastrar foto" });
  if (semFoto > 0) avisos.push({ txt: semFoto === 1 ? "1 quarto ativo está sem nenhuma foto." : `${semFoto} quartos ativos estão sem nenhuma foto.`, href: "/admin/quartos", acao: "Ver quartos" });
  if (!motor.ok) avisos.push({ txt: "O motor de reservas não respondeu. O site fica no ar sem preços.", href: "/admin/diagnostico", acao: "Diagnosticar" });
  if (stats.leads_novos > 0) avisos.push({ txt: stats.leads_novos === 1 ? "1 contato ainda não foi lido." : `${stats.leads_novos} contatos ainda não foram lidos.`, href: "/admin/leads", acao: "Ler agora" });

  const nome = (session.user.name || session.user.email || "").split(" ")[0];
  const hora = new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
  const saudacao = Number(hora) < 12 ? "Bom dia" : Number(hora) < 18 ? "Boa tarde" : "Boa noite";

  return (
    <Pagina larga>
      <Cabecalho sobre="Pousada Marimar" titulo={`${saudacao}${nome ? `, ${nome}` : ""}!`}
        descricao="O resumo do site, das reservas e do atendimento da Marina."
        acoes={<BotaoLink href="/admin/marina?aba=testar" variante="secundario"><MessageCircleHeart className="h-4 w-4" /> Conversar com a Marina</BotaoLink>} />

      {erroBanco && (
        <Aviso tom="erro" titulo="O banco de dados não respondeu." className="mb-6">
          As telas de cadastro podem não abrir agora. Detalhe técnico: {erroBanco}
        </Aviso>
      )}

      {avisos.length > 0 && (
        <Cartao titulo="Precisa da sua atenção" className="mb-6">
          <ul className="space-y-2">
            {avisos.map((a) => (
              <li key={a.txt}>
                <Aviso tom="aviso" acao={<BotaoLink href={a.href} variante="secundario" tamanho="sm">{a.acao}</BotaoLink>}>{a.txt}</Aviso>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Motor de reservas" valor={motor.ok ? "No ar" : "Fora do ar"} tom={motor.ok ? "sucesso" : "erro"}
          detalhe={motor.ok ? `${motor.detalhe} · respondeu em ${(motor.ms / 1000).toFixed(1).replace(".", ",")}s` : motor.detalhe || "sem resposta"} href="/admin/diagnostico" />
        <Indicador rotulo="Marina" valor={`${marina.itens} ${marina.itens === 1 ? "item" : "itens"}`} tom={marina.lacunas ? "aviso" : "sucesso"}
          detalhe={marina.whatsapp ? `WhatsApp leu o treinamento ${quandoFoi(marina.whatsapp)}` : "WhatsApp ainda não leu o treinamento"} href="/admin/marina" />
        <Indicador rotulo="Conversas no site (24h)" valor={marina.conversasHoje} detalhe="pelo chat da Marina" href="/admin/marina?aba=conversas" />
        <Indicador rotulo="Contatos" valor={stats.leads_total ?? 0} tom={stats.leads_novos ? "aviso" : "neutro"}
          detalhe={stats.leads_novos ? `${stats.leads_novos} ${stats.leads_novos === 1 ? "novo" : "novos"} para ler` : "todos lidos"} href="/admin/leads" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Cartao titulo="Últimos contatos" acoes={<BotaoLink href="/admin/leads" variante="fantasma" tamanho="sm">Ver todos</BotaoLink>} semPadding>
          {leadsRecentes.length === 0 ? (
            <div className="p-5"><Vazio icone={<Inbox className="h-6 w-6 text-tinta-suave" />} titulo="Nenhum contato ainda">Quem deixar contato pelo site ou pela Marina aparece aqui.</Vazio></div>
          ) : (
            <ul className="divide-y divide-linha/60 px-5 pb-2 pt-2">
              {leadsRecentes.map((l: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-tinta">{l.nome}</p>
                    <p className="truncate text-xs text-tinta-suave">{l.telefone || "sem telefone"} · {l.origem} · {quandoFoi(l.criado_em)}</p>
                  </div>
                  <Selo tom={l.lido ? "neutro" : "info"} ponto>{l.lido ? "lido" : "novo"}</Selo>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <div className="space-y-6">
          <Cartao titulo="No ar no site">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/admin/quartos", rotulo: "Quartos", n: stats.quartos, I: BedDouble },
                { href: "/admin/pacotes", rotulo: "Pacotes", n: stats.pacotes, I: Gift },
                { href: "/admin/faq", rotulo: "Perguntas", n: stats.faq, I: HelpCircle },
                { href: "/admin/depoimentos", rotulo: "Depoimentos", n: stats.depoimentos, I: Star },
              ].map(({ href, rotulo, n, I }) => (
                <a key={href} href={href} className="flex items-center gap-3 rounded-xl border border-linha/70 p-3 hover:border-marca min-h-14">
                  <I className="h-5 w-5 text-marca" />
                  <span><span className="block text-lg font-bold leading-none tabular-nums text-tinta">{n ?? 0}</span><span className="text-xs text-tinta-suave">{rotulo}</span></span>
                </a>
              ))}
            </div>
          </Cartao>
          <Cartao titulo="A confirmar com a pousada" descricao="O site ainda não publica isto porque depende de confirmação.">
            <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {PENDENTE_CONFIRMACAO.map((p) => (
                <li key={p} className="flex gap-2 text-xs leading-relaxed text-tinta-suave"><span className="text-amber-500" aria-hidden>•</span>{p}</li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>
    </Pagina>
  );
}
