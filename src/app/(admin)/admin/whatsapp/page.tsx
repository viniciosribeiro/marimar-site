import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { statusWhatsapp } from "@/lib/envio-whatsapp";
import { comSql } from "@/lib/db-conexao";
import { lerConfigEscalonamento } from "@/lib/escalonamento";
import { VARIAVEIS_META, faltandoMeta } from "@/lib/whatsapp-meta-base";
import { lerMemoria, resumoProtecoes } from "@/lib/whatsapp-vigia";
import { ADAPTACAO_DIAS, ROTULO, VIGIA, emAdaptacao, MEMORIA_VAZIA } from "@/lib/whatsapp-saude";
import { Pagina, Cabecalho, Cartao, Selo, Aviso, BotaoLink, quandoFoi } from "@/components/admin/ui";
import { ConexaoWhatsapp } from "./ConexaoWhatsapp";
import { EscolhaModo, TesteMeta } from "./PainelModo";

export const dynamic = "force-dynamic";
/* As ações desta tela esperam o QR e a leitura (até ~35 s cada). */
export const maxDuration = 60;

/**
 * WhatsApp da Marina: as duas formas de ligar a Marina ao WhatsApp e a
 * escolha de qual está em uso — o WhatsApp Web (QR, pelo OpenClaw) e a API
 * oficial da Meta (webhook /api/whatsapp/meta). Só uma responde por vez.
 */
/* Contas com o relógio fora do componente (regra de pureza do React). */
const ultimas24h = (horarios: number[]) => horarios.filter((t) => Date.now() - t < 864e5).length;
const adaptacaoAgora = (desde: number | null) => emAdaptacao(desde, Date.now());

