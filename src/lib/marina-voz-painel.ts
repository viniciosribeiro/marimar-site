import type { Sql } from "./db-conexao";
import type { Acao, ResultadoAcao } from "./marina-voz-acoes";
import type { TabelaDesfazer } from "./marina-voz-desfazer";
import { texto, listaDeTexto, dinheiro, simNao, slugDe, dataISO, horario, type Dados } from "./marina-voz-util";
import { normalizarNumero, SETORES, rotuloSetor } from "./escalonamento-base";
import { lerMemoria } from "./whatsapp-vigia";
import { mesmoCelular } from "./whatsapp-saude";

/**
 * O MAPA DO PAINEL para a Marina (modo voz).
 *
 * Cada área do painel descrita UMA vez — tabela, como achar um registro pelo
 * nome, os campos com o tipo de cada um, se dá para criar — e daí saem:
 *   1. o que ela SABE: o retrato do que está cadastrado agora (retratoDoPainel);
 *   2. o que ela PODE: as ações genéricas `criar` e `alterar` (com validação
 *      por tipo, nunca coluna fora da lista);
 *   3. o desfazer/refazer: toda ação tira a foto da linha antes de mexer.
 *
 * Fora daqui de propósito (a Marina sabe que existem e diz onde fica):
 * usuários e senhas, chaves e conexões (voz, WhatsApp, Meta), fotos/vídeos
 * novos (precisam de arquivo), pontos do mapa da rota, preço/vaga e
 * ligar/desligar suíte (vêm do Desbravador) e dados de hóspedes (contatos
 * recebidos, chamados): destes ela só vê a contagem.
 */

type Tipo = "texto" | "textoLongo" | "inteiro" | "dinheiro" | "simnao" | "lista" | "setores" | "dias" | "data" | "hora" | "telefone" | "opcao";
type Campo = {
  col: string; rotulo: string; tipo: Tipo;
  max?: number; min?: number; teto?: number;
  opcoes?: readonly string[];
  obrigatorio?: boolean;
};

export type Area = {
  id: string;
  rotulo: string;
  tela: string;
  oQue: string;
  tabela: TabelaDesfazer;
  /** Colunas para achar o registro pelo nome que a pessoa disser. */
  busca: string[];
  /** Configuração de linha única (não precisa dizer qual). */
  unica?: { id?: number };
  campos: Campo[];
  /** Mostrado no retrato, além do nome. */
  retrato: string[];
  ordem?: string;
  criar?: { slug?: boolean; ordem?: boolean; padroes?: Dados };
  /** Criar/mudar é por outra ação (diz qual) — o mapa avisa a Marina. */
  criarPor?: string;
  editarPor?: string;
  atualizadoEm?: boolean;
  atualizadoPor?: boolean;
  limiteRetrato?: number;
  caminhos: string[];
  /** Regra extra antes de gravar (ex.: número da equipe não pode ser o da Marina). */
  conferir?: (sql: Sql, valores: Dados, idAtual: string | null) => Promise<string | null>;
};

const SIM_NAO = (col: string, rotulo: string): Campo => ({ col, rotulo, tipo: "simnao" });
const ATIVO = SIM_NAO("ativo", "ligado (aparece)");

