import { comSql, type Sql } from "@/lib/db-conexao";
import { garantirEsquemaMidias } from "./esquema-midias";
import { fetchTarifas, type WorkerQuarto } from "@/lib/worker";
import { datasExemplo } from "@/lib/format";
import { origemFotoPermitida, assinaturaDeImagem } from "@/lib/foto-whatsapp";
import { blobConfigurado } from "@/lib/blob";
import { decidirLista, type Historico } from "@/lib/fotos-motor-historico";

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
 * - O motor às vezes VOLTA ATRÁS (04/11/2026: horas devolvendo a lista
 *   antiga depois de ter mostrado a nova): uma lista que ele já tinha
 *   mostrado antes da lista em vigor é ignorada (src/lib/fotos-motor-historico.ts);
 *   o botão do painel força a lista atual do motor.
 * - As cópias no Blob são reconferidas aos poucos (tamanho em bytes no
 *   Desbravador): foto trocada lá com o mesmo nome é copiada de novo.
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
  /** Suítes que estavam desativadas no site e o motor vende: ligadas nesta rodada. */
  suites_ativadas: string[];
  /** Suítes com código do motor que o motor não devolveu mais: desligadas nesta rodada. */
  suites_desativadas: string[];
  fotos_novas: number;
  fotos_espelhadas: number;
  fotos_removidas: number;
  /** Fotos que sumiram do motor nesta rodada e ficam no site até a ausência se confirmar. */
  fotos_aguardando_remocao: number;
  fotos_ja_presentes: number;
  suites_sem_fotos_validas: number;
  espelho: "blob" | "sem_blob";
  /** Fotos do Desbravador que ainda apontam para lá (o espelho copia aos poucos, por rodada). */
  espelho_pendentes: number;
  /** Suítes para as quais o motor devolveu uma lista que já tinha mostrado antes da em vigor: ignorada. */
  suites_lista_antiga: string[];
  /** Cópias no Blob reconferidas contra o Desbravador nesta rodada, e quantas foram copiadas de novo por terem mudado lá. */
  fotos_conferidas: number;
  fotos_trocadas: number;
  /** A rodada foi forçada (botão do painel): a lista atual do motor vale, mesmo que pareça antiga. */
  forcada: boolean;
  /** O que aconteceu com cada suíte: é o que permite conferir "a foto nova da Cecília entrou?". */
  suites: DetalheSuite[];
  avisos: string[];
};

export type DetalheSuite = {
  codigo: string; nome: string; slug: string | null; ativo: boolean | null;
  motor: number; site_antes: number; site_depois: number;
  novas: number; removidas: number; espelhadas: number; aguardando_remocao: number;
  nota?: string;
};

/** Tempo total da rodada (contado antes da consulta ao motor) dentro do qual
 *  ainda vale copiar foto para o Blob: a Function da Vercel tem 60 s no total
 *  e uma rodada morta no meio não grava nem resumo nem erro. */
const ORCAMENTO_RODADA_MS = 40_000;
/** Fotos antigas (já no banco, ainda no Desbravador) copiadas por rodada. */
const ESPELHO_ATRASADO_POR_RODADA = 6;
/** Cópias reconferidas por rodada (uma consulta HEAD ao Desbravador cada; as menos conferidas primeiro). */
const CONFERIR_POR_RODADA = 8;
/**
 * Carência antes de tirar do site uma foto que sumiu do motor. Em 04/11/2026
 * o motor devolveu, para a STANDARD FAMILIA, ora 4 fotos novas, ora só a
 * antiga, em rodadas seguidas — e o site apagava e recriava a cada vez. Uma
 * foto só sai depois de ficar ausente em rodadas que somem mais do que isto.
 * (Nos testes, FOTOS_CARENCIA_REMOCAO_MS encurta a espera.)
 */
const CARENCIA_REMOCAO_MS = Number(process.env.FOTOS_CARENCIA_REMOCAO_MS ?? 30 * 60_000);