export default async function WhatsappPage() {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  const podeMexer = (s.user as { role?: string }).role === "master";

  const [modo, ultimaOficial, memoria, protecoes] = await comSql(async (sql) => {
    const cfg = await lerConfigEscalonamento(sql);
    const [u] = await sql<{ quando: Date | null }[]>`
      SELECT MAX(criado_em) AS quando FROM chat_mensagens WHERE sessao LIKE 'wa:%' AND papel = 'visitante'`.catch(() => [{ quando: null }]);
    return [cfg.whatsapp_modo === "oficial" ? "oficial" : "web", u?.quando ?? null, await lerMemoria(sql), await resumoProtecoes(sql)] as const;
  }).catch(() => ["web", null, MEMORIA_VAZIA, { envios24h: 0, segurados24h: 0, ultimosSegurados: [] }] as const);
  const oficial = modo === "oficial";
  const faltam = faltandoMeta();

  const status = oficial ? null : await Promise.race([
    statusWhatsapp().catch(() => ({ sabe: false, conectado: null, resumo: "não deu para consultar", queda: null, saude: null })),
    new Promise<Awaited<ReturnType<typeof statusWhatsapp>>>((r) => setTimeout(() => r({ sabe: false, conectado: null, resumo: "o servidor da Marina não respondeu em 6 segundos" }), 6000)),
  ]);
  const queda = status?.queda ?? null;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "marimar-site.vercel.app";
  const webhook = `${h.get("x-forwarded-proto") || "https"}://${host}/api/whatsapp/meta`;

  const seloWeb = oficial ? <Selo tom="neutro">Pausado</Selo>
    : !status?.sabe ? <Selo tom="aviso" ponto>Não deu para saber</Selo>
    : status.conectado === true ? <Selo tom="sucesso" ponto>Conectada e atendendo</Selo>
    : status.conectado === false ? <Selo tom="erro" ponto>Fora do WhatsApp</Selo>
    : <Selo tom="aviso" ponto>Estado incerto</Selo>;

  return (
    <Pagina>
      <Cabecalho titulo="WhatsApp da Marina"
        descricao="As duas formas de ligar a Marina ao WhatsApp da pousada, e qual está em uso. Só uma responde por vez; dá para trocar quando quiser." />

      <div className="grid gap-5">
        <Cartao titulo="Qual WhatsApp a Marina usa" descricao="Ao trocar, a outra forma é pausada sozinha para a Marina não responder duas vezes.">
          <EscolhaModo modo={modo} podeMexer={podeMexer} oficialPronta={faltam.length === 0} />
          {!podeMexer && <Aviso tom="info" className="mt-3">Só quem tem acesso de Administração troca a forma.</Aviso>}
        </Cartao>

        <Cartao titulo="WhatsApp Web (QR)" descricao="A Marina entra como um aparelho conectado do celular da pousada." acoes={seloWeb}>
          {oficial ? (
            <Aviso tom="info" titulo="Pausado: a Marina está usando a API oficial">
              O QR continua guardado no servidor. Para voltar, escolha “WhatsApp Web (QR)” acima.
            </Aviso>
          ) : (
            <>
              {!status?.sabe && (
                <Aviso tom="aviso" titulo="O painel não conseguiu perguntar ao servidor da Marina" className="mb-4">
                  {status?.resumo}. Se continuar assim, o servidor do OpenClaw pode estar desligado.
                </Aviso>
              )}
              {status?.conectado === false && queda && (
                <Aviso tom="erro" titulo={queda.motivo} className="mb-4">
                  {queda.desde ? `Caiu ${quandoFoi(new Date(queda.desde))}. ` : ""}Conecte de novo pelo QR abaixo.
                </Aviso>
              )}
              {podeMexer
                ? <ConexaoWhatsapp conectado={status?.sabe ? status.conectado : null} estadoAtual={status?.saude?.estado ?? null} />
                : <Aviso tom="info" titulo="Só quem tem acesso de Administração conecta ou desconecta">Peça ao Vinicios, ou peça para ele mudar o seu acesso em Pessoas e acessos.</Aviso>}
            </>
          )}
        </Cartao>

        <Cartao titulo="API oficial da Meta" descricao="Conta oficial do WhatsApp para empresas (Cloud API)."
          acoes={oficial ? <Selo tom="marca" ponto>Em uso</Selo> : faltam.length ? <Selo tom="neutro">Sem chaves</Selo> : <Selo tom="info">Pronta, não está em uso</Selo>}>
          <div className="space-y-4 text-sm text-tinta leading-relaxed">
            {faltam.length > 0 ? (
              <Aviso tom="info" titulo="Falta configurar na Vercel">
                <ul className="mt-1 space-y-1">
                  {VARIAVEIS_META.filter(([nome]) => faltam.includes(nome)).map(([nome, para]) => (
                    <li key={nome}><code className="font-mono text-xs">{nome}</code> — {para}</li>
                  ))}
                </ul>
                <p className="mt-2">Os valores saem da conta da Meta (passo a passo no manual). Nunca mande essas chaves por chat.</p>
              </Aviso>
            ) : (
              <p>As chaves estão na Vercel.{oficial ? "" : " Para usar, escolha “API oficial da Meta” acima."}</p>
            )}
            <div>
              <p className="text-xs font-medium text-tinta-suave">Endereço do webhook (para colar na Meta, em WhatsApp → Configuração)</p>
              <code className="mt-1 block break-all rounded-xl bg-white/70 px-3 py-2 font-mono text-xs ring-1 ring-black/5">{webhook}</code>
              <p className="mt-1 text-xs text-tinta-suave">Campo de assinatura: <strong>messages</strong>. Token de verificação: o mesmo de <code className="font-mono">WHATSAPP_META_VERIFY_TOKEN</code>.</p>
            </div>
            <p className="text-xs text-tinta-suave">
              Última mensagem recebida pela API oficial: {ultimaOficial ? quandoFoi(new Date(ultimaOficial)) : "nenhuma ainda"}.
            </p>
            {faltam.length === 0 && podeMexer && <TesteMeta />}
            <div className="flex flex-wrap gap-2">
              <BotaoLink href="/admin/equipe?aba=config" variante="fantasma" tamanho="sm">Modelos de mensagem da Meta →</BotaoLink>
            </div>
          </div>
        </Cartao>

        <Cartao titulo="Saúde e proteções" descricao="O que o site faz sozinho para a conexão não cair (docs/blindagem-whatsapp.md).">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Número ligado à Marina", (status?.saude?.numero ?? memoria.numero) ? `+${status?.saude?.numero ?? memoria.numero}` : "—"],
              ["Conectada desde", status?.saude?.conectadoDesde ? quandoFoi(new Date(status.saude.conectadoDesde)) : "—"],
              ["Última mensagem recebida", status?.saude?.ultimaEntrada ? quandoFoi(new Date(status.saude.ultimaEntrada)) : "—"],
              ["Vigia: última verificação", memoria.ultimaVez ? `${quandoFoi(new Date(memoria.ultimaVez))} · ${ROTULO[memoria.estado]}` : "ainda não rodou"],
              ["Destravamentos automáticos (24 h)", `${ultimas24h(memoria.acoes)} de no máximo ${VIGIA.acoesPorDia}`],
              ["Mensagens automáticas (24 h)", `${protecoes.envios24h} ${protecoes.envios24h === 1 ? "enviada" : "enviadas"} · ${protecoes.segurados24h} ${protecoes.segurados24h === 1 ? "segurada" : "seguradas"}`],
              ["Alerta no seu celular", process.env.ALERTA_WHATSAPP_URL ? "ligado" : "desligado (ver manual: ALERTA_WHATSAPP_URL)"],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="flex flex-col border-b border-linha/50 py-1.5">
                <dt className="text-xs text-tinta-suave">{rotulo}</dt>
                <dd className="font-medium text-tinta">{valor}</dd>
              </div>
            ))}
          </dl>
          {adaptacaoAgora(memoria.numeroDesde) && (
            <Aviso tom="info" titulo="Número novo: período de adaptação" className="mt-4">
              Nos primeiros {ADAPTACAO_DIAS} dias de um número ligado à Marina, o site manda metade das mensagens automáticas e espera mais entre uma e outra. Termina {new Date(memoria.numeroDesde! + ADAPTACAO_DIAS * 864e5).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.
            </Aviso>
          )}
          {protecoes.ultimosSegurados.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-tinta-suave">Seguradas pelo disjuntor</p>
              <ul className="mt-1 space-y-1 text-xs text-tinta">
                {protecoes.ultimosSegurados.map((b, i) => <li key={i}>{quandoFoi(new Date(b.em))}: {b.motivo}</li>)}
              </ul>
            </div>
          )}
          {memoria.historico.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-tinta-suave">Histórico</p>
              <ul className="mt-1 space-y-1 text-xs text-tinta">
                {memoria.historico.slice(0, 8).map((h, i) => <li key={i}>{quandoFoi(new Date(h.em))}: {h.texto}</li>)}
              </ul>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Para a Marina não cair">
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-tinta leading-relaxed">
            <li>No WhatsApp Web (QR): <strong>não remova “openclaw”</strong> em WhatsApp → Aparelhos conectados. É a Marina.</li>
            <li>Avise antes de <strong>reinstalar o WhatsApp, trocar de celular</strong> ou passar para o WhatsApp Business.</li>
            <li>Abra o WhatsApp no celular da pousada <strong>pelo menos uma vez a cada 14 dias</strong>.</li>
            <li>Usar o celular ao mesmo tempo que a Marina, em qualquer lugar ou internet, <strong>não derruba</strong> ela.</li>
          </ul>
        </Cartao>
      </div>
    </Pagina>
  );
}
