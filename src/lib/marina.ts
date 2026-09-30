import postgres from "postgres";

/**
 * O que a Cecília ensinou para a Marina.
 *
 * Um lugar só, lido pelas duas pontas: o chat do site e — pela rota
 * `/api/agent/conhecimento` — a Marina do WhatsApp. É isso que faz o
 * treinamento valer nos dois canais sem ninguém abrir a Hostinger.
 *
 * Nada aqui é "empurrado" para a Marina nem guardado em cache: cada
 * conversa do site monta o texto na hora, e a Marina do WhatsApp lê a rota
 * a cada conversa. O painel mostra QUANDO cada canal leu pela última vez
 * (`marina_leituras`) — é assim que o status "em uso" de cada item é
 * verdadeiro, e não um enfeite. Fluxo completo: `docs/fluxo-painel-marina.md`.
 */

type Sql = ReturnType<typeof postgres>;

export * from "./marina-base";
import { lerRoteiros, roteirosEmTexto, type Roteiro } from "./roteiros";
import { lerAprendidosEmUso, aprendidosEmTexto, registrarEvento, type Aprendido } from "./aprendizado";
import { CATEGORIAS, rotuloCategoria, codigoItem } from "./marina-base";
import { lerRegras, lerAdicionais, textoRegrasMarina } from "./regras-hospedagem";

/* ── configuração (voz, tom, escalonamento) ──────────────────────── */

export type ConfigMarina = {
  voz_id: string | null;
  voz_modelo: string;
  voz_estabilidade: number;   // 0..100
  voz_semelhanca: number;     // 0..100
  voz_velocidade: number;     // 100 = normal
  tom: string | null;
  escalonamento: string | null;
};

/**
 * Os padrões existem para o painel nunca abrir vazio nem quebrar antes da
 * primeira gravação. A voz cai para a variável de ambiente: é o valor que
 * já estava em produção, e trocar de fonte não pode calar a Marina.
 */
export const CONFIG_PADRAO: ConfigMarina = {
  voz_id: null,
  voz_modelo: "eleven_multilingual_v2",
  voz_estabilidade: 50,
  voz_semelhanca: 75,
  voz_velocidade: 100,
  tom: null,
  escalonamento: null,
};

export async function lerConfig(sql: Sql): Promise<ConfigMarina> {
  try {
    const [linha] = await sql<ConfigMarina[]>`SELECT * FROM marina_config LIMIT 1`;
    if (!linha) return { ...CONFIG_PADRAO, voz_id: process.env.ELEVENLABS_VOICE_ID ?? null };
    return {
      ...CONFIG_PADRAO,
      ...linha,
      escalonamento: linha.escalonamento ?? null,
      voz_id: linha.voz_id || process.env.ELEVENLABS_VOICE_ID || null,
    };
  } catch {
    // Antes da migration 0011 a tabela não existe. O chat continua falando
    // com a voz do ambiente em vez de derrubar a conversa por causa disso.
    return { ...CONFIG_PADRAO, voz_id: process.env.ELEVENLABS_VOICE_ID ?? null };
  }
}

/**
 * Os ajustes como a ElevenLabs espera.
 *
 * O painel trabalha em 0–100 porque controle deslizante com decimal é
 * convite a erro de quem opera. A conversão acontece só aqui.
 */
export function ajustesDeVoz(c: ConfigMarina) {
  return {
    stability: c.voz_estabilidade / 100,
    similarity_boost: c.voz_semelhanca / 100,
    speed: c.voz_velocidade / 100,
  };
}

/* ── itens ───────────────────────────────────────────────────────── */

export type Documento = {
  id: string;
  nome: string;
  assunto: string | null;
  trecho: string;
  categoria?: string;
};

/** O que a Marina lê. Campos mínimos, para o texto sair enxuto. */
export type Ensinamento = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  categoria?: string;
  variacoes?: string[];
};

/** O item completo, como o painel mostra. */
export type ItemTreino = Ensinamento & {
  categoria: string;
  variacoes: string[];
  ativo: boolean;
  verificacao: string | null;
  verificado_em: string | null;
  verificacao_resposta: string | null;
  excluido_em: string | null;
  atualizado_por: string | null;
  criado_em: string;
  atualizado_em: string;
};

