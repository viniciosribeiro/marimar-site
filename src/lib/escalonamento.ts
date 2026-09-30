import type { Sql } from "./db-conexao";
import { enviarWhatsapp, type Envio } from "./envio-whatsapp";
import { aprenderDeChamado, registrarEvento } from "./aprendizado";
import { lerConfig } from "./marina";
import { sugerirCategoria } from "./marina-base";
import { gatewayConfigurado, urlGateway, cabecalhosGateway } from "./chat";
import {
  CONFIG_ESCALONAMENTO_PADRAO, acoesDePrazo, anonimizar, codigosNoTexto, dentroDoHorario, escolherContato,
  gerarCodigo, janelaAberta, mesmoNumero, setorPara, setorValido, similaridade, LIMIAR_MESMA_PERGUNTA,
  textoAoClienteAoEscalar, textoParaEquipe, type ConfigEscalonamento, type ContatoEquipe,
} from "./escalonamento-base";

/**
 * Escalonamento: quando a Marina não sabe, pergunta à equipe e devolve a
 * resposta ao cliente no mesmo canal.
 *
 *   cliente pergunta ──► abrirChamado ──► WhatsApp da pessoa certa (#K7Q2)
 *   equipe responde  ──► responderChamado ──► resposta no tom da Marina
 *                                           ├─► cliente (WhatsApp ou chat do site)
 *                                           └─► base de aprendizado
 *   prazos           ──► processarPrazos (lembrete, próximo da fila, aviso ao cliente, desistência)
 *
 * Detalhes, limites e segurança: docs/fluxo-escalonamento.md.
 */

export type Chamado = {
  id: string; codigo: string; status: string; canal: "whatsapp" | "site"; destino: string | null;
  pergunta: string; contexto: string | null; setor: string; categoria: string; contato_id: string | null;
  tentativas: { contato_id: string | null; nome: string; em: string; tipo: string; ok: boolean; erro?: string }[];
  notificado_em: string | null; lembrete_em: string | null; cliente_avisado_em: string | null;
  resposta_equipe: string | null; respondido_por: string | null; respondido_em: string | null;
  resposta_final: string | null; entregue_em: string | null; entrega_erro: string | null;
  ultima_msg_cliente_em: string; aprendizado_id: string | null; criado_em: string; atualizado_em: string;
};

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

function chamadoDe(l: Record<string, unknown>): Chamado {
  const c = l as unknown as Chamado;
  return {
    ...c,
    tentativas: Array.isArray(l.tentativas) ? (l.tentativas as Chamado["tentativas"]) : [],
    notificado_em: iso(l.notificado_em), lembrete_em: iso(l.lembrete_em), cliente_avisado_em: iso(l.cliente_avisado_em),
    respondido_em: iso(l.respondido_em), entregue_em: iso(l.entregue_em),
    ultima_msg_cliente_em: iso(l.ultima_msg_cliente_em)!, criado_em: iso(l.criado_em)!, atualizado_em: iso(l.atualizado_em)!,
  };
}

export async function lerConfigEscalonamento(sql: Sql): Promise<ConfigEscalonamento> {
  try {
    const [l] = await sql<ConfigEscalonamento[]>`SELECT * FROM marina_escalonamento_config WHERE id = 1`;
    return l ? { ...CONFIG_ESCALONAMENTO_PADRAO, ...l } : CONFIG_ESCALONAMENTO_PADRAO;
  } catch {
    return CONFIG_ESCALONAMENTO_PADRAO; // antes da migration 0019: desligado
  }
}

export async function lerContatos(sql: Sql): Promise<ContatoEquipe[]> {
  try {
    const linhas = await sql<(ContatoEquipe & { setores: unknown; dias: unknown })[]>`
      SELECT id, nome, numero, setores, dias, hora_inicio, hora_fim, ordem, ativo FROM equipe_contatos ORDER BY ordem, nome`;
    return linhas.map((c) => ({
      ...c,
      setores: Array.isArray(c.setores) ? (c.setores as string[]) : ["geral"],
      dias: Array.isArray(c.dias) ? (c.dias as number[]) : [0, 1, 2, 3, 4, 5, 6],
    }));
  } catch {
    return [];
  }
}

