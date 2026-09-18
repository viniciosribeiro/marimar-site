import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!, { max: 1, prepare: false });
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  for (const t of tables) {
    const [r] = await sql.unsafe(`SELECT count(*) as c FROM "${t.table_name}"`);
    console.log((t.table_name as string).padEnd(25), String(r.c));
  }
  await sql.end();
}
main();