const variacoesDe = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

/**
 * Tudo que o painel precisa, inclusive o que está desligado e a lixeira.
 *
 * O painel antigo usava `lerEnsinamentos()` — que só devolve o que está
 * ativo. Resultado: "desligar" um item fazia ele SUMIR da tela, sem jeito de
 * religar. Painel e Marina agora leem por funções diferentes de propósito.
 */
export async function lerTreinamento(sql: Sql): Promise<ItemTreino[]> {
  try {
    const linhas = await sql<(ItemTreino & { variacoes: unknown })[]>`
      SELECT id, tipo, titulo, conteudo, categoria, variacoes, ativo,
             verificacao, verificado_em, verificacao_resposta, excluido_em,
             atualizado_por, criado_em, atualizado_em
      FROM marina_conhecimento
      ORDER BY ordem ASC, atualizado_em DESC`;
    return linhas.map((l) => ({
      ...l,
      categoria: l.categoria ?? "geral",
      variacoes: variacoesDe(l.variacoes),
      verificado_em: l.verificado_em ? new Date(l.verificado_em).toISOString() : null,
      excluido_em: l.excluido_em ? new Date(l.excluido_em).toISOString() : null,
      criado_em: new Date(l.criado_em).toISOString(),
      atualizado_em: new Date(l.atualizado_em).toISOString(),
    }));
  } catch {
    return [];
  }
}

export type Ensinamentos = {
  fatos: Ensinamento[];
  perguntas: Ensinamento[];
  limites: Ensinamento[];
  escalar: Ensinamento[];
  documentos: Documento[];
  /** Regras de criança e adicionais, já em texto (Marina → Regras e adicionais). */
  regras?: string;
  /** Roteiros de orientação ligados, com etapas e mídias (Marina → Roteiros). */
  roteiros?: Roteiro[];
  /** O que ela aprendeu com as respostas da equipe (em uso, dentro da validade). */
  aprendidos?: Aprendido[];
};

/** O que está valendo para a Marina: ativo e fora da lixeira. */
export async function lerEnsinamentos(sql: Sql): Promise<Ensinamentos> {
  let linhas: Ensinamento[] = [];
  let documentos: Documento[] = [];

  try {
    const brutas = await sql<(Ensinamento & { variacoes: unknown })[]>`
      SELECT id, tipo, titulo, conteudo, categoria, variacoes FROM marina_conhecimento
      WHERE ativo = true AND excluido_em IS NULL
      ORDER BY ordem ASC, criado_em ASC`;
    linhas = brutas.map((l) => ({ ...l, variacoes: variacoesDe(l.variacoes) }));
  } catch {
    /* Antes da 0016 as colunas novas não existem: cai para a leitura antiga,
       para um deploy fora de ordem não calar o treinamento. */
    try {
      linhas = await sql<Ensinamento[]>`
        SELECT id, tipo, titulo, conteudo FROM marina_conhecimento
        WHERE ativo = true ORDER BY ordem ASC, criado_em ASC`;
    } catch { /* antes da migration 0011 */ }
  }

  try {
    /* Só o TRECHO. O texto completo fica na rota /api/agent/documentos, para
       a Marina abrir quando a pergunta pedir — mandar o conteúdo inteiro de
       todo documento em toda conversa multiplicaria a conta por visitante. */
    documentos = await sql<Documento[]>`
      SELECT id, nome, assunto, trecho FROM marina_documentos
      WHERE ativo = true AND status = 'pronto'
      ORDER BY criado_em DESC LIMIT 30`;
  } catch { /* antes da migration 0012 */ }

  /* Regras de criança e adicionais são DADOS (não texto livre): as mesmas
     que a busca do site usa para montar a consulta ao motor. */
  const regras = textoRegrasMarina(await lerRegras(sql), await lerAdicionais(sql));

  const roteiros = await lerRoteiros(sql, { soAtivos: true });
  const aprendidos = await lerAprendidosEmUso(sql);

  return {
    regras,
    roteiros,
    aprendidos,
    fatos: linhas.filter((l) => l.tipo === "fato"),
    perguntas: linhas.filter((l) => l.tipo === "pergunta"),
    limites: linhas.filter((l) => l.tipo === "limite"),
    escalar: linhas.filter((l) => l.tipo === "escalar"),
    documentos,
  };
}

