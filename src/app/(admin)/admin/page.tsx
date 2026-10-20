import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { fetchTarifas } from "@/lib/worker";
import { statusWhatsapp } from "@/lib/envio-whatsapp";
import { faltandoMeta } from "@/lib/whatsapp-meta-base";
import { PENDENTE_CONFIRMACAO } from "@/lib/conteudo-pousada";
import { lerLeituras } from "@/lib/marina";
import { Pagina, Cabecalho, Cartao, Aviso, Vazio, BotaoLink, quandoFoi, cn } from "@/components/admin/ui";
import {
  MessageCircleHeart, BedDouble, Gift, HelpCircle, Star, GraduationCap, ImageIcon, FlaskConical, Sparkles, ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * "Hoje" — a primeira tela da Central (fase 1 do estudo do painel,
 * docs/estudo-painel-central.md). Junta numa lista só tudo o que espera
 * alguém, que antes ficava espalhado em quatro telas, e diz se o motor, a
 * Marina e o WhatsApp estão funcionando.
 */

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
    return { ok: false, ms: 0, detalhe: /fetch failed|timeout|aborted|não respondeu/i.test(m) ? "não respondeu a tempo" : m.slice(0, 60) };
  }
}

/** O WhatsApp da pousada, sem deixar a tela esperar mais de 4 s. */
async function medirWhatsapp(): Promise<Awaited<ReturnType<typeof statusWhatsapp>>> {
  const limite = new Promise<{ sabe: boolean; conectado: null; resumo: string }>((r) =>
    setTimeout(() => r({ sabe: false, conectado: null, resumo: "não respondeu a tempo" }), 4000));
  return Promise.race([statusWhatsapp().catch(() => ({ sabe: false, conectado: null, resumo: "não deu para consultar" })), limite]);
}

type Tom = "erro" | "aviso" | "marca" | "info" | "neutro";
type Pendencia = { tom: Tom; titulo: string; detalhe: string; href: string; acao: string };
const COR_TOM: Record<Tom, string> = {
  erro: "bg-red-500 shadow-[0_0_10px_rgb(239_68_68)]",
  aviso: "bg-amber-500 shadow-[0_0_10px_rgb(245_158_11)]",
  marca: "bg-marca shadow-[0_0_10px_var(--marca)]",
  info: "bg-sky-500 shadow-[0_0_10px_rgb(14_165_233)]",
  neutro: "bg-slate-400",
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios.replace("#", String(n)));

