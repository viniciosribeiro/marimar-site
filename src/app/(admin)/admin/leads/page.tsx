import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { comSql } from "@/lib/db-conexao";
import { marcarLido } from "@/lib/admin-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Pagina, Cabecalho, Lista, Selo, Vazio, botao, quandoFoi } from "@/components/admin/ui";
import { MessageCircle, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

type Lead = {
  id: string; nome: string; telefone: string | null; email: string | null; mensagem: string | null;
  origem: string; lido: boolean; criado_em: Date;
};

const ORIGEM: Record<string, string> = { site: "Formulário do site", agente: "Marina", whatsapp: "WhatsApp" };

/** Contatos deixados no site e pela Marina, com atalho para responder. */
export default async function LeadsPage() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const lista = await comSql((sql) => sql<Lead[]>`SELECT * FROM leads ORDER BY criado_em DESC`);
  const novos = lista.filter((l) => !l.lido).length;

  /* Telefone brasileiro sem o 55 vira wa.me de outro país: completa. */
  const wa = (t: string) => { const d = t.replace(/\D/g, ""); return `https://wa.me/${d.length <= 11 ? "55" + d : d}`; };

  return (
    <Pagina larga>
      <Cabecalho sobre="Atendimento" titulo="Contatos recebidos"
        descricao={novos ? `${novos} ${novos === 1 ? "contato novo" : "contatos novos"} para responder. Quem deixou contato pelo site ou pela Marina aparece aqui.` : "Quem deixou contato pelo site ou pela Marina aparece aqui."} />
      <Lista
        itens={[...lista]}
        chave={(l) => l.id}
        vazio={<Vazio icone="📨" titulo="Nenhum contato ainda">Quando alguém preencher o formulário ou deixar o telefone com a Marina, aparece aqui.</Vazio>}
        colunas={[
          { titulo: "Nome", celula: (l) => (
            <span className="flex items-center gap-2">
              {!l.lido && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="novo" />}
              <span className={l.lido ? "" : "font-semibold"}>{l.nome}</span>
            </span>
          ) },
          { titulo: "Mensagem", celula: (l) => <span className="line-clamp-2 text-tinta-suave">{l.mensagem || "—"}</span>, className: "max-w-sm" },
          { titulo: "Contato", celula: (l) => <span className="text-xs">{[l.telefone, l.email].filter(Boolean).join(" · ") || "—"}</span> },
          { titulo: "Origem", celula: (l) => <Selo>{ORIGEM[l.origem] ?? l.origem}</Selo> },
          { titulo: "Quando", celula: (l) => <span className="text-xs text-tinta-suave">{quandoFoi(l.criado_em)}</span> },
        ]}
        acoes={(l) => (
          <>
            {l.telefone && <a href={wa(l.telefone)} target="_blank" rel="noreferrer" className={botao("suave", "sm")}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
            {l.email && <a href={`mailto:${l.email}`} className={botao("fantasma", "sm")}><Mail className="h-3.5 w-3.5" /> E-mail</a>}
            <form action={marcarLido}>
              <input type="hidden" name="id" value={l.id} />
              <SubmitButton className={botao("fantasma", "sm")}>{l.lido ? "Marcar como novo" : "Marcar como lido"}</SubmitButton>
            </form>
          </>
        )}
      />
    </Pagina>
  );
}
