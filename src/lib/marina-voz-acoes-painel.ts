import type { Sql } from "./db-conexao";
import type { Acao } from "./marina-voz-acoes";
import { lerConteudo, hojeBR, type Atracao } from "./conteudo-editavel";
import {
  texto, listaDeTexto, dinheiro, simNao, slugDe, dataISO, horario, acharUm, type Dados,
} from "./marina-voz-util";

/**
 * Ações por voz no RESTO do painel (fora do treinamento): políticas,
 * perguntas frequentes, cardápio, pacotes, banners, atrações, travessia,
 * eventos e depoimentos.
 *
 * Cada uma grava nas MESMAS tabelas e do MESMO jeito que a tela do painel
 * correspondente (as Server Actions de `admin/*`), só que a porta de entrada
 * é a voz e a pessoa confirma antes. Ficam DE FORA de propósito:
 *  - preço e vaga das suítes, e ligar/desligar suíte (vêm do Desbravador);
 *  - Clássico/Novo do site, usuários e senhas, chaves e integrações;
 *  - apagar de vez (sempre há um "desligar" reversível no lugar);
 *  - qualquer coisa que precise de arquivo (foto, vídeo, imagem de banner).
 */

const reais = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ligaDesliga = (v: unknown) => (v === true ? "ligar" : v === false ? "desligar" : null);

/** Grava uma linha de `conteudo_editavel` preservando o que a ação não mexe. */
async function lerLinhaConteudo(sql: Sql, chave: "chegar" | "ilha" | "eventos"): Promise<Record<string, unknown>> {
  const [l] = await sql<{ dados: Record<string, unknown> }[]>`SELECT dados FROM conteudo_editavel WHERE chave = ${chave}`;
  return l?.dados ?? {};
}
async function gravarLinhaConteudo(sql: Sql, chave: "chegar" | "ilha" | "eventos", dados: Record<string, unknown>) {
  await sql`
    INSERT INTO conteudo_editavel (chave, dados, atualizado_em)
    VALUES (${chave}, ${sql.json(dados as never)}, now())
    ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`;
}

/* ── políticas ───────────────────────────────────────────────────── */

const CAMPOS_POLITICA: { chave: string; rotulo: string; max: number }[] = [
  { chave: "cancelamento", rotulo: "política de cancelamento", max: 4000 },
  { chave: "pet_texto", rotulo: "regra de pets", max: 1000 },
  { chave: "criancas_texto", rotulo: "texto sobre crianças", max: 2000 },
  { chave: "regras_gerais", rotulo: "regras gerais", max: 4000 },
];

const politicas: Acao = {
  rotulo: "Mudar as políticas da pousada",
  caminhos: ["/admin/politicas", "/politicas"],
  comoUsar:
    'mudar a página de Políticas (horários, cancelamento, pets, pagamento). dados (só o que mudar): {"check_in":"14:00","check_out":"12:00","cancelamento":"texto","pet":true|false,"pet_texto":"texto","criancas_texto":"texto","regras_gerais":"texto","formas_pagamento":["Pix","Cartão"],"diaria_minima_padrao":número}',
  validar(d) {
    const out: Dados = {};
    for (const k of ["check_in", "check_out"]) {
      if (d[k] == null || d[k] === "") continue;
      const h = horario(d[k]);
      if (!h) return { ok: false, erro: `Não entendi o horário de ${k === "check_in" ? "check-in" : "check-out"} (ex.: 14:00).` };
      out[k] = h;
    }
    for (const c of CAMPOS_POLITICA) { const t = texto(d[c.chave], c.max); if (t) out[c.chave] = t; }
    if ("pet" in d) { const p = simNao(d.pet); if (p !== null) out.pet = p; }
    if ("formas_pagamento" in d) { const l = listaDeTexto(d.formas_pagamento); if (l.length) out.formas_pagamento = l; }
    if ("diaria_minima_padrao" in d) {
      const n = Math.round(Number(d.diaria_minima_padrao));
      if (!Number.isFinite(n) || n < 1 || n > 30) return { ok: false, erro: "A estadia mínima precisa ser de 1 a 30 noites." };
      out.diaria_minima_padrao = n;
    }
    if (Object.keys(out).length === 0) return { ok: false, erro: "Diga o que mudar nas políticas (check-in, check-out, cancelamento, pets, pagamento…)." };
    return { ok: true, dados: out };
  },
  async descrever(_sql, d) {
    const p: string[] = [];
    if (d.check_in) p.push(`check-in às ${d.check_in}`);
    if (d.check_out) p.push(`check-out às ${d.check_out}`);
    if (d.pet === true) p.push("aceitar pets");
    if (d.pet === false) p.push("não aceitar pets");
    for (const c of CAMPOS_POLITICA) if (d[c.chave]) p.push(`trocar a ${c.rotulo}`);
    if (d.formas_pagamento) p.push(`formas de pagamento: ${(d.formas_pagamento as string[]).join(", ")}`);
    if (d.diaria_minima_padrao) { const n = Number(d.diaria_minima_padrao); p.push(`estadia mínima de ${n} ${n === 1 ? "noite" : "noites"}`); }
    return `mudar nas políticas: ${p.join("; ")}`;
  },
  async executar(sql, d) {
    const { formas_pagamento, ...campos } = d;
    const [linha] = await sql<{ id: string }[]>`SELECT id FROM politicas LIMIT 1`;
    let id = linha?.id;
    if (!id) [{ id }] = await sql<{ id: string }[]>`INSERT INTO politicas DEFAULT VALUES RETURNING id`;
    if (Object.keys(campos).length) await sql`UPDATE politicas SET ${sql(campos as Record<string, string | number | boolean>)}, atualizado_em = now() WHERE id = ${id!}`;
    if (formas_pagamento) await sql`UPDATE politicas SET formas_pagamento = ${sql.json(formas_pagamento as string[])}, atualizado_em = now() WHERE id = ${id!}`;
    return { ok: true, resumo: "Políticas atualizadas. Já valem no site e para a Marina." };
  },
};

