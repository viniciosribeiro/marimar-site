import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Trava de sessao para Server Actions do admin.
 *
 * Server Action e um endpoint POST publico: a pagina que mostra o botao ser
 * protegida NAO protege a acao. Quem tiver o id da action consegue chama-la
 * sem estar logado. Por isso toda action que escreve no banco passa por aqui
 * antes de abrir conexao.
 */
export async function exigirSessao() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  return s;
}
