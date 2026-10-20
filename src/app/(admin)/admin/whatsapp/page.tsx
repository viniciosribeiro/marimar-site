import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { statusWhatsapp } from "@/lib/envio-whatsapp";
import { Pagina, Cabecalho, Cartao, Selo, Aviso, quandoFoi } from "@/components/admin/ui";
import { ConexaoWhatsapp } from "./ConexaoWhatsapp";

export const dynamic = "force-dynamic";
/* As ações desta tela esperam o QR e a leitura (até ~35 s cada). */
export const maxDuration = 60;

/**
 * WhatsApp da Marina: ver se está no ar, conectar pelo QR e desconectar,
 * sem abrir o terminal da Hostinger. Duas formas de conexão: o WhatsApp
 * Web (Baileys, a de hoje) e a API oficial da Meta (em preparação).
 */
export default async function WhatsappPage() {
  const s = await auth(); if (!s?.user) redirect("/admin/login");
  const podeMexer = (s.user as { role?: string }).role === "master";

  const status = await Promise.race([
    statusWhatsapp().catch(() => ({ sabe: false, conectado: null, resumo: "não deu para consultar", queda: null })),
    new Promise<Awaited<ReturnType<typeof statusWhatsapp>>>((r) => setTimeout(() => r({ sabe: false, conectado: null, resumo: "o servidor da Marina não respondeu em 6 segundos" }), 6000)),
  ]);
  const queda = status.queda ?? null;

  const selo = !status.sabe
    ? <Selo tom="aviso" ponto>Não deu para saber</Selo>
    : status.conectado === true ? <Selo tom="sucesso" ponto>Conectada e atendendo</Selo>
    : status.conectado === false ? <Selo tom="erro" ponto>Fora do WhatsApp</Selo>
    : <Selo tom="aviso" ponto>Estado incerto</Selo>;

  return (
    <Pagina>
      <Cabecalho titulo="WhatsApp da Marina"
        descricao="Conecte ou desconecte a Marina do número da pousada sem abrir o servidor. Há duas formas de conexão: o WhatsApp Web, pelo QR, que é a usada hoje, e a API oficial da Meta, em preparação." />

      <div className="grid gap-5">
        <Cartao titulo="WhatsApp Web (QR)" descricao="A forma usada hoje: a Marina entra como um aparelho conectado do celular da pousada." acoes={selo}>
          {!status.sabe && (
            <Aviso tom="aviso" titulo="O painel não conseguiu perguntar ao servidor da Marina" className="mb-4">
              {status.resumo}. Se continuar assim, o servidor do OpenClaw pode estar desligado.
            </Aviso>
          )}
          {status.conectado === false && queda && (
            <Aviso tom="erro" titulo={queda.motivo} className="mb-4">
              {queda.desde ? `Caiu ${quandoFoi(new Date(queda.desde))}. ` : ""}Conecte de novo pelo QR abaixo.
            </Aviso>
          )}
          {podeMexer
            ? <ConexaoWhatsapp conectado={status.sabe ? status.conectado : null} />
            : <Aviso tom="info" titulo="Só quem tem acesso de Administração conecta ou desconecta">Peça ao Vinicios, ou peça para ele mudar o seu acesso em Pessoas e acessos.</Aviso>}
        </Cartao>

        <Cartao titulo="API oficial da Meta" descricao="A segunda forma, oficial do WhatsApp para empresas." acoes={<Selo tom="neutro">Em preparação</Selo>}>
          <p className="text-sm text-tinta-suave leading-relaxed">
            Ainda não está ligada. Ela depende de uma conta Meta Business e da escolha do número, que estão em estudo.
            Quando estiver pronta, aparece aqui para ligar e desligar. As duas formas não ficam ligadas ao mesmo tempo
            no mesmo número: a Marina responderia duas vezes.
          </p>
        </Cartao>

        <Cartao titulo="Para a Marina não cair">
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-tinta leading-relaxed">
            <li>No celular da pousada, <strong>não remova “openclaw”</strong> em WhatsApp → Aparelhos conectados. É a Marina.</li>
            <li>Avise antes de <strong>reinstalar o WhatsApp, trocar de celular</strong> ou passar para o WhatsApp Business.</li>
            <li>Abra o WhatsApp no celular da pousada <strong>pelo menos uma vez a cada 14 dias</strong>.</li>
            <li>Usar o celular ao mesmo tempo que a Marina, em qualquer lugar ou internet, <strong>não derruba</strong> ela.</li>
          </ul>
        </Cartao>
      </div>
    </Pagina>
  );
}
