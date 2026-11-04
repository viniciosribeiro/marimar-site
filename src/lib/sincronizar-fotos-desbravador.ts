import { comSql, type Sql } from "@/lib/db-conexao";
import { fetchTarifas, type WorkerQuarto } from "@/lib/worker";
import { datasExemplo } from "@/lib/format";
import { origemFotoPermitida } from "@/lib/foto-whatsapp";
import { blobConfigurado } from "@/lib/blob";

/**
 * Fotos das suítes sincronizadas com o Desbravador (docs/fluxo-fotos-desbravador.md).
 *
 * A fonte é a mesma consulta de tarifas que o site já faz: o motor devolve,
 * para cada tipo de suíte, a lista de fotos. Regras (decisão do Vinicios,
 * 04/11/2026):
 *
 * - Foto do motor entra marcada `origem = 'desbravador'`. Foto que a pousada
 *   enviou pelo painel (`origem = 'painel'`) NUNCA é tocada: nem removida,
 *   nem reordenada, nem perde a capa.
 * - Foto do motor que sumiu de lá some do site (só as de origem desbravador).
 * - Com o Vercel Blob configurado, cada foto nova é copiada para o nosso
 *   armazenamento: o site e a Marina deixam de depender do servidor do
 *   Desbravador (que bloqueia a Marina com 403). A URL original fica em
 *   `url_origem`, para reconhecer a foto nas próximas rodadas.
 * - Suíte que o motor tem e o site não tem é criada DESATIVADA, com as fotos
 *   já ligadas, para a pousada revisar e ligar no painel.
 * - Roda pelo botão em Admin → Mídias, pelo agendador da Vercel e de carona
 *   em cada busca de disponibilidade (no máximo uma vez por hora).
 *
 * Antes de 04/11 (rotina de 02/11) só acrescentava, sem marcar origem, sem
 * remover, sem espelhar e sem criar suíte — e dependia de um `CRON_SECRET`
 * que nunca foi configurado.
 */

export const INTERVALO_CARONA_MS = 60 * 60_000;

export function codigoQuartoMotor(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toUpperCase() : "";
}

/** Rejeita URLs externas não autorizadas, repetidas e não-imagem. */
export function selecionarFotosDoMotor(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const fotos = valor
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => url.length <= 1500 && origemFotoPermitida(url));
  return [...new Set(fotos)].slice(0, 40);
}

/** "SUÍTE KING TRIPLO" → "suite-king-triplo"; sem colidir com slug já usado. */
export function slugDe(nome: string, usados: Set<string>): string {
  const base = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "suite";
  let slug = base;
  for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;
  usados.add(slug);
  return slug;
}

export type ResumoSincronizacao = {
  consultado_em: string;
  periodo_consulta: { check_in: string; check_out: string };
  suites_motor: number;
  suites_criadas: string[];
  /** Suítes que o motor oferece mas estão desativadas no site (ativar em Quartos). */
  suites_inativas: string[];
  fotos_novas: number;
  fotos_espelhadas: number;
  fotos_removidas: number;
  fotos_ja_presentes: number;
  suites_sem_fotos_validas: number;
  espelho: "blob" | "sem_blob";
  avisos: string[];
};

type LinhaMidia = { id: string; url: string; url_origem: string | null; origem: string; ordem: number; pathname: string | null };

/**
 * Copia a foto do Desbravador para o Vercel Blob. Devolve null quando não
 * dá (sem token, servidor recusou, não é imagem): aí a foto fica apontando
 * para o endereço original, como antes.
 */
async function espelharNoBlob(url: string, caminho: string): Promise<{ url: string; pathname: string; bytes: number } | null> {
  if (!blobConfigurado()) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: "image/*" } });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(tipo)) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) return null;
    const { put } = await import("@vercel/blob");
    const extensao = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
    const gravado = await put(`${caminho}.${extensao}`, bytes, { access: "public", contentType: tipo, addRandomSuffix: true });
    return { url: gravado.url, pathname: gravado.pathname, bytes: bytes.length };
  } catch (e) {
    console.warn("[fotos] espelho falhou:", url, (e as Error).message);
    return null;
  }
}

async function apagarDoBlob(pathnames: string[]) {
  if (!pathnames.length || !blobConfigurado()) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(pathnames);
  } catch (e) {
    console.warn("[fotos] não apagou do storage:", (e as Error).message);
  }
}