/* ── perguntas frequentes (a página pública /faq) ────────────────── */

const faq: Acao = {
  rotulo: "Criar uma pergunta frequente no site",
  caminhos: ["/admin/faq", "/faq"],
  comoUsar:
    'pôr uma pergunta e resposta na página Perguntas frequentes do site. dados: {"pergunta":"...","resposta":"...","visivel_agente":true}',
  validar(d) {
    const pergunta = texto(d.pergunta, 500);
    const resposta = texto(d.resposta, 4000);
    if (!pergunta || !resposta) return { ok: false, erro: "Faltou a pergunta ou a resposta." };
    return { ok: true, dados: { pergunta, resposta, visivel_agente: simNao(d.visivel_agente) ?? true } };
  },
  async descrever(_sql, d) {
    return `pôr nas perguntas frequentes do site: "${texto(d.pergunta, 100)}"`;
  },
  async executar(sql, d) {
    const [{ max }] = await sql<{ max: number }[]>`SELECT COALESCE(MAX(ordem), -1)::int AS max FROM faq`;
    await sql`
      INSERT INTO faq (pergunta, resposta, ordem, ativo, visivel_agente)
      VALUES (${String(d.pergunta)}, ${String(d.resposta)}, ${max + 1}, true, ${d.visivel_agente !== false})`;
    return { ok: true, resumo: `Pus "${texto(d.pergunta, 80)}" nas perguntas frequentes do site.` };
  },
};

const faqEditar: Acao = {
  rotulo: "Mudar ou desligar uma pergunta frequente",
  caminhos: ["/admin/faq", "/faq"],
  comoUsar:
    'mudar uma pergunta frequente que já existe, ou tirá-la do site (desligar, reversível). dados: {"alvo":"parte da pergunta","pergunta":"nova" (opcional),"resposta":"nova" (opcional),"ativo":true|false (opcional)}',
  validar(d) {
    const alvo = texto(d.alvo, 160);
    if (!alvo) return { ok: false, erro: "Diga qual pergunta frequente mudar (parte do texto dela)." };
    const out: Dados = { alvo };
    const p = texto(d.pergunta, 500); if (p) out.pergunta = p;
    const r = texto(d.resposta, 4000); if (r) out.resposta = r;
    const a = simNao(d.ativo); if (a !== null) out.ativo = a;
    if (Object.keys(out).length === 1) return { ok: false, erro: "Diga o que mudar: a pergunta, a resposta, ou tirar do site." };
    return { ok: true, dados: out };
  },
  async descrever(sql, d) {
    const a = await acharUm<{ id: string; pergunta: string }>(sql, "faq", String(d.alvo), "pergunta frequente");
    if (!a.ok) return a.erro;
    const p = [ligaDesliga(d.ativo) === "desligar" ? "tirar do site" : ligaDesliga(d.ativo) === "ligar" ? "voltar ao site" : null,
      d.pergunta ? "trocar a pergunta" : null, d.resposta ? "trocar a resposta" : null].filter(Boolean);
    return `${p.join(" e ")} — "${a.linha.pergunta.slice(0, 90)}"`;
  },
  async executar(sql, d) {
    const a = await acharUm<{ id: string; pergunta: string; resposta: string; ativo: boolean }>(sql, "faq", String(d.alvo), "pergunta frequente");
    if (!a.ok) return { ok: false, erro: a.erro };
    const l = a.linha;
    await sql`
      UPDATE faq SET pergunta = ${(d.pergunta as string) ?? l.pergunta}, resposta = ${(d.resposta as string) ?? l.resposta},
        ativo = ${typeof d.ativo === "boolean" ? d.ativo : l.ativo}
      WHERE id = ${l.id}`;
    return { ok: true, resumo: d.ativo === false ? `Tirei "${l.pergunta.slice(0, 60)}" do site (dá para voltar).` : `Atualizei a pergunta "${l.pergunta.slice(0, 60)}".` };
  },
};

