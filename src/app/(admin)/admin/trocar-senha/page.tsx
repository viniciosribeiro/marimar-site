import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { trocarSenha } from "./actions";
import { Pagina, Rotulo, campo } from "@/components/admin/ui";
import { BotaoEnviar } from "@/components/admin/ui-cliente";

export const dynamic = "force-dynamic";

export default async function TrocarSenhaPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const primeiroAcesso = Boolean((session.user as { mustReset?: boolean }).mustReset);

  return (
    <Pagina>
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-linha/80 bg-white p-6 shadow-sm sm:p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-marca-suave text-marca"><KeyRound className="h-5 w-5" /></span>
          <h1 className="mt-4 font-titulo text-2xl font-bold text-tinta">{primeiroAcesso ? "Crie a sua senha" : "Trocar senha"}</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {primeiroAcesso ? "É o seu primeiro acesso. " : ""}Use pelo menos 12 caracteres — uma frase curta é mais fácil de lembrar e mais segura.
          </p>
          <form action={trocarSenha} className="mt-6 space-y-4">
            <Rotulo rotulo="Nova senha">
              <input type="password" name="senha" required minLength={12} autoComplete="new-password" className={campo + " min-h-12"} />
            </Rotulo>
            <Rotulo rotulo="Repita a nova senha">
              <input type="password" name="confirmacao" required autoComplete="new-password" className={campo + " min-h-12"} />
            </Rotulo>
            <BotaoEnviar tamanho="lg" className="w-full">Salvar senha</BotaoEnviar>
          </form>
        </div>
      </div>
    </Pagina>
  );
}
