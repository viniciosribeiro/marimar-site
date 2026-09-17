import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/trocar-senha"];

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

  const isAdminHost =
    hostname.startsWith("admin.") ||
    hostname.startsWith("admin.localhost");

  // /admin/* pelo domínio público → redireciona para subdomínio admin
  if (pathname.startsWith("/admin") && !isAdminHost) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    const adminHost = hostname.replace("www.", "admin.");
    url.host = adminHost;
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};