export default async function HojePage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if ((session.user as any).mustReset) redirect("/admin/trocar-senha");
  const tecnico = (session.user as { role?: string }).role === "master";

  let stats: Record<string, number> = {};
  let naoLidos: any[] = [];
  let chamados: { codigo: string; pergunta: string; canal: string; criado_em: string }[] = [];
  let lacunaRecente: string | null = null;
  let semFoto = 0;
  let erroBanco = "";
  let marina = { lacunas: 0, whatsapp: null as string | null, conversas7: 0, leads7: 0 };
  /* Qual WhatsApp está em uso (Marina → WhatsApp da Marina). Na API oficial
     o WhatsApp Web fica pausado de propósito: não é queda. */
  let modoWhatsapp = "web";
  let cerebro = { aguardando: 0, pendentes: 0, aprendidos: 0, sozinha: 0, escaladas: 0 };
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    const [r] = await sql`
      SELECT
        (SELECT count(*) FROM quartos WHERE ativo = true)::int      AS quartos,
        (SELECT count(*) FROM leads WHERE lido = false)::int        AS leads_novos,
        (SELECT count(*) FROM midias WHERE destaque = true AND quarto_id IS NULL AND tipo = 'foto')::int AS hero,
        (SELECT count(*) FROM pacotes WHERE ativo = true)::int      AS pacotes,
        (SELECT count(*) FROM faq WHERE ativo = true)::int          AS faq,
        (SELECT count(*) FROM depoimentos WHERE ativo = true)::int  AS depoimentos
    `;
    stats = r as any;
    naoLidos = await sql`SELECT nome, origem, criado_em FROM leads WHERE lido = false ORDER BY criado_em DESC LIMIT 3`;
    const [f] = await sql`
      SELECT count(*)::int AS c FROM quartos q
      WHERE q.ativo = true AND NOT EXISTS (SELECT 1 FROM midias m WHERE m.quarto_id = q.id AND m.tipo = 'foto')
    `;
    semFoto = (f as any).c;
    /* Cada consulta isolada: antes das migrations 0016/0019 as tabelas não existem. */
    const [lac] = await sql`SELECT count(*)::int AS n FROM marina_lacunas WHERE status = 'aberta'`.catch(() => [{ n: 0 }]);
    const [ult] = await sql`SELECT pergunta FROM marina_lacunas WHERE status = 'aberta' ORDER BY criado_em DESC LIMIT 1`.catch(() => [null]);
    lacunaRecente = (ult as any)?.pergunta ?? null;
    const [c7] = await sql`SELECT count(DISTINCT sessao)::int AS n FROM chat_mensagens WHERE criado_em > now() - interval '7 days'`.catch(() => [{ n: 0 }]);
    const [l7] = await sql`SELECT count(*)::int AS n FROM leads WHERE criado_em > now() - interval '7 days'`.catch(() => [{ n: 0 }]);
    const leituras = await lerLeituras(sql);
    marina = { lacunas: (lac as any).n, whatsapp: leituras.whatsapp?.lido_em ?? null, conversas7: (c7 as any).n, leads7: (l7 as any).n };
    const [esc] = await sql<{ whatsapp_modo: string }[]>`SELECT whatsapp_modo FROM marina_escalonamento_config WHERE id = 1`.catch(() => []);
    if (esc?.whatsapp_modo === "oficial") modoWhatsapp = "oficial";
    chamados = await sql<typeof chamados>`SELECT codigo, pergunta, canal, criado_em FROM marina_chamados WHERE status = 'aguardando' ORDER BY criado_em LIMIT 4`.catch(() => []);
    const [cb] = await sql`
      SELECT (SELECT count(*) FROM marina_chamados WHERE status = 'aguardando')::int AS aguardando,
             (SELECT count(*) FROM marina_aprendizado WHERE status = 'pendente')::int AS pendentes,
             (SELECT count(*) FROM marina_aprendizado WHERE status = 'ativo')::int AS aprendidos,
             (SELECT count(*) FROM marina_eventos WHERE tipo = 'aprendido_usado' AND criado_em > now() - interval '30 days')::int AS sozinha,
             (SELECT count(*) FROM marina_eventos WHERE tipo IN ('escalada', 'lacuna') AND criado_em > now() - interval '30 days')::int AS escaladas`
      .catch(() => [cerebro]);
    cerebro = cb as typeof cerebro;
    await sql.end();
  } catch (e) {
    erroBanco = (e as Error).message;
  }

  const oficial = modoWhatsapp === "oficial";
  const semChavesMeta = faltandoMeta();
  const [motor, whatsapp] = await Promise.all([
    medirMotor(),
    oficial
      ? Promise.resolve({ sabe: true, conectado: semChavesMeta.length === 0, resumo: "API oficial da Meta", queda: null })
      : medirWhatsapp(),
  ]);

  /* ─── Precisa de você: do mais urgente ao menos ─── */
  const pendencias: Pendencia[] = [];
  if (whatsapp.sabe && whatsapp.conectado === false) {
    const q = whatsapp.queda;
    pendencias.push({
      tom: "erro", titulo: "A Marina está fora do WhatsApp: ninguém recebe resposta",
      detalhe: oficial
        ? `A forma em uso é a API oficial da Meta, mas faltam na Vercel: ${semChavesMeta.join(", ")}.`
        : q ? `${q.motivo}${q.desde ? ` (${quandoFoi(new Date(q.desde))})` : ""}. ${q.fazer}.` : "O WhatsApp da pousada está desconectado no servidor da Marina.",
      href: tecnico ? "/admin/whatsapp" : "/admin", acao: tecnico ? "Religar" : "Avisar o Vinicios",
    });
  }
  for (const c of chamados) {
    pendencias.push({
      tom: "aviso", titulo: `#${c.codigo} · “${String(c.pergunta).slice(0, 80)}”`,
      detalhe: `${c.canal === "site" ? "Cliente do site" : "Cliente no WhatsApp"} · esperando a equipe desde ${quandoFoi(c.criado_em)}`,
      href: "/admin/equipe?aba=chamados", acao: "Responder",
    });
  }
  if (cerebro.aguardando > chamados.length) {
    const resto = cerebro.aguardando - chamados.length;
    pendencias.push({ tom: "aviso", titulo: plural(resto, "Mais 1 cliente esperando a equipe", "Mais # clientes esperando a equipe"), detalhe: "Chamados abertos", href: "/admin/equipe?aba=chamados", acao: "Ver todos" });
  }
  if (!motor.ok) pendencias.push({ tom: "erro", titulo: "O motor de reservas não respondeu", detalhe: "O site fica no ar, mas sem preços e vagas até ele voltar.", href: tecnico ? "/admin/diagnostico" : "/admin", acao: tecnico ? "Diagnosticar" : "Avisar o Vinicios" });
  if (marina.lacunas > 0) pendencias.push({
    tom: "erro", titulo: plural(marina.lacunas, "A Marina não soube responder 1 pergunta", "A Marina não soube responder # perguntas"),
    detalhe: lacunaRecente ? `Última: “${lacunaRecente.slice(0, 80)}”` : "Perguntas de hóspedes sem resposta",
    href: "/admin/marina?aba=sem-resposta", acao: "Ensinar",
  });
  if (cerebro.pendentes > 0) pendencias.push({
    tom: "marca", titulo: plural(cerebro.pendentes, "1 resposta nova espera sua aprovação", "# respostas novas esperam sua aprovação"),
    detalhe: "A equipe respondeu pelo WhatsApp e a Marina quer guardar", href: "/admin/marina?aba=aprendizado", acao: "Aprovar",
  });
  for (const l of naoLidos) {
    pendencias.push({ tom: "info", titulo: `${l.nome || "Contato sem nome"} deixou contato`, detalhe: `${l.origem || "site"} · ${quandoFoi(l.criado_em)}`, href: "/admin/leads", acao: "Abrir" });
  }
  if ((stats.leads_novos ?? 0) > naoLidos.length) {
    pendencias.push({ tom: "info", titulo: plural(stats.leads_novos - naoLidos.length, "Mais 1 contato para ler", "Mais # contatos para ler"), detalhe: "Contatos recebidos", href: "/admin/leads", acao: "Ver todos" });
  }
  if (stats.hero === 0) pendencias.push({ tom: "neutro", titulo: "O topo do site está sem foto de destaque", detalhe: "A página inicial está usando uma foto de quarto", href: "/admin/banners", acao: "Escolher foto" });
  if (semFoto > 0) pendencias.push({ tom: "neutro", titulo: plural(semFoto, "1 suíte está sem foto", "# suítes estão sem foto"), detalhe: "Aparecem no site sem imagem", href: "/admin/quartos", acao: "Ver suítes" });

  const nome = (session.user.name || session.user.email || "").split(" ")[0];
  const hora = new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
  const saudacao = Number(hora) < 12 ? "Bom dia" : Number(hora) < 18 ? "Boa tarde" : "Boa noite";
  const resolveu = cerebro.sozinha + cerebro.escaladas ? `${Math.round((cerebro.sozinha / (cerebro.sozinha + cerebro.escaladas)) * 100)}%` : "—";

  const semaforo: { ok: boolean | null; nome: string; detalhe: string }[] = [
    { ok: motor.ok, nome: "Motor de reservas", detalhe: motor.ok ? `respondeu em ${(motor.ms / 1000).toFixed(1).replace(".", ",")} s` : motor.detalhe || "sem resposta" },
    { ok: whatsapp.sabe ? whatsapp.conectado : null, nome: "WhatsApp da pousada", detalhe: oficial ? (whatsapp.conectado ? "API oficial da Meta" : "API oficial sem chaves") : whatsapp.sabe ? (whatsapp.conectado ? "conectado" : "desconectado") : whatsapp.resumo },
    whatsapp.sabe && whatsapp.conectado === false
      ? { ok: false, nome: "Marina no WhatsApp", detalhe: "fora do ar: não recebe nem responde" }
      : { ok: marina.whatsapp ? true : null, nome: "Marina no WhatsApp", detalhe: marina.whatsapp ? `leu o treinamento ${quandoFoi(marina.whatsapp)}` : "ainda não leu o treinamento" },
    { ok: !erroBanco, nome: "Banco de dados", detalhe: erroBanco ? "não respondeu" : "funcionando" },
  ];

  return (
    <Pagina larga>
      <Cabecalho sobre="Hoje" titulo={`${saudacao}${nome ? `, ${nome}` : ""}!`}
        descricao={pendencias.length ? "Tudo o que espera alguém, do mais urgente ao menos." : "Nada esperando você agora."}
        acoes={<BotaoLink href="/admin/marina?aba=testar" variante="secundario"><MessageCircleHeart className="h-4 w-4" /> Conversar com a Marina</BotaoLink>} />

      {erroBanco && (
        <Aviso tom="erro" titulo="O banco de dados não respondeu." className="mb-6">
          As telas de cadastro podem não abrir agora. Detalhe técnico: {erroBanco}
        </Aviso>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Cartao titulo={<span className="flex items-center gap-2">Precisa de você {pendencias.length > 0 && <span className="rounded-full bg-marca-suave px-2 text-xs font-bold leading-5 text-marca-escura">{pendencias.length}</span>}</span>} semPadding>
          {pendencias.length === 0 ? (
            <div className="p-5"><Vazio icone={<Sparkles className="h-6 w-6 text-marca" />} titulo="Tudo em dia">Quando um cliente esperar a equipe, a Marina não souber algo ou chegar um contato, aparece aqui.</Vazio></div>
          ) : (
            <ul className="mt-3 divide-y divide-tinta/[0.07]">
              {pendencias.map((p, i) => (
                <li key={i}>
                  <Link href={p.href} className="group flex min-h-16 items-center gap-3 px-5 py-3 transition-colors hover:bg-white/45">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-[3px] ring-white/70", COR_TOM[p.tom])} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-tinta">{p.titulo}</span>
                      <span className="block truncate text-xs text-tinta-suave">{p.detalhe}</span>
                    </span>
                    <span className="hidden shrink-0 rounded-full border border-white/80 bg-white/60 px-3 py-1 text-xs font-semibold text-tinta sm:inline">{p.acao}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-tinta-suave sm:hidden" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <div className="space-y-5">
          <Cartao titulo="Atalhos">
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: "/admin/marina?aba=conhecimento&novo=1", t: "Ensinar a Marina", d: "Algo que ela ainda não sabe", I: GraduationCap },
                { href: "/admin/banners", t: "Trocar foto do topo", d: "Página inicial do site", I: ImageIcon },
                { href: "/admin/pacotes?novo=1", t: "Criar oferta", d: "Pacote com datas e preço", I: Gift },
                { href: "/admin/marina?aba=testar", t: "Testar a Marina", d: "Pergunte como um hóspede", I: FlaskConical },
              ].map(({ href, t, d, I }) => (
                <Link key={href} href={href}
                  className="group flex min-h-[4.5rem] flex-col justify-center gap-0.5 rounded-[1.25rem] border border-white/80 bg-white/55 p-3 shadow-[inset_0_1px_0_#fff] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[.98]">
                  <span className="flex items-center gap-2 text-sm font-semibold text-tinta"><I className="h-4 w-4 shrink-0 text-marca" />{t}</span>
                  <span className="text-xs text-tinta-suave">{d}</span>
                </Link>
              ))}
            </div>
          </Cartao>

          <Cartao titulo="Está tudo funcionando?" acoes={tecnico ? <BotaoLink href="/admin/diagnostico" variante="fantasma" tamanho="sm">Diagnóstico</BotaoLink> : undefined}>
            <ul className="space-y-2.5">
              {semaforo.map((s) => (
                <li key={s.nome} className="flex items-center gap-3 text-sm">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full",
                    s.ok === true ? "bg-emerald-500 shadow-[0_0_10px_rgb(16_185_129)]" : s.ok === false ? "bg-red-500 shadow-[0_0_10px_rgb(239_68_68)]" : "bg-amber-400 shadow-[0_0_10px_rgb(251_191_36)]")} aria-hidden />
                  <span className="font-medium text-tinta">{s.nome}</span>
                  <span className="ml-auto truncate pl-2 text-right text-xs text-tinta-suave">{s.detalhe}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [resolveu, "perguntas que a Marina resolveu sozinha (30 dias)"],
          [cerebro.aprendidos, "respostas aprendidas com a equipe, em uso"],
          [marina.conversas7, "conversas no chat do site (7 dias)"],
          [marina.leads7, "contatos novos (7 dias)"],
        ].map(([v, r]) => (
          <div key={r as string} className="vidro rounded-[1.4rem] p-4">
            <p className="font-titulo text-2xl font-bold tabular-nums text-tinta">{v}</p>
            <p className="text-xs text-tinta-suave">{r}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Cartao titulo="No ar no site">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: "/admin/quartos", rotulo: "Suítes", n: stats.quartos, I: BedDouble },
              { href: "/admin/pacotes", rotulo: "Pacotes", n: stats.pacotes, I: Gift },
              { href: "/admin/faq", rotulo: "Perguntas", n: stats.faq, I: HelpCircle },
              { href: "/admin/depoimentos", rotulo: "Depoimentos", n: stats.depoimentos, I: Star },
            ].map(({ href, rotulo, n, I }) => (
              <Link key={href} href={href} className="flex min-h-14 items-center gap-3 rounded-[1.1rem] border border-white/80 bg-white/50 p-3 hover:bg-white/75">
                <I className="h-5 w-5 text-marca" />
                <span><span className="block text-lg font-bold leading-none tabular-nums text-tinta">{n ?? 0}</span><span className="text-xs text-tinta-suave">{rotulo}</span></span>
              </Link>
            ))}
          </div>
        </Cartao>
        <Cartao titulo="A confirmar com a pousada" descricao="O site ainda não publica isto porque depende de confirmação.">
          <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {PENDENTE_CONFIRMACAO.map((p) => (
              <li key={p} className="flex gap-2 text-xs leading-relaxed text-tinta-suave"><span className="text-amber-500" aria-hidden>•</span>{p}</li>
            ))}
          </ul>
        </Cartao>
      </div>
    </Pagina>
  );
}