export const AREAS: Area[] = [
  {
    id: "equipe", rotulo: "Equipe", tela: "/admin/equipe",
    oQue: "quem da pousada cuida de cada assunto; a Marina chama essas pessoas pelo WhatsApp quando não sabe responder",
    tabela: "equipe_contatos", busca: ["nome"], ordem: "ordem", atualizadoEm: true,
    campos: [
      { col: "nome", rotulo: "nome", tipo: "texto", max: 80, obrigatorio: true },
      { col: "numero", rotulo: "WhatsApp", tipo: "telefone", obrigatorio: true },
      { col: "setores", rotulo: "assuntos", tipo: "setores" },
      { col: "dias", rotulo: "dias de atendimento", tipo: "dias" },
      { col: "hora_inicio", rotulo: "começa às", tipo: "hora" },
      { col: "hora_fim", rotulo: "termina às", tipo: "hora" },
      ATIVO,
    ],
    retrato: ["numero", "setores", "dias", "hora_inicio", "hora_fim"],
    criar: { ordem: true, padroes: { setores: ["geral"], dias: [0, 1, 2, 3, 4, 5, 6], hora_inicio: "08:00", hora_fim: "20:00", ativo: true } },
    caminhos: ["/admin/equipe", "/admin/cerebro"],
    async conferir(sql, v, idAtual) {
      if (typeof v.numero !== "string") return null;
      const [igual] = await sql`SELECT id FROM equipe_contatos WHERE numero = ${v.numero} AND id::text <> ${idAtual ?? ""}`;
      if (igual) return "Esse número já está cadastrado na equipe.";
      const marina = (await lerMemoria(sql)).numero;
      if (marina && mesmoCelular(v.numero, marina)) return "Esse é o número ligado à Marina no WhatsApp; cadastre o celular pessoal da pessoa.";
      return null;
    },
  },
  {
    id: "suites", rotulo: "Suítes (textos do site)", tela: "/admin/quartos",
    oQue: "descrição e detalhes de cada suíte; nome, preço, vaga e se aparece vêm do sistema de reservas (Desbravador)",
    tabela: "quartos", busca: ["nome", "desbravador_room_id"], ordem: "ordem", atualizadoEm: true,
    campos: [
      { col: "descricao", rotulo: "descrição", tipo: "textoLongo" },
      { col: "cama", rotulo: "cama", tipo: "texto", max: 255 },
      { col: "metragem", rotulo: "metragem (m²)", tipo: "inteiro", min: 5, teto: 500 },
      { col: "vista", rotulo: "vista", tipo: "texto", max: 255 },
      SIM_NAO("destaque", "em destaque"),
    ],
    retrato: ["ativo", "cama", "metragem", "vista", "ocupacao_max"],
    caminhos: ["/admin/quartos", "/quartos", "/reservar", "/"],
  },
  {
    id: "categorias_suites", rotulo: "Categorias de suítes", tela: "/admin/categorias",
    oQue: "grupos que organizam as suítes no site", tabela: "categorias", busca: ["nome"], ordem: "ordem",
    campos: [
      { col: "nome", rotulo: "nome", tipo: "texto", max: 255, obrigatorio: true },
      { col: "descricao", rotulo: "descrição", tipo: "textoLongo" },
      ATIVO,
    ],
    retrato: ["descricao"], criar: { slug: true, ordem: true }, caminhos: ["/admin/categorias", "/quartos"],
  },
  {
    id: "comodidades", rotulo: "Comodidades", tela: "/admin/comodidades",
    oQue: "o que a pousada e as suítes oferecem (ar-condicionado, Wi-Fi…)", tabela: "comodidades", busca: ["nome", "nome_motor"], ordem: "ordem",
    campos: [
      { col: "nome", rotulo: "nome", tipo: "texto", max: 255, obrigatorio: true },
      { col: "icone", rotulo: "ícone", tipo: "texto", max: 40 },
      { col: "escopo", rotulo: "vale para", tipo: "opcao", opcoes: ["pousada", "quarto"] },
      ATIVO,
    ],
    retrato: ["escopo"], criar: { slug: true, ordem: true, padroes: { escopo: "quarto" } }, caminhos: ["/admin/comodidades", "/quartos", "/a-pousada"],
  },
  {
    id: "passeios", rotulo: "Passeios", tela: "/admin/passeios",
    oQue: "passeios que a pousada indica", tabela: "passeios", busca: ["nome"], ordem: "ordem",
    campos: [
      { col: "nome", rotulo: "nome", tipo: "texto", max: 255, obrigatorio: true },
      { col: "descricao", rotulo: "descrição", tipo: "textoLongo" },
      { col: "duracao", rotulo: "duração", tipo: "texto", max: 50 },
      { col: "preco_referencia", rotulo: "preço de referência", tipo: "dinheiro" },
      ATIVO,
    ],
    retrato: ["duracao", "preco_referencia"], criar: { ordem: true }, caminhos: ["/admin/passeios", "/ilha-do-mel", "/"],
  },
  {
    id: "blocos_home", rotulo: "Blocos da página inicial", tela: "/admin/blocos-home",
    oQue: "seções da página inicial (topo, sobre, suítes, restaurante…): título, subtítulo, ligar/desligar", tabela: "blocos_home", busca: ["titulo", "tipo"], ordem: "ordem",
    campos: [
      { col: "titulo", rotulo: "título", tipo: "texto", max: 255 },
      { col: "subtitulo", rotulo: "subtítulo", tipo: "textoLongo" },
      ATIVO,
    ],
    retrato: ["tipo"], caminhos: ["/admin/blocos-home", "/"],
  },
  {
    id: "cartoes", rotulo: "Cartões da página inicial", tela: "/admin/cartoes",
    oQue: "os cartões dentro dos blocos da página inicial", tabela: "blocos_itens", busca: ["titulo"], ordem: "ordem",
    campos: [
      { col: "titulo", rotulo: "título", tipo: "texto", max: 200 },
      { col: "texto", rotulo: "texto", tipo: "textoLongo" },
      { col: "cta_texto", rotulo: "texto do botão", tipo: "texto", max: 60 },
      { col: "href", rotulo: "link do botão (ex.: /reservar)", tipo: "texto", max: 300 },
      ATIVO,
    ],
    retrato: ["texto"], caminhos: ["/admin/cartoes", "/"],
  },
  {
    id: "banners", rotulo: "Banners do topo", tela: "/admin/banners",
    oQue: "as imagens grandes do topo do site com título e botão; imagem nova só pela tela", tabela: "banners", busca: ["titulo", "rotulo"], ordem: "ordem",
    campos: [
      { col: "titulo", rotulo: "título", tipo: "texto", max: 200 },
      { col: "subtitulo", rotulo: "subtítulo", tipo: "texto", max: 300 },
      { col: "rotulo", rotulo: "selo pequeno", tipo: "texto", max: 60 },
      { col: "texto", rotulo: "texto", tipo: "textoLongo", max: 600 },
      { col: "cta_texto", rotulo: "texto do botão", tipo: "texto", max: 60 },
      { col: "cta_href", rotulo: "link do botão", tipo: "texto", max: 300 },
      { col: "inicia_em", rotulo: "aparece a partir de", tipo: "data" },
      { col: "termina_em", rotulo: "some depois de", tipo: "data" },
      ATIVO,
    ],
    retrato: ["subtitulo", "cta_texto"], criarPor: "(só pela tela Banners: precisa da imagem)", caminhos: ["/admin/banners", "/"],
  },
  {
    id: "cardapio_secoes", rotulo: "Seções do cardápio", tela: "/admin/cardapio",
    oQue: "as seções do cardápio do restaurante (Bebidas, Pratos…)", tabela: "cardapio_categorias", busca: ["nome"], ordem: "ordem",
    campos: [
      { col: "nome", rotulo: "nome", tipo: "texto", max: 120, obrigatorio: true },
      { col: "descricao", rotulo: "descrição", tipo: "textoLongo" },
      { col: "horario", rotulo: "horário", tipo: "texto", max: 60 },
      { col: "icone", rotulo: "ícone (emoji)", tipo: "texto", max: 16 },
      ATIVO,
    ],
    retrato: ["horario"], criar: { slug: true, ordem: true }, caminhos: ["/admin/cardapio", "/restaurante"],
  },
  {
    id: "cardapio", rotulo: "Pratos e bebidas do cardápio", tela: "/admin/cardapio",
    oQue: "cada item do cardápio; 'disponível = não' é 'esgotado hoje'", tabela: "cardapio_itens", busca: ["nome"], ordem: "ordem", atualizadoEm: true,
    campos: [
      { col: "nome", rotulo: "nome", tipo: "texto", max: 180 },
      { col: "descricao", rotulo: "descrição", tipo: "textoLongo" },
      { col: "preco", rotulo: "preço", tipo: "dinheiro" },
      { col: "preco_promocional", rotulo: "preço promocional", tipo: "dinheiro" },
      { col: "porcao", rotulo: "porção", tipo: "texto", max: 80 },
      SIM_NAO("destaque", "em destaque"),
      SIM_NAO("disponivel", "disponível hoje"),
    ],
    retrato: ["preco", "disponivel"], criarPor: "cardapio_item", limiteRetrato: 60, caminhos: ["/admin/cardapio", "/restaurante"],
  },
  {
    id: "adicionais", rotulo: "Adicionais", tela: "/admin/marina (Crianças e adicionais)",
    oQue: "extras que o hóspede pode pedir (berço, café no quarto…)", tabela: "adicionais", busca: ["nome"], ordem: "ordem", atualizadoEm: true, atualizadoPor: true,
    campos: [
      { col: "nome", rotulo: "nome", tipo: "texto", max: 120 },
      { col: "descricao", rotulo: "descrição", tipo: "textoLongo", max: 600 },
      { col: "preco", rotulo: "preço", tipo: "dinheiro" },
      { col: "cobranca", rotulo: "cobrança", tipo: "opcao", opcoes: ["por_estadia", "por_noite", "por_pessoa_noite", "por_unidade"] },
      SIM_NAO("precisa_pedir", "precisa pedir antes"),
      SIM_NAO("visivel_site", "aparece no site"),
      SIM_NAO("visivel_marina", "a Marina oferece"),
      ATIVO,
    ],
    retrato: ["preco", "cobranca"], criarPor: "adicional", caminhos: ["/admin/marina", "/reservar"],
  },
  {
    id: "pacotes", rotulo: "Pacotes", tela: "/admin/pacotes",
    oQue: "pacotes (Réveillon, Carnaval…); preço vem do sistema de reservas", tabela: "pacotes", busca: ["nome"], ordem: "ordem",
    campos: [], retrato: ["vigencia_inicio", "vigencia_fim", "diaria_minima"], criarPor: "pacote", editarPor: "pacote", caminhos: ["/admin/pacotes", "/pacotes", "/"],
  },
  {
    id: "faq", rotulo: "Perguntas frequentes do site", tela: "/admin/faq",
    oQue: "a página Perguntas frequentes", tabela: "faq", busca: ["pergunta"], ordem: "ordem",
    campos: [
      { col: "pergunta", rotulo: "pergunta", tipo: "texto", max: 500 },
      { col: "resposta", rotulo: "resposta", tipo: "textoLongo" },
      SIM_NAO("visivel_agente", "a Marina usa"),
      ATIVO,
    ],
    retrato: ["resposta"], criarPor: "faq", caminhos: ["/admin/faq", "/faq"],
  },
  {
    id: "depoimentos", rotulo: "Depoimentos", tela: "/admin/depoimentos",
    oQue: "avaliações de hóspedes mostradas no site (só as reais, ditadas pela pessoa)", tabela: "depoimentos", busca: ["autor"], ordem: "ordem",
    campos: [
      { col: "autor", rotulo: "autor", tipo: "texto", max: 255 },
      { col: "origem", rotulo: "origem (Google, Booking…)", tipo: "texto", max: 100 },
      { col: "nota", rotulo: "nota", tipo: "inteiro", min: 1, teto: 5 },
      { col: "texto", rotulo: "texto", tipo: "textoLongo", max: 3000 },
      ATIVO,
    ],
    retrato: ["origem", "nota"], criarPor: "depoimento", caminhos: ["/admin/depoimentos", "/avaliacoes", "/"],
  },
  {
    id: "midias", rotulo: "Fotos e vídeos", tela: "/admin/midias",
    oQue: "a biblioteca de fotos e vídeos; dá para mudar título, descrição e se a Marina pode mandar — foto nova só pela tela", tabela: "midias", busca: ["titulo", "alt"], ordem: "ordem", atualizadoEm: true,
    campos: [
      { col: "titulo", rotulo: "título", tipo: "texto", max: 200 },
      { col: "alt", rotulo: "descrição curta (acessibilidade)", tipo: "texto", max: 300 },
      { col: "descricao", rotulo: "descrição", tipo: "textoLongo", max: 1000 },
      SIM_NAO("destaque", "em destaque"),
      SIM_NAO("visivel_marina", "a Marina pode mandar"),
    ],
    retrato: [], criarPor: "(só pela tela Mídias: precisa do arquivo)", caminhos: ["/admin/midias", "/galeria", "/"],
  },
  {
    id: "escalonamento", rotulo: "Chamar a equipe (escalonamento)", tela: "/admin/equipe",
    oQue: "se a Marina chama a equipe quando não sabe, os prazos e se o que a equipe responde vira aprendizado sozinho", tabela: "marina_escalonamento_config", busca: [], unica: { id: 1 }, atualizadoEm: true, atualizadoPor: true,
    campos: [
      SIM_NAO("ativo", "ligado"),
      { col: "lembrete_min", rotulo: "lembrar a pessoa depois de (min)", tipo: "inteiro", min: 5, teto: 600 },
      { col: "proximo_min", rotulo: "passar para o próximo depois de (min)", tipo: "inteiro", min: 5, teto: 1440 },
      { col: "aviso_cliente_min", rotulo: "avisar o hóspede depois de (min)", tipo: "inteiro", min: 5, teto: 1440 },
      { col: "desistir_min", rotulo: "desistir depois de (min)", tipo: "inteiro", min: 30, teto: 4320 },
      { col: "aprendizado_modo", rotulo: "aprendizado", tipo: "opcao", opcoes: ["aprovacao", "automatico"] },
      { col: "validade_dias", rotulo: "validade do aprendizado (dias)", tipo: "inteiro", min: 1, teto: 365 },
    ],
    retrato: ["ativo", "aprendizado_modo", "lembrete_min", "proximo_min"], caminhos: ["/admin/equipe", "/admin/cerebro"],
  },
];

