import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { trocarSenha } from "./actions";

export const dynamic = "force-dynamic";

export default async function TrocarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const sp = await searchParams;
  const erro = sp.erro;

  return (
    <div className="max-w-sm w-full space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Trocar Senha</h1>
        <p className="text-sm text-gray-500 mt-1">
          Primeiro acesso — crie uma senha de pelo menos 12 caracteres.
        </p>
      </div>

      {erro && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">{erro}</p>
      )}

      <form action={trocarSenha} className="bg-white rounded-lg shadow p-6 space-y-4">
        <input type="hidden" name="userId" value={(session.user as any).id} />
        <div>
          <label className="block text-sm font-medium mb-1">Nova senha</label>
          <input type="password" name="senha" required minLength={12}
            className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirmar senha</label>
          <input type="password" name="confirmacao" required
            className="w-full border rounded p-2" />
        </div>
        <button type="submit"
          className="w-full bg-teal-600 text-white rounded p-2 hover:bg-teal-700">
          Salvar senha
        </button>
      </form>
    </div>
  );
}