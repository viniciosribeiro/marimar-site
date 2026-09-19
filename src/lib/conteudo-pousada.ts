/**
 * ═══════════════════════════════════════════════════════════════════
 * FONTE CANONICA DE CONTEUDO — Pousada Marimar
 * ═══════════════════════════════════════════════════════════════════
 *
 * Origem: briefing da administracao (18/09/2026).
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O briefing separa explicitamente o que esta CONFIRMADO do que ainda
 * precisa de confirmacao interna (PMS / administracao). Sem um lugar unico
 * para isso, cada pagina acabaria inventando ou repetindo dado de OTA como
 * se fosse fato. Aqui, o que nao esta confirmado nao vai para o ar: os
 * componentes leem `PENDENTE_CONFIRMACAO` e simplesmente nao renderizam.
 *
 * REGRA: nenhuma pagina do site escreve fato sobre a pousada na mao.
 * Ou vem do banco (editavel pela administracao), ou vem daqui, ou vem do
 * motor Desbravador. Nunca de improviso.
 *
 * O QUE MORA ONDE
 *  - Banco (tabela `pousada`): telefone, endereco, textos que a administracao
 *    edita pelo admin.
 *  - Este arquivo: conteudo de referencia estavel (como chegar, travessia,
 *    atracoes da ilha, politicas) que nao muda toda semana.
 *  - Motor Desbravador: quartos, tarifas, disponibilidade. NUNCA hardcoded.
 */

/** Data da pesquisa que originou os numeros datados abaixo. */
export const ATUALIZADO_EM = "18/09/2026";

/* ─────────────────────────────────────────────────────────────────
   O COMPLEXO — o fato estrutural mais importante do site
   ───────────────────────────────────────────────────────────────── */

/**
 * O Marimar Cafe Bistro Bar fica NA FRENTE, pe na areia.
 * A Pousada Marimar fica ANEXADA AOS FUNDOS do restaurante.
 *
 * Os quartos NAO devem ser apresentados como se estivessem sobre a areia.
 * Esta frase deve aparecer em todas as paginas relevantes.
 */
export const COMPLEXO = {
  frase: "Restaurante pé na areia na parte da frente e Pousada Marimar anexada logo aos fundos",
  fraseLonga:
    "O Marimar Café Bistrô Bar fica em frente ao mar. A Pousada Marimar está anexada logo aos fundos do restaurante, a poucos passos do trapiche de Encantadas.",
  fraseRodape:
    "Restaurante pé na areia na parte da frente; Pousada Marimar anexada logo aos fundos, a poucos passos do trapiche de Encantadas.",
  respostaFaq:
    "O Marimar Café Bistrô Bar fica pé na areia na parte da frente. A Pousada Marimar pertence ao mesmo complexo e está anexada logo aos fundos do restaurante.",
} as const;

/* ─────────────────────────────────────────────────────────────────
   IDENTIFICACAO E CONTATO
   ───────────────────────────────────────────────────────────────── */

export const IDENTIDADE = {
  nome: "Pousada Marimar",
  nomeCompleto: "Pousada Marimar Ilha do Mel",
  restaurante: "Marimar Café Bistrô Bar",
  site: "https://pousadamarimarilhadomel.com.br/",
  instagram: "https://www.instagram.com/pousada.marimar/",
  instagramUser: "@pousada.marimar",
} as const;

export const CONTATO = {
  /** Telefone e WhatsApp oficiais da POUSADA. Confirmado. */
  whatsapp: "+55 (41) 99501-2920",
  whatsappDigitos: "5541995012920",
  /**
   * PENDENTE: a ficha do restaurante mostra (41) 99916-9607, mas o briefing
   * pede confirmacao antes de publicar como contato oficial. Ate la nao vai ao ar.
   */
  telefoneRestaurante: null as string | null,
  /**
   * Telefones historicos que NAO devem substituir o contato atual:
   * (41) 3426-9052, (41) 99811-8661 e a forma incompleta (41) 9501-2920.
   * Listados so para que ninguem os reintroduza por engano.
   */
  telefonesObsoletos: ["(41) 3426-9052", "(41) 99811-8661", "(41) 9501-2920"],
} as const;

