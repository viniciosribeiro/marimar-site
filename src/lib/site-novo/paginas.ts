/**
 * As páginas do site e quais já têm a versão nova (Site → Modelo do site).
 *
 * Fonte única para três coisas:
 *  - cada página só mostra a versão nova se `pronta` (despacho em src/app/(site)/…);
 *  - o painel mostra o progresso ("3 de 15 páginas prontas");
 *  - "Ligar o Novo para todos" só destrava com TODAS prontas (decisão do
 *    Vinicios em 04/11/2026: o visitante nunca vê os dois visuais misturados).
 *
 * Arquivo só de dados: roda no servidor e no navegador (barra de prévia).
 * Plano completo em docs/plano-site-novo.md.
 */
export type PaginaSite = { caminho: string; nome: string; fase: number; pronta: boolean };

export const PAGINAS_SITE: PaginaSite[] = [
  { caminho: "/", nome: "Página inicial", fase: 1, pronta: true },
  { caminho: "/quartos", nome: "Suítes", fase: 2, pronta: true },
  { caminho: "/quartos/[slug]", nome: "Página de cada suíte", fase: 2, pronta: true },
  { caminho: "/reservar", nome: "Busca e reserva", fase: 3, pronta: true },
  { caminho: "/galeria", nome: "Galeria", fase: 4, pronta: true },
  { caminho: "/restaurante", nome: "Restaurante e cardápio", fase: 4, pronta: true },
  { caminho: "/como-chegar", nome: "Como chegar e mapa", fase: 5, pronta: false },
  { caminho: "/ilha-do-mel", nome: "Ilha do Mel", fase: 5, pronta: false },
  { caminho: "/a-pousada", nome: "A pousada", fase: 5, pronta: false },
  { caminho: "/eventos", nome: "Eventos", fase: 5, pronta: false },
  { caminho: "/avaliacoes", nome: "Avaliações", fase: 5, pronta: false },
  { caminho: "/faq", nome: "Perguntas frequentes", fase: 5, pronta: false },
  { caminho: "/politicas", nome: "Políticas", fase: 5, pronta: false },
  { caminho: "/contato", nome: "Contato", fase: 5, pronta: false },
  { caminho: "/pacotes", nome: "Pacotes", fase: 5, pronta: false },
];

/** A página da lista que atende este endereço (`/quartos/suite-queen` → `/quartos/[slug]`). */
export function paginaDoEndereco(pathname: string): PaginaSite | null {
  const limpo = (pathname.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  const exata = PAGINAS_SITE.find((p) => p.caminho === limpo);
  if (exata) return exata;
  if (limpo.startsWith("/quartos/")) return PAGINAS_SITE.find((p) => p.caminho === "/quartos/[slug]") ?? null;
  if (limpo.startsWith("/pacotes/")) return PAGINAS_SITE.find((p) => p.caminho === "/pacotes") ?? null;
  return null;
}

export const paginaPronta = (caminho: string) => PAGINAS_SITE.some((p) => p.caminho === caminho && p.pronta);
export const paginasProntas = () => PAGINAS_SITE.filter((p) => p.pronta);
export const todasProntas = () => PAGINAS_SITE.every((p) => p.pronta);
