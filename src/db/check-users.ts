import { config } from "dotenv"; config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const users = await sql`SELECT email, nome, papel, must_reset FROM usuarios`;
  console.log("Usuarios:", users.length);
  for (const u of users) console.log(" -", u.email, u.nome, u.papel, "must_reset:", u.must_reset);
  await sql.end();
}
main();