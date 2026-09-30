"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql, type Sql } from "@/lib/db-conexao";
import { sincronizarVoz } from "@/lib/openclaw-config";
import {
  categoriaValida, tipoValido, registrarHistorico, sugerirCategoria, type AcaoHistorico,
} from "@/lib/marina";

/**
 * Ações do treinamento da Marina.
 *
 * Todas devolvem `{ ok, mensagem }` em vez de redirecionar: a tela chama,
 * mostra o aviso e recarrega os dados sem perder filtro nem rolagem. Todas
 * começam por `exigirSessao()` — Server Action é endpoint público.
 *
 * Toda mudança num item grava antes/depois em `marina_historico`. É o que
 * permite "voltar para a versão de ontem" e ver quem mudou o quê.
 */

export type Resultado = { ok: boolean; mensagem: string; id?: string };

const txt = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const faixa = (fd: FormData, k: string, min: number, max: number, padrao: number) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
};
/** Uma variação por linha; linhas repetidas e vazias saem. */
const linhas = (fd: FormData, k: string) =>
  [...new Set((txt(fd, k) ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean))].slice(0, 20);

const autorDe = (s: Awaited<ReturnType<typeof exigirSessao>>) =>
  (s.user?.name || s.user?.email || "painel") as string;

const atualizar = () => revalidatePath("/admin/marina");

type Linha = Record<string, unknown> & { id: string };

async function lerItem(sql: Sql, id: string) {
  const [l] = await sql<Linha[]>`
    SELECT id, tipo, categoria, titulo, conteudo, variacoes, ativo, excluido_em
    FROM marina_conhecimento WHERE id = ${id}`;
  return l;
}

/** Só os campos que importam para comparar versões. */
const foto = (l: Linha | undefined) => l && {
  tipo: l.tipo, categoria: l.categoria, titulo: l.titulo, conteudo: l.conteudo,
  variacoes: l.variacoes, ativo: l.ativo, excluido_em: l.excluido_em ?? null,
};

/* ── itens ───────────────────────────────────────────────────────── */

export async function salvarItem(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const id = txt(fd, "id");
  const tipo = tipoValido(txt(fd, "tipo"));
  const titulo = txt(fd, "titulo")?.slice(0, 300);
  const conteudo = txt(fd, "conteudo")?.slice(0, 6000);
  const variacoes = tipo === "pergunta" ? linhas(fd, "variacoes") : [];
  const categoria = categoriaValida(txt(fd, "categoria") ?? sugerirCategoria(`${titulo} ${conteudo}`));
  const ativo = fd.get("ativo") === null ? true : fd.get("ativo") === "on" || fd.get("ativo") === "true";

  if (!titulo || !conteudo) {
    return { ok: false, mensagem: tipo === "pergunta" ? "Preencha a pergunta e a resposta." : "Preencha o assunto e o texto." };
  }

  const autor = autorDe(s);
  const r = await comSql(async (sql) => {
    if (id) {
      const antes = await lerItem(sql, id);
      if (!antes) return { ok: false, mensagem: "Este item não existe mais. Recarregue a página." };
      /* Editar zera a verificação: o teste anterior valia para o texto antigo. */
      await sql`
        UPDATE marina_conhecimento
        SET tipo = ${tipo}, categoria = ${categoria}, titulo = ${titulo}, conteudo = ${conteudo},
            variacoes = ${sql.json(variacoes)}, ativo = ${ativo},
            verificacao = NULL, verificado_em = NULL, verificacao_resposta = NULL,
            atualizado_por = ${autor}, atualizado_em = now()
        WHERE id = ${id}`;
      await registrarHistorico(sql, id, "editou", foto(antes), foto(await lerItem(sql, id)), autor);
      return { ok: true, mensagem: "Alterado. Já vale no site; o WhatsApp lê na próxima conversa.", id };
    }
    const [novo] = await sql<{ id: string }[]>`
      INSERT INTO marina_conhecimento (tipo, categoria, titulo, conteudo, variacoes, ativo, atualizado_por)
      VALUES (${tipo}, ${categoria}, ${titulo}, ${conteudo}, ${sql.json(variacoes)}, ${ativo}, ${autor})
      RETURNING id`;
    await registrarHistorico(sql, novo.id, "criou", null, foto(await lerItem(sql, novo.id)), autor);

    /* Veio de uma pergunta sem resposta? Fecha a pendência junto. */
    const lacuna = txt(fd, "lacuna_id");
    if (lacuna) {
      await sql`UPDATE marina_lacunas SET status = 'resolvida', conhecimento_id = ${novo.id}, resolvido_em = now()
                WHERE id = ${lacuna}`.catch(() => {});
    }
    return { ok: true, mensagem: "Ensinado! Já vale no site; o WhatsApp lê na próxima conversa.", id: novo.id };
  });
  atualizar();
  return r;
}

