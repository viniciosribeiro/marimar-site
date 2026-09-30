import { AdminNav, type Grupo } from "@/components/admin/AdminNav";
import "./admin.css";

/**
 * Menu agrupado por finalidade. Antes eram 15 itens chapados numa lista
 * unica, sem hierarquia e sem nenhuma versao mobile: a sidebar era w-56
 * fixa dentro de um flex h-screen, entao no celular o painel ficava
 * inutilizavel.
 */
const GRUPOS: Grupo[] = [
  {
    grupo: "Visão geral",
    itens: [
      { href: "/admin", label: "Painel", icone: "painel" },
      { href: "/admin/pousada", label: "Dados da pousada", icone: "pousada" },
    ],
  },
  {
    grupo: "Atendimento",
    itens: [
      { href: "/admin/marina", label: "Marina (atendimento)", icone: "marina" },
      { href: "/admin/leads", label: "Contatos recebidos", icone: "leads" },
    ],
  },
  {
    grupo: "Acomodações",
    itens: [
      { href: "/admin/quartos", label: "Quartos", icone: "quartos" },
      { href: "/admin/categorias", label: "Categorias", icone: "categorias" },
      { href: "/admin/comodidades", label: "Comodidades", icone: "comodidades" },
      { href: "/admin/midias", label: "Fotos e vídeos", icone: "fotos" },
    ],
  },
  {
    grupo: "Restaurante",
    itens: [{ href: "/admin/cardapio", label: "Cardápio digital", icone: "cardapio" }],
  },
  {
    grupo: "Conteúdo do site",
    itens: [
      { href: "/admin/banners", label: "Banners do topo", icone: "banners" },
      { href: "/admin/blocos-home", label: "Blocos da Home", icone: "blocos" },
      { href: "/admin/cartoes", label: "Cartões das seções", icone: "cartoes" },
      { href: "/admin/pacotes", label: "Pacotes", icone: "pacotes" },
      { href: "/admin/passeios", label: "Passeios", icone: "passeios" },
      { href: "/admin/depoimentos", label: "Depoimentos", icone: "depoimentos" },
      { href: "/admin/faq", label: "Perguntas frequentes", icone: "faq" },
      { href: "/admin/politicas", label: "Políticas", icone: "politicas" },
      { href: "/admin/conteudo", label: "Ilha, chegada e eventos", icone: "conteudo" },
      { href: "/admin/atracoes", label: "Atrações da ilha", icone: "atracoes" },
    ],
  },
  {
    grupo: "Aparência",
    itens: [{ href: "/admin/identidade-visual", label: "Identidade visual", icone: "visual" }],
  },
  {
    grupo: "Sistema",
    itens: [
      { href: "/admin/integracoes", label: "Integrações", icone: "integracoes" },
      { href: "/admin/diagnostico", label: "Diagnóstico", icone: "diagnostico" },
      { href: "/admin/usuarios", label: "Usuários", icone: "usuarios" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminNav grupos={GRUPOS} nome="Pousada Marimar">{children}</AdminNav>;
}
