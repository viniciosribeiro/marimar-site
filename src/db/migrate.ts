import { urlDoBanco, explicarErro } from "./env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const dbUrl = urlDoBanco();

  console.log("Conectando ao banco...");
  const client = postgres(dbUrl, { max: 1 });

  console.log("Rodando migrations...");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

  console.log("Migrations aplicadas com sucesso!");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Erro na migration:", explicarErro(err));
  if (String(err?.cause?.message ?? err?.message).includes("already exists")) {
    console.error(
      "\n   Isso acontece quando o banco foi criado com `drizzle-kit push`:\n" +
      "   o schema existe, mas a tabela de controle de migrations está vazia,\n" +
      "   então o migrator tenta aplicar a 0000 do zero.\n\n" +
      "   Rode uma vez:  npm run db:baseline\n" +
      "   e depois:      npm run db:migrate\n"
    );
  }
  process.exit(1);
});