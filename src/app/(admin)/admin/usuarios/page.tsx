import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { comSql } from "@/lib/db-conexao";
import { Pagina, Cabecalho, Lista, Selo, Aviso, quandoFoi } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Usuario = { id: string; email: string; nome: string; papel: string; must_reset: boolean; ultimo_login: Date | null };

/** Quem tem acesso ao painel. Só leitura: contas novas são criadas pelo script de administração. */
export default async function UsuariosPage() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const lista = await comSql((sql) => sql<Usuario[]>`
    SELECT id, email, nome, papel, must_reset, ultimo_login FROM usuarios ORDER BY criado_em DESC`);

  return (
    <Pagina>
      <Cabecalho sobre="Sistema" titulo="Usuários" descricao="Quem tem acesso a este painel." />
      <Lista
        itens={[...lista]}
        chave={(u) => u.id}
        colunas={[
          { titulo: "Nome", celula: (u) => u.nome },
          { titulo: "E-mail", celula: (u) => <span className="text-tinta-suave">{u.email}</span> },
          { titulo: "Papel", celula: (u) => <Selo tom={u.papel === "master" ? "marca" : "neutro"}>{u.papel === "master" ? "Administração" : "Edição"}</Selo> },
          { titulo: "Senha", celula: (u) => u.must_reset ? <Selo tom="aviso" ponto>Precisa trocar</Selo> : <Selo tom="sucesso" ponto>Definida</Selo> },
          { titulo: "Último acesso", celula: (u) => <span className="text-xs text-tinta-suave">{quandoFoi(u.ultimo_login)}</span> },
        ]}
      />
      <Aviso tom="info" className="mt-6">
        Para criar uma conta ou redefinir uma senha, quem administra o sistema roda <code className="font-mono">npm run db:seed:admin</code> (veja <code className="font-mono">docs/runbook.md</code>).
      </Aviso>
    </Pagina>
  );
}