export const ENDERECO = {
  logradouro: "Praia de Encantadas, s/n",
  bairro: "Encantadas",
  ilha: "Ilha do Mel",
  cidade: "Paranaguá",
  uf: "PR",
  cep: "83251-000",
  completo: "Praia de Encantadas, s/n — Ilha do Mel, Paranaguá/PR, CEP 83251-000",
  plusCode: "CMJM+JW",
  /** Ponto do mapa = o RESTAURANTE, usado como referencia para a pousada aos fundos. */
  lat: -25.5684375,
  lng: -48.3151875,
  rotuloMapa: "Marimar Café Bistrô Bar — restaurante pé na areia; Pousada Marimar anexada aos fundos",
} as const;

/**
 * PENDENTE DE CONFIRMACAO — nao publicar.
 * Existe registro historico de Cecilia Otilia Rodrigues Pousada Ltda,
 * CNPJ 04.754.720/0001-01, aberto em 30/10/2001 e BAIXADO em 31/01/2023.
 * Por estar baixado, nao pode ser publicado como empresa operacional atual.
 */
export const RAZAO_SOCIAL_ATUAL = null;
export const CNPJ_ATUAL = null;

/* ─────────────────────────────────────────────────────────────────
   DIFERENCIAIS — somente os confirmados
   ───────────────────────────────────────────────────────────────── */

/**
 * A fila de atributos do topo da home.
 *
 * Quatro, todos FATOS confirmados — nao slogans. "Experiencias
 * inesqueciveis" nao diz nada a quem esta decidindo; "cafe da manha
 * incluso" responde uma duvida real antes de a pessoa olhar datas.
 */
export const DESTAQUES_TOPO = [
  { icone: "praia", texto: "Restaurante pé na areia" },
  { icone: "caminhar", texto: "A passos do trapiche" },
  { icone: "cafe", texto: "Café da manhã incluso" },
  { icone: "folha", texto: "Dentro da Ilha do Mel" },
] as const;

/* `icone` e `cor` referem-se ao catalogo de src/components/site/Icone.tsx.
   Eram emojis: cada sistema desenha o seu, entao a mesma grade de oito
   cartoes saia com oito estilos graficos diferentes — e nenhum emoji aceita
   a cor da marca. */
export const DIFERENCIAIS = [
  { icone: "talheres", cor: "coral", titulo: "Restaurante próprio pé na areia", texto: "O Marimar Café Bistrô Bar fica na parte da frente do complexo, de frente para a Praia de Encantadas." },
  { icone: "caminhar", cor: "mar", titulo: "A poucos passos do trapiche", texto: "Percurso curto e a pé desde o trapiche de Encantadas até o restaurante — a pousada fica logo atrás." },
  { icone: "cafe", cor: "areia", titulo: "Café da manhã incluso", texto: "Self-service servido das 08h às 10h, com pães, bolos, lanches naturais, frios, frutas frescas e sucos." },
  { icone: "ar", cor: "mar", titulo: "Suítes climatizadas", texto: "Ar-condicionado, banheiro privativo e TV nas acomodações." },
  { icone: "wifi", cor: "noite", titulo: "Wi-Fi gratuito", texto: "Internet sem fio nas dependências da pousada." },
  { icone: "familia", cor: "sol", titulo: "Casais e famílias", texto: "Acomodações para casais e opções familiares com camas adicionais." },
  { icone: "festa", cor: "coral", titulo: "Espaço para eventos", texto: "Casamentos, festas e confraternizações usando jardim, restaurante e a proximidade do mar." },
  { icone: "folha", cor: "mata", titulo: "Contato com a natureza", texto: "Encantadas fica dentro do contexto natural da Ilha do Mel, sem circulação de veículos." },
] as const;

/* ─────────────────────────────────────────────────────────────────
   POLITICAS — confirmadas pela pousada
   ───────────────────────────────────────────────────────────────── */