export async function lerChamado(sql: Sql, id: string): Promise<Chamado | null> {
  const [l] = await sql`SELECT * FROM marina_chamados WHERE id = ${id}`;
  return l ? chamadoDe(l) : null;
}

export async function lerChamados(sql: Sql, limite = 200): Promise<Chamado[]> {
  try {
    return (await sql`SELECT * FROM marina_chamados ORDER BY criado_em DESC LIMIT ${limite}`).map(chamadoDe);
  } catch {
    return [];
  }
}

/* ── abrir ───────────────────────────────────────────────────────── */

export type Aviso = { contato: { id: string; nome: string; numero: string } | null; texto: string; envio: Envio };

export type Abertura =
  | { ok: false; motivo: "desligado" | "invalido"; erro: string }
  | { ok: true; novo: boolean; chamado: Chamado; aviso: Aviso | null; mensagemCliente: string };

export async function abrirChamado(
  sql: Sql,
  e: { canal: "whatsapp" | "site"; destino: string; pergunta: string; contexto?: string | null; assunto?: string | null },
): Promise<Abertura> {
  const cfg = await lerConfigEscalonamento(sql);
  if (!cfg.ativo) return { ok: false, motivo: "desligado", erro: "O escalonamento para a equipe está desligado no painel." };
  const pergunta = anonimizar(e.pergunta).slice(0, 800);
  if (pergunta.length < 4 || !e.destino) return { ok: false, motivo: "invalido", erro: "Informe a pergunta e o destino." };
  const contatos = await lerContatos(sql);
  const agora = new Date();
  const algumNoHorario = contatos.some((c) => c.ativo && dentroDoHorario(c, agora));

  /* O mesmo cliente perguntando de novo a mesma coisa (ou a Marina chamando
     a rota duas vezes) não abre um segundo chamado. */
  const abertos = (await sql`
    SELECT * FROM marina_chamados WHERE status = 'aguardando' AND canal = ${e.canal} AND destino = ${e.destino}
      AND criado_em > now() - interval '24 hours'`).map(chamadoDe);
  await sql`UPDATE marina_chamados SET ultima_msg_cliente_em = now() WHERE destino = ${e.destino} AND status IN ('aguardando', 'respondido')`;
  const repetido = abertos.find((c) => similaridade(c.pergunta, pergunta) >= LIMIAR_MESMA_PERGUNTA);
  if (repetido) return { ok: true, novo: false, chamado: repetido, aviso: null, mensagemCliente: textoAoClienteAoEscalar(algumNoHorario, e.canal) };

  const setor = e.assunto && setorValido(e.assunto) !== "geral" ? setorValido(e.assunto) : setorPara(pergunta);
  const emUso = new Set((await sql<{ codigo: string }[]>`SELECT codigo FROM marina_chamados WHERE status IN ('aguardando', 'respondido')`).map((r) => r.codigo));
  let codigo = gerarCodigo();
  for (let i = 0; i < 20 && emUso.has(codigo); i++) codigo = gerarCodigo();

  const [linha] = await sql`
    INSERT INTO marina_chamados (codigo, canal, destino, pergunta, contexto, setor, categoria)
    VALUES (${codigo}, ${e.canal}, ${e.destino}, ${pergunta}, ${e.contexto ? anonimizar(e.contexto).slice(0, 800) : null},
      ${setor}, ${sugerirCategoria(pergunta)})
    RETURNING *`;
  const chamado = chamadoDe(linha);
  const aviso = await notificar(sql, chamado, "novo", cfg, contatos);
  await registrarEvento(sql, "escalada", { canal: e.canal, categoria: chamado.categoria, referencia: chamado.id });
  return { ok: true, novo: true, chamado: (await lerChamado(sql, chamado.id)) ?? chamado, aviso, mensagemCliente: textoAoClienteAoEscalar(algumNoHorario, e.canal) };
}

