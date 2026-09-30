import { auth } from "@/lib/auth"; import { redirect } from "next/navigation"; import { fetchTarifas } from "@/lib/worker"; import postgres from "postgres"; import { headers } from "next/headers";
import { gatewayConfigurado, urlGateway, cabecalhosGateway } from "@/lib/chat";
import { alternarChat } from "./chat-actions";
import { datasExemplo } from "@/lib/format";
import { Pagina, Cabecalho, Cartao, Indicador, Aviso, Selo, botao } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  // Sem fallback hardcoded: se a env var faltar, a tela avisa em vez de
  // vazar uma chave de exemplo que funcionava em producao.
  const apiKey = process.env.AGENT_API_KEY ?? "";
  const keyConfigurada = apiKey.length >= 16;

  // Resolve a URL base a partir do host da requisição (funciona em dev E produção),
  // em vez de depender de NEXT_PUBLIC_SITE_URL que pode estar ausente.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const baseUrl = `${proto}://${host}`;

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  const { checkIn, checkOut } = datasExemplo();

  /* Os testes de rede correm em paralelo. Em sequencia, com os timeouts
     somados (12s + 4x5s + 8s), a tela podia levar mais de 40s para abrir
     exatamente quando algo estava fora do ar — a hora em que ela e aberta. */

  // Testa Worker Desbravador
  const testeWorker = (async () => {
    try { const t0 = Date.now(); const dados = await fetchTarifas(checkIn, checkOut, 2); return { dados, lat: Date.now() - t0, erro: "" }; }
    catch (e: any) { return { dados: null, lat: 0, erro: e.message as string }; }
  })();

  // Testa API do Agente
  const endpoints = ["pousada", "quartos", "faq", "pacotes"];
  const testesAgente = endpoints.map(async (ep) => {
    try { const t0 = Date.now(); const r = await fetch(`${baseUrl}/api/agent/${ep}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000) }); return { ok: r.ok, status: r.status, lat: Date.now() - t0 }; }
    catch { return { ok: false, status: 0, lat: 0 }; }
  });

  // Testa API Disponibilidade pública
  const testeDisp = (async () => {
    try { const t0 = Date.now(); const r = await fetch(`${baseUrl}/api/disponibilidade?check_in=${checkIn}&check_out=${checkOut}&adultos=2`, { signal: AbortSignal.timeout(8000) }); return { ok: r.ok, lat: Date.now() - t0 }; }
    catch { return { ok: false, lat: 0 }; }
  })();

  const [worker, resultadosAgente, disp] = await Promise.all([testeWorker, Promise.all(testesAgente), testeDisp]);
  const workerData: any = worker.dados; const workerLat = worker.lat; const workerErr = worker.erro;
  const agentTests: any = Object.fromEntries(endpoints.map((ep, k) => [ep, resultadosAgente[k]]));
  const dispOk = disp.ok; const dispLat = disp.lat;

  /* ── Marina no site ──
     Testa o gateway do OpenClaw como o /api/chat faria: mesma URL, mesmo
     token, servidor a servidor. `GET /v1/models` porque e a chamada mais
     barata que prova as tres coisas de uma vez — alcance, token valido e
     gateway de pe — sem gastar credito de conversa. */
  /* Isolado como o da home: entre o deploy e a migration 0008 a coluna e a
     tabela nao existem, e uma falha aqui derruba a tela INTEIRA de
     integracoes — justamente a tela que a pessoa abre para descobrir o que
     esta quebrado. */
  let chatAtivo = false;
  let chatPendente = false;
  try {
    const [linhaChat] = await sql`SELECT chat_ativo FROM pousada LIMIT 1`;
    chatAtivo = Boolean((linhaChat as any)?.chat_ativo);
  } catch {
    chatPendente = true;
  }

  let gwOk = false, gwLat = 0, gwErro = "", gwModelos: string[] = [];
  if (gatewayConfigurado()) {
    try {
      const t0 = Date.now();
      const r = await fetch(urlGateway("/v1/models"), {
        headers: cabecalhosGateway(),
        signal: AbortSignal.timeout(8000),
      });
      gwLat = Date.now() - t0;
      gwOk = r.ok;
      if (r.ok) {
        const j = await r.json().catch(() => null);
        gwModelos = (j?.data ?? []).map((m: any) => String(m.id)).slice(0, 8);
      } else {
        gwErro = `HTTP ${r.status}`;
      }
    } catch (e: any) {
      gwErro = e?.message === "The operation was aborted due to timeout"
        ? "sem resposta em 8s — o gateway pode estar fechado para fora da Hostinger"
        : (e?.message ?? "falhou");
    }
  }

  let chatHoje = 0;
  let chatConversas = 0;
  try {
    const [a] = await sql`
      SELECT COUNT(*)::int AS c FROM chat_mensagens
      WHERE papel = 'visitante' AND criado_em > now() - interval '24 hours'`;
    const [b] = await sql`
      SELECT COUNT(DISTINCT sessao)::int AS c FROM chat_mensagens
      WHERE criado_em > now() - interval '30 days'`;
    chatHoje = (a as any)?.c ?? 0;
    chatConversas = (b as any)?.c ?? 0;
  } catch {
    chatPendente = true;
  }

  // Stats do banco
  const [qCount] = await sql`SELECT count(*)::int as c FROM quartos WHERE ativo = true`;
  const [lCount] = await sql`SELECT count(*)::int as c FROM leads`;
  const [mCount] = await sql`SELECT count(*)::int as c FROM midias`;
  const [cCount] = await sql`SELECT count(*)::int as c FROM cache_tarifas`;
  await sql.end();

  /* Nunca a chave inteira na tela: um print desta página no WhatsApp
     entregava acesso à API da Marina (revisão de 28/09/2026). */
  const maskedKey = keyConfigurada
    ? apiKey.slice(0, 4) + "••••••••" + apiKey.slice(-2)
    : "não configurada";
  const agenteOk = Object.values(agentTests).filter((t: any) => t.ok).length;

  return (
    <Pagina larga>
      <Cabecalho sobre="Sistema" titulo="Integrações" descricao="Tudo o que o site conversa: motor de reservas, Marina (site e WhatsApp) e banco de dados. Testado ao vivo a cada vez que a tela abre." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Motor Desbravador" valor={workerData ? "No ar" : "Fora do ar"} tom={workerData ? "sucesso" : "erro"}
          detalhe={workerData ? `${workerLat} ms · ${workerData.total_disponiveis} com vaga` : workerErr} />
        <Indicador rotulo="Busca de disponibilidade" valor={dispOk ? "No ar" : "Falhou"} tom={dispOk ? "sucesso" : "erro"} detalhe={dispOk ? `${dispLat} ms` : "o site não mostra preço"} />
        <Indicador rotulo="API da Marina" valor={`${agenteOk}/${endpoints.length}`} tom={agenteOk === endpoints.length ? "sucesso" : "aviso"} detalhe="rotas respondendo" />
        <Indicador rotulo="Banco de dados" valor="No ar" tom="sucesso" detalhe={`${qCount.c} quartos · ${mCount.c} fotos`} />
      </div>

      <Cartao className="mb-6" titulo="Marina no site"
        descricao="O chat de atendimento nas páginas do site. Fala com a mesma Marina do WhatsApp, pelo gateway do OpenClaw."
        acoes={!chatPendente && (
          <form action={alternarChat}>
            <SubmitButton className={botao(chatAtivo ? "secundario" : "primario", "md", chatAtivo ? "text-red-700" : "")}>
              {chatAtivo ? "Desligar o chat" : "Ligar o chat"}
            </SubmitButton>
          </form>
        )}>
        {chatPendente ? (
          <Aviso tom="aviso">Falta rodar <code>npm run db:migrate</code> (migration <code>0008_chat_site</code>). Até lá o chat não existe — o resto desta tela funciona normalmente.</Aviso>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Indicador rotulo="Situação" valor={chatAtivo ? "No ar" : "Desligado"} tom={chatAtivo ? "sucesso" : "neutro"} />
            <Indicador rotulo="Perguntas em 24h" valor={chatHoje} />
            <Indicador rotulo="Conversas em 30 dias" valor={chatConversas} />
          </div>
        )}
        <div className="mt-4 border-t border-linha/60 pt-4">
          <p className="mb-2 text-xs font-semibold text-tinta-suave">Gateway do OpenClaw</p>
          {!gatewayConfigurado() ? (
            <Aviso tom="aviso">Faltam <code>OPENCLAW_GATEWAY_URL</code> e <code>OPENCLAW_GATEWAY_TOKEN</code> na Vercel. Sem elas o chat não tem com quem falar — o botão acima liga a tela, não a conversa.</Aviso>
          ) : gwOk ? (
            <Aviso tom="sucesso">
              Conectado em {gwLat} ms.{gwModelos.length > 0 && <> Modelos: <strong>{gwModelos.join(", ")}</strong> (use um deles em <code>OPENCLAW_MODELO</code>).</>}
            </Aviso>
          ) : (
            <Aviso tom="erro">Não alcançou o gateway: {gwErro}</Aviso>
          )}
        </div>
      </Cartao>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Rotas da Marina, ao vivo">
          <ul className="divide-y divide-linha/60">
            {Object.entries(agentTests).map(([ep, t]: any) => (
              <li key={ep} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-mono text-sm text-tinta">/api/agent/{ep}</span>
                <span className="flex items-center gap-2 text-xs text-tinta-suave">{t.lat} ms <Selo tom={t.ok ? "sucesso" : "erro"} ponto>{t.ok ? `HTTP ${t.status}` : "fora do ar"}</Selo></span>
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao titulo="Chave da API da Marina" descricao="A mesma chave precisa estar na Vercel (AGENT_API_KEY) e na Hostinger (MARIMAR_API_KEY). Por segurança, só o começo e o fim aparecem aqui.">
          <p className="rounded-xl bg-fundo-suave px-4 py-3 font-mono text-sm text-tinta">{maskedKey}</p>
          {!keyConfigurada && <Aviso tom="erro" className="mt-3">Sem a chave, todas as rotas da Marina recusam acesso e ela passa a improvisar.</Aviso>}
        </Cartao>
      </div>

      <Cartao className="mb-6" titulo="Motor Desbravador">
        {workerData ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Indicador rotulo="Tipos de quarto" valor={workerData.quartos.length + workerData.indisponiveis.length} />
            <Indicador rotulo="Com vaga" valor={workerData.total_disponiveis} />
            <Indicador rotulo="Noites no teste" valor={workerData.noites} />
            <Indicador rotulo="Tempo de resposta" valor={`${workerLat} ms`} />
          </div>
        ) : <Aviso tom="erro">Motor fora do ar — {workerErr}</Aviso>}
        {workerData && (
          <details className="mt-4 text-xs">
            <summary className="min-h-9 cursor-pointer text-tinta-suave hover:text-tinta">Ver a resposta completa do motor</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-tinta p-4 text-xs text-emerald-200">{JSON.stringify(workerData, null, 2)}</pre>
          </details>
        )}
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Banco de dados">
          <div className="grid grid-cols-2 gap-3">
            <Indicador rotulo="Quartos ativos" valor={qCount.c} />
            <Indicador rotulo="Fotos" valor={mCount.c} />
            <Indicador rotulo="Contatos" valor={lCount.c} />
            <Indicador rotulo="Consultas em cache" valor={cCount.c} />
          </div>
        </Cartao>
        <Cartao titulo="Como a Marina se conecta" descricao="Referência para configurar o OpenClaw. A chave vai no cabeçalho de toda chamada.">
          <pre className="overflow-x-auto rounded-xl bg-tinta p-4 font-mono text-xs leading-relaxed text-emerald-200">{`URL base: ${baseUrl}/api/agent
Cabeçalho: Authorization: Bearer <AGENT_API_KEY>

GET  /conhecimento   o que a pousada ensinou (ler em toda conversa)
GET  /indice         mapa de todas as fontes
GET  /disponibilidade?check_in=&check_out=&adultos=
GET  /documentos?busca=<palavras>
POST /lacuna         pergunta que ela não soube
POST /lead           contato de interessado`}</pre>
          <p className="mt-2 text-xs text-tinta-suave">Instruções completas em <code>agente/README.md</code>.</p>
        </Cartao>
      </div>
    </Pagina>
  );
}
