"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Palmtree, MessageCircleHeart, BedDouble, Sparkles } from "lucide-react";
import { botao, campo } from "@/components/admin/ui";
import { Girando } from "@/components/admin/ui-cliente";

/**
 * Entrada do painel.
 *
 * O lado esquerdo (só no computador) diz o que se faz aqui dentro; no
 * celular a tela é só o formulário, com campos grandes — é onde a Cecília
 * mais entra, na recepção.
 */
export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (session?.user) {
      router.push((session.user as { mustReset?: boolean }).mustReset ? "/admin/trocar-senha" : "/admin");
    }
  }, [session, router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    const r = await signIn("credentials", { email, password: senha, redirect: false }).catch(() => null);
    if (!r || r.error) {
      setEntrando(false);
      setErro(r ? "E-mail ou senha não conferem. Confira e tente de novo." : "Não consegui falar com o servidor. Confira a internet.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-fundo-suave lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Identidade — só no computador */}
      <aside className="relative hidden overflow-hidden bg-tinta p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-marca/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-acento/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-marca text-marca-texto"><Palmtree className="h-6 w-6" /></span>
          <div>
            <p className="font-titulo text-lg font-bold">Pousada Marimar</p>
            <p className="text-xs text-white/60">Encantadas · Ilha do Mel</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-titulo text-4xl font-bold leading-tight">O painel da pousada, do jeito que a recepção usa.</h1>
          <ul className="mt-8 space-y-4 text-sm text-white/80">
            {[
              { I: MessageCircleHeart, t: "Ensine a Marina e veja o que ela responde, na hora." },
              { I: BedDouble, t: "Quartos, fotos e textos do site sem depender de ninguém." },
              { I: Sparkles, t: "Funciona no celular, direto do balcão." },
            ].map(({ I, t }) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10"><I className="h-4 w-4" /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/45">Acesso restrito à equipe da pousada.</p>
      </aside>

      {/* Formulário */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 lg:min-h-0">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-marca text-marca-texto"><Palmtree className="h-6 w-6" /></span>
            <div>
              <p className="font-titulo text-lg font-bold text-tinta">Pousada Marimar</p>
              <p className="text-xs text-tinta-suave">Painel da pousada</p>
            </div>
          </div>

          <h2 className="font-titulo text-2xl font-bold text-tinta">Entrar</h2>
          <p className="mt-1 text-sm text-tinta-suave">Use o e-mail e a senha da sua conta do painel.</p>

          <form onSubmit={entrar} className="mt-8 space-y-5" noValidate={false}>
            {erro && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{erro}</p>
            )}
            <label className="block">
              <span className="block text-sm font-medium text-tinta">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                autoComplete="username" inputMode="email" autoFocus
                className={campo + " mt-1.5 min-h-12 text-base"} placeholder="voce@pousada.com.br" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-tinta">Senha</span>
              <span className="relative mt-1.5 block">
                <input type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)}
                  required autoComplete="current-password" className={campo + " min-h-12 pr-12 text-base"} />
                <button type="button" onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-tinta-suave hover:text-tinta">
                  {verSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>
            <button type="submit" disabled={entrando} className={botao("primario", "lg", "w-full")}>
              {entrando && <Girando />}
              {entrando ? "Entrando…" : "Entrar no painel"}
            </button>
          </form>
          <p className="mt-6 text-xs text-tinta-suave">Esqueceu a senha? Fale com quem administra o sistema da pousada.</p>
        </div>
      </main>
    </div>
  );
}
