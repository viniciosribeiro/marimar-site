import { AdminNav, type Grupo } from "@/components/admin/AdminNav";

/**
 * Menu agrupado por finalidade. Antes eram 15 itens chapados numa lista
 * unica, sem hierarquia e sem nenhuma versao mobile: a sidebar era w-56
 * fixa dentro de um flex h-screen, entao no celular o painel ficava
 * inutilizavel.
 */
const GRUPOS: Grupo[] = [
  {
    grupo: "Visão geral",
    itens: [{ href: "/admin", label: "Painel", icone: "📊" }],
  },
  {
    grupo: "Acomodações",
    itens: [
      { href: "/admin/quartos", label: "Quartos", icone: "🛏" },
      { href: "/admin/categorias", label: "Categorias", icone: "📁" },
      { href: "/admin/comodidades", label: "Comodidades", icone: "✅" },
      { href: "/admin/midias", label: "Fotos", icone: "🖼" },
    ],
  },
  {
    grupo: "Restaurante",
    itens: [{ href: "/admin/cardapio", label: "Cardápio digital", icone: "🍽" }],
  },
  {
    grupo: "Conteúdo do site",
    itens: [
      { href: "/admin/blocos-home", label: "Blocos da Home", icone: "🧱" },
      { href: "/admin/pacotes", label: "Pacotes", icone: "🎁" },
      { href: "/admin/passeios", label: "Passeios", icone: "🧭" },
      { href: "/admin/depoimentos", label: "Depoimentos", icone: "⭐" },
      { href: "/admin/faq", label: "Perguntas frequentes", icone: "❓" },
      { href: "/admin/politicas", label: "Políticas", icone: "📋" },
    ],
  },
  {
    grupo: "Aparência",
    itens: [{ href: "/admin/identidade-visual", label: "Identidade visual", icone: "🎨" }],
  },
  {
    grupo: "Hóspedes",
    itens: [{ href: "/admin/leads", label: "Contatos recebidos", icone: "📨" }],
  },
  {
    grupo: "Sistema",
    itens: [
      { href: "/admin/integracoes", label: "Integrações", icone: "🔌" },
      { href: "/admin/diagnostico", label: "Diagnóstico", icone: "🩺" },
      { href: "/admin/usuarios", label: "Usuários", icone: "👥" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <AdminNav grupos={GRUPOS} nome="Marimar" />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