export const area = (id: unknown) => AREAS.find((a) => a.id === id) ?? null;

/* ── conversão por tipo (a fala vem solta; o banco recebe certo) ──── */

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const JSON_TIPOS: Tipo[] = ["lista", "setores", "dias"];
const NOMES_DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function lerDias(v: unknown): number[] | null {
  const lista = Array.isArray(v) ? v : typeof v === "string" ? [v] : typeof v === "number" ? [v] : [];
  const out = new Set<number>();
  for (const x of lista) {
    if (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 6) { out.add(x); continue; }
    const t = semAcento(String(x));
    if (/todos|todo dia|diariamente/.test(t)) { [0, 1, 2, 3, 4, 5, 6].forEach((d) => out.add(d)); continue; }
    if (/fim de semana|fins de semana/.test(t)) { out.add(0); out.add(6); continue; }
    const faixa = /(domingo|segunda|terca|quarta|quinta|sexta|sabado)\w*\s*(?:a|ate|-)\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)/.exec(t);
    if (faixa) {
      const i = NOMES_DIAS.indexOf(faixa[1]), j = NOMES_DIAS.indexOf(faixa[2]);
      for (let d = i; ; d = (d + 1) % 7) { out.add(d); if (d === j) break; }
      continue;
    }
    for (const parte of t.split(/[,;e\s]+/)) {
      const k = NOMES_DIAS.findIndex((n) => parte.startsWith(n.slice(0, 3)));
      if (k >= 0) out.add(k);
      else if (/^[0-6]$/.test(parte)) out.add(Number(parte));
    }
  }
  return out.size ? [...out].sort() : null;
}