/**
 * Avisa uma pessoa da equipe. "novo" e "repasse" escolhem a próxima da fila
 * (setor → horário → prioridade, sem repetir quem já foi avisado);
 * "lembrete" cutuca quem está com o chamado.
 */
async function notificar(sql: Sql, c: Chamado, tipo: "novo" | "repasse" | "lembrete", cfg: ConfigEscalonamento, contatos?: ContatoEquipe[]): Promise<Aviso> {
  const todos = contatos ?? (await lerContatos(sql));
  const agora = new Date();
  const jaAvisados = c.tentativas.map((t) => t.contato_id).filter((x): x is string => !!x);
  const contato = tipo === "lembrete"
    ? todos.find((p) => p.id === c.contato_id && p.ativo) ?? null
    : escolherContato(todos, c.setor, jaAvisados, agora);
  const texto = textoParaEquipe(c, tipo);
  if (!contato) {
    const erro = todos.some((p) => p.ativo) ? "Todos da equipe já foram avisados." : "Nenhum contato ativo em Equipe responsável.";
    await sql`UPDATE marina_chamados SET notificado_em = now(), atualizado_em = now(),
      tentativas = tentativas || ${sql.json([{ contato_id: null, nome: "—", em: agora.toISOString(), tipo, ok: false, erro }])}
      WHERE id = ${c.id}`;
    return { contato: null, texto, envio: { ok: false, erro } };
  }
  const template = cfg.whatsapp_modo === "oficial" && cfg.template_equipe ? { nome: cfg.template_equipe, idioma: cfg.template_idioma } : null;
  const envio = await enviarWhatsapp(contato.numero, texto, { template, chave: `${c.id}:${tipo}:${contato.id}` });
  const tentativa = { contato_id: contato.id, nome: contato.nome, em: agora.toISOString(), tipo, ok: envio.ok, ...(envio.ok ? {} : { erro: envio.erro }) };
  if (tipo === "lembrete") {
    await sql`UPDATE marina_chamados SET lembrete_em = now(), atualizado_em = now(), tentativas = tentativas || ${sql.json([tentativa])} WHERE id = ${c.id}`;
  } else {
    await sql`UPDATE marina_chamados SET contato_id = ${contato.id}, notificado_em = now(), lembrete_em = null, atualizado_em = now(),
      tentativas = tentativas || ${sql.json([tentativa])} WHERE id = ${c.id}`;
  }
  return { contato: { id: contato.id, nome: contato.nome, numero: contato.numero }, texto, envio };
}

/* ── entregar ao cliente ─────────────────────────────────────────── */

/**
 * Leva um texto ao cliente, no canal em que ele está. Site: a mensagem
 * entra na conversa dele e o chat a mostra sozinho (ele consulta a cada
 * poucos segundos). WhatsApp: pelo gateway, respeitando a janela de 24 h
 * quando a conta é da API oficial.
 */
export async function entregarAoCliente(sql: Sql, c: Chamado, texto: string, cfg: ConfigEscalonamento): Promise<Envio> {
  if (!c.destino) return { ok: false, erro: "O destino deste chamado já foi apagado." };
  if (c.canal === "site") {
    try {
      await sql`INSERT INTO chat_mensagens (sessao, papel, conteudo, chamado_id) VALUES (${c.destino}, 'marina', ${texto}, ${c.id})`;
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: (e as Error).message };
    }
  }
  const aberta = janelaAberta(c.ultima_msg_cliente_em, new Date(), cfg.whatsapp_modo);
  if (!aberta && !cfg.template_cliente) {
    return { ok: false, erro: "Fora da janela de 24 h do WhatsApp oficial e sem template configurado. Responda o cliente manualmente." };
  }
  return enviarWhatsapp(c.destino, texto, {
    template: aberta ? null : { nome: cfg.template_cliente!, idioma: cfg.template_idioma },
    chave: `${c.id}:cliente:${texto.length}:${texto.slice(0, 20)}`,
  });
}

/**
 * A resposta da equipe no jeito da Marina. Passa pelo mesmo agente (o
 * gateway), com o tom cadastrado, e a ordem de não acrescentar nada. Se o
 * gateway não responder, vai uma versão simples — a informação chega do
 * mesmo jeito.
 */
