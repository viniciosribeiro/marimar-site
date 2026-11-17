import type { Sql } from "./db-conexao";
import { tipoValido, categoriaValida } from "./marina-base";
import { sugerirCategoria, registrarHistorico } from "./marina";

/**
 * O que a Marina PODE fazer no painel pela voz.
 *
 * Cada ação reaproveita a MESMA gravação das telas do painel (as Server
 * Actions em `admin/marina/actions.ts` e afins) — nada aqui inventa um
 * caminho novo de banco. A diferença é só a porta de entrada: em vez de um
 * formulário, a Marina propõe a ação e, depois do "confirma?" da pessoa, o
 * executor roda `executar` com a sessão de administrador de quem está
 * treinando (ver `admin/marina/voz-acoes.ts`). Toda ação:
 *
 *   validar(dados)  — confere a forma; NÃO toca no banco.
 *   descrever(...)  — a frase do cartão de confirmação; só LÊ.
 *   executar(...)   — grava, assinado, e devolve um resumo curto.
 *
 * Acrescentar uma ação é só pôr outra entrada em ACOES — por isso o registro,
 * e não um `if` gigante. Preço e disponibilidade NUNCA entram (são do motor).
 */

export type ResultadoAcao = { ok: true; resumo: string } | { ok: false; erro: string };
type Dados = Record<string, unknown>;

export type Acao = {
  rotulo: string;
  /** Uma linha para o catálogo que vai no pedido à Marina: quando usar e a forma de `dados`. */
  comoUsar: string;
  /** Exige perfil Administração (papel "master"). */
  tecnico?: boolean;
  validar(dados: Dados): { ok: true; dados: Dados } | { ok: false; erro: string };
  descrever(sql: Sql, dados: Dados): Promise<string>;
  executar(sql: Sql, dados: Dados, autor: string): Promise<ResultadoAcao>;
};

/* ── utilidades ──────────────────────────────────────────────────── */

const texto = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

const listaDeTexto = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()))].slice(0, 20)
    : [];

const soDigitos = (v: unknown) => (typeof v === "string" ? v.replace(/[^\d]/g, "") : "");

/** "35", "35,50", "R$ 35,50" → 35.5. Vazio/ inválido → null. */
const dinheiro = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

type ItemAchado = { id: string; tipo: string; categoria: string; titulo: string; conteudo: string; variacoes: unknown; ativo: boolean };

/** Acha UM item por parte do título/texto. `soLixeira` procura o que está na lixeira. */
async function acharItem(sql: Sql, alvo: string, soLixeira = false): Promise<
  { ok: true; item: ItemAchado } | { ok: false; erro: string }
> {
  const termo = `%${alvo.trim().slice(0, 120)}%`;
  const filtro = soLixeira ? sql`excluido_em IS NOT NULL` : sql`excluido_em IS NULL`;
  const itens = await sql<ItemAchado[]>`
    SELECT id, tipo, categoria, titulo, conteudo, variacoes, ativo
    FROM marina_conhecimento
    WHERE ${filtro} AND (titulo ILIKE ${termo} OR conteudo ILIKE ${termo})
    ORDER BY (titulo ILIKE ${termo}) DESC, atualizado_em DESC
    LIMIT 4`;
  if (itens.length === 0) return { ok: false, erro: soLixeira ? `Não achei "${alvo}" na lixeira.` : `Não achei nenhum item sobre "${alvo}".` };
  if (itens.length > 1 && itens[0].titulo.toLowerCase() !== alvo.trim().toLowerCase()) {
    return { ok: false, erro: `Achei mais de um item parecido com "${alvo}" (${itens.map((i) => i.titulo).slice(0, 3).join("; ")}). Diga o nome exato.` };
  }
  return { ok: true, item: itens[0] };
}

async function lerConfigLinha(sql: Sql): Promise<{ id: string; tom: string | null } | null> {
  const [l] = await sql<{ id: string; tom: string | null }[]>`SELECT id, tom FROM marina_config LIMIT 1`;
  return l ?? null;
}

async function gravarTom(sql: Sql, tom: string | null) {
  const linha = await lerConfigLinha(sql);
  if (linha) await sql`UPDATE marina_config SET tom = ${tom}, atualizado_em = now() WHERE id = ${linha.id}`;
  else await sql`INSERT INTO marina_config ${sql({ tom })}`;
}

/* ── o antes/depois que vai para o histórico de um item ──────────── */
const foto = (l: { tipo: unknown; categoria: unknown; titulo: unknown; conteudo: unknown; variacoes: unknown; ativo: unknown }) =>
  ({ tipo: l.tipo, categoria: l.categoria, titulo: l.titulo, conteudo: l.conteudo, variacoes: l.variacoes, ativo: l.ativo });

