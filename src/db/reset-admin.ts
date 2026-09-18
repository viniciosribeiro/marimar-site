import { config } from "dotenv"; config({ path: ".env.local" });
import postgres from "postgres";
import bcrypt from "bcryptjs";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const users = await sql`SELECT email, nome, papel, must_reset FROM usuarios`;
  for (const u of users) console.log(u.email, "|", u.nome, "|", u.papel, "| must_reset:", u.must_reset);

  // Reset da senha da Cecília para uma conhecida
  if (users.length > 0) {
    const hash = await bcrypt.hash("Marimar2026@@", 12);
    await sql`UPDATE usuarios SET senha_hash = ${hash}, must_reset = true, tentativas_falhas = 0, bloqueado_ate = NULL WHERE papel = 'master'`;
    console.log("\nSenha do master resetada. must_reset=true (troca no 1o login).");
  }
  await sql.end();
}
main();