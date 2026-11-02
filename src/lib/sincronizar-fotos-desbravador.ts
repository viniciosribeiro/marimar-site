import { comSql } from "@/lib/db-conexao";
import { fetchTarifas } from "@/lib/worker";
import { datasExemplo } from "@/lib/format";
import { origemFotoPermitida } from "@/lib/foto-whatsapp";

/**
 * Sincroniza automaticamente fotos por tipo de suite a partir da fonte ja
 * recebida pelo PousadaHub. Nao remove fotos antigas, nao muda capas, nem
 * mistura quartos: usa exclusivamente desbravador_room_id.
 */
export function codigoQuartoMotor(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toUpperCase() : "";
}

/** Rejeita URLs externas nao autorizadas, repetidas e nao-imagem. */
export function selecionarFotosDoMotor(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const fotos = valor
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => url.length <= 1500 && origemFotoPermitida(url));
  return [...new Set(fotos)].slice(0, 40);
}

export async function sincronizarFotosDoMotor() {
  // O Worker retorna fotos[] tanto dos disponiveis quanto dos indisponiveis.
  // Se o motor falhar, nenhuma escrita e realizada.
  const { checkIn, checkOut } = datasExemplo(7, 2);
  const resposta = await fetchTarifas(checkIn, checkOut, 2, 0, { timeoutMs: 35000 });
  const motor = [...resposta.quartos, ...resposta.indisponiveis];
  if (!motor.length) throw new Error("Motor sem quartos; nenhuma foto foi alterada.");

  return comSql(async (sql) => sql.begin(async (tx) => {
    // Impede duas sincronizacoes simultaneas de duplicarem linhas.
    const [lock] = await tx<{ livre: boolean }[]>`SELECT pg_try_advisory_xact_lock(20261102) AS livre`;
    if (!lock?.livre) throw new Error("Sincronizacao de fotos ja em andamento.");

    const locais = await tx<{ id: string; nome: string; desbravador_room_id: string }[]>`
      SELECT id, nome, desbravador_room_id FROM quartos
      WHERE ativo = true AND desbravador_room_id IS NOT NULL
    `;
    const porCodigo = new Map(
      locais.map((q) => [codigoQuartoMotor(q.desbravador_room_id), q]),
    );
    let fotosNovas = 0;
    let fotosExistentes = 0;
    let suitesAtualizadas = 0;
    let suitesSemVinculo = 0;
    let suitesSemFotos = 0;
    const vistos = new Set<string>();

    for (const quarto of motor) {
      const codigo = codigoQuartoMotor(quarto.id);
      if (!codigo || vistos.has(codigo)) continue;
      vistos.add(codigo);

      const local = porCodigo.get(codigo);
      if (!local) { suitesSemVinculo++; continue; }
      const doMotor = selecionarFotosDoMotor(quarto.fotos);
      if (!doMotor.length) { suitesSemFotos++; continue; }

      const anteriores = await tx<{ url: string; ordem: number }[]>`
        SELECT url, ordem FROM midias
        WHERE quarto_id = ${local.id} AND tipo = 'foto'
      `;
      const conhecidas = new Set(anteriores.map((f) => f.url));
      let ordem = anteriores.reduce((n, f) => Math.max(n, f.ordem), -1) + 1;
      let inseridasNestaSuite = 0;

      for (const foto of doMotor) {
        if (conhecidas.has(foto)) { fotosExistentes++; continue; }

        const [inserida] = await tx<{ id: string }[]>`
          INSERT INTO midias (quarto_id, url, alt, tipo, secao, ordem, destaque)
          SELECT ${local.id}, ${foto}, ${"Foto da suíte " + local.nome},
                 'foto', 'quarto', ${ordem}, false
          WHERE NOT EXISTS (
            SELECT 1 FROM midias
            WHERE quarto_id = ${local.id} AND tipo = 'foto' AND url = ${foto}
          )
          RETURNING id
        `;
        if (inserida) {
          fotosNovas++;
          inseridasNestaSuite++;
          conhecidas.add(foto);
          ordem++;
        }
      }
      if (inseridasNestaSuite) suitesAtualizadas++;
    }

    return {
      consultado_em: new Date().toISOString(),
      periodo_consulta: { check_in: checkIn, check_out: checkOut },
      suites_motor: vistos.size,
      suites_atualizadas: suitesAtualizadas,
      fotos_novas: fotosNovas,
      fotos_ja_presentes: fotosExistentes,
      suites_sem_vinculo: suitesSemVinculo,
      suites_sem_fotos_validas: suitesSemFotos,
      observacao: "Nenhuma foto removida; capas e fotos manuais preservadas.",
    };
  }));
}
