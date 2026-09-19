/**
 * Arquitetura de navegacao — fonte unica.
 *
 * Antes existiam duas listas soltas no layout: seis links chapados no topo
 * e quinze no rodape. Quem chegava pelo topo nao encontrava Politicas, FAQ,
 * Pacotes, Avaliacoes ou Eventos — paginas que existem e respondem
 * exatamente as duvidas de quem esta decidindo a reserva.
 *
 * Agora a mesma estrutura serve topo (menu com painel), celular (gaveta
 * sanfonada) e rodape. Adicionar uma pagina aqui e adiciona-la nos tres.
 *
 * As descricoes sao o que o menu tem de mais util: dizem o que a pessoa vai
 * encontrar antes de ela gastar um clique. Por isso nenhuma delas promete
 * numero, preco ou fato que dependa do que o admin cadastrou — o cardapio e
 * as fotos mudam, o menu nao pode mentir enquanto isso.
 */

export type ItemNav = {
  href: string;
  rotulo: string;
  descricao?: string;
};

export type GrupoNav = {
  /** Rotulo no topo. */
  rotulo: string;
  /** Para onde vai quem clica no proprio grupo (e o que marca o item ativo). */
  href: string;
  /** Sem itens, vira link simples no topo. */
  itens?: ItemNav[];
};

export const NAVEGACAO: GrupoNav[] = [
  {
    rotulo: "Acomodações",
    href: "/quartos",
    itens: [
      {
        href: "/quartos",
        rotulo: "Todas as acomodações",
        descricao: "Tipos de quarto, capacidade e o que vem em cada um",
      },
      {
        href: "/pacotes",
        rotulo: "Pacotes e ofertas",
        descricao: "Estadias montadas para feriado e temporada",
      },
      {
        href: "/politicas",
        rotulo: "Políticas da pousada",
        descricao: "Check-in, cancelamento, crianças e pets",
      },
    ],
  },
  {
    rotulo: "Restaurante",
    href: "/restaurante",
    itens: [
      {
        href: "/restaurante",
        rotulo: "O restaurante",
        descricao: "O Marimar Café Bistrô Bar, de frente para a praia",
      },
      {
        href: "/restaurante#cardapio",
        rotulo: "Cardápio digital",
        descricao: "Pratos e bebidas com foto, descrição e preço",
      },
      {
        href: "/restaurante#cafe-da-manha",
        rotulo: "Café da manhã",
        descricao: "Incluso na diária de todos os quartos",
      },
      {
        href: "/eventos",
        rotulo: "Eventos e casamentos",
        descricao: "Celebrações com a ilha inteira de cenário",
      },
    ],
  },
  {
    rotulo: "A Pousada",
    href: "/a-pousada",
    itens: [
      {
        href: "/a-pousada",
        rotulo: "Sobre a Marimar",
        descricao: "A casa, a história e a estrutura do complexo",
      },
      {
        href: "/galeria",
        rotulo: "Galeria de fotos",
        descricao: "A pousada, os quartos, o restaurante e a praia",
      },
      {
        href: "/avaliacoes",
        rotulo: "Avaliações",
        descricao: "O que os hóspedes escreveram nas plataformas",
      },
      {
        href: "/faq",
        rotulo: "Perguntas frequentes",
        descricao: "As dúvidas que mais chegam antes da reserva",
      },
    ],
  },
  {
    rotulo: "Ilha do Mel",
    href: "/ilha-do-mel",
    itens: [
      {
        href: "/ilha-do-mel",
        rotulo: "Encantadas e a ilha",
        descricao: "Onde a pousada fica e como é o vilarejo",
      },
      {
        href: "/como-chegar",
        rotulo: "Como chegar",
        descricao: "Rota passo a passo, e no celular até a porta",
      },
      {
        href: "/ilha-do-mel#travessia",
        rotulo: "Travessia de barco",
        descricao: "Saídas de Pontal do Sul e de Paranaguá",
      },
      {
        href: "/ilha-do-mel#atracoes",
        rotulo: "Praias e trilhas",
        descricao: "Gruta das Encantadas, Farol e as praias vizinhas",
      },
    ],
  },
  {
    rotulo: "Contato",
    href: "/contato",
  },
];

/**
 * Colunas do rodape. Deriva da mesma estrutura acima para nao existir uma
 * segunda verdade — o rodape mostra tudo, sem as descricoes.
 */
export const COLUNAS_RODAPE = NAVEGACAO.filter((g) => g.itens?.length).map((g) => ({
  titulo: g.rotulo,
  itens: g.itens!,
}));

/**
 * O item do topo fica marcado quando a pessoa esta nele OU em qualquer
 * pagina abaixo dele. Sem isto, quem esta em /pacotes nao ve nada aceso e
 * perde a nocao de onde esta.
 *
 * O `#ancora` e cortado de proposito: /restaurante#cardapio e /restaurante
 * sao a mesma pagina, e comparar a string crua deixaria os dois disputando.
 */
export function grupoAtivo(pathname: string, grupo: GrupoNav): boolean {
  const base = (h: string) => h.split("#")[0];
  const casa = (h: string) => pathname === h || pathname.startsWith(h + "/");
  if (casa(base(grupo.href))) return true;
  return (grupo.itens ?? []).some((i) => casa(base(i.href)));
}
