import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { fetchTarifas } from "@/lib/worker";
import { datasExemplo } from "@/lib/format";
import { contarDominioAntigo } from "@/lib/dominio-antigo";
import { lerLeituras, type Leitura } from "@/lib/marina";
import { gatewayConfigurado } from "@/lib/chat";
import { chaveDoProvedor, lerOpcoesVoz } from "@/lib/voz";
import { PROVEDOR, type Provedor } from "@/lib/voz-base";
import { ultimaSincronizacao, ultimoErroSincronizacao, type ResumoSincronizacao } from "@/lib/sincronizar-fotos-desbravador";
import { lerMemoria } from "@/lib/whatsapp-vigia";
import { colunasDaMigration0022 } from "@/lib/esquema-midias";
import { MEMORIA_VAZIA, type MemoriaVigia } from "@/lib/whatsapp-saude";
import { Pagina, Cabecalho, Cartao, Indicador, Aviso, Selo, quandoFoi } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Consulta real ao motor. Fora do componente: medir tempo não é trabalho de desenho. */
async function testarMotor() {
  try {
    const t0 = Date.now();
    const { checkIn, checkOut } = datasExemplo();
    const data = await fetchTarifas(checkIn, checkOut, 2);
    return { ok: true as const, ms: Date.now() - t0, data, erro: "" };
  } catch (e) {
    return { ok: false as const, ms: 0, data: null, erro: (e as Error).message };
  }
}

/* Os agendadores: o que roda sozinho e quando rodou pela última vez.
   A Vercel (plano Hobby) chama o agendador uma vez por dia com a
   CRON_SECRET; sem ela, a chamada diária é recusada e só a sincronização
   "de carona" (nas buscas de /reservar) e o botão do painel funcionam.
   Fora do componente porque lê o relógio. */
function listarAgendadores(fotos: { em: Date; resumo: ResumoSincronizacao } | null, vigia: MemoriaVigia, colunas0022: boolean) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const cronOk = cronSecret.length >= 16;
  const diaMs = 24 * 3600_000;
  const agora = Date.now();
  const fotosHa = fotos ? agora - fotos.em.getTime() : null;
  const vigiaHa = vigia.ultimaVez > 0 ? agora - vigia.ultimaVez : null;
  return [
    {
      nome: "Agendador da Vercel (CRON_SECRET)",
      tom: cronOk ? "sucesso" : "neutro",
      valor: cronOk ? "configurado" : "opcional",
      ajuda: cronOk
        ? "a Vercel chama /api/cron/sincronizar-fotos todo dia às 12:00 UTC (9h de Brasília) com a chave e recebe o resumo"
        : "não é obrigatória: a rodada diária da Vercel roda mesmo sem ela, em segundo plano (no máximo 1 vez por hora, como nas buscas). Com a chave, a resposta do agendador traz o resumo",
    },
    {
      nome: "Colunas das fotos (migration 0022)",
      tom: colunas0022 ? "sucesso" : "aviso",
      valor: colunas0022 ? "aplicadas" : "pendentes",
      ajuda: colunas0022
        ? "midias.origem e midias.url_origem existem — o site sabe de onde veio cada foto"
        : "o site aplica sozinho na primeira sincronização ou ao abrir Mídias; nada a fazer",
    },
    {
      nome: "Fotos das suítes sincronizadas com o Desbravador",
      tom: fotosHa === null ? "aviso" : fotosHa < 2 * diaMs ? "sucesso" : "aviso",
      valor: fotos ? quandoFoi(fotos.em) : "nunca",
      ajuda: fotos
        ? `${fotos.resumo.suites_motor} suítes no motor · ${fotos.resumo.fotos_novas} novas · ${fotos.resumo.fotos_removidas} removidas · espelho ${fotos.resumo.espelho === "blob" ? "no Blob" : "desligado (sem BLOB_READ_WRITE_TOKEN)"}${fotos.resumo.suites_criadas.length ? ` · suítes criadas: ${fotos.resumo.suites_criadas.join(", ")}` : ""}${fotos.resumo.avisos.length ? ` · ${fotos.resumo.avisos.length} aviso(s)` : ""}`
        : "ainda não rodou — use o botão “Sincronizar com o Desbravador” em Mídias, ou faça uma busca em /reservar",
    },
    {
      nome: "Vigia do WhatsApp",
      tom: vigiaHa === null ? "aviso" : vigiaHa < diaMs ? "sucesso" : "aviso",
      valor: vigiaHa === null ? "nunca" : quandoFoi(new Date(vigia.ultimaVez)),
      ajuda: vigiaHa === null
        ? "roda em /api/cron/chamados (agendador externo a cada 5 min) e de carona no chat do site"
        : `estado ${vigia.estado}; roda em /api/cron/chamados e de carona no chat do site`,
    },
  ] as const;
}

