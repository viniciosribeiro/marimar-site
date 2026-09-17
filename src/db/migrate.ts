import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL_UNPOOLED ou DATABASE_URL é obrigatória");
    process.exit(1);
  }

  console.log("Conectando ao banco...");
  const client = postgres(dbUrl, { max: 1 });

  console.log("Rodando migrations...");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

  console.log("Migrations aplicadas com sucesso!");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migration:", err);
  process.exit(1);
});