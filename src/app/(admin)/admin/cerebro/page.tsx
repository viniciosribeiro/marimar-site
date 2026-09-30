import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { lerCerebro } from "@/lib/cerebro";
import { rotuloCategoria } from "@/lib/marina-base";
import { Pagina, Cabecalho, Cartao, Aviso, Indicador, Selo, Vazio, cn, quandoFoi } from "@/components/admin/ui";
import { BarrasAreas, LinhaTaxa, MapaCerebro, Legenda } from "./Graficos";

export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90] as const;
const CANAIS = [["todos", "Todos os canais"], ["site", "Chat do site"], ["whatsapp", "WhatsApp"]] as const;

const plural = (n: number, p: string) => `${n} ${n === 1 ? p : p + "s"}`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const duracao = (min: number | null) => (min === null ? "—" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`);

/**
 * Cérebro da Marina: o que ela sabe, o que está aprendendo e quanto já
 * resolve sozinha. Filtros por período e canal na URL (?dias=30&canal=site).
 */
export default async function CerebroPage({ searchParams }: { searchParams: Promise<{ dias?: string; canal?: string }> }) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias) as 7) ? Number(sp.dias) : 30;
  const canal = (["site", "whatsapp"].includes(sp.canal ?? "") ? sp.canal : "todos") as "todos" | "site" | "whatsapp";

  const d = await comSql((sql) => lerCerebro(sql, { dias, canal })).catch(() => null);
  if (!d) {
    return (
      <Pagina>
        <Cabecalho sobre="Atendimento" titulo="Cérebro da Marina" />
        <Aviso tom="erro" titulo="Não consegui abrir o banco de dados agora.">Recarregue em alguns segundos. Se continuar, rode a migration 0019.</Aviso>
      </Pagina>
    );
  }

  const link = (p: { dias?: number; canal?: string }) => `/admin/cerebro?dias=${p.dias ?? dias}&canal=${p.canal ?? canal}`;
  const totalSabe = d.totais.manual + d.totais.documentos + d.totais.aprendido + d.totais.midias + d.totais.roteiros;
  const delta = d.taxa.periodo !== null && d.taxa.anterior !== null ? Math.round((d.taxa.periodo - d.taxa.anterior) * 100) : null;
  const pendencias = d.revisar.pendentes + d.revisar.vencidos + d.revisar.conflitos;

  return (
    <Pagina larga>
      <Cabecalho sobre="Atendimento" titulo="Cérebro da Marina"
        descricao="Tudo o que ela sabe, de onde veio e como está evoluindo. Cresce quando vocês ensinam no painel e quando a equipe responde o que ela não sabia." />

      {/* filtros: uma linha, acima de tudo */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <nav aria-label="Período" className="flex gap-1 rounded-full border border-linha/80 bg-white p-1 shadow-sm">
          {PERIODOS.map((p) => (
            <Link key={p} href={link({ dias: p })} aria-current={p === dias ? "page" : undefined}
              className={cn("min-h-9 flex-1 rounded-full px-4 py-2 text-center text-sm font-medium sm:flex-none", p === dias ? "bg-marca text-marca-texto" : "text-tinta-suave hover:text-tinta")}>{p} dias</Link>
          ))}
        </nav>
        <nav aria-label="Canal" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 [scrollbar-width:none]">
          {CANAIS.map(([v, r]) => (
            <Link key={v} href={link({ canal: v })} aria-current={v === canal ? "page" : undefined}
              className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium", v === canal ? "border-marca bg-marca/10 text-tinta" : "border-linha bg-white text-tinta-suave hover:text-tinta")}>{r}</Link>
          ))}
        </nav>
      </div>

      {!d.escalonamentoAtivo && (
        <Aviso tom="info" className="mb-6" titulo="O escalonamento está desligado.">
          Sem ele a Marina não pergunta à equipe e não aprende sozinha. Ligue em <Link href="/admin/equipe?aba=config" className="font-semibold underline">Equipe responsável</Link>.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="O que ela sabe" valor={totalSabe} href="/admin/marina?aba=conhecimento"
          detalhe={`${plural(d.totais.manual + d.totais.documentos, "cadastrado")} · ${plural(d.totais.aprendido, "aprendido")} · ${plural(d.totais.midias + d.totais.roteiros, "mídia")}`} />
        <Indicador rotulo={`Resolveu sozinha (${dias} dias)`} valor={pct(d.taxa.periodo)} tom={d.taxa.periodo === null ? "neutro" : d.taxa.periodo >= 0.5 ? "sucesso" : "aviso"}
          detalhe={delta === null ? `${d.taxa.sozinha} com o aprendido · ${d.taxa.escaladas} à equipe` : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} pontos vs. os ${dias} dias anteriores`} />
        <Indicador rotulo="Chamados esperando" valor={d.chamados.abertos} tom={d.chamados.atrasados ? "erro" : d.chamados.abertos ? "aviso" : "sucesso"} href="/admin/equipe?aba=chamados"
          detalhe={d.chamados.atrasados ? plural(d.chamados.atrasados, "atrasado") : `${plural(d.chamados.respondidos, "respondido")} no período`} />
        <Indicador rotulo="Tempo médio da equipe" valor={duracao(d.chamados.tempoMedioMin)} href="/admin/equipe?aba=chamados"
          detalhe={`${plural(d.chamados.total, "chamado")} · ${plural(d.chamados.expirados, "expirado")}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Cartao className="lg:col-span-2" titulo="Mapa do conhecimento"
          descricao="Cada círculo é uma área: o tamanho é o volume e o anel mostra de onde veio. Por fora, os setores da equipe que respondem cada área.">
          <MapaCerebro areas={d.areas} ligacoes={d.ligacoes} setores={d.setores} />
          <div className="mt-3 flex justify-center"><Legenda /></div>
        </Cartao>
        <Cartao titulo="Precisa de você" descricao="O que espera uma decisão.">
          <ul className="divide-y divide-linha/60">
            {[
              { n: d.revisar.pendentes, t: "aprendizados esperando aprovação", href: "/admin/marina?aba=aprendizado", tom: "aviso" as const },
              { n: d.revisar.conflitos, t: "parecidos com algo cadastrado", href: "/admin/marina?aba=aprendizado", tom: "erro" as const },
              { n: d.revisar.vencidos, t: "vencidos (preço, horário, evento)", href: "/admin/marina?aba=aprendizado", tom: "erro" as const },
              { n: d.revisar.naoRevisados, t: "em uso sem ninguém ter revisado", href: "/admin/marina?aba=aprendizado", tom: "info" as const },
              { n: d.chamados.atrasados, t: "chamados atrasados", href: "/admin/equipe?aba=chamados", tom: "erro" as const },
              { n: d.lacunasAbertas, t: "perguntas sem resposta", href: "/admin/marina?aba=sem-resposta", tom: "aviso" as const },
            ].map((x) => (
              <li key={x.t}>
                <Link href={x.href} className="flex min-h-12 items-center gap-3 py-2 hover:bg-areia/30">
                  <span className={cn("flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums",
                    x.n ? { aviso: "bg-amber-100 text-amber-900", erro: "bg-red-100 text-red-800", info: "bg-sky-100 text-sky-900" }[x.tom] : "bg-areia/60 text-tinta-suave")}>{x.n}</span>
                  <span className={cn("text-sm", x.n ? "text-tinta" : "text-tinta-suave")}>{x.t}</span>
                </Link>
              </li>
            ))}
          </ul>
          {pendencias === 0 && d.chamados.atrasados === 0 && <p className="mt-3 text-sm text-emerald-700">✓ Tudo em dia.</p>}
        </Cartao>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Áreas de conhecimento" descricao="Quanto ela sabe de cada assunto, e de onde veio.">
          <BarrasAreas areas={d.areas} />
        </Cartao>
        <Cartao titulo="Resolvendo sozinha, ao longo do tempo"
          descricao="Das perguntas que não estavam no cadastro, quantas ela respondeu com o que aprendeu — em vez de chamar a equipe.">
          <LinhaTaxa serie={d.serie} />
        </Cartao>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Aprendeu por último" acoes={<Link href="/admin/marina?aba=aprendizado" className="text-sm font-medium text-marca hover:underline">Ver todos</Link>}>
          {d.recentes.length === 0 ? <Vazio titulo="Nada aprendido ainda">Aparece aqui quando a equipe responder um chamado.</Vazio> : (
            <ul className="space-y-3">
              {d.recentes.map((a) => (
                <li key={a.id} className="rounded-xl border border-linha/70 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Selo tom={a.status === "ativo" ? "sucesso" : a.status === "oficial" ? "marca" : "aviso"} ponto>{a.status === "ativo" ? "Em uso" : a.status === "oficial" ? "Oficial" : "Para aprovar"}</Selo>
                    <span className="text-xs text-tinta-suave">{rotuloCategoria(a.categoria)} · {quandoFoi(a.criado_em)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-tinta">{a.pergunta}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-tinta-suave">{a.resposta}</p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Perguntas mais frequentes" descricao="Do que ela aprendeu: as que mais voltam.">
          {d.frequentes.length === 0 ? <Vazio titulo="Sem dados ainda" /> : (
            <ol className="space-y-2.5">
              {d.frequentes.map((a, i) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-areia/70 text-xs font-bold text-tinta">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-tinta">{a.pergunta}</span>
                    <span className="block text-xs text-tinta-suave">{a.usos} {a.usos === 1 ? "vez respondida sozinha" : "vezes respondida sozinha"}{a.variacoes.length ? ` · ${a.variacoes.length + 1} jeitos de perguntar` : ""}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Cartao>
        <Cartao titulo="O que mais precisa da equipe" descricao={`Assuntos que ela escalou ou não soube, em ${dias} dias.`}>
          {d.temas.length === 0 ? <Vazio titulo="Nada escalado no período" /> : (
            <ul className="space-y-2.5">
              {d.temas.map((t) => {
                const max = Math.max(...d.temas.map((x) => x.escaladas + x.lacunas));
                const tot = t.escaladas + t.lacunas;
                return (
                  <li key={t.rotulo}>
                    <div className="flex items-baseline justify-between gap-2 text-sm"><span className="text-tinta">{t.rotulo}</span><span className="font-semibold tabular-nums text-tinta">{tot}</span></div>
                    <span className="mt-1 block h-2 overflow-hidden rounded-r-[4px] bg-areia/50" style={{ width: `${(tot / max) * 100}%` }}>
                      <span className="block h-full bg-tinta-suave/60" />
                    </span>
                    <span className="text-xs text-tinta-suave">{t.escaladas} à equipe{t.lacunas ? ` · ${t.lacunas} sem resposta` : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-linha/60 pt-4 text-center">
            {([["Abertos", d.chamados.abertos], ["Respondidos", d.chamados.respondidos], ["Atrasados", d.chamados.atrasados]] as const).map(([r, n]) => (
              <div key={r}><p className="text-xl font-bold tabular-nums text-tinta">{n}</p><p className="text-xs text-tinta-suave">{r}</p></div>
            ))}
          </div>
        </Cartao>
      </div>

      <p className="mt-6 text-xs text-tinta-suave">
        A Marina não aprende sozinha com as conversas: ela aprende com o que vocês cadastram e com as respostas da equipe aos chamados, sempre abaixo do que foi cadastrado à mão.
      </p>
    </Pagina>
  );
}
