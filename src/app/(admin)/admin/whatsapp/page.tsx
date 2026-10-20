import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { statusWhatsapp } from "@/lib/envio-whatsapp";
import { comSql } from "@/lib/db-conexao";
import { lerConfigEscalonamento } from "@/lib/escalonamento";
import { VARIAVEIS_META, faltandoMeta } from "@/lib/whatsapp-meta-base";
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
export default async function WhatsappPage() {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  const podeMexer = (s.user as { role?: string }).role === "master";

  const [modo, ultimaOficial] = await comSql(async (sql) => {
    const cfg = await lerConfigEscalonamento(sql);
    const [u] = await sql<{ quando: Date | null }[]>`
      SELECT MAX(criado_em) AS quando FROM chat_mensagens WHERE sessao LIKE 'wa:%' AND papel = 'visitante'`.catch(() => [{ quando: null }]);
    return [cfg.whatsapp_modo === "oficial" ? "oficial" : "web", u?.quando ?? null] as const;
  }).catch(() => ["web", null] as const);
  const oficial = modo === "oficial";
  const faltam = faltandoMeta();

  const status = oficial ? null : await Promise.race([
    statusWhatsapp().catch(() => ({ sabe: false, conectado: null, resumo: "não deu para consultar", queda: null })),
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
                ? <ConexaoWhatsapp conectado={status?.sabe ? status.conectado : null} />
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