/**
 * Diagnóstico: o que está ligado e o que não está.
 *
 * É a tela que se abre às pressas quando "o site está sem preço" ou "a
 * Marina parou". Cada verificação é isolada: uma falha não esconde as outras.
 * Nenhuma chave secreta aparece aqui — só se ela existe.
 */
export default async function DiagnosticoPage() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");

  const motor = await testarMotor();

  let antigas: Awaited<ReturnType<typeof contarDominioAntigo>> = { total: 0, porLugar: [] };
  let leituras: Record<string, Leitura> = {};
  let banco = true;
  let voz: { provedor: Provedor; pronta: boolean; transcricao: boolean } = { provedor: "elevenlabs", pronta: false, transcricao: false };
  let fotos: { em: Date; resumo: ResumoSincronizacao } | null = null;
  let fotosErro: { em: string; erro: string } | null = null;
  let vigia: MemoriaVigia = MEMORIA_VAZIA;
  let colunas0022 = false;
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, connect_timeout: 5 });
    antigas = await contarDominioAntigo(sql);
    leituras = await lerLeituras(sql);
    const o = await lerOpcoesVoz(sql);
    voz = {
      provedor: o.provedor,
      pronta: Boolean((await chaveDoProvedor(sql, o.provedor)).chave),
      transcricao: Boolean((await chaveDoProvedor(sql, "elevenlabs")).chave),
    };
    fotos = await ultimaSincronizacao(sql).catch(() => null);
    fotosErro = await ultimoErroSincronizacao(sql).catch(() => null);
    vigia = await lerMemoria(sql).catch(() => MEMORIA_VAZIA);
    colunas0022 = await colunasDaMigration0022(sql).catch(() => false);
    await sql.end();
  } catch { banco = false; }

  const variaveis = [
    { nome: "Banco de dados", ok: banco, ajuda: "DATABASE_URL" },
    { nome: "Chave da API da Marina", ok: Boolean(process.env.AGENT_API_KEY), ajuda: "AGENT_API_KEY — sem ela as rotas da Marina recusam tudo" },
    { nome: "Ligação com a Marina (OpenClaw)", ok: gatewayConfigurado(), ajuda: "OPENCLAW_GATEWAY_URL e OPENCLAW_GATEWAY_TOKEN — chat do site e área de teste" },
    { nome: `Voz da Marina (${PROVEDOR[voz.provedor].nome})`, ok: voz.pronta, ajuda: "conta conectada em Marina → Voz, ou a chave na Vercel — áudio no site e no WhatsApp" },
    { nome: "Ouvir áudio do cliente (ElevenLabs)", ok: voz.transcricao, ajuda: "ElevenLabs conectada em Marina → Voz, ou ELEVENLABS_API_KEY — transcreve os áudios" },
    { nome: "Motor de reservas", ok: Boolean(process.env.WORKER_BASE_URL), ajuda: "WORKER_BASE_URL e WORKER_SLUG" },
  ];

  const agendadores = listarAgendadores(fotos, vigia, colunas0022);

  return (
    <Pagina larga>
      <Cabecalho sobre="Sistema" titulo="Diagnóstico" descricao="O que está ligado e o que não está. Recarregue a página para testar de novo." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Motor de reservas" valor={motor.ok ? "No ar" : "Fora do ar"} tom={motor.ok ? "sucesso" : "erro"}
          detalhe={motor.ok ? `respondeu em ${(motor.ms / 1000).toFixed(1).replace(".", ",")}s` : "sem preço no site"} />
        <Indicador rotulo="Tipos de quarto no motor" valor={motor.data ? motor.data.quartos.length + motor.data.indisponiveis.length : "—"}
          detalhe={motor.data ? `${motor.data.total_disponiveis} com vaga na data de teste` : undefined} />
        <Indicador rotulo="WhatsApp leu o treinamento" valor={leituras.whatsapp ? quandoFoi(leituras.whatsapp.lido_em) : "nunca"}
          tom={leituras.whatsapp ? "sucesso" : "aviso"} detalhe="pela rota /api/agent/conhecimento" />
        <Indicador rotulo="Imagens no servidor antigo" valor={antigas.total} tom={antigas.total ? "aviso" : "sucesso"}
          detalhe={antigas.total ? "somem quando o DNS virar" : "nenhuma — a virada de DNS não derruba nada"} />
      </div>

      {!motor.ok && (
        <Aviso tom="erro" titulo="O motor de reservas não respondeu." className="mb-6">
          {motor.erro}. O site continua no ar, mas sem preço e sem disponibilidade até o motor voltar.
        </Aviso>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Configuração" descricao="Só mostra se cada item existe — nenhum valor secreto aparece aqui.">
          <ul className="divide-y divide-linha/60">
            {variaveis.map((v) => (
              <li key={v.nome} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-tinta">{v.nome}</p>
                  <p className="text-xs text-tinta-suave">{v.ajuda}</p>
                </div>
                <Selo tom={v.ok ? "sucesso" : "erro"} ponto>{v.ok ? "ok" : "faltando"}</Selo>
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao titulo="Agendadores" descricao="O que roda sozinho e quando rodou pela última vez.">
          <ul className="divide-y divide-linha/60">
            {agendadores.map((a) => (
              <li key={a.nome} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-tinta">{a.nome}</p>
                  <p className="text-xs text-tinta-suave">{a.ajuda}</p>
                </div>
                <Selo tom={a.tom} ponto>{a.valor}</Selo>
              </li>
            ))}
          </ul>
          {fotosErro ? (
            <Aviso tom="erro" titulo={`A última tentativa de sincronizar as fotos falhou (${quandoFoi(fotosErro.em)})`} className="mt-3">
              {fotosErro.erro}. A próxima busca em /reservar (ou o botão em Mídias) tenta de novo.
            </Aviso>
          ) : null}
          {fotos?.resumo.avisos.length ? (
            <Aviso tom="aviso" titulo="Avisos da última sincronização de fotos" className="mt-3">
              <ul className="list-disc space-y-0.5 pl-4 text-xs">{fotos.resumo.avisos.slice(0, 6).map((a, i) => <li key={i}>{a}</li>)}</ul>
            </Aviso>
          ) : null}
          {fotos?.resumo.suites?.length ? (
            <details className="mt-3 rounded-xl border border-linha/60">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-tinta">Fotos por suíte na última rodada ({fotos.resumo.suites.length})</summary>
              <table className="w-full text-xs">
                <thead><tr className="text-left text-tinta-suave"><th className="px-3 py-1">Suíte</th><th className="px-1 py-1">No motor</th><th className="px-1 py-1">No site</th><th className="px-1 py-1">Novas</th><th className="px-1 py-1">Removidas</th><th className="px-3 py-1">Obs.</th></tr></thead>
                <tbody>
                  {fotos.resumo.suites.map((d) => (
                    <tr key={d.codigo} className="border-t border-linha/40">
                      <td className="px-3 py-1">{d.nome} <span className="font-mono text-tinta-suave">{d.codigo}</span></td>
                      <td className="px-1 py-1">{d.motor}</td><td className="px-1 py-1">{d.site_depois}</td>
                      <td className="px-1 py-1">{d.novas}</td><td className="px-1 py-1">{d.removidas}</td>
                      <td className="px-3 py-1 text-tinta-suave">{d.nota ?? (d.motor === d.site_depois ? "em dia" : "diferente")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </Cartao>

        <Cartao titulo="Imagens no servidor antigo">
          {antigas.total ? (
            <div className="space-y-3 text-sm text-tinta-suave">
              <p>Estas imagens ainda carregam de <code className="font-mono text-xs">pousadamarimarilhadomel.com.br</code>. No dia em que o DNS apontar para a Vercel, somem todas de uma vez.</p>
              <p>No terminal do projeto: <code className="rounded bg-areia px-1.5 py-0.5 font-mono text-xs">npm run db:migrar-fotos -- --dry</code> para ver, e sem <code className="font-mono text-xs">--dry</code> para fazer.</p>
              <ul className="space-y-0.5 text-xs">
                {antigas.porLugar.map((p) => <li key={p.onde}><span className="font-mono">{p.onde}</span> — {p.quantas}</li>)}
              </ul>
            </div>
          ) : (
            <Aviso tom="sucesso">Nenhuma. Todas as imagens estão hospedadas conosco.</Aviso>
          )}
        </Cartao>
      </div>

      {motor.data && (
        <details className="mt-6 rounded-2xl border border-linha/80 bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-tinta min-h-12">Resposta completa do motor (para quem for investigar)</summary>
          <pre className="max-h-96 overflow-auto border-t border-linha/60 bg-fundo-suave p-4 text-xs">{JSON.stringify(motor.data, null, 2)}</pre>
        </details>
      )}
    </Pagina>
  );
}
