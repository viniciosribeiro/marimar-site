import { NextResponse, type NextRequest } from "next/server";
import { conferirPrevia, COOKIE_PREVIA, COOKIE_VER, DURACAO_PREVIA_MS, voltarSeguro } from "@/lib/modelo-site";

export const dynamic = "force-dynamic";

/**
 * A barrinha da prévia: "Ver o Clássico" / "Ver o Novo" / "Sair da prévia".
 * Formulário comum (POST), sem JavaScript, e volta para a mesma página.
 * Só vale para quem tem o cookie de prévia válido; para os outros, nada muda.
 */
export async function POST(req: NextRequest) {
  const fd = await req.formData().catch(() => null);
  const ver = String(fd?.get("ver") ?? "");
  /* Só uma página do próprio site (ver voltarSeguro). */
  const res = NextResponse.redirect(voltarSeguro(String(fd?.get("voltar") ?? "/"), req.url), 303);
  res.headers.set("cache-control", "no-store");
  if (!conferirPrevia(req.cookies.get(COOKIE_PREVIA)?.value, "previa")) return res;

  const opcoes = {
    httpOnly: true, sameSite: "lax" as const, path: "/",
    secure: req.nextUrl.protocol === "https:", maxAge: Math.floor(DURACAO_PREVIA_MS / 1000),
  };
  if (ver === "sair") {
    res.cookies.set(COOKIE_PREVIA, "", { ...opcoes, maxAge: 0 });
    res.cookies.set(COOKIE_VER, "", { ...opcoes, maxAge: 0 });
  } else if (ver === "novo" || ver === "classico") {
    res.cookies.set(COOKIE_VER, ver, opcoes);
  }
  return res;
}