type Conv = { ok: true; valor: unknown } | { ok: false; erro: string };

function converter(c: Campo, v: unknown): Conv {
  const limpar = v === null || v === "";
  if (limpar && !JSON_TIPOS.includes(c.tipo) && c.tipo !== "simnao") {
    return c.obrigatorio ? { ok: false, erro: `O campo ${c.rotulo} não pode ficar vazio.` } : { ok: true, valor: null };
  }
  switch (c.tipo) {
    case "texto": case "textoLongo": {
      const t = texto(typeof v === "number" ? String(v) : v, c.max ?? (c.tipo === "texto" ? 300 : 6000));
      return t ? { ok: true, valor: t } : { ok: false, erro: `Não entendi o ${c.rotulo}.` };
    }
    case "inteiro": {
      const n = Math.round(Number(String(v).replace(",", ".").replace(/[^\d.-]/g, "")));
      if (!Number.isFinite(n) || (c.min != null && n < c.min) || (c.teto != null && n > c.teto)) {
        return { ok: false, erro: `O ${c.rotulo} precisa ser um número${c.min != null ? ` de ${c.min}` : ""}${c.teto != null ? ` a ${c.teto}` : ""}.` };
      }
      return { ok: true, valor: n };
    }
    case "dinheiro": {
      const n = dinheiro(v);
      return n === null ? { ok: false, erro: `Não entendi o valor de ${c.rotulo} (ex.: 45,90).` } : { ok: true, valor: n };
    }
    case "simnao": {
      const b = simNao(v);
      return b === null ? { ok: false, erro: `Para ${c.rotulo}, diga sim ou não.` } : { ok: true, valor: b };
    }
    case "lista": return { ok: true, valor: listaDeTexto(v) };
    case "setores": {
      const ids: string[] = [];
      for (const x of listaDeTexto(v)) {
        const t = semAcento(x);
        const s = SETORES.find((s) => s.id === t || semAcento(s.rotulo) === t || semAcento(s.rotulo).startsWith(t));
        if (!s) return { ok: false, erro: `Assunto "${x}" não existe. Os assuntos são: ${SETORES.map((s) => s.rotulo).join(", ")}.` };
        ids.push(s.id);
      }
      return { ok: true, valor: ids.length ? [...new Set(ids)] : ["geral"] };
    }
    case "dias": {
      const d = lerDias(v);
      return d ? { ok: true, valor: d } : { ok: false, erro: "Não entendi os dias (ex.: segunda a sexta, todos os dias)." };
    }
    case "data": {
      const iso = dataISO(v);
      return iso ? { ok: true, valor: new Date(`${iso}T12:00:00`) } : { ok: false, erro: `Não entendi a data de ${c.rotulo} (use dia/mês/ano).` };
    }
    case "hora": {
      const h = horario(v);
      return h ? { ok: true, valor: h } : { ok: false, erro: `Não entendi o horário de ${c.rotulo} (ex.: 08:00).` };
    }
    case "telefone": {
      const n = normalizarNumero(String(v ?? ""));
      return n ? { ok: true, valor: n } : { ok: false, erro: "Número inválido: diga com DDD, ex.: 41 99999-1234." };
    }
    case "opcao": {
      const t = semAcento(String(v)).replace(/\s+/g, "_");
      const o = c.opcoes?.find((o) => semAcento(o) === t || semAcento(o).replace(/_/g, "") === t.replace(/_/g, ""));
      return o ? { ok: true, valor: o } : { ok: false, erro: `Para ${c.rotulo}, as opções são: ${c.opcoes?.join(", ")}.` };
    }
  }
}