/* ── cardápio do restaurante ─────────────────────────────────────── */

type Prato = { id: string; nome: string; categoria_id: string; descricao: string | null; preco: string | null; preco_promocional: string | null; porcao: string | null; destaque: boolean; disponivel: boolean };

async function acharSecao(sql: Sql, nome: string): Promise<{ ok: true; id: string; nome: string } | { ok: false; erro: string }> {
  const a = await acharUm<{ id: string; nome: string }>(sql, "cardapio_categorias", nome, "seção do cardápio");
  if (a.ok) return { ok: true, id: a.linha.id, nome: a.linha.nome };
  const todas = await sql<{ nome: string }[]>`SELECT nome FROM cardapio_categorias ORDER BY ordem, nome LIMIT 12`;
  return { ok: false, erro: `${a.erro}${todas.length ? ` As seções são: ${todas.map((t) => t.nome).join(", ")}.` : ""}` };
}

const cardapioItem: Acao = {
  rotulo: "Criar ou mudar um prato do cardápio",
  caminhos: ["/admin/cardapio", "/restaurante"],
  comoUsar:
    'criar um prato/bebida no cardápio, ou mudar um que já existe (preço, descrição, porção, destaque). dados: {"alvo":"nome do prato que já existe" (só para mudar),"nome":"...","secao":"nome da seção do cardápio" (obrigatório para criar),"descricao":"...","preco":número,"preco_promocional":número ou null,"porcao":"...","destaque":true|false}',
  validar(d) {
    const out: Dados = {};
    const alvo = texto(d.alvo, 160); if (alvo) out.alvo = alvo;
    const nome = texto(d.nome, 180); if (nome) out.nome = nome;
    const secao = texto(d.secao, 120); if (secao) out.secao = secao;
    const descricao = texto(d.descricao, 2000); if (descricao) out.descricao = descricao;
    const porcao = texto(d.porcao, 80); if (porcao) out.porcao = porcao;
    if (d.preco != null && d.preco !== "") {
      const p = dinheiro(d.preco); if (p === null) return { ok: false, erro: "Não entendi o preço (ex.: 45,90)." }; out.preco = p;
    }
    if ("preco_promocional" in d) out.preco_promocional = d.preco_promocional === null ? null : dinheiro(d.preco_promocional);
    const dest = simNao(d.destaque); if (dest !== null) out.destaque = dest;
    if (!alvo && !nome) return { ok: false, erro: "Diga o nome do prato (ou qual prato mudar)." };
    if (!alvo && !secao) return { ok: false, erro: "Diga em qual seção do cardápio ele entra (ex.: Bebidas, Pratos principais)." };
    if (alvo && Object.keys(out).length === 1) return { ok: false, erro: "Diga o que mudar no prato (preço, descrição, porção…)." };
    return { ok: true, dados: out };
  },
  async descrever(sql, d) {
    const preco = typeof d.preco === "number" ? ` por ${reais(d.preco)}` : "";
    if (!d.alvo) return `criar no cardápio "${d.nome}"${d.secao ? ` (seção ${d.secao})` : ""}${preco}`;
    const a = await acharUm<Prato>(sql, "cardapio_itens", String(d.alvo), "prato");
    if (!a.ok) return a.erro;
    const p = [d.nome ? `renomear para "${d.nome}"` : null, typeof d.preco === "number" ? `preço para ${reais(d.preco)}` : null,
      d.descricao ? "trocar a descrição" : null, d.porcao ? `porção "${d.porcao}"` : null,
      d.destaque === true ? "pôr em destaque" : d.destaque === false ? "tirar do destaque" : null,
      d.secao ? `mudar para a seção ${d.secao}` : null].filter(Boolean);
    return `mudar o prato "${a.linha.nome}": ${p.join(", ")}`;
  },
  async executar(sql, d) {
    let categoria: string | null = null;
    if (d.secao) {
      const s = await acharSecao(sql, String(d.secao));
      if (!s.ok) return { ok: false, erro: s.erro };
      categoria = s.id;
    }
    if (d.alvo) {
      const a = await acharUm<Prato>(sql, "cardapio_itens", String(d.alvo), "prato");
      if (!a.ok) return { ok: false, erro: a.erro };
      const l = a.linha;
      await sql`
        UPDATE cardapio_itens SET
          nome = ${(d.nome as string) ?? l.nome}, categoria_id = ${categoria ?? l.categoria_id},
          descricao = ${(d.descricao as string) ?? l.descricao}, porcao = ${(d.porcao as string) ?? l.porcao},
          preco = ${typeof d.preco === "number" ? d.preco.toFixed(2) : l.preco},
          preco_promocional = ${"preco_promocional" in d ? (d.preco_promocional == null ? null : Number(d.preco_promocional).toFixed(2)) : l.preco_promocional},
          destaque = ${typeof d.destaque === "boolean" ? d.destaque : l.destaque}, atualizado_em = now()
        WHERE id = ${l.id}`;
      return { ok: true, resumo: `Atualizei "${(d.nome as string) ?? l.nome}" no cardápio.` };
    }
    const [{ max }] = await sql<{ max: number }[]>`SELECT COALESCE(MAX(ordem), -1)::int AS max FROM cardapio_itens WHERE categoria_id = ${categoria!}`;
    await sql`
      INSERT INTO cardapio_itens (categoria_id, nome, descricao, preco, preco_promocional, porcao, marcadores, destaque, ordem)
      VALUES (${categoria!}, ${String(d.nome)}, ${(d.descricao as string) ?? null},
        ${typeof d.preco === "number" ? d.preco.toFixed(2) : null},
        ${d.preco_promocional == null ? null : Number(d.preco_promocional).toFixed(2)},
        ${(d.porcao as string) ?? null}, ${sql.json([])}, ${d.destaque === true}, ${max + 1})`;
    return { ok: true, resumo: `Pus "${d.nome}" no cardápio. Já aparece no site e para a Marina.` };
  },
};

