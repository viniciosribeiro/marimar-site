/**
 * O mapa do painel: sete áreas no lugar das 27 telas soltas
 * (docs/estudo-painel-central.md, aprovado pelo Vinicios em 19/10/2026).
 *
 * Fase 1: as telas continuam as mesmas, nos mesmos endereços; cada uma
 * ganhou uma área e um nome na língua da pousada. `aba` aponta para a aba
 * interna da tela (?aba=) e `padrao` marca a aba que abre quando o endereço
 * vem sem ela. `tecnico` = só para quem tem papel "master" (perfil Técnico).
 *
 * Arquivo só de dados: serve ao servidor (layout) e ao menu (cliente).
 */

export type ItemArea = {
  href: string;
  rotulo: string;
  /** Palavras que a busca "O que você quer fazer?" entende, sem acento. */
  chaves?: string;
  tecnico?: boolean;
  padrao?: boolean;
};

export type AreaId = "hoje" | "atendimento" | "marina" | "hospedagem" | "restaurante" | "site" | "ajustes";

export type Area = {
  id: AreaId;
  nome: string;
  /** Nome curto da barra do celular. */
  curto?: string;
  descricao: string;
  itens: ItemArea[];
};

export const AREAS: Area[] = [
  {
    id: "hoje", nome: "Hoje", descricao: "O que precisa de você agora",
    itens: [{ href: "/admin", rotulo: "Hoje", chaves: "inicio painel resumo pendencias atencao" }],
  },
  {
    id: "atendimento", nome: "Atendimento", curto: "Atender", descricao: "Clientes esperando, perguntas e contatos",
    itens: [
      { href: "/admin/equipe?aba=chamados", rotulo: "Chamados", chaves: "chamado cliente esperando equipe responder whatsapp" },
      { href: "/admin/marina?aba=sem-resposta", rotulo: "Sem resposta", chaves: "lacuna nao soube pergunta sem resposta" },
      { href: "/admin/marina?aba=aprendizado", rotulo: "Para aprovar", chaves: "aprovar aprendizado guardar resposta equipe" },
      { href: "/admin/marina?aba=conversas", rotulo: "Conversas", chaves: "conversa chat site historico hospede whatsapp oficial" },
      { href: "/admin/leads", rotulo: "Contatos", chaves: "contato lead telefone email hospede formulario" },
    ],
  },
  {
    id: "marina", nome: "Marina", descricao: "O que ela sabe, como fala e a quem pergunta",
    itens: [
      { href: "/admin/cerebro", rotulo: "Visão geral", chaves: "cerebro aprendizado resolve sozinha mapa" },
      { href: "/admin/whatsapp", rotulo: "WhatsApp da Marina", tecnico: true, chaves: "whatsapp conectar desconectar qr religar caiu aparelho conexao api oficial meta" },
      { href: "/admin/marina?aba=visao", rotulo: "Treinamento", padrao: true, chaves: "treinamento leitura canal whatsapp site" },
      { href: "/admin/marina?aba=conhecimento", rotulo: "O que ela sabe", chaves: "ensinar conhecimento fato saber informacao treinar" },
      { href: "/admin/marina?aba=documentos", rotulo: "Documentos", chaves: "documento pdf arquivo enviar" },
      { href: "/admin/marina?aba=roteiros", rotulo: "Roteiros com vídeo", chaves: "roteiro video orientacao como chegar etapa" },
      { href: "/admin/marina?aba=personalidade", rotulo: "Jeito de falar", chaves: "personalidade tom jeito regra limite falar" },
      { href: "/admin/marina?aba=voz", rotulo: "Voz", chaves: "voz audio falar ouvir" },
      { href: "/admin/equipe?aba=equipe", rotulo: "Quem responde", padrao: true, chaves: "equipe quem responde numero whatsapp pessoa horario" },
      { href: "/admin/equipe?aba=config", rotulo: "Prazos e WhatsApp", chaves: "prazo tempo escalonamento ligar desligar aviso" },
      { href: "/admin/marina?aba=testar", rotulo: "Testar", chaves: "testar perguntar simular conversar" },
      { href: "/admin/marina?aba=historico", rotulo: "Histórico", chaves: "historico mudanca restaurar desfazer" },
    ],
  },
  {
    id: "hospedagem", nome: "Hospedagem", descricao: "Suítes, regras dos hóspedes e ofertas",
    itens: [
      { href: "/admin/quartos", rotulo: "Suítes", chaves: "quarto suite cama motor foto" },
      { href: "/admin/categorias", rotulo: "Categorias", chaves: "categoria tipo quarto" },
      { href: "/admin/comodidades", rotulo: "Comodidades", chaves: "comodidade ar wifi frigobar tv" },
      { href: "/admin/marina?aba=regras", rotulo: "Crianças e adicionais", chaves: "crianca bebe colo idade adicional cama extra preco" },
      { href: "/admin/politicas", rotulo: "Políticas", chaves: "politica checkin checkout cancelamento pet animal pagamento horario" },
      { href: "/admin/pacotes", rotulo: "Pacotes e ofertas", chaves: "pacote oferta promocao reveillon carnaval feriado" },
    ],
  },
  {
    id: "restaurante", nome: "Restaurante", descricao: "Cardápio do Marimar Café Bistrô Bar",
    itens: [{ href: "/admin/cardapio", rotulo: "Cardápio", chaves: "cardapio prato preco drink bebida restaurante comida" }],
  },
  {
    id: "site", nome: "Site", descricao: "Tudo o que o hóspede vê no site",
    itens: [
      { href: "/admin/banners", rotulo: "Topo e banners", chaves: "foto topo banner capa imagem principal carrossel" },
      { href: "/admin/blocos-home", rotulo: "Seções da página inicial", chaves: "secao bloco home inicio titulo ordem esconder" },
      { href: "/admin/cartoes", rotulo: "Cartões das seções", chaves: "cartao card secao destaque" },
      { href: "/admin/midias", rotulo: "Fotos e vídeos", chaves: "foto video galeria album midia imagem enviar" },
      { href: "/admin/conteudo", rotulo: "Ilha, chegada e eventos", chaves: "ilha do mel chegada evento casamento texto" },
      { href: "/admin/rota", rotulo: "Como chegar (mapa)", chaves: "rota mapa barco trapiche terminal chegar" },
      { href: "/admin/atracoes", rotulo: "Atrações da ilha", chaves: "atracao praia trilha farol gruta passeio" },
      { href: "/admin/passeios", rotulo: "Passeios", chaves: "passeio barco tour" },
      { href: "/admin/faq", rotulo: "Perguntas frequentes", chaves: "faq pergunta duvida" },
      { href: "/admin/depoimentos", rotulo: "Depoimentos", chaves: "depoimento avaliacao comentario hospede" },
      { href: "/admin/identidade-visual", rotulo: "Aparência", chaves: "cor fonte letra logo visual identidade tema movimento seo google" },
    ],
  },
  {
    id: "ajustes", nome: "Ajustes", descricao: "Dados da pousada, pessoas e sistema",
    itens: [
      { href: "/admin/pousada", rotulo: "Dados da pousada", chaves: "whatsapp telefone email endereco instagram contato historia nome" },
      { href: "/admin/trocar-senha", rotulo: "Minha senha", chaves: "senha trocar minha senha" },
      { href: "/admin/usuarios", rotulo: "Pessoas e acessos", tecnico: true, chaves: "usuario pessoa acesso login" },
      { href: "/admin/integracoes", rotulo: "Integrações", tecnico: true, chaves: "integracao motor desbravador openclaw gateway chave api" },
      { href: "/admin/diagnostico", rotulo: "Diagnóstico", tecnico: true, chaves: "diagnostico erro funcionando teste sistema" },
    ],
  },
];