async function mudarEstado(fd: FormData, acao: AcaoHistorico, mensagem: string,
  mudar: (sql: Sql, id: string) => Promise<unknown>): Promise<Resultado> {
  const s = await exigirSessao();
  const id = txt(fd, "id");
  if (!id) return { ok: false, mensagem: "Item não encontrado." };
  const autor = autorDe(s);
  const r = await comSql(async (sql) => {
    const antes = await lerItem(sql, id);
    if (!antes) return { ok: false, mensagem: "Este item não existe mais." };
    await mudar(sql, id);
    await sql`UPDATE marina_conhecimento SET atualizado_por = ${autor}, atualizado_em = now() WHERE id = ${id}`;
    await registrarHistorico(sql, id, acao, foto(antes), foto(await lerItem(sql, id)), autor);
    return { ok: true, mensagem };
  });
  atualizar();
  return r;
}

export async function ligarItem(fd: FormData) {
  return mudarEstado(fd, "ligou", "Ligado. A Marina volta a usar este item.",
    (sql, id) => sql`UPDATE marina_conhecimento SET ativo = true WHERE id = ${id}`);
}

export async function desligarItem(fd: FormData) {
  return mudarEstado(fd, "desligou", "Desligado. Fica guardado aqui, e a Marina para de usar.",
    (sql, id) => sql`UPDATE marina_conhecimento SET ativo = false WHERE id = ${id}`);
}

/** Excluir manda para a lixeira. Nada some de verdade sem um segundo passo. */
export async function excluirItem(fd: FormData) {
  return mudarEstado(fd, "excluiu", "Enviado para a lixeira. Dá para restaurar quando quiser.",
    (sql, id) => sql`UPDATE marina_conhecimento SET excluido_em = now() WHERE id = ${id}`);
}

export async function restaurarItem(fd: FormData) {
  return mudarEstado(fd, "restaurou", "Restaurado da lixeira.",
    (sql, id) => sql`UPDATE marina_conhecimento SET excluido_em = NULL WHERE id = ${id}`);
}

/** Apagar de vez: só da lixeira, e o histórico continua guardado. */
export async function apagarDeVez(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  const id = txt(fd, "id");
  if (!id) return { ok: false, mensagem: "Item não encontrado." };
  const r = await comSql(async (sql) => {
    const [l] = await sql`DELETE FROM marina_conhecimento WHERE id = ${id} AND excluido_em IS NOT NULL RETURNING id`;
    return l
      ? { ok: true, mensagem: "Apagado de vez." }
      : { ok: false, mensagem: "Só dá para apagar de vez o que já está na lixeira." };
  });
  atualizar();
  return r;
}

/**
 * Voltar a uma versão do histórico.
 *
 * Aplica o "depois" daquela entrada (como o item ficou naquele momento). Se
 * o item já tinha sido apagado de vez, ele é recriado com o mesmo id.
 */
export async function voltarVersao(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const historico = txt(fd, "historico_id");
  if (!historico) return { ok: false, mensagem: "Versão não encontrada." };
  const autor = autorDe(s);
  const r = await comSql(async (sql) => {
    const [h] = await sql<{ conhecimento_id: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null }[]>`
      SELECT conhecimento_id, antes, depois FROM marina_historico WHERE id = ${historico}`;
    const v = h?.depois ?? h?.antes;
    if (!h || !v) return { ok: false, mensagem: "Esta versão não pode ser restaurada." };
    const id = h.conhecimento_id;
    const antes = await lerItem(sql, id);
    const vals = {
      tipo: tipoValido(v.tipo), categoria: categoriaValida(v.categoria),
      titulo: String(v.titulo ?? ""), conteudo: String(v.conteudo ?? ""),
      variacoes: Array.isArray(v.variacoes) ? v.variacoes : [], ativo: v.ativo !== false,
    };
    if (antes) {
      await sql`
        UPDATE marina_conhecimento
        SET tipo = ${vals.tipo}, categoria = ${vals.categoria}, titulo = ${vals.titulo}, conteudo = ${vals.conteudo},
            variacoes = ${sql.json(vals.variacoes as string[])}, ativo = ${vals.ativo}, excluido_em = NULL,
            verificacao = NULL, verificado_em = NULL, atualizado_por = ${autor}, atualizado_em = now()
        WHERE id = ${id}`;
    } else {
      await sql`
        INSERT INTO marina_conhecimento (id, tipo, categoria, titulo, conteudo, variacoes, ativo, atualizado_por)
        VALUES (${id}, ${vals.tipo}, ${vals.categoria}, ${vals.titulo}, ${vals.conteudo},
                ${sql.json(vals.variacoes as string[])}, ${vals.ativo}, ${autor})`;
    }
    await registrarHistorico(sql, id, "voltou-versao", foto(antes), foto(await lerItem(sql, id)), autor);
    return { ok: true, mensagem: "Versão restaurada." };
  });
  atualizar();
  return r;
}