const cardapioDisponivel: Acao = {
  rotulo: "Marcar prato como esgotado (ou repor)",
  caminhos: ["/admin/cardapio", "/restaurante"],
  comoUsar:
    'marcar um prato como esgotado hoje, ou voltar a oferecer. dados: {"alvo":"nome do prato","disponivel":false (esgotou) | true (repor)}',
  validar(d) {
    const alvo = texto(d.alvo, 160);
    const disponivel = simNao(d.disponivel);
    if (!alvo) return { ok: false, erro: "Diga qual prato." };
    if (disponivel === null) return { ok: false, erro: "Diga se esgotou ou se voltou." };
    return { ok: true, dados: { alvo, disponivel } };
  },
  async descrever(sql, d) {
    const a = await acharUm<Prato>(sql, "cardapio_itens", String(d.alvo), "prato");
    if (!a.ok) return a.erro;
    return d.disponivel ? `voltar a oferecer "${a.linha.nome}"` : `marcar "${a.linha.nome}" como esgotado hoje`;
  },
  async executar(sql, d) {
    const a = await acharUm<Prato>(sql, "cardapio_itens", String(d.alvo), "prato");
    if (!a.ok) return { ok: false, erro: a.erro };
    await sql`UPDATE cardapio_itens SET disponivel = ${d.disponivel === true}, atualizado_em = now() WHERE id = ${a.linha.id}`;
    return { ok: true, resumo: d.disponivel ? `"${a.linha.nome}" voltou ao cardápio.` : `"${a.linha.nome}" marcado como esgotado hoje.` };
  },
};

/* ── pacotes ─────────────────────────────────────────────────────── */

type Pacote = { id: string; nome: string; slug: string; descricao: string | null; inclusos: string[] | null; vigencia_inicio: Date | null; vigencia_fim: Date | null; diaria_minima: number; ativo: boolean };
const dataDoBanco = (iso: string) => new Date(`${iso}T12:00:00`);