type LinhaMidia = { id: string; url: string; url_origem: string | null; origem: string; ordem: number; pathname: string | null };

/**
 * Copia a foto do Desbravador para o Vercel Blob. Devolve null quando não
 * dá (sem token, servidor recusou, não é imagem): aí a foto fica apontando
 * para o endereço original, como antes.
 */
async function espelharNoBlob(url: string, caminho: string): Promise<{ url: string; pathname: string; bytes: number } | null> {
  if (!blobConfigurado()) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { accept: "image/*" } });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(tipo)) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) return null;
    /* Página de erro com cabeçalho de imagem (WAF do Desbravador) não vira foto. */
    if (!assinaturaDeImagem(bytes, tipo)) return null;
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

export async function sincronizarFotosDoMotor(opcoes: { espelhar?: boolean; forcar?: boolean } = {}): Promise<ResumoSincronizacao> {
  const inicio = Date.now();
  /* Marca de "começou": se a Function for encerrada no meio (tempo), a marca
     fica e o Diagnóstico mostra que a rodada não terminou, em vez de silêncio. */
  await comSql((sql) => sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('fotos_sync_erro', ${JSON.stringify({ em: new Date(inicio).toISOString(), erro: "A rodada começou e não registrou conclusão: provavelmente o tempo da função acabou antes do fim. A próxima rodada continua de onde parou." })}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`).catch(() => {});
  try {
    const resumo = await sincronizar(opcoes, inicio);
    await comSql((sql) => sql`DELETE FROM integracoes WHERE chave = 'fotos_sync_erro'`).catch(() => {});
    return resumo;
  } catch (e) {
    /* O erro fica gravado para o Diagnóstico e para a rota do agendador:
       uma rodada de carona que falha não aparece em lugar nenhum sem isso. */
    const erro = (e as Error).message;
    await comSql((sql) => sql`
      INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('fotos_sync_erro', ${JSON.stringify({ em: new Date().toISOString(), erro })}, now())
      ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`).catch(() => {});
    throw e;
  }
}

async function sincronizar(opcoes: { espelhar?: boolean; forcar?: boolean }, inicio: number): Promise<ResumoSincronizacao> {
  const espelhar = opcoes.espelhar ?? true;
  const { checkIn, checkOut } = datasExemplo(7, 2);
  const resposta = await fetchTarifas(checkIn, checkOut, 2, 0, { timeoutMs: 25_000 });
  const motor: WorkerQuarto[] = [...resposta.quartos, ...resposta.indisponiveis];
  if (!motor.length) throw new Error("O motor não devolveu suítes; nenhuma foto foi alterada.");

  return comSql(async (sql) => {
    /* As colunas da 0022, se o banco ainda não as tiver (src/lib/esquema-midias.ts). */
    await garantirEsquemaMidias(sql);
    /* Uma rodada por vez (o botão e o agendador podem coincidir). */
    const [trava] = await sql<{ livre: boolean }[]>`SELECT pg_try_advisory_lock(20261102) AS livre`;
    if (!trava?.livre) throw new Error("Já há uma sincronização de fotos em andamento.");
    try {
      return await rodar(sql, motor, { checkIn, checkOut }, espelhar, inicio, opcoes.forcar === true);
    } finally {
      await sql`SELECT pg_advisory_unlock(20261102)`.catch(() => {});
    }
  });
}

export async function ultimoErroSincronizacao(sql: Sql): Promise<{ em: string; erro: string } | null> {
  const [l] = await sql<{ valor: string }[]>`SELECT valor FROM integracoes WHERE chave = 'fotos_sync_erro'`.catch(() => []);
  if (!l) return null;
  try { return JSON.parse(l.valor); } catch { return null; }
}

async function rodar(sql: Sql, motor: WorkerQuarto[], periodo: { checkIn: string; checkOut: string }, espelhar: boolean, inicio: number, forcar = false): Promise<ResumoSincronizacao> {
  const resumo: ResumoSincronizacao = {
    consultado_em: new Date().toISOString(),
    periodo_consulta: { check_in: periodo.checkIn, check_out: periodo.checkOut },
    suites_motor: 0, suites_criadas: [], suites_ativadas: [], suites_desativadas: [], fotos_novas: 0, fotos_espelhadas: 0, fotos_removidas: 0,
    fotos_aguardando_remocao: 0, fotos_ja_presentes: 0, suites_sem_fotos_validas: 0, espelho: espelhar && blobConfigurado() ? "blob" : "sem_blob",
    espelho_pendentes: 0, suites_lista_antiga: [], fotos_conferidas: 0, fotos_trocadas: 0, forcada: forcar, suites: [], avisos: [],
  };
  /* O espelho tem um orçamento de tempo: estourou, a foto entra apontando
     para o Desbravador e é copiada numa rodada seguinte (espelho atrasado). */
  const podeEspelhar = () => espelhar && resumo.espelho === "blob" && Date.now() - inicio < ORCAMENTO_RODADA_MS;

  const locais = await sql<{ id: string; nome: string; slug: string; desbravador_room_id: string | null; ativo: boolean }[]>`
    SELECT id, nome, slug, desbravador_room_id, ativo FROM quartos`;
  const porCodigo = new Map<string, typeof locais[number]>();
  for (const q of locais) {
    if (!q.desbravador_room_id) continue;
    const codigo = codigoQuartoMotor(q.desbravador_room_id);
    /* Dois cadastros com o mesmo código (ex.: "FAM" e "fam"): fica o ativo. */
    const atual = porCodigo.get(codigo);
    if (!atual || (!atual.ativo && q.ativo)) porCodigo.set(codigo, q);
  }
  const slugsUsados = new Set(locais.map((q) => q.slug));
  const vistos = new Set<string>();
  const paraApagarDoBlob: string[] = [];
  /* Desde quando cada foto do motor está ausente (URL → ISO). */
  const ausentes = await lerAusentes(sql);
  const historico = await lerHistorico(sql);
  const agoraIso = new Date().toISOString();

  for (const quarto of motor) {
    const codigo = codigoQuartoMotor(quarto.id);
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    resumo.suites_motor++;

    const doMotor = selecionarFotosDoMotor(quarto.fotos);
    const detalhe: DetalheSuite = {
      codigo, nome: quarto.nome, slug: null, ativo: null, motor: doMotor.length,
      site_antes: 0, site_depois: 0, novas: 0, removidas: 0, espelhadas: 0, aguardando_remocao: 0,
    };
    resumo.suites.push(detalhe);
    let local = porCodigo.get(codigo);

    /* O motor manda (decisão do proprietário, 04/11/2026): suíte que o
       Desbravador vende aparece no site — nova entra ativa; desligada no
       site é religada. Ninguém ativa/desativa quarto no painel. */
    if (!local) {
      const slug = slugDe(quarto.nome, slugsUsados);
      const [criada] = await sql<{ id: string; nome: string; slug: string; desbravador_room_id: string; ativo: boolean }[]>`
        INSERT INTO quartos (nome, slug, descricao_motor, ocupacao_max, capacidade_adultos, diaria_minima, desbravador_room_id, ordem, ativo)
        VALUES (${quarto.nome}, ${slug}, ${quarto.categoria || null}, ${quarto.ocupacao_max || 2}, ${Math.min(2, quarto.ocupacao_max || 2)},
                ${quarto.estadia_minima || 1}, ${codigo}, ${100 + resumo.suites_criadas.length}, true)
        ON CONFLICT (desbravador_room_id) DO NOTHING
        RETURNING id, nome, slug, desbravador_room_id, ativo`;
      if (!criada) { detalhe.nota = "não foi possível criar o cadastro"; continue; }
      local = criada;
      porCodigo.set(codigo, criada);
      resumo.suites_criadas.push(quarto.nome);
      detalhe.nota = "cadastro criado (o motor vende)";
    } else if (!local.ativo) {
      await sql`UPDATE quartos SET ativo = true WHERE id = ${local.id}`;
      local = { ...local, ativo: true };
      porCodigo.set(codigo, local);
      resumo.suites_ativadas.push(local.nome);
      detalhe.nota = "ativada: o motor vende";
    }
    detalhe.slug = local.slug;
    detalhe.ativo = local.ativo;

    const anteriores = await sql<LinhaMidia[]>`
      SELECT id, url, url_origem, origem, ordem, pathname FROM midias
      WHERE quarto_id = ${local.id} AND tipo = 'foto' ORDER BY ordem`;
    detalhe.site_antes = anteriores.length;
    /* A foto é reconhecida pela URL do motor: antes do espelho ela é a própria
       `url`; depois, fica em `url_origem`. */
    const conhecidas = new Map<string, LinhaMidia>();
    for (const m of anteriores) { conhecidas.set(m.url, m); if (m.url_origem) conhecidas.set(m.url_origem, m); }

    /* O motor voltou atrás? A lista que vale é a mais recente que ele já
       mostrou, não a que veio por último (fotos-motor-historico.ts). */
    const noSite = anteriores.filter((m) => m.origem === "desbravador").map((m) => m.url_origem ?? m.url);
    const decisao = decidirLista(historico[codigo], doMotor, agoraIso, { forcar, noSite });
    historico[codigo] = decisao.historico;
    const efetiva = decisao.acao === "ignorar" ? decisao.vigente : doMotor;
    if (decisao.acao === "ignorar") {
      resumo.suites_lista_antiga.push(quarto.nome);
      detalhe.nota = (detalhe.nota ? detalhe.nota + "; " : "") + decisao.motivo;
    }

    if (!doMotor.length) {
      resumo.suites_sem_fotos_validas++;
      if (decisao.acao !== "ignorar") detalhe.nota = (detalhe.nota ? detalhe.nota + "; " : "") + "o motor não trouxe foto válida";
    }
    if (efetiva.length) {
      let ordem = anteriores.reduce((n, f) => Math.max(n, f.ordem), -1) + 1;
      for (const foto of efetiva) {
        if (conhecidas.has(foto)) { resumo.fotos_ja_presentes++; continue; }
        const espelho = podeEspelhar() ? await espelharNoBlob(foto, `fotos/desbravador/${local.slug}/${ordem}`) : null;
        const [inserida] = await sql<{ id: string }[]>`
          INSERT INTO midias (quarto_id, url, url_origem, origem, alt, tipo, secao, ordem, destaque, pathname, bytes)
          SELECT ${local.id}, ${espelho?.url ?? foto}, ${foto}, 'desbravador', ${"Foto da suíte " + local.nome}, 'foto', 'quarto', ${ordem}, false,
                 ${espelho?.pathname ?? null}::text, ${espelho?.bytes ?? null}::bigint
          WHERE NOT EXISTS (SELECT 1 FROM midias WHERE quarto_id = ${local.id} AND tipo = 'foto' AND (url = ${foto} OR url_origem = ${foto}))
          RETURNING id`;
        if (inserida) {
          resumo.fotos_novas++; detalhe.novas++;
          if (espelho) { resumo.fotos_espelhadas++; detalhe.espelhadas++; }
          conhecidas.set(foto, { id: inserida.id, url: espelho?.url ?? foto, url_origem: foto, origem: "desbravador", ordem, pathname: espelho?.pathname ?? null });
          ordem++;
        }
      }
    }

    /* Foto do motor que não veio mais: sai do site — mas só depois da
       carência, para o motor "piscando" não apagar e recriar fotos. As do
       painel ficam sempre. (Lista antiga ignorada: vale a lista em vigor.) */
    const atuais = new Set(efetiva);
    for (const m of anteriores) {
      if (m.origem !== "desbravador") continue;
      const chave = m.url_origem ?? m.url;
      if (atuais.has(chave)) { delete ausentes[chave]; continue; }
      const desde = ausentes[chave];
      if (!desde || Date.now() - Date.parse(desde) < CARENCIA_REMOCAO_MS) {
        if (!desde) ausentes[chave] = agoraIso;
        resumo.fotos_aguardando_remocao++; detalhe.aguardando_remocao++;
        continue;
      }
      await sql`DELETE FROM midias WHERE id = ${m.id} AND origem = 'desbravador'`;
      delete ausentes[chave];
      resumo.fotos_removidas++; detalhe.removidas++;
      if (m.pathname) paraApagarDoBlob.push(m.pathname);
    }
    if (detalhe.aguardando_remocao) {
      detalhe.nota = (detalhe.nota ? detalhe.nota + "; " : "") + `${detalhe.aguardando_remocao} foto(s) sumiram do motor; saem se continuarem ausentes`;
    }
    detalhe.site_depois = detalhe.site_antes + detalhe.novas - detalhe.removidas;
  }

  await apagarDoBlob(paraApagarDoBlob);
  await gravarAusentes(sql, ausentes);
  await gravarHistorico(sql, historico);

  /* Suíte com código do motor que o motor não devolveu nesta rodada sai do
     site (volta sozinha quando o motor voltar a vendê-la). Só quando a
     resposta do motor parece inteira: com menos de 3 tipos, não se mexe. */
  if (resumo.suites_motor >= 3) {
    const codigos = [...vistos];
    const desligadas = await sql<{ nome: string }[]>`
      UPDATE quartos SET ativo = false
      WHERE ativo = true AND desbravador_room_id IS NOT NULL AND btrim(desbravador_room_id) <> ''
        AND upper(btrim(desbravador_room_id)) <> ALL(${codigos}::text[])
      RETURNING nome`;
    resumo.suites_desativadas = desligadas.map((q) => q.nome);
  }

  /* Espelho atrasado: fotos do motor que já estavam no banco antes de hoje
     (ou entraram sem tempo) ainda apontam para o Desbravador. Poucas por
     rodada, dentro do orçamento; a Marina e o site deixam de depender de lá. */
  const atrasadas = await sql<{ id: string; url: string; quarto_slug: string | null; ordem: number }[]>`
    SELECT m.id, m.url, q.slug AS quarto_slug, m.ordem FROM midias m LEFT JOIN quartos q ON q.id = m.quarto_id
    WHERE m.origem = 'desbravador' AND m.tipo = 'foto' AND m.pathname IS NULL
      AND m.url LIKE 'https://reservas.desbravador.com.br/%'
    ORDER BY m.criado_em LIMIT ${ESPELHO_ATRASADO_POR_RODADA + 40}`;
  resumo.espelho_pendentes = atrasadas.length;
  for (const m of atrasadas.slice(0, ESPELHO_ATRASADO_POR_RODADA)) {
    if (!podeEspelhar()) break;
    const espelho = await espelharNoBlob(m.url, `fotos/desbravador/${m.quarto_slug ?? "suite"}/${m.ordem}`);
    if (!espelho) continue;
    await sql`UPDATE midias SET url = ${espelho.url}, url_origem = COALESCE(url_origem, ${m.url}), pathname = ${espelho.pathname}, bytes = ${espelho.bytes}, atualizado_em = now()
      WHERE id = ${m.id} AND pathname IS NULL`;
    resumo.fotos_espelhadas++;
    resumo.espelho_pendentes--;
  }

  /* Nunca derruba a rodada: o que importa (listas e remoções) já foi gravado. */
  await conferirCopias(sql, resumo, podeEspelhar, inicio).catch((e) => {
    resumo.avisos.push(`A conferência das cópias não terminou: ${(e as Error).message}`);
  });

  if (resumo.suites_lista_antiga.length) {
    resumo.avisos.push(`O motor devolveu uma lista de fotos antiga para: ${resumo.suites_lista_antiga.join(", ")}. O site manteve a lista mais recente (o botão "Sincronizar com o Desbravador" em Mídias força a lista atual do motor).`);
  }
  if (resumo.fotos_trocadas) {
    resumo.avisos.push(`${resumo.fotos_trocadas} foto(s) mudaram no Desbravador sem mudar de nome e foram copiadas de novo.`);
  }
  if (resumo.suites_criadas.length) {
    resumo.avisos.push(`Suíte(s) nova(s) do motor cadastrada(s) e já no site: ${resumo.suites_criadas.join(", ")}. Revise descrição e detalhes em Hospedagem → Quartos.`);
  }
  if (resumo.suites_ativadas.length) {
    resumo.avisos.push(`Suíte(s) ligada(s) no site porque o motor vende: ${resumo.suites_ativadas.join(", ")}.`);
  }
  if (resumo.suites_desativadas.length) {
    resumo.avisos.push(`Suíte(s) desligada(s) do site porque o motor não devolveu mais: ${resumo.suites_desativadas.join(", ")}. Volta sozinha se o motor voltar a vendê-la.`);
  }
  if (resumo.espelho === "sem_blob" && resumo.fotos_novas) {
    resumo.avisos.push("Sem BLOB_READ_WRITE_TOKEN na Vercel, as fotos ficam apontando para o servidor do Desbravador.");
  }
  if (resumo.fotos_aguardando_remocao) {
    resumo.avisos.push(`${resumo.fotos_aguardando_remocao} foto(s) sumiram do motor nesta rodada; ficam no site até a ausência se confirmar (carência de ${Math.max(1, Math.round(CARENCIA_REMOCAO_MS / 60_000))} min).`);
  }
  if (resumo.espelho === "blob" && resumo.espelho_pendentes > 0) {
    resumo.avisos.push(`${resumo.espelho_pendentes} foto(s) ainda apontam para o Desbravador; o espelho copia algumas a cada rodada.`);
  }
  /* Gravado por último, com os avisos: é o que o Diagnóstico mostra. */
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('fotos_sync', ${JSON.stringify(resumo)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`.catch(() => {});
  return resumo;
}

/* ── as cópias no Blob ainda batem com o Desbravador? ───────────── */

/**
 * Foto trocada no Desbravador COM O MESMO NOME de arquivo não aparece na
 * lista do motor como nova — a cópia ficaria velha para sempre. Por rodada,
 * algumas cópias (as há mais tempo sem conferir) são comparadas pelo
 * tamanho em bytes com o original (uma consulta HEAD, só cabeçalhos); se
 * mudou, a foto é copiada de novo. Nunca derruba a rodada.
 */
async function conferirCopias(sql: Sql, resumo: ResumoSincronizacao, podeEspelhar: () => boolean, inicio: number): Promise<void> {
  if (resumo.espelho !== "blob") return;
  type Copia = { id: string; url_origem: string; bytes: string | number | null; pathname: string; ordem: number; quarto_slug: string | null };
  let copias: Copia[] = [];
  try {
    copias = [...await sql<Copia[]>`
      SELECT m.id, m.url_origem, m.bytes, m.pathname, m.ordem, q.slug AS quarto_slug
      FROM midias m LEFT JOIN quartos q ON q.id = m.quarto_id
      WHERE m.origem = 'desbravador' AND m.tipo = 'foto' AND m.pathname IS NOT NULL AND m.bytes IS NOT NULL
        AND m.url_origem LIKE 'https://reservas.desbravador.com.br/%'
      ORDER BY m.atualizado_em ASC NULLS FIRST, m.criado_em ASC LIMIT ${CONFERIR_POR_RODADA}`];
  } catch { return; }
  for (const m of copias) {
    if (Date.now() - inicio > ORCAMENTO_RODADA_MS) break;
    let tamanho: number | null = null;
    try {
      const r = await fetch(m.url_origem, { method: "HEAD", signal: AbortSignal.timeout(4_000), headers: { accept: "image/*" } });
      if (r.ok) { const n = Number(r.headers.get("content-length")); tamanho = Number.isFinite(n) && n > 0 ? n : null; }
    } catch { /* sem resposta: fica para a próxima */ }
    if (tamanho !== null) resumo.fotos_conferidas++;
    if (tamanho !== null && tamanho !== Number(m.bytes)) {
      const espelho = podeEspelhar() ? await espelharNoBlob(m.url_origem, `fotos/desbravador/${m.quarto_slug ?? "suite"}/${m.ordem}`) : null;
      if (espelho) {
        await sql`UPDATE midias SET url = ${espelho.url}, pathname = ${espelho.pathname}, bytes = ${espelho.bytes}, atualizado_em = now() WHERE id = ${m.id}`;
        await apagarDoBlob([m.pathname]);
        resumo.fotos_trocadas++;
        continue;
      }
    }
    /* Conferida: vai para o fim da fila. */
    await sql`UPDATE midias SET atualizado_em = now() WHERE id = ${m.id}`.catch(() => {});
  }
}

/* ── o que o motor já mostrou (fotos-motor-historico.ts) ─────────── */

async function lerHistorico(sql: Sql): Promise<Historico> {
  const [l] = await sql<{ valor: string }[]>`SELECT valor FROM integracoes WHERE chave = 'fotos_sync_historico'`.catch(() => []);
  if (!l) return {};
  try {
    const v = JSON.parse(l.valor);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Historico) : {};
  } catch { return {}; }
}

async function gravarHistorico(sql: Sql, historico: Historico): Promise<void> {
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('fotos_sync_historico', ${JSON.stringify(historico)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`.catch(() => {});
}

/* ── fotos ausentes do motor, com a hora em que sumiram ─────────── */

async function lerAusentes(sql: Sql): Promise<Record<string, string>> {
  const [l] = await sql<{ valor: string }[]>`SELECT valor FROM integracoes WHERE chave = 'fotos_sync_ausentes'`.catch(() => []);
  if (!l) return {};
  try {
    const v = JSON.parse(l.valor);
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch { return {}; }
}

async function gravarAusentes(sql: Sql, ausentes: Record<string, string>): Promise<void> {
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES ('fotos_sync_ausentes', ${JSON.stringify(ausentes)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`.catch(() => {});
}

/* ── a última rodada, para o painel ─────────────────────────────── */

export async function ultimaSincronizacao(sql: Sql): Promise<{ em: Date; resumo: ResumoSincronizacao } | null> {
  const [l] = await sql<{ valor: string; atualizado_em: Date }[]>`SELECT valor, atualizado_em FROM integracoes WHERE chave = 'fotos_sync'`.catch(() => []);
  if (!l) return null;
  try { return { em: new Date(l.atualizado_em), resumo: JSON.parse(l.valor) }; } catch { return null; }
}

/* De carona, no máximo uma vez por hora (pela hora gravada no banco), sem
   atrasar quem está buscando. A memória do processo só evita perguntar ao
   banco a cada busca numa rajada; quem decide é o banco. */
let ultimaCarona = 0;
const INTERVALO_CARONA_PROCESSO_MS = 60_000;
export async function talvezSincronizarFotos(sql: Sql): Promise<void> {
  if (Date.now() - ultimaCarona < INTERVALO_CARONA_PROCESSO_MS) return;
  ultimaCarona = Date.now();
  try {
    const ultima = await ultimaSincronizacao(sql);
    if (ultima && Date.now() - ultima.em.getTime() < INTERVALO_CARONA_MS) return;
    await sincronizarFotosDoMotor();
  } catch (e) {
    console.warn("[fotos] sincronização de carona não concluiu:", (e as Error).message);
  }
}