/* ── configuração ────────────────────────────────────────────────── */

async function gravarConfig(sql: Sql, dados: Record<string, unknown>) {
  const [existe] = await sql<{ id: string }[]>`SELECT id FROM marina_config LIMIT 1`;
  if (existe) await sql`UPDATE marina_config SET ${sql(dados)}, atualizado_em = now() WHERE id = ${existe.id}`;
  else await sql`INSERT INTO marina_config ${sql(dados)}`;
}

export async function salvarVoz(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  const dados = {
    voz_id: txt(fd, "voz_id"),
    voz_modelo: txt(fd, "voz_modelo") ?? "eleven_multilingual_v2",
    voz_estabilidade: faixa(fd, "voz_estabilidade", 0, 100, 50),
    voz_semelhanca: faixa(fd, "voz_semelhanca", 0, 100, 75),
    voz_velocidade: faixa(fd, "voz_velocidade", 70, 120, 100),
  };
  await comSql((sql) => gravarConfig(sql, dados));
  atualizar();

  /* O banco governa o chat do site; o WhatsApp lê a voz da config do
     OpenClaw. A falha aqui NÃO desfaz o salvamento do site. */
  if (dados.voz_id) {
    const eco = await sincronizarVoz(dados.voz_id, dados.voz_modelo);
    if (!eco.ok) return { ok: false, mensagem: `Voz salva para o site, mas o WhatsApp não aceitou: ${eco.erro}` };
  }
  return { ok: true, mensagem: "Voz salva nos dois canais." };
}

/** Jeito de falar e quando passar para uma pessoa. */
export async function salvarPersonalidade(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  await comSql((sql) => gravarConfig(sql, {
    tom: txt(fd, "tom")?.slice(0, 4000) ?? null,
    escalonamento: txt(fd, "escalonamento")?.slice(0, 3000) ?? null,
  }));
  atualizar();
  return { ok: true, mensagem: "Personalidade salva. Vale na próxima mensagem, nos dois canais." };
}

/* ── conversas e lacunas ─────────────────────────────────────────── */

/**
 * Corrigir uma resposta de conversa real.
 *
 * Vira uma PERGUNTA E RESPOSTA: a pergunta do hóspede entra como pergunta,
 * a correção como resposta. É o formato que a Marina mais acerta depois.
 */
export async function corrigirResposta(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const id = txt(fd, "id");
  const correcao = txt(fd, "correcao");
  const pergunta = txt(fd, "pergunta") ?? txt(fd, "assunto") ?? "Correção de atendimento";
  if (!id || !correcao) return { ok: false, mensagem: "Escreva o que ela deveria ter dito." };
  const autor = autorDe(s);
  const categoria = categoriaValida(txt(fd, "categoria") ?? sugerirCategoria(`${pergunta} ${correcao}`));

  const r = await comSql(async (sql) => {
    await sql`UPDATE chat_mensagens SET marcada = true, correcao = ${correcao} WHERE id = ${id}`;
    const [novo] = await sql<{ id: string }[]>`
      INSERT INTO marina_conhecimento (tipo, categoria, titulo, conteudo, atualizado_por)
      VALUES ('pergunta', ${categoria}, ${pergunta.slice(0, 300)}, ${correcao}, ${autor})
      RETURNING id`;
    await registrarHistorico(sql, novo.id, "criou", null, foto(await lerItem(sql, novo.id)), autor);
    await sql`UPDATE marina_lacunas SET status = 'resolvida', conhecimento_id = ${novo.id}, resolvido_em = now()
              WHERE status = 'aberta' AND lower(pergunta) = lower(${pergunta})`.catch(() => {});
    return { ok: true, mensagem: "Corrigido e ensinado. A próxima resposta já sai certa." };
  });
  atualizar();
  return r;
}

