import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD sao obrigatorios no .env.local");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("ADMIN_SEED_PASSWORD deve ter no minimo 12 caracteres.");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const sql = postgres(dbUrl, { max: 1 });

  const hash = await bcrypt.hash(password, 12);

  await sql`
    INSERT INTO usuarios (email, nome, senha_hash, papel, must_reset)
    VALUES (${email}, 'Cecilia', ${hash}, 'master', true)
    ON CONFLICT (email) DO UPDATE SET senha_hash = ${hash}, must_reset = true
  `;

  console.log(`Usuario master criado: ${email}`);
  console.log("must_reset=true — troca de senha forcada no primeiro login.");
  console.log("Remova ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD do .env.local apos este comando.");

  await sql.end();
}

main().catch((err) => { console.error("Erro:", err); process.exit(1); });