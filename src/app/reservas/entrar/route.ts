import { NextRequest, NextResponse } from "next/server";
import { COOKIE_RESERVAS, DURACAO_SESSAO_SEG, criarSessao, loginConfigurado, origemPermitida, verificarLogin } from "@/lib/reservas-acesso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tentativas = new Map<string, { total: number; ate: number }>();

export async function POST(req: NextRequest) {
  if (!origemPermitida(req)) return new Response("Origem não autorizada", { status: 403 });
  const retorno = (erro: string) => NextResponse.redirect(new URL("/reservas?erro=" + erro, req.url), { status: 303 });
  if (!loginConfigurado()) return retorno("configuracao");
  const dados = await req.formData().catch(() => null);
  const usuario = dados?.get("usuario");
  const senha = dados?.get("senha");
  if (typeof usuario !== "string" || typeof senha !== "string" || usuario.length > 100 || senha.length > 128) {
    return retorno("acesso");
  }
  // Contenção básica por instância serverless. Reforçar com WAF/rate limit persistente ao ampliar o uso.
  const chave = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "sem-ip").slice(0, 100);
  const agora = Date.now();
  const estado = tentativas.get(chave);
  if (estado && estado.ate > agora && estado.total >= 5) return retorno("limite");
  const ok = verificarLogin(usuario, senha);
  if (!ok) {
    tentativas.set(chave, { total: (estado && estado.ate > agora ? estado.total : 0) + 1, ate: agora + 15 * 60_000 });
    return retorno("acesso");
  }
  tentativas.delete(chave);
  const resp = NextResponse.redirect(new URL("/reservas", req.url), { status: 303 });
  resp.cookies.set(COOKIE_RESERVAS, criarSessao(), {
    httpOnly: true, secure: true, sameSite: "strict", path: "/reservas", maxAge: DURACAO_SESSAO_SEG,
  });
  resp.headers.set("Cache-Control", "no-store, private");
  return resp;
}
