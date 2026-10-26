import { NextRequest, NextResponse } from "next/server";
import { COOKIE_RESERVAS, origemPermitida } from "@/lib/reservas-acesso";

export async function POST(req: NextRequest) {
  if (!origemPermitida(req)) return new Response("Origem não autorizada", { status: 403 });
  const resp = NextResponse.redirect(new URL("/reservas", req.url), { status: 303 });
  resp.cookies.set(COOKIE_RESERVAS, "", {
    httpOnly: true, secure: true, sameSite: "strict", path: "/reservas", maxAge: 0,
  });
  resp.headers.set("Cache-Control", "no-store, private");
  return resp;
}