export async function formularResposta(sql: Sql, c: Pick<Chamado, "codigo" | "pergunta">, respostaEquipe: string): Promise<string> {
  const simples = `Voltei com a resposta da equipe sobre a sua pergunta ("${c.pergunta.slice(0, 120)}"): ${respostaEquipe} 😊`;
  if (!gatewayConfigurado()) return simples;
  try {
    const cfg = await lerConfig(sql);
    const sistema = [
      "Você é a Marina, da Pousada Marimar. Um cliente fez uma pergunta que você não sabia, e a equipe da pousada respondeu.",
      "Escreva a mensagem que você vai mandar ao cliente com essa resposta.",
      "Regras: use SÓ a informação da equipe — não acrescente preço, horário, promessa nem nada que não esteja lá.",
      "Comece retomando o assunto (o cliente pode ter perguntado outras coisas depois). Curto, natural, no máximo 3 frases.",
      "Não mencione código de chamado, nem 'equipe interna', nem nomes de funcionários.",
      cfg.tom?.trim() ? `Como falar:\n${cfg.tom.trim()}` : "",
    ].filter(Boolean).join("\n");
    const r = await fetch(urlGateway("/v1/chat/completions"), {
      method: "POST",
      headers: cabecalhosGateway(),
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODELO || "openclaw",
        stream: false,
        user: `chamado:${c.codigo}`,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: `Pergunta do cliente: ${c.pergunta}\n\nResposta da equipe: ${respostaEquipe}` },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) return simples;
    const d = await r.json();
    const texto = String(d?.choices?.[0]?.message?.content ?? "").trim();
    return texto.length >= 8 ? texto.slice(0, 1500) : simples;
  } catch {
    return simples;
  }
}

/* ── a equipe respondeu ──────────────────────────────────────────── */

export type Resposta =
  | { tipo: "nao_equipe" }
  | { tipo: "nenhum_aberto"; mensagem: string }
  | { tipo: "qual"; mensagem: string; codigos: string[] }
  | {
      tipo: "respondido"; mensagem: string; chamado: Chamado; entregue: boolean;
      /** Quando o site não conseguiu entregar no WhatsApp: a Marina manda. */
      entregarManual: { para: string; texto: string } | null;
      aprendizado: { id: string; novo: boolean; status: string } | null;
    };

/**
 * Uma mensagem da equipe chegou. Descobre de qual chamado é — pelo código
 * no texto ou na mensagem citada; sem código, pelo único chamado aberto
 * daquela pessoa — e devolve ao cliente certo. Vários clientes esperando ao
 * mesmo tempo não se misturam: cada resposta só vai para o chamado do código.
 */
