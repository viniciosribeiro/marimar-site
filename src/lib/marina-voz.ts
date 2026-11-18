import type { Sql } from "./db-conexao";
import { montarTreinamento } from "./marina";
import { catalogoParaPrompt } from "./marina-voz-acoes";
import {
  normalizarPrecos, estimarCentavos, type PrecosVoz,
} from "./marina-voz-base";

/**
 * Modo voz do treinamento — lado do servidor (chave, banco, gateway).
 *
 * Monta o pedido que vai à Marina (o MESMO gateway e o MESMO treinamento do
 * chat, só que com um contexto de voz e a lista de ações que ela pode
 * propor), lê/grava o teto de gasto, soma o uso do mês e guarda a sessão
 * (conversa falada + o que foi feito + custo).
 */

/* ── o pedido à Marina ───────────────────────────────────────────── */

const VOZ_CONTEXTO = [
  "VOCÊ ESTÁ NO MODO DE TREINAMENTO E OPERAÇÃO POR VOZ. Esqueça, NESTA conversa, a",
  "persona de atendimento de hóspede: aqui você NÃO fala com um hóspede e NÃO é só a",
  "atendente do site. Você fala com a EQUIPE da Pousada Marimar, que te ensina e te",
  "pede para mexer no painel. Trate quem fala como um colega da pousada.",
  "",
  "VOCÊ PODE, SIM, FAZER COISAS AQUI. NUNCA responda que \"não consigo\", \"não tenho",
  "acesso\" ou \"só consulto\". Nesta tela você tem capacidades REAIS:",
  "",
  "1) AGIR NO PAINEL: quando pedirem para criar, mudar, ensinar, apagar, ligar,",
  "   desligar ou atualizar qualquer coisa da lista de AÇÕES abaixo, você PROPÕE a",
  "   ação no bloco indicado e pergunta \"confirma?\". O sistema executa só depois do",
  "   \"sim\" — por isso você nunca diz que já fez, mas também nunca diz que não dá.",
  "2) FALAR SOBRE O QUE ACONTECEU: você PODE responder sobre as conversas recentes",
  "   dos hóspedes e sobre as mudanças recentes do painel — está tudo na seção",
  "   \"O QUE ANDOU ACONTECENDO\" abaixo. Responda com esses dados; se pedirem algo que",
  "   não está ali, diga o que você tem e ofereça abrir a tela certa.",
  "3) APRENDER: há perguntas que você não soube responder (lista abaixo) — puxe UMA",
  "   de cada vez, confirme o que ouviu e ofereça guardar (ação ensinar).",
  "",
  "COMO FALAR: curto e natural, como numa ligação — uma ou duas frases por vez. Nada",
  "de listas, títulos, markdown, asteriscos, emojis nem links/endereços: tudo o que",
  "você escrever fora do bloco de ação vira ÁUDIO e será ouvido.",
].join("\n");

function blocoDeAcoes(tecnico: boolean): string {
  return [
    "── AÇÕES QUE VOCÊ PODE FAZER NO PAINEL ──",
    catalogoParaPrompt(tecnico),
    "",
    "REGRA IMPORTANTE: sempre que a pessoa PEDIR para fazer, mudar, criar, ensinar,",
    "apagar, ligar, desligar ou atualizar qualquer coisa da lista acima, você NÃO",
    "explica o passo a passo e NÃO diz que não consegue — você PROPÕE a ação no",
    "bloco abaixo e termina perguntando \"confirma?\". Só responda sem ação quando",
    "for realmente uma pergunta ou um papo, não um pedido de mudança.",
    "",
    "Formato (UM bloco por resposta; o resto do texto não é lido — só a \"fala\"):",
    '[[acao]]{"nome":"<nome da ação>","dados":{...},"fala":"<sua pergunta de confirmação, curta>"}[[/acao]]',
    "",
    "Exemplos:",
    '• "anota que o check-in é às 14 horas" →',
    '  [[acao]]{"nome":"ensinar","dados":{"tipo":"fato","titulo":"Horário de check-in","conteudo":"O check-in começa às 14h."},"fala":"Vou guardar que o check-in começa às 14 horas, confirma?"}[[/acao]]',
    '• "muda o WhatsApp da pousada para 41 99999-0000" →',
    '  [[acao]]{"nome":"dados_pousada","dados":{"whatsapp":"5541999990000"},"fala":"Vou trocar o WhatsApp para 41 99999-0000, confirma?"}[[/acao]]',
    '• "criança até 5 anos é de colo" →',
    '  [[acao]]{"nome":"regra_criancas","dados":{"idade_colo_max":5},"fala":"Vou pôr criança de colo até 5 anos, confirma?"}[[/acao]]',
    '• "cria um adicional de café no quarto por 30 reais" →',
    '  [[acao]]{"nome":"adicional","dados":{"nome":"Café no quarto","preco":30,"cobranca":"por_unidade"},"fala":"Vou criar o adicional Café no quarto por 30 reais, confirma?"}[[/acao]]',
  ].join("\n");
}