const pacote: Acao = {
  rotulo: "Criar, mudar, ligar ou desligar um pacote",
  caminhos: ["/admin/pacotes", "/pacotes", "/"],
  comoUsar:
    'criar um pacote (Réveillon, Carnaval…) ou mudar/ligar/desligar um que já existe. dados: {"alvo":"nome do pacote que já existe" (só para mudar),"nome":"...","descricao":"...","inclusos":["...","..."],"vigencia_inicio":"AAAA-MM-DD","vigencia_fim":"AAAA-MM-DD","diaria_minima":número,"ativo":true|false} — preço não entra (vem do motor de reservas)',
  validar(d) {
    const out: Dados = {};
    const alvo = texto(d.alvo, 160); if (alvo) out.alvo = alvo;
    const nome = texto(d.nome, 255); if (nome) out.nome = nome;
    const descricao = texto(d.descricao, 4000); if (descricao) out.descricao = descricao;
    if ("inclusos" in d) { const l = listaDeTexto(d.inclusos); if (l.length) out.inclusos = l; }
    for (const k of ["vigencia_inicio", "vigencia_fim"]) {
      if (d[k] == null || d[k] === "") continue;
      const iso = dataISO(d[k]); if (!iso) return { ok: false, erro: "Não entendi a data da vigência (use dia/mês/ano)." }; out[k] = iso;
    }
    if (out.vigencia_inicio && out.vigencia_fim && String(out.vigencia_fim) < String(out.vigencia_inicio)) return { ok: false, erro: "A data final da vigência ficou antes da inicial." };
    if (d.diaria_minima != null && d.diaria_minima !== "") {
      const n = Math.round(Number(d.diaria_minima)); if (!Number.isFinite(n) || n < 1 || n > 30) return { ok: false, erro: "A estadia mínima do pacote precisa ser de 1 a 30 noites." }; out.diaria_minima = n;
    }
    const a = simNao(d.ativo); if (a !== null) out.ativo = a;
    if (!alvo && !nome) return { ok: false, erro: "Diga o nome do pacote (ou qual pacote mudar)." };
    if (alvo && Object.keys(out).length === 1) return { ok: false, erro: "Diga o que mudar no pacote." };
    return { ok: true, dados: out };
  },
  async descrever(sql, d) {
    if (!d.alvo) return `criar o pacote "${d.nome}"${d.ativo === false ? " (desligado)" : ""}`;
    const a = await acharUm<Pacote>(sql, "pacotes", String(d.alvo), "pacote");
    if (!a.ok) return a.erro;
    const p = [ligaDesliga(d.ativo), d.nome ? `renomear para "${d.nome}"` : null, d.descricao ? "trocar a descrição" : null,
      d.inclusos ? "trocar o que inclui" : null, d.vigencia_inicio || d.vigencia_fim ? "mudar a vigência" : null,
      d.diaria_minima ? `estadia mínima de ${d.diaria_minima}` : null].filter(Boolean);
    if (p.length === 1 && (p[0] === "ligar" || p[0] === "desligar")) return `${p[0]} o pacote "${a.linha.nome}"`;
    return `mudar o pacote "${a.linha.nome}": ${p.join(", ")}`;
  },
  async executar(sql, d) {
    if (d.alvo) {
      const a = await acharUm<Pacote>(sql, "pacotes", String(d.alvo), "pacote");
      if (!a.ok) return { ok: false, erro: a.erro };
      const l = a.linha;
      await sql`
        UPDATE pacotes SET
          nome = ${(d.nome as string) ?? l.nome}, descricao = ${(d.descricao as string) ?? l.descricao},
          inclusos = ${sql.json(((d.inclusos as string[]) ?? l.inclusos ?? []) as never)},
          vigencia_inicio = ${d.vigencia_inicio ? dataDoBanco(String(d.vigencia_inicio)) : l.vigencia_inicio},
          vigencia_fim = ${d.vigencia_fim ? dataDoBanco(String(d.vigencia_fim)) : l.vigencia_fim},
          diaria_minima = ${(d.diaria_minima as number) ?? l.diaria_minima},
          ativo = ${typeof d.ativo === "boolean" ? d.ativo : l.ativo}
        WHERE id = ${l.id}`;
      return { ok: true, resumo: d.ativo === false ? `Desliguei o pacote "${l.nome}" (dá para religar).` : `Atualizei o pacote "${(d.nome as string) ?? l.nome}".` };
    }
    const base = slugDe(String(d.nome));
    const usados = new Set((await sql<{ slug: string }[]>`SELECT slug FROM pacotes WHERE slug LIKE ${base + "%"}`).map((r) => r.slug));
    let slug = base;
    for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;
    const [{ max }] = await sql<{ max: number }[]>`SELECT COALESCE(MAX(ordem), -1)::int AS max FROM pacotes`;
    await sql`
      INSERT INTO pacotes (nome, slug, descricao, inclusos, vigencia_inicio, vigencia_fim, diaria_minima, ordem, ativo)
      VALUES (${String(d.nome)}, ${slug}, ${(d.descricao as string) ?? null}, ${sql.json(((d.inclusos as string[]) ?? []) as never)},
        ${d.vigencia_inicio ? dataDoBanco(String(d.vigencia_inicio)) : null}, ${d.vigencia_fim ? dataDoBanco(String(d.vigencia_fim)) : null},
        ${(d.diaria_minima as number) ?? 1}, ${max + 1}, ${d.ativo !== false})`;
    return { ok: true, resumo: `Criei o pacote "${d.nome}". ${d.ativo === false ? "Está desligado até você ligar." : "Já aparece em Pacotes no site."}` };
  },
};

/* ── banners (só textos e ligar/desligar: a imagem é pela tela) ──── */

type Banner = { id: string; titulo: string | null; subtitulo: string | null; texto: string | null; cta_texto: string | null; ativo: boolean };