function converterTodos(a: Area, campos: unknown, criando: boolean): { ok: true; valores: Dados } | { ok: false; erro: string } {
  if (!campos || typeof campos !== "object" || Array.isArray(campos)) return { ok: false, erro: "Diga o que mudar (os campos)." };
  const valores: Dados = {};
  for (const [k, v] of Object.entries(campos as Dados)) {
    const c = a.campos.find((c) => c.col === k);
    if (!c) return { ok: false, erro: `Em ${a.rotulo} não dá para mudar "${k}". Dá para: ${a.campos.map((c) => c.rotulo).join(", ")}.` };
    const r = converter(c, v);
    if (!r.ok) return r;
    valores[k] = r.valor;
  }
  if (criando) {
    const falta = a.campos.filter((c) => c.obrigatorio && valores[c.col] == null);
    if (falta.length) return { ok: false, erro: `Para criar em ${a.rotulo} falta: ${falta.map((c) => c.rotulo).join(", ")}.` };
  }
  if (!Object.keys(valores).length) return { ok: false, erro: "Diga o que mudar." };
  return { ok: true, valores };
}

/* ── achar o registro pelo nome ──────────────────────────────────── */

const chaveDe = (a: Area) => (a.tabela === "conteudo_editavel" ? "chave" : "id");
const nomeDaLinha = (a: Area, l: Dados) => String(a.busca.map((c) => l[c]).find((v) => v != null && v !== "") ?? l.tipo ?? "(sem nome)");

async function acharLinha(sql: Sql, a: Area, alvo: unknown): Promise<{ ok: true; id: string | null; nome: string } | { ok: false; erro: string }> {
  if (a.unica) {
    const [l] = await sql<{ id: string }[]>`SELECT ${sql(chaveDe(a))}::text AS id FROM ${sql(a.tabela)} LIMIT 1`;
    return { ok: true, id: l?.id ?? null, nome: a.rotulo };
  }
  const t = texto(alvo, 160);
  if (!t) return { ok: false, erro: `Diga qual registro de ${a.rotulo} (o nome dele).` };
  const vistos = new Map<string, { id: string; nome: string; exato: boolean }>();
  for (const col of a.busca) {
    const linhas = await sql<Dados[]>`
      SELECT * FROM ${sql(a.tabela)} WHERE ${sql(col)}::text ILIKE ${`%${t}%`} LIMIT 6`;
    for (const l of linhas) {
      const id = String(l[chaveDe(a)]);
      const nome = nomeDaLinha(a, l);
      const exato = a.busca.some((c) => semAcento(String(l[c] ?? "")) === semAcento(t));
      if (!vistos.has(id)) vistos.set(id, { id, nome, exato });
    }
  }
  const lista = [...vistos.values()].sort((x, y) => Number(y.exato) - Number(x.exato));
  if (!lista.length) return { ok: false, erro: `Não achei "${t}" em ${a.rotulo}.` };
  if (lista.length > 1 && !lista[0].exato) {
    return { ok: false, erro: `Achei mais de um parecido com "${t}" em ${a.rotulo} (${lista.slice(0, 3).map((x) => x.nome).join("; ")}). Diga o nome exato.` };
  }
  return { ok: true, id: lista[0].id, nome: lista[0].nome };
}

/* ── gravar (só colunas do mapa; jsonb à parte) ──────────────────── */

async function gravarValores(sql: Sql, a: Area, id: string, valores: Dados, autor: string) {
  const chave = chaveDe(a);
  const normais: Dados = {};
  const json: [string, unknown][] = [];
  for (const [k, v] of Object.entries(valores)) {
    const c = a.campos.find((c) => c.col === k);
    if (!c) continue;
    if (JSON_TIPOS.includes(c.tipo)) json.push([k, v]); else normais[k] = v;
  }
  if (a.atualizadoEm) normais.atualizado_em = new Date();
  if (a.atualizadoPor) normais.atualizado_por = autor;
  if (Object.keys(normais).length) {
    await sql`UPDATE ${sql(a.tabela)} SET ${sql(normais as Record<string, string>)} WHERE ${sql(chave)}::text = ${id}`;
  }
  for (const [k, v] of json) {
    await sql`UPDATE ${sql(a.tabela)} SET ${sql(k)} = ${sql.json(v as never)} WHERE ${sql(chave)}::text = ${id}`;
  }
}

/* ── como mostrar um valor (cartão de confirmação e retrato) ────── */

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function mostrar(col: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (v instanceof Date) return v.toLocaleDateString("pt-BR");
  if (col === "setores" && Array.isArray(v)) return v.map((s) => rotuloSetor(String(s))).join(", ");
  if (col === "dias" && Array.isArray(v)) {
    const d = v.map(Number).sort();
    if (d.length === 7) return "todos os dias";
    if (d.join() === "1,2,3,4,5") return "segunda a sexta";
    return d.map((x) => DIA_CURTO[x] ?? x).join(", ");
  }
  if (Array.isArray(v)) return v.join(", ");
  if (/preco|valor/.test(col) && Number.isFinite(Number(v))) return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (/^(inicia_em|termina_em|vigencia_)/.test(col) && typeof v === "string") return new Date(v).toLocaleDateString("pt-BR");
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length > 90 ? s.slice(0, 87) + "…" : s;
}

function descreverValores(a: Area, valores: Dados): string {
  return Object.entries(valores).map(([k, v]) => {
    const c = a.campos.find((c) => c.col === k);
    if (k === "ativo" && typeof v === "boolean") return v ? "ligar" : "desligar";
    return `${c?.rotulo ?? k}: ${mostrar(k, v)}`;
  }).join("; ");
}

/* ── as duas ações gerais ────────────────────────────────────────── */

