import { config } from "dotenv"; config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  await sql`INSERT INTO depoimentos (autor, origem, nota, texto, ativo, ordem) VALUES 
    ('Maria S.', 'Google', 5, 'Lugar magico! A pousada e um sonho.', true, 1),
    ('Joao P.', 'Booking', 5, 'Cafe da manha delicioso, quarto impecavel.', true, 2),
    ('Ana C.', 'Google', 4, 'Pousada linda e bem cuidada.', true, 3),
    ('Familia Oliveira', 'TripAdvisor', 5, 'Fomos com as criancas e foi perfeito.', true, 4)
  `;
  console.log("depoimentos:", (await sql`SELECT count(*) FROM depoimentos`)[0].count);

  await sql`INSERT INTO passeios (nome, descricao, duracao, preco_referencia, ativo, ordem) VALUES 
    ('Trilha ate a Fortaleza', 'Caminhada guiada com vista panoramica.', '3h', 80, true, 1),
    ('Passeio de barco', 'Tour pelas ilhas vizinhas e Gruta das Encantadas.', '4h', 120, true, 2),
    ('Por do sol no Farol', 'Caminhada ate o Farol das Conchas.', '2h', 40, true, 3),
    ('Observacao de aves', 'Santuario de aves migratorias.', '2h', 60, true, 4),
    ('Surf e SUP', 'Aulas na Praia Grande.', '1h', 50, true, 5),
    ('Gastronomia caicara', 'Roteiro pelos melhores restaurantes.', '3h', 90, true, 6)
  `;
  console.log("passeios:", (await sql`SELECT count(*) FROM passeios`)[0].count);

  await sql`INSERT INTO pacotes (nome, slug, descricao, diaria_minima, ativo, ordem) VALUES 
    ('Pacote Romantico', 'pacote-romantico', 'Estadia romantica com espumante e chocolates.', 2, true, 1),
    ('Pacote Familia', 'pacote-familia', 'Estadia para toda a familia com recreacao.', 2, true, 2),
    ('Pacote Aventura', 'pacote-aventura', 'Inclui passeios de barco, trilhas e surfe.', 3, true, 3)
  `;
  console.log("pacotes:", (await sql`SELECT count(*) FROM pacotes`)[0].count);

  await sql.end();
}

main();