const banner: Acao = {
  rotulo: "Ligar, desligar ou mudar o texto de um banner",
  caminhos: ["/admin/banners", "/"],
  comoUsar:
    'ligar/desligar um banner do topo do site ou mudar os textos dele (a imagem só pela tela Banners). dados: {"alvo":"título do banner","ativo":true|false,"titulo":"...","subtitulo":"...","texto":"...","cta_texto":"texto do botão"}',
  validar(d) {
    const alvo = texto(d.alvo, 160);
    if (!alvo) return { ok: false, erro: "Diga qual banner (pelo título dele)." };
    const out: Dados = { alvo };
    for (const k of ["titulo", "subtitulo", "texto", "cta_texto"]) { const t = texto(d[k], k === "texto" ? 600 : 200); if (t) out[k] = t; }
    const a = simNao(d.ativo); if (a !== null) out.ativo = a;
    if (Object.keys(out).length === 1) return { ok: false, erro: "Diga o que fazer com o banner (ligar, desligar ou trocar um texto)." };
    return { ok: true, dados: out };
  },
  async descrever(sql, d) {
    const a = await acharUm<Banner>(sql, "banners", String(d.alvo), "banner");
    if (!a.ok) return a.erro;
    const p = [ligaDesliga(d.ativo), d.titulo || d.subtitulo || d.texto || d.cta_texto ? "trocar o texto" : null].filter(Boolean);
    return `${p.join(" e ")} do banner "${a.linha.titulo ?? "sem título"}"`;
  },
  async executar(sql, d) {
    const a = await acharUm<Banner>(sql, "banners", String(d.alvo), "banner");
    if (!a.ok) return { ok: false, erro: a.erro };
    const l = a.linha;
    await sql`
      UPDATE banners SET
        titulo = ${(d.titulo as string) ?? l.titulo}, subtitulo = ${(d.subtitulo as string) ?? l.subtitulo},
        texto = ${(d.texto as string) ?? l.texto}, cta_texto = ${(d.cta_texto as string) ?? l.cta_texto},
        ativo = ${typeof d.ativo === "boolean" ? d.ativo : l.ativo}
      WHERE id = ${l.id}::uuid`;
    return { ok: true, resumo: d.ativo === false ? `Desliguei o banner "${l.titulo ?? "sem título"}".` : d.ativo === true ? `Liguei o banner "${l.titulo ?? "sem título"}".` : `Atualizei o banner "${(d.titulo as string) ?? l.titulo ?? "sem título"}".` };
  },
};

/* ── atrações da Ilha do Mel (moram em conteudo_editavel, linha "ilha") ── */

function acharAtracao(lista: Atracao[], alvo: string): { ok: true; i: number } | { ok: false; erro: string } {
  const t = alvo.trim().toLowerCase();
  const exata = lista.findIndex((a) => a.nome.toLowerCase() === t);
  if (exata >= 0) return { ok: true, i: exata };
  const parecidas = lista.map((a, i) => ({ a, i })).filter(({ a }) => a.nome.toLowerCase().includes(t));
  if (parecidas.length === 1) return { ok: true, i: parecidas[0].i };
  if (parecidas.length > 1) return { ok: false, erro: `Achei mais de uma atração parecida com "${alvo}" (${parecidas.slice(0, 3).map((p) => p.a.nome).join("; ")}). Diga o nome exato.` };
  return { ok: false, erro: `Não achei a atração "${alvo}".${lista.length ? ` As atrações são: ${lista.slice(0, 10).map((a) => a.nome).join(", ")}.` : ""}` };
}

const primeiraFrase = (t: string) => (t.split(/(?<=[.!?])\s/)[0] ?? t).slice(0, 220);