export const ACOES_GERAIS: Record<string, Acao> = {
  criar: {
    rotulo: "Criar um registro em qualquer área do painel",
    comoUsar:
      'criar um registro numa área do MAPA DO PAINEL que diga "criar: sim". dados: {"area":"<id da área>","campos":{"<coluna>":valor,…}} — use as colunas do mapa',
    validar(d) {
      const a = area(d.area);
      if (!a) return { ok: false, erro: `Não conheço a área "${String(d.area ?? "")}".` };
      if (!a.criar) return { ok: false, erro: a.criarPor ? `Em ${a.rotulo}, criar é ${a.criarPor.startsWith("(") ? a.criarPor : `pela ação ${a.criarPor}`}.` : `Em ${a.rotulo} não dá para criar por aqui.` };
      const c = converterTodos(a, d.campos, true);
      return c.ok ? { ok: true, dados: { area: a.id, campos: c.valores } } : c;
    },
    async descrever(_sql, d) {
      const a = area(d.area)!;
      const v = d.campos as Dados;
      const nome = a.busca.map((c) => v[c]).find(Boolean) ?? "";
      const resto = Object.fromEntries(Object.entries(v).filter(([k]) => !a.busca.includes(k)));
      return `criar em ${a.rotulo}: "${nome}"${Object.keys(resto).length ? ` (${descreverValores(a, resto)})` : ""}`;
    },
    async executar(sql, d, autor, ctx): Promise<ResultadoAcao> {
      const a = area(d.area)!;
      const valores = { ...(a.criar?.padroes ?? {}), ...(d.campos as Dados) };
      const erro = a.conferir ? await a.conferir(sql, valores, null) : null;
      if (erro) return { ok: false, erro };
      const normais: Dados = {};
      for (const [k, v] of Object.entries(valores)) {
        const c = a.campos.find((c) => c.col === k);
        if (c && !JSON_TIPOS.includes(c.tipo)) normais[k] = v;
      }
      if (a.criar?.slug) {
        const base = slugDe(String(valores[a.busca[0]] ?? "item"));
        const usados = new Set((await sql<{ slug: string }[]>`SELECT slug FROM ${sql(a.tabela)} WHERE slug LIKE ${base + "%"}`).map((r) => r.slug));
        let slug = base;
        for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;
        normais.slug = slug;
      }
      if (a.criar?.ordem && a.ordem) {
        const [{ max }] = await sql<{ max: number }[]>`SELECT COALESCE(MAX(${sql(a.ordem)}), -1)::int AS max FROM ${sql(a.tabela)}`;
        normais[a.ordem] = max + 1;
      }
      const [novo] = await sql<{ id: string }[]>`INSERT INTO ${sql(a.tabela)} ${sql(normais as Record<string, string>)} RETURNING id::text AS id`;
      ctx.criou(a.tabela, novo.id);
      const json = Object.fromEntries(Object.entries(valores).filter(([k]) => JSON_TIPOS.includes(a.campos.find((c) => c.col === k)?.tipo as Tipo)));
      if (Object.keys(json).length) await gravarValores(sql, { ...a, atualizadoEm: false, atualizadoPor: false }, novo.id, json, autor);
      const nome = String(valores[a.busca[0]] ?? "");
      return { ok: true, resumo: `Criei "${nome}" em ${a.rotulo}.`, caminhos: a.caminhos };
    },
  },

  alterar: {
    rotulo: "Mudar, ligar ou desligar qualquer coisa do painel",
    comoUsar:
      'mudar, ligar ou desligar um registro de qualquer área do MAPA DO PAINEL. dados: {"area":"<id da área>","alvo":"nome do registro" (não use nas áreas de configuração única),"campos":{"<coluna>":valor,…}} — para ligar/desligar use "ativo": true/false',
    validar(d) {
      const a = area(d.area);
      if (!a) return { ok: false, erro: `Não conheço a área "${String(d.area ?? "")}".` };
      if (a.editarPor) return { ok: false, erro: `Em ${a.rotulo}, mudar é pela ação ${a.editarPor}.` };
      const c = converterTodos(a, d.campos, false);
      if (!c.ok) return c;
      return { ok: true, dados: { area: a.id, alvo: texto(d.alvo, 160), campos: c.valores } };
    },
    async descrever(sql, d) {
      const a = area(d.area)!;
      const r = await acharLinha(sql, a, d.alvo);
      if (!r.ok) return r.erro;
      const v = d.campos as Dados;
      if (Object.keys(v).length === 1 && typeof v.ativo === "boolean") return `${v.ativo ? "ligar" : "desligar"} "${r.nome}" (${a.rotulo})`;
      return a.unica ? `mudar ${a.rotulo}: ${descreverValores(a, v)}` : `mudar "${r.nome}" (${a.rotulo}): ${descreverValores(a, v)}`;
    },
    async executar(sql, d, autor, ctx): Promise<ResultadoAcao> {
      const a = area(d.area)!;
      const r = await acharLinha(sql, a, d.alvo);
      if (!r.ok) return { ok: false, erro: r.erro };
      let id = r.id;
      if (!id && a.unica) {
        /* Configuração que ainda não existe: nasce com os padrões do banco. */
        const [n] = await sql<{ id: string }[]>`INSERT INTO ${sql(a.tabela)} ${sql({ id: a.unica.id ?? 1 } as Record<string, number>)} RETURNING id::text AS id`;
        id = n.id;
        ctx.criou(a.tabela, id);
      }
      if (!id) return { ok: false, erro: `Não achei o registro em ${a.rotulo}.` };
      const valores = d.campos as Dados;
      const erro = a.conferir ? await a.conferir(sql, valores, id) : null;
      if (erro) return { ok: false, erro };
      await ctx.tocar(a.tabela, id);
      await gravarValores(sql, a, id, valores, autor);
      const so = Object.keys(valores);
      const resumo = so.length === 1 && typeof valores.ativo === "boolean"
        ? `${valores.ativo ? "Liguei" : "Desliguei"} "${r.nome}" (${a.rotulo}).`
        : `Mudei ${a.unica ? a.rotulo : `"${r.nome}" (${a.rotulo})`}: ${descreverValores(a, valores)}.`;
      return { ok: true, resumo, caminhos: a.caminhos };
    },
  },
};

