import type { Sql } from "./db-conexao";
import { montarTreinamento } from "./marina";
import { CONTEXTO_CANAL } from "./chat";
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
  "Você está numa conversa POR VOZ com a equipe da Pousada Marimar. É a central de",
  "treinamento: quem fala com você trabalha na pousada e está te ensinando e te",
  "pedindo ajustes. NÃO é um hóspede.",
  "",
  "Fale CURTO e natural, como numa ligação: no máximo uma ou duas frases por vez.",
  "Nada de listas, títulos, markdown, asteriscos, emojis nem links/endereços — tudo",
  "o que você escrever (fora do bloco de ação) vira ÁUDIO e será ouvido.",
  "",
  "Seu papel aqui tem dois lados:",
  "1) APRENDER: ajude a preencher o que falta. Há perguntas que você não soube",
  "   responder antes (lista abaixo) — puxe UMA de cada vez, de forma leve, confirme",
  "   o que ouviu e ofereça guardar.",
  "2) AGIR NO PAINEL: quando pedirem para mudar algo que está na lista de AÇÕES, não",
  "   descreva o passo a passo — PROPONHA a ação no formato abaixo e termine",
  "   perguntando \"confirma?\". NUNCA diga que já fez: quem confirma é a pessoa, e o",
  "   sistema só executa depois do \"sim\".",
  "",
  "Se pedirem algo que não está na lista de ações, diga com naturalidade que por voz",
  "ainda não dá para fazer isso, e siga ajudando (dá para ensinar/anotar mesmo assim).",
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

/** O pedido completo de sistema para o modo voz. */
export async function montarSistemaVoz(sql: Sql, tecnico: boolean): Promise<{ sistema: string; lacunas: { id: string; pergunta: string }[] }> {
  const [{ texto }, lacunas] = await Promise.all([
    montarTreinamento(sql, "teste"),
    lacunasAbertas(sql),
  ]);
  const sistema = [
    VOZ_CONTEXTO,
    "Contexto dos canais (vale também aqui, menos a parte de fotos, que a voz não envia):",
    CONTEXTO_CANAL,
    texto,
    blocoDeAcoes(tecnico),
    blocoDeLacunas(lacunas),
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