export async function responderChamado(
  sql: Sql,
  e: { numero?: string | null; contatoId?: string | null; autor?: string | null; texto: string; citado?: string | null; codigo?: string | null },
): Promise<Resposta> {
  const contatos = await lerContatos(sql);
  const contato = e.contatoId
    ? contatos.find((c) => c.id === e.contatoId) ?? null
    : e.numero ? contatos.find((c) => mesmoNumero(c.numero, e.numero)) ?? null : null;
  if (!contato && !e.autor) return { tipo: "nao_equipe" };

  const abertos = (await sql`SELECT * FROM marina_chamados WHERE status = 'aguardando' ORDER BY criado_em`).map(chamadoDe);
  const codigos = abertos.map((c) => c.codigo);
  const achados = e.codigo ? codigosNoTexto(e.codigo, codigos) : codigosNoTexto(`${e.texto}\n${e.citado ?? ""}`, codigos);
  let chamado = achados.length ? abertos.find((c) => c.codigo === achados[0]) ?? null : null;
  if (!chamado && contato) {
    const meus = abertos.filter((c) => c.contato_id === contato.id || c.tentativas.some((t) => t.contato_id === contato.id));
    if (meus.length === 1) chamado = meus[0];
    else if (meus.length > 1) {
      return {
        tipo: "qual", codigos: meus.map((c) => c.codigo),
        mensagem: `Você tem ${meus.length} chamados em aberto: ${meus.map((c) => `#${c.codigo} ("${c.pergunta.slice(0, 50)}")`).join(", ")}. Responda citando a mensagem do chamado ou escrevendo o código (ex.: #${meus[0].codigo} e a resposta).`,
      };
    }
  }
  if (!chamado) {
    return { tipo: "nenhum_aberto", mensagem: "Não achei nenhum chamado em aberto para esta resposta. Se era para um cliente, escreva o código do chamado (ex.: #K7Q2) junto com a resposta." };
  }

  /* O código não faz parte da resposta ao cliente. */
  const respostaEquipe = e.texto.replace(new RegExp(`#?${chamado.codigo}\\b[:\\s-]*`, "ig"), "").trim();
  if (respostaEquipe.length < 2) {
    return { tipo: "qual", codigos: [chamado.codigo], mensagem: `Recebi o código #${chamado.codigo}, mas sem a resposta. Mande a informação junto.` };
  }
  const autor = contato?.nome ?? e.autor ?? "equipe";
  const cfg = await lerConfigEscalonamento(sql);

  /* Marca como respondido ANTES de formular/entregar: uma segunda resposta
     ao mesmo chamado, chegando junto, não gera duas mensagens ao cliente. */
  const [marcado] = await sql`
    UPDATE marina_chamados SET status = 'respondido', resposta_equipe = ${respostaEquipe.slice(0, 3000)},
      respondido_por = ${autor}, respondido_em = now(), atualizado_em = now()
    WHERE id = ${chamado.id} AND status = 'aguardando' RETURNING id`;
  if (!marcado) return { tipo: "nenhum_aberto", mensagem: `O chamado #${chamado.codigo} já foi respondido.` };

  const texto = await formularResposta(sql, chamado, respostaEquipe);
  const envio = await entregarAoCliente(sql, chamado, texto, cfg);
  const aprendizado = await aprenderDeChamado(sql, chamado, respostaEquipe, autor, cfg);
  const minutos = (Date.now() - new Date(chamado.notificado_em ?? chamado.criado_em).getTime()) / 60000;
  await registrarEvento(sql, "respondido", { canal: chamado.canal, categoria: chamado.categoria, referencia: chamado.id, valor: Math.round(minutos) });

  const destino = chamado.destino;
  if (envio.ok) {
    /* Entregue: o destino (telefone ou sessão) não fica guardado. */
    await sql`UPDATE marina_chamados SET status = 'entregue', resposta_final = ${texto}, entregue_em = now(), entrega_erro = null,
      destino = null, aprendizado_id = ${aprendizado?.id ?? null}, atualizado_em = now() WHERE id = ${chamado.id}`;
  } else {
    await sql`UPDATE marina_chamados SET resposta_final = ${texto}, entrega_erro = ${envio.erro}, aprendizado_id = ${aprendizado?.id ?? null},
      atualizado_em = now() WHERE id = ${chamado.id}`;
  }
  await sql`UPDATE marina_lacunas SET status = 'resolvida', resolvido_em = now() WHERE status = 'aberta' AND lower(pergunta) = lower(${chamado.pergunta})`.catch(() => {});

  const canal = chamado.canal === "site" ? "chat do site" : "WhatsApp";
  const aprendeu = aprendizado
    ? aprendizado.status === "ativo" ? " A Marina já aprendeu e vai responder sozinha da próxima vez."
      : aprendizado.status === "pendente" ? " A resposta foi para a fila de revisão do aprendizado." : ""
    : "";
  return {
    tipo: "respondido",
    chamado: (await lerChamado(sql, chamado.id))!,
    entregue: envio.ok,
    entregarManual: !envio.ok && chamado.canal === "whatsapp" && destino ? { para: destino, texto } : null,
    aprendizado,
    mensagem: envio.ok
      ? `✅ Chamado #${chamado.codigo} respondido e entregue ao cliente (${canal}).${aprendeu}`
      : `⚠️ Chamado #${chamado.codigo} respondido, mas não consegui entregar ao cliente (${canal}): ${envio.erro}`,
  };
}

