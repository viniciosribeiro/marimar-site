import postgres from "postgres";

/**
 * O mapa do que a Marina pode saber.
 *
 * Uma lista só, lida pelos dois lados: pela Marina, na rota
 * `/api/agent/indice`, para ela saber o que existe antes de improvisar; e
 * pela Cecília, na aba "O que ela sabe hoje", para ver onde há buraco.
 *
 * Duas listas separadas divergiriam na primeira mudança — e o resultado
 * seria o pior dos dois mundos: um painel dizendo que está tudo coberto e
 * uma agente sem a rota.
 *
 * `contar` é o que transforma isto de documentação em diagnóstico: um
 * assunto com rota pronta e zero registros no banco está tão descoberto
 * quanto um assunto sem rota, e é invisível se ninguém contar.
 */
export type AreaDeConhecimento = {
  chave: string;
  titulo: string;
  rota: string;
  /** Perguntas de hóspede que esta área responde. */
  responde: string[];
  /** De onde vem: banco (a Cecília edita), fixo (código) ou motor (ao vivo). */
  origem: "banco" | "fixo" | "motor";
  /** Onde a Cecília edita, quando for do banco. */
  editarEm?: string;
  /** Conta quantos registros existem. Ausente = não é contável. */
  contar?: (sql: ReturnType<typeof postgres>) => Promise<number>;
};

const conta = (consulta: (sql: ReturnType<typeof postgres>) => Promise<{ n: number }[]>) =>
  async (sql: ReturnType<typeof postgres>) => {
    try {
      const [r] = await consulta(sql);
      return r?.n ?? 0;
    } catch {
      return -1; // tabela ausente — diferente de "existe e está vazia"
    }
  };

export const AREAS: AreaDeConhecimento[] = [
  {
    chave: "pousada",
    titulo: "A pousada e as políticas",
    rota: "/api/agent/pousada",
    responde: ["Que horas é o check-in?", "Aceita cachorro?", "Como funciona o cancelamento?", "Tem estacionamento?"],
    origem: "banco",
    editarEm: "/admin/politicas",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM politicas`),
  },
  {
    chave: "quartos",
    titulo: "Acomodações, fotos e comodidades",
    rota: "/api/agent/quartos",
    responde: ["Quais quartos vocês têm?", "O quarto tem ar-condicionado?", "Me manda foto da suíte"],
    origem: "banco",
    editarEm: "/admin/quartos",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM quartos WHERE ativo = true`),
  },
  {
    chave: "disponibilidade",
    titulo: "Datas, vagas e tarifas",
    rota: "/api/agent/disponibilidade",
    responde: ["Tem vaga no feriado?", "Quanto custa de 10 a 12?"],
    origem: "motor",
  },
  {
    chave: "chegar",
    titulo: "Como chegar na pousada",
    rota: "/api/agent/chegar",
    responde: ["Como chego aí?", "Que barco eu pego?", "Onde deixo o carro?", "Quanto custa a travessia?"],
    origem: "fixo",
  },
  {
    chave: "restaurante",
    titulo: "Restaurante, cardápio e café da manhã",
    rota: "/api/agent/restaurante",
    responde: ["O que tem para comer?", "Quanto custa o prato?", "O café está incluso?"],
    origem: "banco",
    editarEm: "/admin/cardapio",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM cardapio_itens WHERE ativo = true`),
  },
  {
    chave: "pacotes",
    titulo: "Pacotes",
    rota: "/api/agent/pacotes",
    responde: ["Tem pacote de feriado?", "O que o pacote inclui?"],
    origem: "banco",
    editarEm: "/admin/pacotes",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM pacotes WHERE ativo = true`),
  },
  {
    chave: "passeios",
    titulo: "Passeios e atrações da ilha",
    rota: "/api/agent/passeios",
    responde: ["Que passeios vocês fazem?", "O que tem para ver por aí?", "A gruta fica longe?"],
    origem: "banco",
    editarEm: "/admin/passeios",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM passeios WHERE ativo = true`),
  },
  {
    chave: "faq",
    titulo: "Perguntas frequentes",
    rota: "/api/agent/faq",
    responde: ["As dúvidas que a pousada já respondeu antes"],
    origem: "banco",
    editarEm: "/admin/faq",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM faq WHERE ativo = true`),
  },
  {
    chave: "avaliacoes",
    titulo: "Depoimentos e notas",
    rota: "/api/agent/avaliacoes",
    responde: ["O que os hóspedes acham?", "Vocês têm boa nota?"],
    origem: "banco",
    editarEm: "/admin/depoimentos",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM depoimentos WHERE ativo = true`),
  },
  {
    chave: "ilha",
    titulo: "A Ilha do Mel",
    rota: "/api/agent/ilha",
    responde: ["Como é a ilha?", "Tem carro lá?", "O que dá para fazer?"],
    origem: "fixo",
  },
  {
    chave: "eventos",
    titulo: "Casamentos e eventos",
    rota: "/api/agent/eventos",
    responde: ["Dá para casar aí?", "Vocês recebem confraternização?"],
    origem: "fixo",
  },
  {
    chave: "conhecimento",
    titulo: "O que você ensinou pelo painel",
    rota: "/api/agent/conhecimento",
    responde: ["Tudo que você escrever nas abas de conhecimento, limites e jeito de falar"],
    origem: "banco",
    editarEm: "/admin/marina",
    contar: conta((sql) => sql`SELECT COUNT(*)::int AS n FROM marina_conhecimento WHERE ativo = true`),
  },
];

/**
 * A area SEM a funcao de contagem.
 *
 * O `Omit` nao e capricho de tipo: este objeto atravessa a fronteira
 * servidor -> cliente para chegar na tela da Cecilia, e funcao nao e
 * serializavel. Deixar o `contar` dentro derruba a pagina inteira com um
 * erro de React que nao diz qual propriedade foi — foi exatamente o que
 * aconteceu na primeira versao.
 */
export type Cobertura = Omit<AreaDeConhecimento, "contar"> & { quantos: number | null };

export async function medirCobertura(sql: ReturnType<typeof postgres>): Promise<Cobertura[]> {
  const saida: Cobertura[] = [];
  for (const area of AREAS) {
    const { contar, ...resto } = area;
    saida.push({ ...resto, quantos: contar ? await contar(sql) : null });
  }
  return saida;
}