/* Campos do contato/dados da pousada que a Marina pode mudar por voz. */
const CAMPOS_POUSADA: { chave: string; rotulo: string; tipo: "texto" | "digitos"; max: number }[] = [
  { chave: "nome", rotulo: "nome", tipo: "texto", max: 160 },
  { chave: "whatsapp", rotulo: "WhatsApp", tipo: "digitos", max: 15 },
  { chave: "telefone", rotulo: "telefone", tipo: "digitos", max: 15 },
  { chave: "email", rotulo: "e-mail", tipo: "texto", max: 200 },
  { chave: "endereco", rotulo: "endereço", tipo: "texto", max: 300 },
  { chave: "cidade", rotulo: "cidade", tipo: "texto", max: 120 },
  { chave: "horario_recepcao", rotulo: "horário da recepção", tipo: "texto", max: 200 },
  { chave: "descricao_curta", rotulo: "descrição curta", tipo: "texto", max: 400 },
  { chave: "como_chegar", rotulo: "como chegar", tipo: "texto", max: 2000 },
];

/* ── as ações ────────────────────────────────────────────────────── */

export const ACOES: Record<string, Acao> = {
  ensinar: {
    rotulo: "Ensinar algo novo",
    comoUsar:
      'guardar uma informação, uma pergunta-e-resposta ou um limite. dados: {"tipo":"fato"|"pergunta"|"limite","titulo":"...","conteudo":"...","variacoes":["..."] (só se tipo pergunta),"lacuna_id":"..." (só se veio de uma pergunta que faltava)}',
    validar(d) {
      const tipo = tipoValido(d.tipo);
      const titulo = texto(d.titulo, 300);
      const conteudo = texto(d.conteudo, 6000);
      if (!titulo || !conteudo) return { ok: false, erro: "Faltou o assunto ou o conteúdo do que ensinar." };
      return { ok: true, dados: { tipo, titulo, conteudo, variacoes: tipo === "pergunta" ? listaDeTexto(d.variacoes) : [], lacuna_id: texto(d.lacuna_id, 64) } };
    },
    async descrever(_sql, d) {
      const tipo = tipoValido(d.tipo);
      const rotulo = tipo === "pergunta" ? "a pergunta" : tipo === "limite" ? "o limite" : "a informação";
      return `guardar ${rotulo} "${texto(d.titulo, 120)}"`;
    },
    async executar(sql, d, autor) {
      const tipo = tipoValido(d.tipo);
      const categoria = categoriaValida(sugerirCategoria(`${d.titulo} ${d.conteudo}`));
      const [novo] = await sql<{ id: string }[]>`
        INSERT INTO marina_conhecimento (tipo, categoria, titulo, conteudo, variacoes, ativo, atualizado_por)
        VALUES (${tipo}, ${categoria}, ${String(d.titulo)}, ${String(d.conteudo)}, ${sql.json((d.variacoes as string[]) ?? [])}, true, ${autor})
        RETURNING id`;
      const [linha] = await sql`SELECT tipo, categoria, titulo, conteudo, variacoes, ativo FROM marina_conhecimento WHERE id = ${novo.id}`;
      await registrarHistorico(sql, novo.id, "criou", null, foto(linha as never), autor);
      if (d.lacuna_id) {
        await sql`UPDATE marina_lacunas SET status = 'resolvida', conhecimento_id = ${novo.id}, resolvido_em = now() WHERE id = ${String(d.lacuna_id)}`.catch(() => {});
      }
      return { ok: true, resumo: `Ensinei "${texto(d.titulo, 80)}". Já vale no site e o WhatsApp lê na próxima conversa.` };
    },
  },

  editar_conhecimento: {
    rotulo: "Mudar algo que ela já sabe",
    comoUsar:
      'mudar um item que já existe. dados: {"alvo":"parte do nome do item","conteudo":"novo texto" (opcional),"titulo":"novo nome" (opcional),"ativo":true|false (opcional, para ligar/desligar)}',
    validar(d) {
      const alvo = texto(d.alvo, 160);
      if (!alvo) return { ok: false, erro: "Diga qual item mudar (parte do nome)." };
      const temMudanca = texto(d.conteudo, 6000) || texto(d.titulo, 300) || typeof d.ativo === "boolean";
      if (!temMudanca) return { ok: false, erro: "Diga o que mudar no item (texto, nome, ou ligar/desligar)." };
      return { ok: true, dados: { alvo, conteudo: texto(d.conteudo, 6000), titulo: texto(d.titulo, 300), ativo: typeof d.ativo === "boolean" ? d.ativo : null } };
    },
    async descrever(sql, d) {
      const achado = await acharItem(sql, String(d.alvo));
      if (!achado.ok) return achado.erro;
      const partes: string[] = [];
      if (d.ativo === true) partes.push("ligar");
      if (d.ativo === false) partes.push("desligar");
      if (d.titulo) partes.push("renomear");
      if (d.conteudo) partes.push("trocar o texto");
      return `${partes.join(" e ") || "mudar"} o item "${achado.item.titulo}"`;
    },
    async executar(sql, d, autor) {
      const achado = await acharItem(sql, String(d.alvo));
      if (!achado.ok) return { ok: false, erro: achado.erro };
      const antes = achado.item;
      const titulo = (d.titulo as string) ?? antes.titulo;
      const conteudo = (d.conteudo as string) ?? antes.conteudo;
      const ativo = typeof d.ativo === "boolean" ? d.ativo : antes.ativo;
      await sql`
        UPDATE marina_conhecimento
        SET titulo = ${titulo}, conteudo = ${conteudo}, ativo = ${ativo},
            verificacao = NULL, verificado_em = NULL, verificacao_resposta = NULL,
            atualizado_por = ${autor}, atualizado_em = now()
        WHERE id = ${antes.id}`;
      const [depois] = await sql`SELECT tipo, categoria, titulo, conteudo, variacoes, ativo FROM marina_conhecimento WHERE id = ${antes.id}`;
      await registrarHistorico(sql, antes.id, "editou", foto(antes as never), foto(depois as never), autor);
      const oque = d.ativo === false ? "desliguei" : d.ativo === true ? "liguei" : "alterei";
      return { ok: true, resumo: `Pronto, ${oque} "${titulo}". Dá para voltar atrás no Histórico.` };
    },
  },

  excluir_item: {
    rotulo: "Mandar um item para a lixeira",
    comoUsar: 'mandar um item do conhecimento para a lixeira (reversível). dados: {"alvo":"parte do nome do item"}',
    validar(d) {
      const alvo = texto(d.alvo, 160);
      return alvo ? { ok: true, dados: { alvo } } : { ok: false, erro: "Diga qual item apagar (parte do nome)." };
    },
    async descrever(sql, d) {
      const achado = await acharItem(sql, String(d.alvo));
      return achado.ok ? `mandar para a lixeira o item "${achado.item.titulo}"` : achado.erro;
    },
    async executar(sql, d, autor) {
      const achado = await acharItem(sql, String(d.alvo));
      if (!achado.ok) return { ok: false, erro: achado.erro };
      await sql`UPDATE marina_conhecimento SET excluido_em = now(), atualizado_por = ${autor}, atualizado_em = now() WHERE id = ${achado.item.id}`;
      await registrarHistorico(sql, achado.item.id, "excluiu", foto(achado.item as never), null, autor);
      return { ok: true, resumo: `Mandei "${achado.item.titulo}" para a lixeira. Dá para restaurar quando quiser.` };
    },
  },

  restaurar_item: {
    rotulo: "Tirar um item da lixeira",
    comoUsar: 'restaurar um item que está na lixeira. dados: {"alvo":"parte do nome do item"}',
    validar(d) {
      const alvo = texto(d.alvo, 160);
      return alvo ? { ok: true, dados: { alvo } } : { ok: false, erro: "Diga qual item restaurar (parte do nome)." };
    },
    async descrever(sql, d) {
      const achado = await acharItem(sql, String(d.alvo), true);
      return achado.ok ? `restaurar da lixeira o item "${achado.item.titulo}"` : achado.erro;
    },
    async executar(sql, d, autor) {
      const achado = await acharItem(sql, String(d.alvo), true);
      if (!achado.ok) return { ok: false, erro: achado.erro };
      await sql`UPDATE marina_conhecimento SET excluido_em = NULL, atualizado_por = ${autor}, atualizado_em = now() WHERE id = ${achado.item.id}`;
      await registrarHistorico(sql, achado.item.id, "restaurou", null, foto(achado.item as never), autor);
      return { ok: true, resumo: `Restaurei "${achado.item.titulo}".` };
    },
  },

  ajustar_personalidade: {
    rotulo: "Mudar o jeito dela falar",
    comoUsar:
      'mudar o tom/estilo da Marina. dados: {"tom":"como ela deve falar","modo":"substituir"|"acrescentar" (padrão acrescentar)}',
    validar(d) {
      const tom = texto(d.tom, 4000);
      if (!tom) return { ok: false, erro: "Diga como você quer que ela passe a falar." };
      const modo = d.modo === "substituir" ? "substituir" : "acrescentar";
      return { ok: true, dados: { tom, modo } };
    },
    async descrever(_sql, d) {
      return d.modo === "substituir"
        ? `trocar o jeito de falar dela por "${texto(d.tom, 100)}"`
        : `acrescentar ao jeito de falar dela: "${texto(d.tom, 100)}"`;
    },
    async executar(sql, d) {
      const linha = await lerConfigLinha(sql);
      const atual = linha?.tom?.trim() ?? "";
      const novo = d.modo === "substituir" || !atual ? String(d.tom) : `${atual}\n${d.tom}`;
      await gravarTom(sql, novo.slice(0, 4000));
      return { ok: true, resumo: "Mudei o jeito dela falar. Vale na próxima mensagem, nos dois canais." };
    },
  },

  regra_criancas: {
    rotulo: "Regra de crianças e bebês",
    comoUsar:
      'mudar a regra de crianças/bebês (afeta o preço). dados: {"idade_colo_max":número de 0 a 12 ou null (desliga a regra),"crianca_paga_como_adulto":true|false,"bebe_cobranca":"gratis"|"por_noite"|"por_estadia","bebe_valor":número,"observacao":"..."} — só o que mudar',
    validar(d) {
      const out: Dados = {};
      if ("idade_colo_max" in d) {
        if (d.idade_colo_max === null) out.idade_colo_max = null;
        else {
          const n = Math.round(Number(d.idade_colo_max));
          if (!Number.isFinite(n) || n < 0 || n > 12) return { ok: false, erro: "A idade de colo precisa ser de 0 a 12 anos (ou nada, para desligar a regra)." };
          out.idade_colo_max = n;
        }
      }
      if (typeof d.crianca_paga_como_adulto === "boolean") out.crianca_paga_como_adulto = d.crianca_paga_como_adulto;
      if ("bebe_cobranca" in d) {
        const c = String(d.bebe_cobranca);
        if (!["gratis", "por_noite", "por_estadia"].includes(c)) return { ok: false, erro: "A cobrança do bebê é: grátis, por noite ou por estadia." };
        out.bebe_cobranca = c;
      }
      if ("bebe_valor" in d) out.bebe_valor = dinheiro(d.bebe_valor);
      const obs = texto(d.observacao, 600);
      if (obs) out.observacao = obs;
      if (Object.keys(out).length === 0) return { ok: false, erro: "Diga o que mudar na regra (idade de colo, se a criança paga como adulto, cobrança do bebê)." };
      return { ok: true, dados: out };
    },
    async descrever(_sql, d) {
      const partes: string[] = [];
      if ("idade_colo_max" in d) partes.push(d.idade_colo_max === null ? "desligar a regra de crianças" : `criança de colo até ${d.idade_colo_max} anos`);
      if (typeof d.crianca_paga_como_adulto === "boolean") partes.push(d.crianca_paga_como_adulto ? "criança fora do colo paga como adulto" : "criança fora do colo não paga como adulto");
      if ("bebe_cobranca" in d) partes.push(`bebê ${d.bebe_cobranca === "gratis" ? "não paga" : "cobrado " + String(d.bebe_cobranca).replace("_", " ")}`);
      return `mudar a regra de hóspedes: ${partes.join("; ")}`;
    },
    async executar(sql, d, autor) {
      const [atual] = await sql<{ idade_colo_max: number | null; crianca_paga_como_adulto: boolean; bebe_cobranca: string; bebe_valor: string | null; observacao: string | null }[]>`
        SELECT idade_colo_max, crianca_paga_como_adulto, bebe_cobranca, bebe_valor, observacao FROM regras_hospedagem WHERE id = 1`;
      const dados = {
        id: 1,
        idade_colo_max: "idade_colo_max" in d ? (d.idade_colo_max as number | null) : (atual?.idade_colo_max ?? null),
        crianca_paga_como_adulto: typeof d.crianca_paga_como_adulto === "boolean" ? d.crianca_paga_como_adulto : (atual?.crianca_paga_como_adulto ?? true),
        bebe_cobranca: "bebe_cobranca" in d ? (d.bebe_cobranca as string) : (atual?.bebe_cobranca ?? "gratis"),
        bebe_valor: "bebe_valor" in d ? (d.bebe_valor as number | null) : (atual?.bebe_valor ?? null),
        observacao: "observacao" in d ? (d.observacao as string) : (atual?.observacao ?? null),
        atualizado_por: autor,
      };
      await sql`INSERT INTO regras_hospedagem ${sql(dados)} ON CONFLICT (id) DO UPDATE SET ${sql(dados)}, atualizado_em = now()`;
      return { ok: true, resumo: dados.idade_colo_max === null ? "Regra de crianças desligada; o site volta ao cálculo do motor." : "Regra de crianças salva. Já vale na busca do site e para a Marina." };
    },
  },

  dados_pousada: {
    rotulo: "Mudar dados da pousada",
    comoUsar:
      'mudar dados da pousada. dados (só o que mudar): {"whatsapp":"...","telefone":"...","email":"...","nome":"...","endereco":"...","cidade":"...","horario_recepcao":"...","descricao_curta":"...","como_chegar":"..."}',
    validar(d) {
      const out: Dados = {};
      for (const c of CAMPOS_POUSADA) {
        if (!(c.chave in d) || d[c.chave] == null) continue;
        if (c.tipo === "digitos") {
          const dig = soDigitos(d[c.chave]);
          if (dig.length < 8 || dig.length > 15) return { ok: false, erro: `O ${c.rotulo} ficou com um número estranho de dígitos; confira (ex.: 5541999990000).` };
          out[c.chave] = dig;
        } else if (c.chave === "email") {
          const e = texto(d[c.chave], c.max);
          if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, erro: "Esse e-mail não parece válido." };
          out[c.chave] = e;
        } else {
          const t = texto(d[c.chave], c.max);
          if (t) out[c.chave] = t;
        }
      }
      if (Object.keys(out).length === 0) return { ok: false, erro: "Diga qual dado da pousada mudar (WhatsApp, telefone, e-mail, endereço...)." };
      return { ok: true, dados: out };
    },
    async descrever(_sql, d) {
      const partes = CAMPOS_POUSADA.filter((c) => c.chave in d).map((c) => `${c.rotulo} para "${String(d[c.chave]).slice(0, 60)}"`);
      return `mudar ${partes.join(", ")}`;
    },
    async executar(sql, d) {
      const campos = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)]));
      await sql`UPDATE pousada SET ${sql(campos)}, atualizado_em = now() WHERE id = (SELECT id FROM pousada LIMIT 1)`;
      return { ok: true, resumo: "Dados da pousada atualizados. Já aparecem no site." };
    },
  },

  adicional: {
    rotulo: "Criar um adicional",
    comoUsar:
      'criar um adicional que o hóspede pode pedir (berço, café no quarto, late checkout...). dados: {"nome":"...","preco":número ou null,"cobranca":"por_estadia"|"por_noite"|"por_pessoa_noite"|"por_unidade","descricao":"..."}',
    validar(d) {
      const nome = texto(d.nome, 120);
      if (!nome) return { ok: false, erro: "Dê um nome ao adicional (ex.: berço, café no quarto)." };
      const cobranca = ["por_estadia", "por_noite", "por_pessoa_noite", "por_unidade"].includes(String(d.cobranca)) ? String(d.cobranca) : "por_estadia";
      return { ok: true, dados: { nome, preco: dinheiro(d.preco), cobranca, descricao: texto(d.descricao, 600) } };
    },
    async descrever(_sql, d) {
      const p = d.preco != null ? ` por R$ ${Number(d.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
      return `criar o adicional "${texto(d.nome, 80)}"${p}`;
    },
    async executar(sql, d, autor) {
      await sql`
        INSERT INTO adicionais (nome, descricao, preco, cobranca, categoria, precisa_pedir, visivel_site, visivel_marina, ativo, atualizado_por)
        VALUES (${String(d.nome)}, ${(d.descricao as string) ?? null}, ${(d.preco as number | null) ?? null}, ${String(d.cobranca)}, 'outros', true, true, true, true, ${autor})`;
      return { ok: true, resumo: `Criei o adicional "${texto(d.nome, 80)}". Já aparece no site e para a Marina.` };
    },
  },
};

/** Catálogo em texto para o pedido à Marina. Oculta as ações técnicas de quem não é Administração. */
export function catalogoParaPrompt(tecnico: boolean): string {
  return Object.entries(ACOES)
    .filter(([, a]) => tecnico || !a.tecnico)
    .map(([nome, a]) => `- ${nome}: ${a.comoUsar}`)
    .join("\n");
}

export function acaoExiste(nome: string, tecnico: boolean): boolean {
  const a = ACOES[nome];
  return Boolean(a && (tecnico || !a.tecnico));
}