function blocoDeLacunas(lacunas: { id: string; pergunta: string }[]): string {
  if (!lacunas.length) return "";
  return [
    "── PERGUNTAS QUE VOCÊ NÃO SOUBE RESPONDER (puxe UMA de cada vez) ──",
    ...lacunas.map((l) => `- (${l.id}) ${l.pergunta}`),
    "Quando ensinarem a resposta de uma destas, use a ação ensinar com o lacuna_id",
    "igual ao código entre parênteses, para fechar a pendência junto.",
  ].join("\n");
}

export async function lacunasAbertas(sql: Sql, limite = 8): Promise<{ id: string; pergunta: string }[]> {
  return sql<{ id: string; pergunta: string }[]>`
    SELECT id, pergunta FROM marina_lacunas
    WHERE status = 'aberta' ORDER BY criado_em DESC LIMIT ${limite}`.catch(() => []);
}

/**
 * A última conversa de treino DESTA pessoa, para retomar de onde parou.
 * Pega a sessão de voz mais recente com fala e devolve os últimos turnos.
 */
export async function ultimaConversa(sql: Sql, autor: string, limite = 6): Promise<{ turnos: { papel: "voce" | "marina"; texto: string }[]; quando: string | null }> {
  const linhas = await sql<{ transcricao: unknown; criado_em: Date }[]>`
    SELECT transcricao, criado_em FROM marina_voz_sessao
    WHERE autor = ${autor} AND jsonb_array_length(transcricao) > 0
    ORDER BY criado_em DESC LIMIT 1`.catch(() => []);
  const l = linhas[0];
  if (!l || !Array.isArray(l.transcricao)) return { turnos: [], quando: null };
  const turnos = (l.transcricao as { papel?: unknown; texto?: unknown }[])
    .filter((t) => (t.papel === "voce" || t.papel === "marina") && typeof t.texto === "string")
    .map((t) => ({ papel: t.papel as "voce" | "marina", texto: (t.texto as string).slice(0, 400) }))
    .slice(-limite);
  return { turnos, quando: l.criado_em ? new Date(l.criado_em).toISOString() : null };
}

/* ── o que andou acontecendo (para ela responder sobre conversas e ações) ── */

const rotuloAcao = (a: string): string => (({
  criou: "ensinou", editou: "editou", ligou: "ligou", desligou: "desligou",
  excluiu: "mandou p/ lixeira", restaurou: "restaurou", "voltou-versao": "voltou versão", testou: "testou",
} as Record<string, string>)[a] ?? a);

/** Últimas perguntas de hóspedes e últimas mudanças no painel. */
export async function atividadeRecente(sql: Sql): Promise<{ conversas: string[]; mudancas: string[] }> {
  const [conversas, mudancas] = await Promise.all([
    sql<{ conteudo: string }[]>`
      SELECT conteudo FROM chat_mensagens
      WHERE papel = 'visitante' AND length(conteudo) > 2
      ORDER BY criado_em DESC LIMIT 8`.catch(() => []),
    sql<{ acao: string; autor: string | null; titulo: string | null }[]>`
      SELECT h.acao, h.autor, c.titulo
      FROM marina_historico h LEFT JOIN marina_conhecimento c ON c.id = h.conhecimento_id
      ORDER BY h.criado_em DESC LIMIT 8`.catch(() => []),
  ]);
  return {
    conversas: conversas.map((c) => c.conteudo.replace(/\s+/g, " ").trim().slice(0, 120)),
    mudancas: mudancas.map((m) => `${rotuloAcao(m.acao)} "${(m.titulo ?? "item").slice(0, 60)}"${m.autor ? ` — ${m.autor}` : ""}`),
  };
}

function blocoDeAtividade(a: { conversas: string[]; mudancas: string[] }): string {
  if (!a.conversas.length && !a.mudancas.length) return "";
  const linhas = ["── O QUE ANDOU ACONTECENDO (use para responder quando perguntarem sobre conversas ou mudanças) ──"];
  if (a.conversas.length) {
    linhas.push("Últimas perguntas de hóspedes no chat do site:");
    linhas.push(...a.conversas.map((c) => `- ${c}`));
  }
  if (a.mudancas.length) {
    linhas.push("Últimas mudanças no treinamento/painel:");
    linhas.push(...a.mudancas.map((m) => `- ${m}`));
  }
  return linhas.join("\n");
}