export const POLITICAS = {
  checkIn: "14h",
  checkOut: "11h",
  cafeDaManha: "08h às 10h",
  /** Limite pratico por causa da travessia da ABALINE. */
  checkInLimite: "17h",
  chegadaTardia: "Somente com aviso antecipado.",
  pets: false,
  petsTexto: "Animais de estimação não são aceitos.",
  fumar: "Proibido fumar nas suítes.",
  silencio: "Barulho permitido somente até 22h.",
  allInclusive: false,
  pacotes: "Os pacotes incluem café da manhã. Não há sistema all inclusive.",
  criancas: "Suítes família podem ter adicional para adulto extra e tarifa adicional para crianças.",
  cancelamento: [
    "As reservas são não reembolsáveis: em caso de cancelamento, o pagamento total é devido conforme a condição contratada.",
    "Da data da reserva até uma semana antes da hospedagem: taxa de 50%.",
    "De uma semana antes até o check-in: taxa de 100%.",
    "Condições climáticas não geram automaticamente alteração ou cancelamento.",
  ],
  /**
   * PENDENTE: idade minima para check-in, camas extras, no-show completo,
   * formas de pagamento e parcelamento seguem o PMS e a tarifa escolhida.
   * As OTAs divergem (Booking 14h-18h vs Expedia 14h-21h; idade minima 18
   * so na Expedia; cama extra so na Expedia) e NAO substituem a regra oficial.
   */
  observacao: "Regras de crianças, camas extras, pagamento e check-in tardio seguem o PMS e a tarifa escolhida. Confirme no momento da reserva.",
} as const;

/* ─────────────────────────────────────────────────────────────────
   COMO CHEGAR
   ───────────────────────────────────────────────────────────────── */

export const TRAVESSIA = {
  operadora: "ABALINE",
  site: "https://www.abaline.com.br/novo/",
  /** Encantadas — NAO Nova Brasilia. Erro comum e caro para o hospede. */
  destino: "Encantadas",
  avisoDestino: "Escolha o destino Encantadas. Nova Brasília é o outro atracadouro da ilha e fica longe da pousada.",
  duracao: "cerca de 30 minutos",
  terminais: [
    { nome: "Pontal do Sul", endereco: "Alameda do Café, s/n — Pontal do Sul, Pontal do Paraná/PR", principal: true },
    { nome: "Paranaguá", endereco: "Rua General Carneiro, 366 — Centro Histórico, Paranaguá/PR", principal: false },
  ],
  /** Valores VARIAVEIS — sempre exibir com a data da consulta e o link oficial. */
  precos: { ida: 26.9, volta: 22.1, idaEVolta: 49.0, gratuidade: "Crianças de até 7 anos", consultadoEm: ATUALIZADO_EM },
  estacionamento: "O terminal de Pontal do Sul não possui estacionamento próprio, mas há estacionamentos privados nas proximidades. Quem chega de carro deixa o veículo no continente e segue de barco.",
} as const;

export const CHEGADA_ETAPAS = [
  { n: 1, titulo: "Chegue a Pontal do Sul", texto: "De Curitiba, siga pela BR-277 rumo ao litoral até Pontal do Sul. A Viação Graciosa comercializa o trecho Curitiba–Pontal do Sul. De avião, o aeroporto de referência é o Afonso Pena (CWB), seguido de deslocamento rodoviário até o litoral." },
  { n: 2, titulo: "Embarque para Encantadas", texto: "A travessia da ABALINE leva cerca de 30 minutos. Confirme que o destino é Encantadas, não Nova Brasília." },
  { n: 3, titulo: "Caminhe até o Marimar Café Bistrô Bar", texto: "Do trapiche de Encantadas o percurso é curto e a pé. Chegue ao restaurante, que fica pé na areia, e acesse a Pousada Marimar anexada logo aos fundos." },
] as const;

export const SOBRE_A_ILHA = {
  acesso: "O acesso à Ilha do Mel é feito por embarcação. Não há circulação normal de veículos motorizados e os deslocamentos internos são principalmente a pé ou de bicicleta.",
  bagagem: "Como não há carros na ilha, leve bagagem que você consiga carregar no trecho a pé desde o trapiche.",
} as const;

/* ─────────────────────────────────────────────────────────────────
   ATRACOES
   ───────────────────────────────────────────────────────────────── */