/* ── a sincronização em si ──────────────────────────────────────── */

export async function sincronizarFotosDoMotor(opcoes: { espelhar?: boolean } = {}): Promise<ResumoSincronizacao> {
  const espelhar = opcoes.espelhar ?? true;
  const { checkIn, checkOut } = datasExemplo(7, 2);
  const resposta = await fetchTarifas(checkIn, checkOut, 2, 0, { timeoutMs: 35_000 });
  const motor: WorkerQuarto[] = [...resposta.quartos, ...resposta.indisponiveis];
  if (!motor.length) throw new Error("O motor não devolveu suítes; nenhuma foto foi alterada.");

  return comSql(async (sql) => {
    /* Uma rodada por vez (o botão e o agendador podem coincidir). */
    const [trava] = await sql<{ livre: boolean }[]>`SELECT pg_try_advisory_lock(20261102) AS livre`;
    if (!trava?.livre) throw new Error("Já há uma sincronização de fotos em andamento.");
    try {
      return await rodar(sql, motor, { checkIn, checkOut }, espelhar);
    } finally {
      await sql`SELECT pg_advisory_unlock(20261102)`.catch(() => {});
    }
  });
}

async function rodar(sql: Sql, motor: WorkerQuarto[], periodo: { checkIn: string; checkOut: string }, espelhar: boolean): Promise<ResumoSincronizacao> {
  const resumo: ResumoSincronizacao = {
    consultado_em: new Date().toISOString(),
    periodo_consulta: { check_in: periodo.checkIn, check_out: periodo.checkOut },
    suites_motor: 0, suites_criadas: [], suites_inativas: [], fotos_novas: 0, fotos_espelhadas: 0, fotos_removidas: 0,
    fotos_ja_presentes: 0, suites_sem_fotos_validas: 0, espelho: espelhar && blobConfigurado() ? "blob" : "sem_blob", avisos: [],
  };

  const locais = await sql<{ id: string; nome: string; slug: string; desbravador_room_id: string | null; ativo: boolean }[]>`
    SELECT id, nome, slug, desbravador_room_id, ativo FROM quartos`;
  const porCodigo = new Map(locais.filter((q) => q.desbravador_room_id).map((q) => [codigoQuartoMotor(q.desbravador_room_id), q]));
  const slugsUsados = new Set(locais.map((q) => q.slug));
  const vistos = new Set<string>();
  const paraApagarDoBlob: string[] = [];

  for (const quarto of motor) {
    const codigo = codigoQuartoMotor(quarto.id);
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    resumo.suites_motor++;

    const doMotor = selecionarFotosDoMotor(quarto.fotos);
    let local = porCodigo.get(codigo);

    /* Suíte que só existe no motor: entra desativada, para a pousada revisar. */
    if (!local) {
      const slug = slugDe(quarto.nome, slugsUsados);
      const [criada] = await sql<{ id: string; nome: string; slug: string; desbravador_room_id: string; ativo: boolean }[]>`
        INSERT INTO quartos (nome, slug, descricao_motor, ocupacao_max, capacidade_adultos, diaria_minima, desbravador_room_id, ordem, ativo)
        VALUES (${quarto.nome}, ${slug}, ${quarto.categoria || null}, ${quarto.ocupacao_max || 2}, ${Math.min(2, quarto.ocupacao_max || 2)},
                ${quarto.estadia_minima || 1}, ${codigo}, ${100 + resumo.suites_criadas.length}, false)
        ON CONFLICT (desbravador_room_id) DO NOTHING
        RETURNING id, nome, slug, desbravador_room_id, ativo`;
      if (!criada) continue;
      local = criada;
      porCodigo.set(codigo, criada);
      resumo.suites_criadas.push(quarto.nome);
    } else if (!local.ativo) {
      /* Existe, mas está desligada no site: as fotos entram mesmo assim
         (prontas para quando a pousada ativar) e o aviso diz onde ativar. */
      resumo.suites_inativas.push(local.nome);
    }

    const anteriores = await sql<LinhaMidia[]>`
      SELECT id, url, url_origem, origem, ordem, pathname FROM midias
      WHERE quarto_id = ${local.id} AND tipo = 'foto' ORDER BY ordem`;
    /* A foto é reconhecida pela URL do motor: antes do espelho ela é a própria
       `url`; depois, fica em `url_origem`. */
    const conhecidas = new Map<string, LinhaMidia>();
    for (const m of anteriores) { conhecidas.set(m.url, m); if (m.url_origem) conhecidas.set(m.url_origem, m); }

    if (!doMotor.length) {
      resumo.suites_sem_fotos_validas++;
    } else {
      let ordem = anteriores.reduce((n, f) => Math.max(n, f.ordem), -1) + 1;
      for (const foto of doMotor) {
        if (conhecidas.has(foto)) { resumo.fotos_ja_presentes++; continue; }
        const espelho = espelhar ? await espelharNoBlob(foto, `fotos/desbravador/${local.slug}/${ordem}`) : null;
        const [inserida] = await sql<{ id: string }[]>`
          INSERT INTO midias (quarto_id, url, url_origem, origem, alt, tipo, secao, ordem, destaque, pathname, bytes)
          SELECT ${local.id}, ${espelho?.url ?? foto}, ${foto}, 'desbravador', ${"Foto da suíte " + local.nome}, 'foto', 'quarto', ${ordem}, false,
                 ${espelho?.pathname ?? null}, ${espelho?.bytes ?? null}
          WHERE NOT EXISTS (SELECT 1 FROM midias WHERE quarto_id = ${local.id} AND tipo = 'foto' AND (url = ${foto} OR url_origem = ${foto}))
          RETURNING id`;
        if (inserida) {
          resumo.fotos_novas++;
          if (espelho) resumo.fotos_espelhadas++;
          conhecidas.set(foto, { id: inserida.id, url: espelho?.url ?? foto, url_origem: foto, origem: "desbravador", ordem, pathname: espelho?.pathname ?? null });
          ordem++;
        }
      }
    }

    /* Foto do motor que não veio mais: sai do site. As do painel ficam. */
    const atuais = new Set(doMotor);
    for (const m of anteriores) {
      if (m.origem !== "desbravador") continue;
      const chave = m.url_origem ?? m.url;
      if (atuais.has(chave)) continue;
      await sql`DELETE FROM midias WHERE id = ${m.id} AND origem = 'desbravador'`;
      resumo.fotos_removidas++;
      if (m.pathname) paraApagarDoBlob.push(m.pathname);
    }
  }

  await apagarDoBlob(paraApagarDoBlob);
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('fotos_sync', ${JSON.stringify(resumo)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`.catch(() => {});
  if (resumo.suites_criadas.length) {
    resumo.avisos.push(`Suíte(s) nova(s) criada(s) desativada(s), para revisar no painel: ${resumo.suites_criadas.join(", ")}.`);
  }
  if (resumo.suites_inativas.length) {
    resumo.avisos.push(`O motor oferece ${resumo.suites_inativas.length} suíte(s) que estão desativadas no site (Hospedagem → Quartos → Editar → Ativo): ${resumo.suites_inativas.join(", ")}.`);
  }
  if (resumo.espelho === "sem_blob" && resumo.fotos_novas) {
    resumo.avisos.push("Sem BLOB_READ_WRITE_TOKEN na Vercel, as fotos ficam apontando para o servidor do Desbravador.");
  }
  return resumo;
}

/* ── a última rodada, para o painel ─────────────────────────────── */

export async function ultimaSincronizacao(sql: Sql): Promise<{ em: Date; resumo: ResumoSincronizacao } | null> {
  const [l] = await sql<{ valor: string; atualizado_em: Date }[]>`SELECT valor, atualizado_em FROM integracoes WHERE chave = 'fotos_sync'`.catch(() => []);
  if (!l) return null;
  try { return { em: new Date(l.atualizado_em), resumo: JSON.parse(l.valor) }; } catch { return null; }
}

/* De carona, no máximo uma vez por hora, sem atrasar quem está buscando. */
let ultimaCarona = 0;
export async function talvezSincronizarFotos(sql: Sql): Promise<void> {
  if (Date.now() - ultimaCarona < INTERVALO_CARONA_MS) return;
  ultimaCarona = Date.now();
  try {
    const ultima = await ultimaSincronizacao(sql);
    if (ultima && Date.now() - ultima.em.getTime() < INTERVALO_CARONA_MS) return;
    await sincronizarFotosDoMotor();
  } catch (e) {
    console.warn("[fotos] sincronização de carona não concluiu:", (e as Error).message);
  }
}