/* ── prazos ──────────────────────────────────────────────────────── */

export async function processarPrazos(sql: Sql, agora = new Date()): Promise<{ lembretes: number; repasses: number; avisos: number; expirados: number }> {
  const cfg = await lerConfigEscalonamento(sql);
  const n = { lembretes: 0, repasses: 0, avisos: 0, expirados: 0 };
  let abertos: Chamado[] = [];
  try {
    abertos = (await sql`SELECT * FROM marina_chamados WHERE status = 'aguardando' ORDER BY criado_em LIMIT 200`).map(chamadoDe);
  } catch {
    return n;
  }
  if (!abertos.length) return n;
  const contatos = await lerContatos(sql);
  const [p] = await sql<{ whatsapp: string | null; telefone: string | null }[]>`SELECT whatsapp, telefone FROM pousada LIMIT 1`.catch(() => []);

  for (const c of abertos) {
    for (const acao of acoesDePrazo(c, cfg, agora)) {
      if (acao === "lembrete") { await notificar(sql, c, "lembrete", cfg, contatos); n.lembretes++; }
      if (acao === "proximo") { await notificar(sql, c, "repasse", cfg, contatos); n.repasses++; }
      if (acao === "avisar_cliente") {
        const texto = "Ainda estou confirmando a sua pergunta com a equipe da pousada — não esqueci de você! Assim que me responderem, te aviso por aqui 😊";
        const envio = await entregarAoCliente(sql, c, texto, cfg);
        await sql`UPDATE marina_chamados SET cliente_avisado_em = now(), atualizado_em = now(), entrega_erro = ${envio.ok ? null : envio.erro} WHERE id = ${c.id}`;
        n.avisos++;
      }
      if (acao === "desistir") {
        /* Nunca inventar contato: só oferece o que está cadastrado. */
        const contato = p?.whatsapp ? ` Se preferir, fale direto com a recepção pelo WhatsApp ${p.whatsapp}.` : p?.telefone ? ` Se preferir, ligue para a recepção: ${p.telefone}.` : "";
        const texto = `Desculpe a demora! Não consegui a confirmação da equipe a tempo sobre a sua pergunta ("${c.pergunta.slice(0, 100)}").${contato}`;
        const envio = await entregarAoCliente(sql, c, texto, cfg);
        await sql`UPDATE marina_chamados SET status = 'expirado', destino = null, entrega_erro = ${envio.ok ? null : envio.erro}, atualizado_em = now() WHERE id = ${c.id}`;
        await registrarEvento(sql, "lacuna", { canal: c.canal, categoria: c.categoria, referencia: c.id });
        n.expirados++;
      }
    }
  }
  return n;
}

/*
 * Os prazos rodam por três caminhos: a rota /api/cron/chamados (chamada por
 * um agendador), e — de carona — o chat do site e as rotas de chamado da
 * Marina. Um intervalo mínimo por instância evita rodar a cada requisição.
 */
let ultimaRodada = 0;
export async function talvezProcessarPrazos(sql: Sql) {
  if (Date.now() - ultimaRodada < 60_000) return;
  ultimaRodada = Date.now();
  try { await processarPrazos(sql); } catch (e) { console.error("[chamados] prazos:", (e as Error).message); }
}

/** Mensagem de teste para um contato da equipe (botão "Testar envio"). */
export async function testarContato(sql: Sql, id: string): Promise<Envio> {
  const [c] = await sql<{ nome: string; numero: string }[]>`SELECT nome, numero FROM equipe_contatos WHERE id = ${id}`;
  if (!c) return { ok: false, erro: "Contato não encontrado." };
  const envio = await enviarWhatsapp(c.numero, `👋 Oi, ${c.nome}! Teste da Marina: é por este número que vou pedir ajuda quando um cliente perguntar algo que eu não sei. Não precisa responder.`);
  await sql`UPDATE equipe_contatos SET ultimo_teste_em = now(), ultimo_teste_ok = ${envio.ok}, ultimo_teste_erro = ${envio.ok ? null : envio.erro} WHERE id = ${id}`;
  return envio;
}