/** Tarefas que a busca entende além dos nomes das telas. */
export const TAREFAS: { rotulo: string; href: string; chaves: string; tecnico?: boolean; externo?: boolean }[] = [
  { rotulo: "Trocar a foto do topo do site", href: "/admin/banners", chaves: "foto topo capa banner imagem principal home" },
  { rotulo: "Ensinar algo novo à Marina", href: "/admin/marina?aba=conhecimento&novo=1", chaves: "ensinar marina nova informacao treinar aprender" },
  { rotulo: "Responder clientes que esperam a equipe", href: "/admin/equipe?aba=chamados", chaves: "responder cliente esperando chamado" },
  { rotulo: "Criar uma oferta ou pacote", href: "/admin/pacotes?novo=1", chaves: "criar oferta pacote promocao novo" },
  { rotulo: "Adicionar um prato ao cardápio", href: "/admin/cardapio", chaves: "adicionar prato cardapio novo item preco" },
  { rotulo: "Mudar o WhatsApp do site", href: "/admin/pousada", chaves: "whatsapp numero telefone botao" },
  { rotulo: "Mudar cores e letras do site", href: "/admin/identidade-visual", chaves: "cor letra fonte visual logo" },
  { rotulo: "Horário de check-in e check-out", href: "/admin/politicas", chaves: "horario checkin checkout entrada saida cafe" },
  { rotulo: "Escolher a quem a Marina pergunta", href: "/admin/equipe?aba=equipe", chaves: "quem responde equipe numero pergunta" },
  { rotulo: "Religar o WhatsApp da Marina", href: "/admin/whatsapp", chaves: "religar conectar qr whatsapp caiu marina fora do ar desconectar", tecnico: true },
  { rotulo: "Conversar com a Marina para testar", href: "/admin/marina?aba=testar", chaves: "testar conversar marina perguntar" },
  { rotulo: "Ver se está tudo funcionando", href: "/admin/diagnostico", chaves: "funcionando erro problema motor sistema", tecnico: true },
  { rotulo: "Abrir o site em outra aba", href: "/", chaves: "ver site abrir publico", externo: true },
  { rotulo: "Sair do painel", href: "/api/auth/signout", chaves: "sair logout desconectar" },
];

export const tirarAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function partes(href: string) {
  const [path, qs = ""] = href.split("?");
  return { path, aba: new URLSearchParams(qs).get("aba") };
}

/**
 * Qual item (e área) corresponde ao endereço atual. A mesma tela pode estar
 * em duas áreas por aba (a Marina tem abas de Atendimento, Marina e
 * Hospedagem): decide a aba.
 */
export function itemAtual(pathname: string, aba: string | null): { area: Area; item: ItemArea } | null {
  let melhor: { area: Area; item: ItemArea; nota: number } | null = null;
  for (const area of AREAS) {
    for (const item of area.itens) {
      const p = partes(item.href);
      let nota = 0;
      if (p.aba) {
        if (pathname !== p.path) continue;
        if (aba === p.aba) nota = 3;
        else if (!aba && item.padrao) nota = 2;
        else continue;
      } else if (pathname === p.path) nota = p.path === "/admin" ? 3 : 2;
      else if (p.path !== "/admin" && pathname.startsWith(p.path + "/")) nota = 1;
      else continue;
      if (!melhor || nota > melhor.nota) melhor = { area, item, nota };
    }
  }
  return melhor ? { area: melhor.area, item: melhor.item } : null;
}

/** O primeiro endereço da área (o que o menu abre). */
export const inicioDaArea = (a: Area, tecnico: boolean) => (a.itens.find((i) => tecnico || !i.tecnico) ?? a.itens[0]).href;
