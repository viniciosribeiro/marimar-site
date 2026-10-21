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