export async function ignorarLacuna(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  const id = txt(fd, "id");
  if (!id) return { ok: false, mensagem: "Pergunta não encontrada." };
  await comSql((sql) => sql`UPDATE marina_lacunas SET status = 'ignorada', resolvido_em = now() WHERE id = ${id}`);
  atualizar();
  return { ok: true, mensagem: "Tirada da lista." };
}

/* ── regras de hospedagem e adicionais ───────────────────────────── */

const inteiroOuNulo = (fd: FormData, k: string, min: number, max: number) => {
  const v = txt(fd, k);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
};
/** "35", "35,50", "R$ 35,50" → 35.5. Vazio → null (sob consulta / sem valor). */
const dinheiro = (fd: FormData, k: string) => {
  const v = txt(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

const atualizarSite = () => {
  atualizar();
  for (const p of ["/reservar", "/politicas", "/"]) revalidatePath(p);
};

/**
 * Regra de crianças e bebês.
 *
 * É um dado, não um texto: a busca do site usa para montar a consulta ao
 * motor, e a Marina recebe a mesma regra — os dois dão o mesmo preço.
 * Idade de colo em branco desliga a regra (volta ao comportamento do motor).
 */
export async function salvarRegras(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const idade = inteiroOuNulo(fd, "idade_colo_max", 0, 12);
  const cobranca = ["gratis", "por_noite", "por_estadia"].includes(txt(fd, "bebe_cobranca") ?? "") ? txt(fd, "bebe_cobranca")! : "gratis";
  const valor = cobranca === "gratis" ? null : dinheiro(fd, "bebe_valor");
  if (cobranca !== "gratis" && valor === null) {
    return { ok: false, mensagem: "Informe o valor cobrado pelo bebê, ou escolha “não paga”." };
  }
  const dados = {
    idade_colo_max: idade,
    crianca_paga_como_adulto: fd.get("crianca_paga_como_adulto") === "on",
    bebe_cobranca: cobranca,
    bebe_valor: valor,
    observacao: txt(fd, "observacao")?.slice(0, 600) ?? null,
    atualizado_por: autorDe(s),
  };
  await comSql((sql) => sql`
    INSERT INTO regras_hospedagem ${sql({ id: 1, ...dados })}
    ON CONFLICT (id) DO UPDATE SET ${sql(dados)}, atualizado_em = now()`);
  atualizarSite();
  return {
    ok: true,
    mensagem: idade === null
      ? "Regra desligada. O site volta a usar o cálculo do motor para crianças."
      : "Regra salva. Já vale na busca do site e para a Marina.",
  };
}

export async function salvarAdicional(fd: FormData): Promise<Resultado> {
  const s = await exigirSessao();
  const id = txt(fd, "id");
  const nome = txt(fd, "nome")?.slice(0, 120);
  if (!nome) return { ok: false, mensagem: "Dê um nome ao adicional." };
  const cobranca = ["por_estadia", "por_noite", "por_pessoa_noite", "por_unidade"].includes(txt(fd, "cobranca") ?? "")
    ? txt(fd, "cobranca")! : "por_estadia";
  const dados = {
    nome,
    descricao: txt(fd, "descricao")?.slice(0, 600) ?? null,
    preco: dinheiro(fd, "preco"),
    cobranca,
    categoria: ["quarto", "bebe", "alimentacao", "experiencia", "transporte", "outros"].includes(txt(fd, "categoria") ?? "")
      ? txt(fd, "categoria")! : "outros",
    precisa_pedir: fd.get("precisa_pedir") === "on",
    visivel_site: fd.get("visivel_site") === "on",
    visivel_marina: fd.get("visivel_marina") === "on",
    ativo: fd.get("ativo") === "on",
    atualizado_por: autorDe(s),
  };
  await comSql((sql) => id
    ? sql`UPDATE adicionais SET ${sql(dados)}, atualizado_em = now() WHERE id = ${id}`
    : sql`INSERT INTO adicionais ${sql(dados)}`);
  atualizarSite();
  return { ok: true, mensagem: id ? "Adicional atualizado." : "Adicional criado. Já aparece no site e para a Marina." };
}

export async function excluirAdicional(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  const id = txt(fd, "id");
  if (!id) return { ok: false, mensagem: "Adicional não encontrado." };
  await comSql((sql) => sql`DELETE FROM adicionais WHERE id = ${id}`);
  atualizarSite();
  return { ok: true, mensagem: "Adicional apagado." };
}