export const ATRACOES = [
  {
    slug: "gruta-das-encantadas",
    nome: "Gruta das Encantadas",
    resumo: "Formação natural no sul da ilha, com acesso por passarela e forte presença no folclore local.",
    texto: "Atração natural localizada no sul da Ilha do Mel, formada pela ação do mar sobre uma faixa de diabásio menos resistente entre rochas de migmatito. O acesso é feito por passarela. A tradição folclórica local associa a gruta a sereias e mulheres encantadas — daí o nome do vilarejo.",
    distanciaTexto: "cerca de 600 m da pousada",
    destaque: true,
  },
  {
    slug: "praias-e-trilhas",
    nome: "Praias e trilhas de Encantadas",
    resumo: "Praia de Encantadas, Praia de Fora e as trilhas que ligam os dois lados da ilha.",
    texto: "Encantadas concentra praias de perfis diferentes a curta distância uma da outra, ligadas por trilhas. O Morro do Sabão é um dos pontos altos do trajeto no sul da ilha.",
    distanciaTexto: null,
    destaque: true,
  },
  {
    slug: "farol-das-conchas",
    nome: "Farol das Conchas",
    resumo: "Cartão-postal da ilha, no lado de Nova Brasília, com vista ampla do litoral.",
    texto: "Farol histórico situado em Nova Brasília, do outro lado da ilha. É um dos mirantes mais procurados da Ilha do Mel.",
    distanciaTexto: "cerca de 4,1 km da pousada",
    destaque: true,
  },
  {
    slug: "fortaleza",
    nome: "Fortaleza de Nossa Senhora dos Prazeres",
    resumo: "Fortificação do século XVIII, patrimônio histórico da ilha.",
    texto: "Construída no século XVIII para defesa da barra de Paranaguá, é o principal ponto histórico da Ilha do Mel.",
    distanciaTexto: "cerca de 6 km da pousada",
    destaque: false,
  },
] as const;

/**
 * As distancias acima vieram do Booking e foram calculadas por trajeto
 * rodoviario. Na ilha o deslocamento e a pe, entao o TEMPO real e maior.
 * Por isso exibimos distancia aproximada e nunca "X minutos de carro".
 */
export const AVISO_DISTANCIAS = "Distâncias aproximadas. Na Ilha do Mel os deslocamentos são a pé, então o tempo de percurso é maior do que o de um trajeto equivalente no continente.";

export const CUIDADOS_AMBIENTAIS = [
  "A Ilha do Mel é unidade de conservação — parte dela é Parque Estadual.",
  "Leve seu lixo de volta: a coleta na ilha é limitada.",
  "Respeite a sinalização das trilhas e as áreas de preservação.",
  "Não há circulação de veículos: os deslocamentos são a pé ou de bicicleta.",
] as const;

/* ─────────────────────────────────────────────────────────────────
   RESTAURANTE E CAFE DA MANHA
   ───────────────────────────────────────────────────────────────── */

export const RESTAURANTE = {
  nome: "Marimar Café Bistrô Bar",
  posicao: "Parte da frente do complexo, pé na areia, de frente para a Praia de Encantadas.",
  cardapioResumo: "Peixes, camarões, saladas, pratos frios e quentes, drinks e bebidas.",
  /**
   * PENDENTE: horarios completos, cardapio com precos, atendimento ao publico
   * externo e telefone proprio precisam de confirmacao. O Booking indica
   * cafe da manha, brunch, almoco, jantar, cafe da tarde e happy hour, mas
   * isso e dado de OTA e nao vai ao ar como promessa.
   */
  horarios: null as string | null,
  atendePublicoExterno: null as boolean | null,
  cardapioUrl: null as string | null,
  avisoPendente: "Horários, cardápio completo e preços são confirmados diretamente com a pousada.",
} as const;

export const CAFE_DA_MANHA = {
  incluso: true,
  horario: "08h às 10h",
  estilo: "Self-service",
  itens: ["Pães", "Bolos", "Lanches naturais", "Doces", "Frios", "Frutas frescas", "Sucos"],
} as const;

export const EVENTOS = {
  tipos: ["Casamentos", "Festas", "Confraternizações", "Eventos corporativos"],
  espacos: ["Jardim", "Restaurante pé na areia", "Proximidade do mar"],
  /** PENDENTE: capacidade maxima, valores, pacotes e equipamentos. */
  capacidade: null as string | null,
  avisoPendente: "Capacidade, valores e pacotes são montados sob consulta.",
} as const;

/* ─────────────────────────────────────────────────────────────────
   COMODIDADES
   ───────────────────────────────────────────────────────────────── */

