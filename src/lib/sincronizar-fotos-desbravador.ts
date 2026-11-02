import { comSql } from "@/lib/db-conexao";
import { fetchTarifas } from "@/lib/worker";
import { datasExemplo } from "@/lib/format";
import { origemFotoPermitida } from "@/lib/foto-whatsapp";

/**
 * Importacao incremental automatica: o motor ja fornece fotos[] por tipo
 * de suite. A biblioteca da Marimar continua a ser a fonte usada no site.
 *
 * Regras: nunca apaga/move fotos, nunca troca a capa escolhida no painel,
 * nunca assume o nome de um quarto como identificador, nunca sincroniza
 * um URL externo nao autorizado. Execucao diaria pelo Vercel Cron.
 */
export function codigoQuartoMotor(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toUpperCase() : "";
}

export function selecionarFotosDoMotor(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const fotos = valor
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => url.length <= 1500 && origemFotoPermitida(url));
  return [...new Set(fotos)].slice(0, 40);
}

export async function sincronizarFotosDoMotor() {
  // O contrato do PousadaHub ja traz fotos nos quartos disponiveis e esgotados.
  // Se nao houver nenhum quarto, nao tocar no banco: pode ser falha do motor.
  const { checkIn, checkOut } = datasExemplo(7, 2);
  const resposta = await fetchTarifas(checkIn, checkOut, 2, 0, { timeoutMs: 35000 });
  const motor = [...resposta.quartos, ...resposta.indisponiveis];
  if (motor.length === 0) throw new Error("Motor retornou zero quartos; sincronizacao nao realizada.");

  return comSql(async (sql) => sql.begin(async (tx) => {
    // Uma segunda execucao em paralelo nao pode duplicar fotos.
    const [lock] = await tx<{ livre: boolean }[]>`SELECT pg_try_advisory_xact_lock(20261102) AS livre`;
    if (!lock?.livre) throw new Error("Ja existe uma sincronizacao de fotos em andamento.");

    const locais = await tx<{ id: string; nome: string; desbravador_room_id: string }[]>`
      SELECT id, nome, desbravador_room_id
      FROM quartos
      WHERE ativo = true AND desbravador_room_id IS NOT NULL
    `;
    const porCodigo = new Map(
      locais.map((q) => [codigoQuartoMotor(q.desbravador_room_id), q]),
    );

    let importadas = 0;
    let existentes = 0;
    let semVinculo = 0;
    let semFotos = 0;
    let suitesAtualizadas = 0;
    const processados = new Set<string>();

    for (const quarto of motor) {
      const codigo = codigoQuartoMotor(quarto.id);
      if (!codigo || processados.has(codigo)) continue;
      processados.add(codigo);
      const local = porCodigo.get(codigo);
      if (!local) { semVinculo++; continue; }

      const novasDoMotor = selecionarFotosDoMotor(quarto.fotos);
      if (!novasDoMotor.length) { semFotos++; continue; }

      const anteriores = await tx<{ url: string; ordem: number }[]>`
        SELECT url, ordem FROM midias
        WHERE quarto_id = ${{local.id} AND tipo = 'foto'
      `;
      const conhecidas = new Set(anteriores.map((f) => f.url));
      let ordem = anteriores.reduce((max, f) => Math.max(max, f.ordem), -1) + 1;
      let destaSuite = 0;

      for (const foto of novasDoMotor) {
        if (conhecidas.has(foto)) { existentes++; continue; }
        const [inserida] = await tx<{ id: string }[]>`
          INSERT INTO midias (quarto_id, url, alt, tipo, secao, ordem, destaque)
          SELECT ${{local.id}, ${{foto}, ${{"Foto da suíte " + local.nome}, 'foto', 'quarto', ${{ordem}, false
          WHERE NOT EXISTS (
            SELECT 1 FROM midias
            WHERE quarto_id = ${{local.id} AND tipo = 'foto' AND url = ${{foto}
          )
          RETURNING id
        `;
        if (inserida) { importadas++; destaSuite++; conhecidas.add(foto); ordem++; }
      }
      if (destaSuite) suitesAtualizadas++;
    }

    return {
      consultado_em: new Date().toISOString(),
      periodo_consulta: { check_in: checkIn, check_out: checkOut },
      suites_motor: processados.size,
      suites_atualizadas: suitesAtualizadas,
      fotos_novas: importadas,
      fotos_ja_presentes: existentes,
      suites_sem_vinculo: semVinculo,
      suites_sem_fotos_validas: semFotos,
      observacao: "Nao remove fotos nem altera capas. Importa somente URLs confiaveis do Desbravador.",
    };
  }));
}
