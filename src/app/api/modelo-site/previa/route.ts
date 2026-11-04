import { NextResponse, type NextRequest } from "next/server";
import {
  assinarPrevia, conferirPrevia, COOKIE_PREVIA, COOKIE_VER, DURACAO_PREVIA_MS,
} from "@/lib/modelo-site";

export const dynamic = "force-dynamic";

/**
 * Entrada da prévia do site novo neste aparelho.
 *
 * O painel (Site → Modelo do site) gera `?t=` assinado e válido por 15 min.
 * Aqui ele vira um cookie de prévia de 30 dias, só deste navegador, e a
 * pessoa vai para a página inicial já vendo o Novo. Visitante comum nunca
 * passa por aqui. Link vencido ou adulterado: explica o que fazer.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const valor = conferirPrevia(t, "entrar") ? assinarPrevia("previa", Date.now() + DURACAO_PREVIA_MS) : null;
  if (!valor) {
    return new NextResponse(PAGINA_LINK_VENCIDO, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  const opcoes = {
    httpOnly: true, sameSite: "lax" as const, path: "/",
    secure: req.nextUrl.protocol === "https:", maxAge: Math.floor(DURACAO_PREVIA_MS / 1000),
  };
  res.cookies.set(COOKIE_PREVIA, valor, opcoes);
  res.cookies.set(COOKIE_VER, "novo", opcoes);
  res.headers.set("cache-control", "no-store");
  return res;
}

const PAGINA_LINK_VENCIDO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Link de prévia vencido</title>
<style>body{font:17px/1.55 system-ui,sans-serif;background:#FBF8F3;color:#17324A;margin:0;padding:48px 20px}
main{max-width:30rem;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .6em}a{color:#0B7C77}</style></head>
<body><main><h1>Este link de prévia venceu</h1>
<p>O link para ver o site novo vale 15 minutos. Gere outro no painel, em <strong>Site → Modelo do site → Ver o site novo neste aparelho</strong>.</p>
<p><a href="/">Ir para o site</a></p></main></body></html>`;