/** Confirmadas em fontes oficiais. */
export const COMODIDADES_CONFIRMADAS = [
  "Wi-Fi gratuito", "Ar-condicionado", "Banheiro privativo", "TV",
  "Café da manhã incluso", "Restaurante", "Bar", "Jardim",
  "Áreas de convivência", "Quartos para não fumantes", "Quartos família",
] as const;

/** Nao existem na propriedade — dito explicitamente para nao prometer. */
export const NAO_DISPONIVEL = [
  { item: "Estacionamento", motivo: "A pousada fica na ilha, onde não há circulação de veículos." },
  { item: "Elevador", motivo: "O complexo não possui elevador." },
  { item: "Aceitação de pets", motivo: "Animais de estimação não são aceitos." },
] as const;

/* ─────────────────────────────────────────────────────────────────
   AVALIACOES — numeros de terceiros, sempre com fonte e data
   ───────────────────────────────────────────────────────────────── */

export const AVALIACOES = {
  consultadoEm: ATUALIZADO_EM,
  plataformas: [
    { nome: "Google", nota: 4.4, escala: 5, total: 557, url: null },
    { nome: "Booking", nota: 8.0, escala: 10, total: 450, url: "https://www.booking.com/hotel/br/hostel-marimar.pt-br.html" },
    { nome: "Expedia", nota: 8.6, escala: 10, total: 94, url: "https://www.expedia.com.br/Paranagua-Hoteis-Pousada-Marimar.h29331794.Hotel-Reservas" },
    { nome: "KAYAK", nota: 7.8, escala: 10, total: 463, url: "https://www.kayak.com.br/Hoteis-Pousada-Marimar-Paranagua.420732.ksp" },
    { nome: "TripAdvisor", nota: 4.1, escala: 5, total: 127, url: "https://www.tripadvisor.com.br/Hotel_Review-g303445-d1066395-Reviews-Pousada_Marimar-Ilha_do_Mel_State_of_Parana.html" },
  ],
  /** Subnotas do Booking. Incluimos as baixas de proposito: honestidade sustenta a alta. */
  detalheBooking: [
    { criterio: "Localização", nota: 9.2 },
    { criterio: "Limpeza", nota: 7.8 },
    { criterio: "Conforto", nota: 7.8 },
    { criterio: "Instalações", nota: 7.6 },
    { criterio: "Custo-benefício", nota: 7.4 },
    { criterio: "Wi-Fi", nota: 6.0 },
  ],
  pontosFortes: ["Localização", "Proximidade do trapiche", "Atendimento", "Tranquilidade", "Restaurante", "Café da manhã"],
  /**
   * NUNCA inventar depoimento. Qualquer citacao precisa identificar a
   * plataforma de origem. Enquanto nao houver depoimento real coletado com
   * essa atribuicao, o site mostra so as notas agregadas.
   */
  depoimentos: [] as { texto: string; autor: string; plataforma: string; nota?: number }[],
} as const;

/* ─────────────────────────────────────────────────────────────────
   PENDENCIAS — o que a administracao precisa confirmar
   ───────────────────────────────────────────────────────────────── */

export const PENDENTE_CONFIRMACAO = [
  "Razão social e CNPJ vigentes (o CNPJ histórico está baixado desde 31/01/2023)",
  "Número físico atual de suítes (histórico registra 24; agregador antigo 18; site 11 categorias; Expedia 13 opções)",
  "Nome oficial e inventário final de cada acomodação",
  "Capacidade, tipos de cama e metragem por categoria",
  "Acessibilidade",
  "Horários completos do restaurante e atendimento ao público externo",
  "Cardápio e preços atuais do restaurante",
  "Telefone específico do restaurante (a ficha mostra (41) 99916-9607)",
  "Capacidade máxima para eventos",
  "Idade mínima para check-in e regras de cama extra",
  "Regras finais para crianças e política completa de no-show",
  "Formas de pagamento e parcelamento",
  "Horário final da recepção e detalhes do check-in tardio",
] as const;

/* ─────────────────────────────────────────────────────────────────
   FAQ CANONICO
   Perguntas que o briefing exige. A pagina /faq mostra estas e
   acrescenta o que a administracao cadastrar no admin, sem duplicar.
   ───────────────────────────────────────────────────────────────── */