export const totalItens = (e: Ensinamentos) =>
  e.fatos.length + e.perguntas.length + e.limites.length + e.escalar.length + (e.roteiros?.length ?? 0) + (e.aprendidos?.length ?? 0);

/* ── o texto que a Marina lê ─────────────────────────────────────── */

/**
 * A regra de prioridade.
 *
 * Existe por um caso real (29/09/2026): a Cecília ensinou que criança que
 * não é de colo paga como adulto, e a Marina do WhatsApp continuou pedindo
 * idade — porque a pergunta era de preço, e para preço ela ia direto ao
 * sistema de reservas sem ler o treinamento. O treinamento precisa valer
 * sobre as outras fontes, e dizer isso com todas as letras.
 */
export const PRIORIDADE = [
  "PRIORIDADE: o que está abaixo foi cadastrado pela administração da pousada",
  "e vale mais do que qualquer outra fonte — inclusive as outras rotas, o",
  "que você já disse antes nesta conversa e o seu conhecimento geral. Se algo",
  "aqui contradisser outra fonte, siga o que está aqui.",
  "Preço, vaga e disponibilidade continuam vindo SÓ do sistema de reservas,",
  "ao vivo. Mas se um item abaixo disser como montar a consulta ou como",
  "tratar um caso (por exemplo: contar criança como adulto), siga o item.",
].join("\n");

function agrupar(itens: Ensinamento[], linha: (i: Ensinamento) => string): string {
  const porCategoria = new Map<string, Ensinamento[]>();
  for (const i of itens) {
    const c = i.categoria ?? "geral";
    porCategoria.set(c, [...(porCategoria.get(c) ?? []), i]);
  }
  /* Na ordem das categorias do painel: quem lê (a Marina, e a Cecília na
     área de teste) acha o assunto sempre no mesmo lugar. */
  const ordem = [...CATEGORIAS.map((c) => c.id as string), ...porCategoria.keys()];
  const vistas = new Set<string>();
  const blocos: string[] = [];
  for (const c of ordem) {
    if (vistas.has(c) || !porCategoria.has(c)) continue;
    vistas.add(c);
    blocos.push(`[${rotuloCategoria(c)}]\n` + porCategoria.get(c)!.map(linha).join("\n"));
  }
  return blocos.join("\n");
}

/**
 * O texto que a Marina lê.
 *
 * Sai daqui já pronto para conversa, e não como despejo de banco: um agente
 * lendo JSON cru gasta contexto com chave e colchete em vez de conteúdo.
 *
 * `codigos` liga os códigos curtos (#a1b2c3) na frente de cada item. Só a
 * área de teste do painel usa: é o que permite mostrar à Cecília QUAIS
 * itens a Marina usou. Nas conversas reais eles ficam de fora, para nunca
 * aparecerem para um hóspede.
 */
