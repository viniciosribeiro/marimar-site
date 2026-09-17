import { config } from "dotenv"; config({ path: ".env.local" });
import postgres from "postgres";
import { readFileSync } from "fs";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  // Carrega o JSON com as fotos do motor
  const data = JSON.parse(readFileSync("docs/samples/tarifas-2026-10-15.json", "utf-8"));
  const allRooms = [...data.quartos, ...data.indisponiveis];

  let count = 0;
  for (const room of allRooms) {
    // Encontra o quarto local pelo desbravador_room_id
    const [local] = await sql`SELECT id FROM quartos WHERE desbravador_room_id = ${room.id}`;
    if (!local) continue;

    // Insere cada foto do motor como midia
    for (let i = 0; i < (room.fotos || []).length; i++) {
      await sql`
        INSERT INTO midias (quarto_id, url, alt, tipo, ordem, destaque)
        VALUES (${local.id}, ${room.fotos[i]}, ${room.nome + " - Foto " + (i+1)}, 'foto', ${i}, ${i === 0})
      `;
      count++;
    }
  }

  console.log(count + " fotos importadas do motor Desbravador");
  await sql.end();
}

main().catch(console.error);