/** O pedido completo de sistema para o modo voz. */
export async function montarSistemaVoz(sql: Sql, tecnico: boolean): Promise<{ sistema: string; lacunas: { id: string; pergunta: string }[] }> {
  const [{ texto }, lacunas, atividade] = await Promise.all([
    montarTreinamento(sql, "teste"),
    lacunasAbertas(sql),
    atividadeRecente(sql),
  ]);
  const sistema = [
    VOZ_CONTEXTO,
    blocoDeAcoes(tecnico),
    blocoDeAtividade(atividade),
    blocoDeLacunas(lacunas),
    "── O QUE A POUSADA TE ENSINOU (a base das suas respostas) ──",
    texto,
  ].filter(Boolean).join("\n\n");
  return { sistema, lacunas };
}

/* ── teto de gasto (estimativa) ──────────────────────────────────── */

const CHAVE_CONFIG = "voz_treino_config";

export async function lerPrecosVoz(sql: Sql): Promise<PrecosVoz> {
  const [l] = await sql<{ valor: string | null }[]>`SELECT valor FROM integracoes WHERE chave = ${CHAVE_CONFIG}`.catch(() => []);
  let bruto: unknown = {};
  try { bruto = l?.valor ? JSON.parse(l.valor) : {}; } catch { /* volta ao padrão */ }
  return normalizarPrecos(bruto);
}

export async function gravarPrecosVoz(sql: Sql, precos: PrecosVoz): Promise<void> {
  await sql`
    INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (${CHAVE_CONFIG}, ${JSON.stringify(precos)}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = now()`;
}

/** Gasto estimado do mês corrente (todas as sessões de voz do treinamento). */
export async function usoDoMesCentavos(sql: Sql, precos: PrecosVoz): Promise<number> {
  const [l] = await sql<{ tts: number; stt: number }[]>`
    SELECT COALESCE(SUM(tts_caracteres), 0)::int AS tts, COALESCE(SUM(stt_segundos), 0)::int AS stt
    FROM marina_voz_sessao WHERE criado_em >= date_trunc('month', now())`.catch(() => [{ tts: 0, stt: 0 }]);
  return estimarCentavos(l?.tts ?? 0, l?.stt ?? 0, precos);
}

/* ── a sessão (conversa falada + o que foi feito + custo) ─────────── */

type Turno = { papel: "voce" | "marina"; texto: string };

export async function garantirSessao(sql: Sql, id: string, autor: string): Promise<void> {
  await sql`
    INSERT INTO marina_voz_sessao (id, autor) VALUES (${id}, ${autor})
    ON CONFLICT (id) DO NOTHING`;
}

export async function anexarTranscricao(sql: Sql, id: string, turnos: Turno[]): Promise<void> {
  if (!turnos.length) return;
  const agora = new Date().toISOString();
  const novos = turnos.map((t) => ({ ...t, em: agora }));
  await sql`
    UPDATE marina_voz_sessao
    SET transcricao = transcricao || ${sql.json(novos)}::jsonb, atualizado_em = now()
    WHERE id = ${id}`;
}

export async function somarCusto(sql: Sql, id: string, extra: { ttsCaracteres?: number; sttSegundos?: number }): Promise<void> {
  await sql`
    UPDATE marina_voz_sessao
    SET tts_caracteres = tts_caracteres + ${Math.max(0, Math.round(extra.ttsCaracteres ?? 0))},
        stt_segundos   = stt_segundos   + ${Math.max(0, Math.round(extra.sttSegundos ?? 0))},
        atualizado_em = now()
    WHERE id = ${id}`;
}

export async function anexarAcaoFeita(sql: Sql, id: string, acao: { nome: string; resumo: string }): Promise<void> {
  const registro = [{ ...acao, em: new Date().toISOString() }];
  await sql`
    UPDATE marina_voz_sessao
    SET acoes = acoes || ${sql.json(registro)}::jsonb, atualizado_em = now()
    WHERE id = ${id}`;
}

export async function encerrarSessao(sql: Sql, id: string): Promise<void> {
  await sql`UPDATE marina_voz_sessao SET encerrado_em = now(), atualizado_em = now() WHERE id = ${id} AND encerrado_em IS NULL`;
}
