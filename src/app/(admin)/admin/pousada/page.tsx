import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CrudForm } from "@/components/admin/CrudForm";
import { lerPousada } from "@/lib/pousada";
import { salvarPousada } from "./actions";

import { Pagina, Cabecalho } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function DadosPousadaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;
  const p = await lerPousada();

  return (
    <Pagina>
      <Cabecalho sobre="Visão geral" titulo="Dados da pousada"
        descricao="Contato e apresentação. Aparece no site inteiro (topo, rodapé, botões de WhatsApp) e é o que a Marina informa quando alguém pede o contato." />

      <CrudForm
        action={salvarPousada}
        error={sp.erro}
        ok={sp.ok}
        submitLabel="Salvar dados"
        fields={[
          { name: "nome", label: "Nome da pousada", required: true, defaultValue: p?.nome ?? "Pousada Marimar" },
          { name: "whatsapp", label: "WhatsApp", defaultValue: p?.whatsapp ?? "", ajuda: "Com DDD. Ex.: (41) 99501-2920" },
          { name: "telefone", label: "Telefone fixo (opcional)", defaultValue: p?.telefone ?? "" },
          { name: "email", label: "E-mail", type: "email", defaultValue: p?.email ?? "" },
          { name: "instagram", label: "Instagram", defaultValue: p?.instagram ?? "" },
          { name: "horario_recepcao", label: "Horário da recepção", defaultValue: p?.horario_recepcao ?? "" },
          { name: "endereco", label: "Endereço", defaultValue: p?.endereco ?? "", className: "sm:col-span-2 lg:basis-full" },
          {
            name: "descricao_longa", label: "Nossa história", type: "textarea", rows: 6,
            defaultValue: p?.descricao_longa ?? "",
            ajuda: "Aparece na página A Pousada. Em branco, o site usa o texto padrão.",
          },
        ]}
      />
    </Pagina>
  );
}