const atracao: Acao = {
  rotulo: "Criar ou mudar uma atração da Ilha do Mel",
  caminhos: ["/admin/atracoes", "/ilha-do-mel", "/"],
  comoUsar:
    'criar uma atração da ilha (praia, trilha, gruta…) ou mudar uma que já existe. dados: {"alvo":"nome da atração que já existe" (só para mudar),"nome":"...","resumo":"uma frase","texto":"a descrição","distancia":"ex.: 20 min a pé da pousada","destaque":true|false}',
  validar(d) {
    const out: Dados = {};
    const alvo = texto(d.alvo, 160); if (alvo) out.alvo = alvo;
    const nome = texto(d.nome, 160); if (nome) out.nome = nome;
    const resumo = texto(d.resumo, 300); if (resumo) out.resumo = resumo;
    const t = texto(d.texto, 4000); if (t) out.texto = t;
    const dist = texto(d.distancia, 200); if (dist) out.distancia = dist;
    const dest = simNao(d.destaque); if (dest !== null) out.destaque = dest;
    if (!alvo) {
      if (!nome) return { ok: false, erro: "Diga o nome da atração." };
      if (!resumo && !t) return { ok: false, erro: "Conte um pouco sobre a atração (uma frase já serve)." };
    } else if (Object.keys(out).length === 1) return { ok: false, erro: "Diga o que mudar na atração." };
    return { ok: true, dados: out };
  },
  async descrever(sql, d) {
    if (!d.alvo) return `criar a atração "${d.nome}" na página Ilha do Mel`;
    const lista = (await lerConteudo(sql)).ATRACOES;
    const a = acharAtracao(lista, String(d.alvo));
    return a.ok ? `mudar a atração "${lista[a.i].nome}"` : a.erro;
  },
  async executar(sql, d) {
    const linha = await lerLinhaConteudo(sql, "ilha");
    const lista = [...(await lerConteudo(sql)).ATRACOES];
    if (d.alvo) {
      const a = acharAtracao(lista, String(d.alvo));
      if (!a.ok) return { ok: false, erro: a.erro };
      const atual = lista[a.i];
      lista[a.i] = {
        ...atual,
        nome: (d.nome as string) ?? atual.nome, resumo: (d.resumo as string) ?? atual.resumo, texto: (d.texto as string) ?? atual.texto,
        distanciaTexto: (d.distancia as string) ?? atual.distanciaTexto, destaque: typeof d.destaque === "boolean" ? d.destaque : atual.destaque,
      };
      await gravarLinhaConteudo(sql, "ilha", { ...linha, ATRACOES: lista });
      return { ok: true, resumo: `Atualizei a atração "${lista[a.i].nome}". Já vale no site e para a Marina.` };
    }
    const usados = new Set(lista.map((a) => a.slug));
    const base = slugDe(String(d.nome));
    let slug = base;
    for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;
    const corpo = (d.texto as string) ?? (d.resumo as string);
    lista.push({ slug, nome: String(d.nome), resumo: (d.resumo as string) ?? primeiraFrase(corpo), texto: corpo, distanciaTexto: (d.distancia as string) ?? "", destaque: d.destaque === true });
    await gravarLinhaConteudo(sql, "ilha", { ...linha, ATRACOES: lista });
    return { ok: true, resumo: `Criei a atração "${d.nome}". Já aparece na página Ilha do Mel e para a Marina.` };
  },
};

/* ── travessia de barco (linha "chegar") ─────────────────────────── */

const travessia: Acao = {
  rotulo: "Mudar a travessia de barco (preço, duração, operadora)",
  caminhos: ["/admin/conteudo", "/como-chegar", "/ilha-do-mel"],
  comoUsar:
    'mudar o que o site e a Marina dizem do barco até a ilha. dados (só o que mudar): {"ida":número,"volta":número,"ida_e_volta":número,"gratuidade":"quem não paga","duracao":"ex.: 30 minutos","operadora":"...","estacionamento":"..."}',
  validar(d) {
    const out: Dados = {};
    for (const k of ["ida", "volta", "ida_e_volta"]) {
      if (d[k] == null || d[k] === "") continue;
      const v = dinheiro(d[k]); if (v === null) return { ok: false, erro: "Não entendi o valor da passagem (ex.: 45,00)." }; out[k] = v;
    }
    for (const [k, max] of [["gratuidade", 400], ["duracao", 120], ["operadora", 160], ["estacionamento", 600]] as const) { const t = texto(d[k], max); if (t) out[k] = t; }
    if (Object.keys(out).length === 0) return { ok: false, erro: "Diga o que mudar na travessia (preço da ida, volta, duração…)." };
    return { ok: true, dados: out };
  },
  async descrever(_sql, d) {
    const p = [typeof d.ida === "number" ? `ida ${reais(d.ida)}` : null, typeof d.volta === "number" ? `volta ${reais(d.volta)}` : null,
      typeof d.ida_e_volta === "number" ? `ida e volta ${reais(d.ida_e_volta)}` : null, d.duracao ? `duração "${d.duracao}"` : null,
      d.operadora ? `operadora ${d.operadora}` : null, d.gratuidade ? "quem não paga" : null, d.estacionamento ? "estacionamento" : null].filter(Boolean);
    return `mudar a travessia de barco: ${p.join(", ")}`;
  },
  async executar(sql, d) {
    const linha = await lerLinhaConteudo(sql, "chegar");
    const atual = (await lerConteudo(sql)).TRAVESSIA;
    const precos = { ...atual.precos };
    if (typeof d.ida === "number") precos.ida = d.ida;
    if (typeof d.volta === "number") precos.volta = d.volta;
    if (typeof d.ida_e_volta === "number") precos.idaEVolta = d.ida_e_volta;
    if (d.gratuidade) precos.gratuidade = String(d.gratuidade);
    if (precos.ida !== atual.precos.ida || precos.volta !== atual.precos.volta || precos.idaEVolta !== atual.precos.idaEVolta) precos.consultadoEm = hojeBR();
    const travessiaNova = {
      ...((linha.TRAVESSIA as Record<string, unknown>) ?? {}),
      ...(d.duracao ? { duracao: String(d.duracao) } : {}),
      ...(d.operadora ? { operadora: String(d.operadora) } : {}),
      ...(d.estacionamento ? { estacionamento: String(d.estacionamento) } : {}),
      precos,
    };
    await gravarLinhaConteudo(sql, "chegar", { ...linha, TRAVESSIA: travessiaNova, CHEGADA_ETAPAS: linha.CHEGADA_ETAPAS ?? (await lerConteudo(sql)).CHEGADA_ETAPAS });
    return { ok: true, resumo: "Travessia atualizada. A Marina já passa os valores novos (com a data de hoje)." };
  },
};