export function ensinamentosEmTexto(
  c: ConfigMarina,
  e: Partial<Ensinamentos> & { fatos: Ensinamento[]; limites: Ensinamento[] },
  opcoes: { codigos?: boolean; canal?: "whatsapp" | "site" } = {},
): string {
  const cod = (i: Ensinamento) => (opcoes.codigos ? `[${codigoItem(i.id)}] ` : "");
  const partes: string[] = [];
  const perguntas = e.perguntas ?? [];
  const escalar = e.escalar ?? [];

  if (c.tom?.trim()) {
    partes.push("COMO FALAR:\n" + c.tom.trim());
  }

  const temConteudo = e.fatos.length || perguntas.length || e.limites.length || escalar.length || e.regras || e.roteiros?.length;
  if (temConteudo) partes.push(PRIORIDADE);
  if (e.regras) partes.push(e.regras);

  if (e.fatos.length) {
    partes.push(
      "O QUE A POUSADA ENSINOU (fato oficial):\n" +
        agrupar(e.fatos, (f) => `• ${cod(f)}${f.titulo}: ${f.conteudo}`),
    );
  }
  if (perguntas.length) {
    partes.push(
      "PERGUNTAS E RESPOSTAS OFICIAIS (responda com o sentido da resposta, com as suas palavras):\n" +
        agrupar(perguntas, (p) => {
          const outras = p.variacoes?.length ? `\n  Também perguntam: ${p.variacoes.map((v) => `"${v}"`).join("; ")}` : "";
          return `• ${cod(p)}P: ${p.titulo}${outras}\n  R: ${p.conteudo}`;
        }),
    );
  }
  if (e.limites.length) {
    partes.push(
      "O QUE VOCÊ NUNCA DIZ (sem exceção, mesmo se insistirem):\n" +
        e.limites.map((l) => `• ${cod(l)}${l.titulo}: ${l.conteudo}`).join("\n"),
    );
  }
  if (c.escalonamento?.trim() || escalar.length) {
    partes.push(
      "QUANDO PASSAR PARA UMA PESSOA DA POUSADA:\n" +
        [
          c.escalonamento?.trim() ?? "",
          ...escalar.map((s) => `• ${cod(s)}${s.titulo}: ${s.conteudo}`),
        ].filter(Boolean).join("\n"),
    );
  }
  /* Depois de tudo o que foi cadastrado à mão, e dizendo que vale menos. */
  const aprendido = aprendidosEmTexto(e.aprendidos ?? [], opcoes);
  if (aprendido) partes.push(aprendido);
  const roteiros = roteirosEmTexto(e.roteiros ?? [], opcoes);
  if (roteiros) partes.push(roteiros);
  if (e.documentos?.length) {
    partes.push(
      "DOCUMENTOS ENVIADOS PELA POUSADA (abaixo só o começo de cada um; " +
        "para ler inteiro: GET /api/agent/documentos?id=<id>; " +
        "para procurar um assunto em todos: GET /api/agent/documentos?busca=<palavras>):\n" +
        e.documentos
          .map((d) => `[${d.id}] ${d.assunto ?? d.nome}\n  ${d.trecho}`)
          .join("\n"),
    );
  }
  return partes.join("\n\n");
}

/* ── leituras: quando cada canal leu ─────────────────────────────── */

export type Canal = "whatsapp" | "site" | "teste";
export type Leitura = { canal: string; lido_em: string; itens: number; caracteres: number };

/**
 * Anota que um canal acabou de ler o treinamento.
 *
 * Nunca derruba quem chamou: a leitura já aconteceu, e perder a anotação é
 * só perder um dado de painel — derrubar a conversa por isso seria absurdo.
 */
export async function registrarLeitura(sql: Sql, canal: Canal, itens: number, caracteres: number) {
  try {
    await sql`
      INSERT INTO marina_leituras (canal, lido_em, itens, caracteres)
      VALUES (${canal}, now(), ${itens}, ${caracteres})
      ON CONFLICT (canal) DO UPDATE
        SET lido_em = now(), itens = EXCLUDED.itens, caracteres = EXCLUDED.caracteres`;
  } catch { /* antes da migration 0016 */ }
}

export async function lerLeituras(sql: Sql): Promise<Record<string, Leitura>> {
  try {
    const linhas = await sql<Leitura[]>`SELECT canal, lido_em, itens, caracteres FROM marina_leituras`;
    return Object.fromEntries(
      linhas.map((l) => [l.canal, { ...l, lido_em: new Date(l.lido_em).toISOString() }]),
    );
  } catch {
    return {};
  }
}

/* ── histórico ───────────────────────────────────────────────────── */

export type AcaoHistorico = "criou" | "editou" | "ligou" | "desligou" | "excluiu" | "restaurou" | "voltou-versao" | "testou";

export async function registrarHistorico(
  sql: Sql, id: string, acao: AcaoHistorico,
  antes: unknown, depois: unknown, autor: string | null,
) {
  try {
    await sql`
      INSERT INTO marina_historico (conhecimento_id, acao, antes, depois, autor)
      VALUES (${id}, ${acao}, ${antes ? sql.json(antes as never) : null},
              ${depois ? sql.json(depois as never) : null}, ${autor})`;
  } catch { /* antes da 0016: a mudança já foi feita, perder o registro não a desfaz */ }
}