/* ── o que a Marina SABE: o mapa e o retrato do painel ───────────── */

const SO_PELA_TELA = [
  "Usuários e senhas (/admin/usuarios): quem entra no painel — só pela tela, por segurança.",
  "Conexão do WhatsApp da Marina (/admin/whatsapp): QR code e modo de envio — só pela tela.",
  "Voz da Marina e contas de voz (/admin/marina → Voz): chaves e escolha da voz — só pela tela.",
  "Rota e mapa (/admin/rota): pontos no mapa — só pela tela (é arrastando no mapa).",
  "Fotos e vídeos novos (/admin/midias) e imagem de banner: precisam do arquivo — só pela tela.",
  "Preço, vaga e quais suítes aparecem: vêm do sistema de reservas (Desbravador), não do painel.",
  "Contatos recebidos (/admin/leads) e chamados: dados de hóspedes — você só sabe quantos são.",
  "Diagnóstico (/admin/diagnostico) e Cérebro (/admin/cerebro): telas de leitura.",
];

const ACOES_ESPECIAIS = [
  "Dados da pousada (nome, contatos, endereço, redes, textos de busca): ação dados_pousada.",
  "Políticas (check-in, check-out, cancelamento, pets, pagamento): ação politicas.",
  "Crianças e bebês: ação regra_criancas. Adicionais novos: ação adicional.",
  "Travessia de barco: travessia. Eventos: eventos. Atrações da ilha: atracao. Textos da ilha: ilha.",
  "Pacotes: ação pacote. Pergunta frequente nova: faq. Prato novo: cardapio_item. Depoimento novo: depoimento.",
  "Aparência (abertura em vídeo, animações, céu por hora): ação aparencia.",
  "Clássico ou Novo para os visitantes: ação modelo_site. Chat da Marina no site ligado/desligado: ação chat_site.",
  "O que você sabe (treinamento): ensinar, editar_conhecimento, excluir_item, restaurar_item, ajustar_personalidade.",
];

function descreverCampo(c: Campo): string {
  const tipo = c.tipo === "opcao" ? `uma de: ${c.opcoes?.join(", ")}`
    : c.tipo === "setores" ? `lista de: ${SETORES.map((s) => s.id).join(", ")}`
    : c.tipo === "dias" ? 'dias, ex.: "segunda a sexta", "todos os dias"'
    : c.tipo === "simnao" ? "true/false" : c.tipo === "hora" ? "HH:MM" : c.tipo === "data" ? "AAAA-MM-DD"
    : c.tipo === "dinheiro" ? "número em reais" : c.tipo === "inteiro" ? "número" : c.tipo === "lista" ? "lista de textos" : c.tipo === "telefone" ? "telefone com DDD" : "texto";
  return `${c.col} (${c.rotulo}; ${tipo})`;
}

export function mapaDoPainel(): string {
  const linhas = ["── MAPA DO PAINEL (todas as áreas; use os ids e colunas exatamente assim) ──"];
  for (const a of AREAS) {
    const criar = a.criar ? "criar: sim (ação criar)" : a.criarPor ? `criar: ${a.criarPor.startsWith("(") ? a.criarPor : `ação ${a.criarPor}`}` : "criar: não";
    const mudar = a.editarPor ? `mudar: ação ${a.editarPor}` : `mudar: ação alterar${a.unica ? " (configuração única, sem alvo)" : ""}`;
    linhas.push(`- ${a.id} — ${a.rotulo} (${a.tela}): ${a.oQue}. ${mudar}; ${criar}.${a.campos.length ? ` Colunas: ${a.campos.map(descreverCampo).join("; ")}.` : ""}`);
  }
  linhas.push("", "Áreas com ação própria:", ...ACOES_ESPECIAIS.map((l) => `- ${l}`));
  linhas.push("", "Você conhece, mas só se muda pela tela (diga onde fica):", ...SO_PELA_TELA.map((l) => `- ${l}`));
  return linhas.join("\n");
}

type L = Dados;
const vazio = async <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);

