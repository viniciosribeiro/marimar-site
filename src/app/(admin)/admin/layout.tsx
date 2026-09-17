import Link from "next/link";

const menu = [
  ["/admin", "📊 Painel"],
  ["/admin/quartos", "🛏 Quartos"],
  ["/admin/categorias", "📁 Categorias"],
  ["/admin/midias", "🖼️ Mídias"],
  ["/admin/comodidades", "✅ Comodidades"],
  ["/admin/pacotes", "🎁 Pacotes"],
  ["/admin/passeios", "🧭 Passeios"],
  ["/admin/politicas", "📋 Políticas"],
  ["/admin/faq", "❓ FAQ"],
  ["/admin/depoimentos", "⭐ Depoimentos"],
  ["/admin/leads", "📨 Leads"],
  ["/admin/identidade-visual", "🎨 Visual"],
  ["/admin/integracoes", "🔌 Integrações"],
  ["/admin/diagnostico", "🩺 Diagnóstico"],
  ["/admin/usuarios", "👥 Usuários"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-xl">🏝️</span>
            <span className="font-bold text-gray-800 text-sm">Marimar</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {menu.map(([href, label]) => (
            <Link key={href} href={href}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-4">
          <Link href="/api/auth/signout"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors">
            🚪 Sair
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}