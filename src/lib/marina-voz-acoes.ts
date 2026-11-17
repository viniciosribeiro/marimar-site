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
 * Começa por quatro ações seguras e reversíveis. Acrescentar é só pôr outra
 * entrada em ACOES — por isso o registro, e não um `if` gigante.
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

/** Acha UM item ativo (fora da lixeira) por parte do título ou do texto. */
async function acharItem(sql: Sql, alvo: string): Promise<
  { ok: true; item: { id: string; tipo: string; categoria: string; titulo: string; conteudo: string; variacoes: unknown; ativo: boolean } }
  | { ok: false; erro: string }
> {
  const termo = `%${alvo.trim().slice(0, 120)}%`;
  const itens = await sql<{ id: string; tipo: string; categoria: string; titulo: string; conteudo: string; variacoes: unknown; ativo: boolean }[]>`
    SELECT id, tipo, categoria, titulo, conteudo, variacoes, ativo
    FROM marina_conhecimento
    WHERE excluido_em IS NULL AND (titulo ILIKE ${termo} OR conteudo ILIKE ${termo})
    ORDER BY (titulo ILIKE ${termo}) DESC, atualizado_em DESC
    LIMIT 4`;
  if (itens.length === 0) return { ok: false, erro: `Não achei nenhum item sobre "${alvo}".` };
  if (itens.length > 1 && itens[0].titulo.toLowerCase() !== alvo.trim().toLowerCase()) {
    return { ok: false, erro: `Achei mais de um item parecido com "${alvo}" (${itens.map((i) => i.titulo).slice(0, 3).join("; ")}). Diga qual é pelo nome exato.` };
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

  dados_pousada: {
    rotulo: "Mudar o contato da pousada",
    comoUsar:
      'mudar WhatsApp, telefone ou e-mail da pousada. dados: {"whatsapp":"...","telefone":"...","email":"..."} (só os que mudar)',
    validar(d) {
      const whatsapp = d.whatsapp != null ? soDigitos(d.whatsapp) : null;
      const telefone = d.telefone != null ? soDigitos(d.telefone) : null;
      const email = texto(d.email, 200);
      if (whatsapp !== null && (whatsapp.length < 10 || whatsapp.length > 15)) return { ok: false, erro: "O WhatsApp precisa dos dígitos com DDD (e DDI, ex.: 5541999990000)." };
      if (telefone !== null && (telefone.length < 8 || telefone.length > 15)) return { ok: false, erro: "O telefone ficou com um número estranho de dígitos; confira." };
      if (email !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: "Esse e-mail não parece válido." };
      if (whatsapp === null && telefone === null && email === null) return { ok: false, erro: "Diga qual contato mudar (WhatsApp, telefone ou e-mail)." };
      return { ok: true, dados: { whatsapp, telefone, email } };
    },
    async descrever(_sql, d) {
      const partes: string[] = [];
      if (d.whatsapp) partes.push(`WhatsApp para ${d.whatsapp}`);
      if (d.telefone) partes.push(`telefone para ${d.telefone}`);
      if (d.email) partes.push(`e-mail para ${d.email}`);
      return `mudar o ${partes.join(", o ")}`;
    },
    async executar(sql, d) {
      const campos: Record<string, string> = {};
      if (d.whatsapp) campos.whatsapp = String(d.whatsapp);
      if (d.telefone) campos.telefone = String(d.telefone);
      if (d.email) campos.email = String(d.email);
      await sql`UPDATE pousada SET ${sql(campos)}, atualizado_em = now() WHERE id = (SELECT id FROM pousada LIMIT 1)`;
      return { ok: true, resumo: "Contato da pousada atualizado. Já aparece no site." };
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