/** O que está cadastrado AGORA, área por área, curto. Nada de senha, chave ou dado de hóspede. */
export async function retratoDoPainel(sql: Sql): Promise<string> {
  const listas = AREAS.filter((a) => !a.unica && a.id !== "midias");
  const [linhasAreas, [pousada], [politicas], [regras], conteudo, [esc], midias, [leads], [chamados]] = await Promise.all([
    Promise.all(listas.map((a) => vazio(a.ordem
      ? sql<L[]>`SELECT * FROM ${sql(a.tabela)} ORDER BY ${sql(a.ordem)} LIMIT ${a.limiteRetrato ?? 30}`
      : sql<L[]>`SELECT * FROM ${sql(a.tabela)} LIMIT ${a.limiteRetrato ?? 30}`))),
    vazio(sql<L[]>`SELECT nome, whatsapp, telefone, email, endereco, cidade, horario_recepcao, instagram, facebook, descricao_curta, chat_ativo, tema, modelo_site FROM pousada LIMIT 1`),
    vazio(sql<L[]>`SELECT check_in, check_out, pet, pet_texto, cancelamento, formas_pagamento, diaria_minima_padrao FROM politicas LIMIT 1`),
    vazio(sql<L[]>`SELECT idade_colo_max, crianca_paga_como_adulto, bebe_cobranca, bebe_valor FROM regras_hospedagem WHERE id = 1`),
    vazio(sql<{ chave: string; dados: L }[]>`SELECT chave, dados FROM conteudo_editavel`),
    vazio(sql<L[]>`SELECT ativo, aprendizado_modo, lembrete_min, proximo_min, desistir_min FROM marina_escalonamento_config WHERE id = 1`),
    vazio(sql<{ secao: string; n: number; marina: number }[]>`SELECT secao, count(*)::int AS n, count(*) FILTER (WHERE visivel_marina)::int AS marina FROM midias GROUP BY secao ORDER BY secao`),
    vazio(sql<{ n: number }[]>`SELECT count(*) FILTER (WHERE NOT lido)::int AS n FROM leads`),
    vazio(sql<{ n: number }[]>`SELECT count(*)::int AS n FROM marina_chamados WHERE status = 'aguardando'`),
  ]);

  const out = ["── O QUE ESTÁ CADASTRADO NO PAINEL AGORA (use para responder e para agir) ──"];
  listas.forEach((a, i) => {
    const linhas = linhasAreas[i];
    if (!linhas.length) { out.push(`${a.rotulo}: nada cadastrado.`); return; }
    const itens = linhas.map((l) => {
      const extras = a.retrato.map((c) => (l[c] == null || l[c] === "" ? null : `${a.campos.find((x) => x.col === c)?.rotulo ?? c}: ${mostrar(c, l[c])}`)).filter(Boolean);
      const desligado = l.ativo === false ? (a.id === "suites" ? " (fora do site agora)" : " (desligado)") : "";
      return `${nomeDaLinha(a, l)}${desligado}${extras.length ? ` — ${extras.join("; ")}` : ""}`;
    });
    out.push(`${a.rotulo} (${linhas.length}${linhas.length >= (a.limiteRetrato ?? 30) ? "+" : ""}): ${itens.join(" | ")}`);
  });

  if (pousada) {
    out.push(`Dados da pousada: ${["nome", "whatsapp", "telefone", "email", "endereco", "cidade", "horario_recepcao", "instagram", "facebook"]
      .filter((k) => pousada[k]).map((k) => `${k}: ${mostrar(k, pousada[k])}`).join("; ")}.`);
    const tema = (pousada.tema ?? {}) as { animacoes?: boolean; movimento?: { abertura?: boolean; aberturaEstilo?: string } };
    const modelo = (pousada.modelo_site ?? {}) as { modelo?: string; ceu_por_hora?: boolean };
    out.push(`Site: visitantes no modelo ${modelo.modelo === "novo" ? "Novo" : "Clássico"}; abertura ${tema.movimento?.abertura === false ? "desligada" : `ligada (${tema.movimento?.aberturaEstilo === "logo" ? "logo animada" : "vídeo"})`}; animações ${tema.animacoes === false ? "desligadas" : "ligadas"}; céu por hora ${modelo.ceu_por_hora === false ? "desligado" : "ligado"}; chat da Marina no site ${pousada.chat_ativo ? "ligado" : "desligado"}.`);
  }
  if (politicas) {
    out.push(`Políticas: check-in ${politicas.check_in ?? "?"}, check-out ${politicas.check_out ?? "?"}; pets ${politicas.pet ? "aceitos" : "não aceitos"}${politicas.pet_texto ? ` (${mostrar("t", politicas.pet_texto)})` : ""}; estadia mínima ${politicas.diaria_minima_padrao ?? 1}; pagamento: ${mostrar("l", politicas.formas_pagamento)}; cancelamento: ${mostrar("t", politicas.cancelamento)}.`);
  }
  if (regras) {
    out.push(`Crianças: ${regras.idade_colo_max == null ? "regra desligada (vale o cálculo do sistema de reservas)" : `de colo até ${regras.idade_colo_max} anos; acima ${regras.crianca_paga_como_adulto ? "paga como adulto" : "não paga como adulto"}`}; bebê ${regras.bebe_cobranca === "gratis" ? "não paga" : `${mostrar("t", regras.bebe_cobranca)} ${regras.bebe_valor ? mostrar("preco", regras.bebe_valor) : ""}`}.`);
  }
  for (const c of conteudo) {
    if (c.chave === "chegar" && c.dados.TRAVESSIA) {
      const t = c.dados.TRAVESSIA as { operadora?: string; duracao?: string; precos?: { ida?: number; volta?: number; idaEVolta?: number; consultadoEm?: string } };
      out.push(`Travessia: ${t.operadora ?? ""}, ${t.duracao ?? ""}; ida ${mostrar("preco", t.precos?.ida)}, volta ${mostrar("preco", t.precos?.volta)}, ida e volta ${mostrar("preco", t.precos?.idaEVolta)} (consultado em ${t.precos?.consultadoEm ?? "?"}).`);
    }
    if (c.chave === "ilha" && Array.isArray(c.dados.ATRACOES)) {
      out.push(`Atrações da ilha: ${(c.dados.ATRACOES as { nome: string; distanciaTexto?: string }[]).map((a) => `${a.nome}${a.distanciaTexto ? ` (${a.distanciaTexto})` : ""}`).join(" | ") || "nenhuma"}.`);
    }
    if (c.chave === "eventos" && c.dados.EVENTOS) {
      const e = c.dados.EVENTOS as { tipos?: string[]; capacidade?: string | null };
      out.push(`Eventos: ${(e.tipos ?? []).join(", ") || "—"}; capacidade ${e.capacidade || "sob consulta"}.`);
    }
  }
  if (esc) out.push(`Chamar a equipe: ${esc.ativo ? "ligado" : "desligado"}; aprendizado ${esc.aprendizado_modo === "automatico" ? "automático" : "com aprovação"}; lembrete em ${esc.lembrete_min} min, próximo em ${esc.proximo_min} min, desiste em ${esc.desistir_min} min.`);
  if (midias.length) out.push(`Fotos e vídeos: ${midias.map((m) => `${m.secao} ${m.n} (${m.marina} a Marina pode mandar)`).join("; ")}.`);
  out.push(`Contatos recebidos não lidos: ${leads?.n ?? 0}. Chamados aguardando a equipe: ${chamados?.n ?? 0}.`);
  return out.join("\n");
}
