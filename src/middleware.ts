import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/trocar-senha"];

// Domínios de produção onde o subdomínio admin.* é usado
const PRODUCTION_HOSTS = [
  "www.pousadamarimarilhadomel.com.br",
  "pousadamarimarilhadomel.com.br",
];

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Injeta o pathname atual como header para o layout usar
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Rotas públicas do admin: nunca redirecionar
  const isPublicAdmin = PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isPublicAdmin || isApiAuth) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Só aplica o split de hostname nos domínios de produção reais.
  // Em dev e em preview/vercel.app, /admin funciona na mesma origem.
  const isProductionHost = PRODUCTION_HOSTS.some((h) => hostname === h);
  const isAdminHost =
    hostname.startsWith("admin.") ||
    hostname.startsWith("admin.localhost");

  // /admin/* pelo domínio público de produção → redireciona para admin.<dominio>
  if (pathname.startsWith("/admin") && !isAdminHost && isProductionHost) {
    const adminHost = "admin.pousadamarimarilhadomel.com.br";
    url.host = adminHost;
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};