/* ── lacunas: o que ela não soube ────────────────────────────────── */

/**
 * A resposta parece um "não sei"?
 *
 * Heurística de propósito simples: frases que a própria skill manda a
 * Marina dizer quando não tem o dado. Falso positivo custa pouco (a Cecília
 * clica em "ignorar"); falso negativo é uma pergunta sem treino que ninguém
 * vê — por isso a lista é generosa.
 */
const SEM_RESPOSTA = [
  /n[aã]o (tenho|sei|encontrei|consegui confirmar|possuo) (essa|esta|essas|a) informa/i,
  /n[aã]o tenho (como|certeza)/i,
  /vou (confirmar|verificar|checar) com a (pousada|recep[cç][aã]o|equipe)/i,
  /(confirme|confirmar|verifique) (direto |diretamente )?com a pousada/i,
  /n[aã]o sei (informar|dizer|responder)/i,
  /n[aã]o consegui (responder|encontrar)/i,
];

export const pareceSemResposta = (texto: string) => SEM_RESPOSTA.some((r) => r.test(texto));

export async function registrarLacuna(
  sql: Sql,
  l: { pergunta: string; resposta?: string | null; canal: string; sessao?: string | null },
) {
  const pergunta = l.pergunta.trim().slice(0, 600);
  if (pergunta.length < 4) return;
  try {
    /* A mesma pergunta aberta nos últimos 7 dias não entra de novo: a lista
       é de ASSUNTOS a treinar, não um log. */
    const [igual] = await sql<{ id: string }[]>`
      SELECT id FROM marina_lacunas
      WHERE status = 'aberta' AND lower(pergunta) = lower(${pergunta})
        AND criado_em > now() - interval '7 days' LIMIT 1`;
    if (igual) return;
    await registrarEvento(sql, "lacuna", { canal: l.canal.slice(0, 20) });
    await sql`
      INSERT INTO marina_lacunas (pergunta, resposta, canal, sessao)
      VALUES (${pergunta}, ${l.resposta?.slice(0, 2000) ?? null}, ${l.canal.slice(0, 20)}, ${l.sessao ?? null})`;
  } catch { /* antes da migration 0016 */ }
}

/* ── área de teste: as fontes que ela citou ──────────────────────── */

export const PEDIDO_FONTES = [
  "MODO TESTE DO PAINEL: esta conversa é um teste da administração, não um hóspede.",
  "Responda normalmente. Depois da resposta, numa última linha separada, escreva",
  "FONTES: seguido dos códigos (#xxxxxx) dos itens do treinamento que você usou,",
  "separados por vírgula — ou FONTES: nenhuma, se não usou nenhum.",
].join("\n");

/** Separa a resposta da linha FONTES e devolve os códigos citados. */
export function separarFontes(texto: string): { resposta: string; codigos: string[] } {
  const m = texto.match(/\n?\s*FONTES:\s*(.*)\s*$/i);
  if (!m) return { resposta: texto.trim(), codigos: [] };
  const codigos = [...new Set(m[1].match(/#[a-f0-9]{6}/gi) ?? [])].map((c) => c.toLowerCase());
  return { resposta: texto.slice(0, m.index).trim(), codigos };
}

/* ── montagem única, usada pelo chat do site e pela área de teste ── */

/**
 * Lê tudo e devolve o texto pronto. Chat do site e área de teste passam por
 * aqui — se fossem dois caminhos, o teste do painel poderia passar com um
 * texto diferente do que o hóspede recebe, e o teste não provaria nada.
 */
export async function montarTreinamento(
  sql: Sql, canal: Canal, opcoes: { codigos?: boolean } = {},
): Promise<{ texto: string; ensinamentos: Ensinamentos; config: ConfigMarina }> {
  const config = await lerConfig(sql);
  const ensinamentos = await lerEnsinamentos(sql);
  const texto = ensinamentosEmTexto(config, ensinamentos, { ...opcoes, canal: canal === "whatsapp" ? "whatsapp" : "site" });
  await registrarLeitura(sql, canal, totalItens(ensinamentos), texto.length);
  return { texto, ensinamentos, config };
}