export const FAQ_CANONICO: { grupo: string; itens: { p: string; r: string }[] }[] = [
  {
    grupo: "Localização e chegada",
    itens: [
      { p: "Qual a diferença entre o restaurante e a pousada?", r: COMPLEXO.respostaFaq },
      { p: "Qual o ponto correto no mapa?", r: `O ponto de referência é o ${RESTAURANTE.nome} (Plus Code ${ENDERECO.plusCode}). A entrada da pousada é pelos fundos do restaurante.` },
      { p: "De onde saem os barcos?", r: `Os principais embarques são Pontal do Sul (${TRAVESSIA.terminais[0].endereco}) e Paranaguá (${TRAVESSIA.terminais[1].endereco}).` },
      { p: "Qual destino devo escolher na travessia?", r: TRAVESSIA.avisoDestino },
      { p: "Quanto custa e quanto demora a travessia?", r: `O trecho Pontal do Sul–Encantadas leva ${TRAVESSIA.duracao}. Em ${TRAVESSIA.precos.consultadoEm}, a venda oficial indicava cerca de R$ ${TRAVESSIA.precos.ida.toFixed(2).replace(".", ",")} a ida e R$ ${TRAVESSIA.precos.idaEVolta.toFixed(2).replace(".", ",")} ida e volta, com gratuidade para ${TRAVESSIA.precos.gratuidade.toLowerCase()}. Valores e horários mudam sem aviso — confirme no site da ${TRAVESSIA.operadora}.` },
      { p: "Tem estacionamento?", r: TRAVESSIA.estacionamento },
      { p: "Qual a distância do trapiche até a pousada?", r: "O percurso é curto e feito a pé. Do trapiche de Encantadas você caminha até o restaurante, que fica pé na areia, e entra na pousada pelos fundos." },
      { p: "Como levo as malas?", r: "Não há circulação de veículos na ilha, então o trecho do trapiche até a pousada é feito a pé. Leve bagagem que você consiga carregar." },
    ],
  },
  {
    grupo: "Estadia",
    itens: [
      { p: "Qual o horário de check-in e check-out?", r: `Check-in a partir das ${POLITICAS.checkIn} e check-out até as ${POLITICAS.checkOut}.` },
      { p: "Posso chegar mais tarde?", r: `Normalmente aceitamos check-in até as ${POLITICAS.checkInLimite}, porque a chegada depende da travessia da ${TRAVESSIA.operadora}. ${POLITICAS.chegadaTardia}` },
      { p: "O café da manhã está incluso?", r: `Sim. ${CAFE_DA_MANHA.estilo}, servido das ${CAFE_DA_MANHA.horario}.` },
      { p: "Aceitam animais de estimação?", r: POLITICAS.petsTexto },
      { p: "Pode fumar?", r: POLITICAS.fumar },
      { p: "Até que horas pode ter barulho?", r: POLITICAS.silencio },
      { p: "Como funciona para crianças e camas extras?", r: `${POLITICAS.criancas} ${POLITICAS.observacao}` },
      { p: "Tem Wi-Fi?", r: "Sim, Wi-Fi gratuito nas dependências da pousada. Vale lembrar que a Ilha do Mel tem infraestrutura de internet limitada — é o item com a menor nota nas nossas avaliações, e preferimos avisar antes." },
    ],
  },
  {
    grupo: "Restaurante e serviços",
    itens: [
      { p: "A pousada tem restaurante?", r: `Sim. O ${RESTAURANTE.nome} pertence à Pousada Marimar e fica na parte da frente do complexo, pé na areia. ${RESTAURANTE.cardapioResumo}` },
      { p: "O restaurante atende quem não está hospedado?", r: RESTAURANTE.avisoPendente },
      { p: "Fazem eventos e casamentos?", r: `Sim — casamentos, festas e confraternizações, usando o jardim, o restaurante e a proximidade do mar. ${EVENTOS.avisoPendente}` },
    ],
  },
  {
    grupo: "Reserva e cancelamento",
    itens: [
      { p: "Como funciona o cancelamento?", r: POLITICAS.cancelamento.join(" ") },
      { p: "E se o tempo virar?", r: "Condições climáticas não geram automaticamente alteração ou cancelamento da reserva." },
      { p: "Vocês são all inclusive?", r: POLITICAS.pacotes },
    ],
  },
];
