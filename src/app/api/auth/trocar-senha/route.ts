import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import postgres from "postgres";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { senha } = await request.json();
  if (!senha || senha.length < 12) {
    return NextResponse.json({ error: "Minimo 12 caracteres" }, { status: 400 });
  }

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const hash = await bcrypt.hash(senha, 12);

  await sql`
    UPDATE usuarios SET senha_hash = ${hash}, must_reset = false
    WHERE id = ${(session.user as any).id}
  `;
  await sql.end();

  return NextResponse.json({ ok: true });
}