/* ── eventos (linha "eventos") ───────────────────────────────────── */

const eventos: Acao = {
  rotulo: "Mudar a página de Eventos",
  caminhos: ["/admin/conteudo", "/eventos"],
  comoUsar:
    'mudar o que a pousada recebe de eventos. dados (só o que mudar): {"tipos":["Casamento","Aniversário"],"espacos":["..."],"capacidade":"ex.: até 80 pessoas" ou "" (sob consulta)}',
  validar(d) {
    const out: Dados = {};
    if ("tipos" in d) { const l = listaDeTexto(d.tipos); if (l.length) out.tipos = l; }
    if ("espacos" in d) { const l = listaDeTexto(d.espacos); if (l.length) out.espacos = l; }
    if ("capacidade" in d) out.capacidade = texto(d.capacidade, 120);
    if (Object.keys(out).length === 0) return { ok: false, erro: "Diga o que mudar em Eventos (tipos, espaços ou capacidade)." };
    return { ok: true, dados: out };
  },
  async descrever(_sql, d) {
    const p = [d.tipos ? `tipos: ${(d.tipos as string[]).join(", ")}` : null, d.espacos ? "espaços" : null,
      "capacidade" in d ? (d.capacidade ? `capacidade "${d.capacidade}"` : "capacidade sob consulta") : null].filter(Boolean);
    return `mudar a página de Eventos: ${p.join("; ")}`;
  },
  async executar(sql, d) {
    const linha = await lerLinhaConteudo(sql, "eventos");
    const atual = (await lerConteudo(sql)).EVENTOS;
    const novo = {
      ...atual,
      ...(d.tipos ? { tipos: d.tipos as string[] } : {}),
      ...(d.espacos ? { espacos: d.espacos as string[] } : {}),
      ...("capacidade" in d ? { capacidade: (d.capacidade as string | null) || null } : {}),
    };
    await gravarLinhaConteudo(sql, "eventos", { ...linha, EVENTOS: novo });
    return { ok: true, resumo: "Página de Eventos atualizada." };
  },
};

/* ── depoimentos (só o que a pessoa DITAR) ───────────────────────── */

const depoimento: Acao = {
  rotulo: "Pôr um depoimento de hóspede no site",
  caminhos: ["/admin/depoimentos", "/avaliacoes", "/"],
  comoUsar:
    'pôr no site um depoimento REAL que a pessoa ditar (nunca invente nem melhore o texto do hóspede). dados: {"autor":"nome do hóspede","texto":"o que ele escreveu","origem":"Google, Booking…","nota":1 a 5}',
  validar(d) {
    const autor = texto(d.autor, 255);
    const t = texto(d.texto, 3000);
    if (!autor || !t) return { ok: false, erro: "Faltou o nome do hóspede ou o texto do depoimento." };
    const n = d.nota == null || d.nota === "" ? 5 : Math.round(Number(d.nota));
    if (!Number.isFinite(n) || n < 1 || n > 5) return { ok: false, erro: "A nota vai de 1 a 5." };
    return { ok: true, dados: { autor, texto: t, origem: texto(d.origem, 100), nota: n } };
  },
  async descrever(_sql, d) {
    return `pôr no site o depoimento de ${d.autor}${d.origem ? ` (${d.origem})` : ""}, nota ${d.nota}`;
  },
  async executar(sql, d) {
    const [{ max }] = await sql<{ max: number }[]>`SELECT COALESCE(MAX(ordem), -1)::int AS max FROM depoimentos`;
    await sql`
      INSERT INTO depoimentos (autor, origem, nota, texto, ordem, ativo)
      VALUES (${String(d.autor)}, ${(d.origem as string) ?? null}, ${Number(d.nota)}, ${String(d.texto)}, ${max + 1}, true)`;
    return { ok: true, resumo: `Pus o depoimento de ${d.autor} no site.` };
  },
};

export const ACOES_PAINEL: Record<string, Acao> = {
  politicas,
  faq,
  faq_editar: faqEditar,
  cardapio_item: cardapioItem,
  cardapio_disponivel: cardapioDisponivel,
  pacote,
  banner,
  atracao,
  travessia,
  eventos,
  depoimento,
};
